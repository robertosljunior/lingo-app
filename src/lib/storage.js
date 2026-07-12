// storage.js — IndexedDB persistence via idb.
//
// Stores (v3, compatible with generated lesson owner metadata):
//   lessons   { lesson_id*, title, level, focus, raw_content, created_at }
//   questions { key* (lesson_id:id), lesson_id, id, type, prompt, expected_answer,
//               accepted_answers, skill_target, mistake_focus (legacy), payload }
//   answers   { key* auto, profile_id, lesson_id, question_id, user_answer,
//               expected_answer, score, is_correct, verdict, mistake_type,
//               feedback, evaluation, answered_at, session_id, spoken_transcript?,
//               pronunciation_score? }
//   mistakes  { key* (profile:mistake_type), profile_id, mistake_type, count,
//               examples, updated_at }
//   profiles  { profile_id*, name, created_at }
//   srs       { key* (profile:lesson:question), profile_id, lesson_id,
//               question_id, box, due_at, last_result, updated_at }
//   settings  { key*, value }
//   skill_events   { key* (profile:answer:skill), profile_id, answer_id, skill_id, outcome, effective_weight }
//   skill_profiles { key* (profile:skill), profile_id, skill_id, mastery, aggregates }
//   adaptive_sessions stored compactly in settings: adaptive_session:<profile_id>

import { openDB } from 'idb'
import { srsKey, nextSrs, rankPracticeQuestions } from './srs.js'
import { buildSkillEvents, aggregateSkillProfile, inferAssessedSkills, rankSkillsForReview, PROFILE_ENGINE_VERSION } from './skill-profile.js'
import { validateGeneratedLesson } from './generated-lesson-validator.js'
import { indexQuestionSkills, buildAdaptivePracticePlan, buildLessonGenerationContext as buildAdaptiveContextPure, QUESTION_SKILL_INDEX_VERSION } from './adaptive-planner.js'

const DB_NAME = 'app-idiomas'
export const DB_VERSION = 3

export const DEFAULT_PROFILE = 'default'

let dbPromise = null

export const LESSON_NOT_ACCESSIBLE = { code: 'LESSON_NOT_ACCESSIBLE' }
function canAccessLesson(lesson, profile_id = null) {
  return !!lesson && (!lesson.owner_profile_id || !profile_id || lesson.owner_profile_id === profile_id)
}
export function isLessonAccessDenied(result) { return result?.code === 'LESSON_NOT_ACCESSIBLE' }
export async function __resetDbForTests() { if (dbPromise) { try { (await dbPromise).close() } catch {} } dbPromise = null }

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d, oldVersion) {
        if (!d.objectStoreNames.contains('lessons')) {
          d.createObjectStore('lessons', { keyPath: 'lesson_id' })
            .createIndex('created_at', 'created_at')
        }
        if (!d.objectStoreNames.contains('questions')) {
          const s = d.createObjectStore('questions', { keyPath: 'key' })
          s.createIndex('lesson_id', 'lesson_id')
        }
        if (!d.objectStoreNames.contains('answers')) {
          const s = d.createObjectStore('answers', { keyPath: 'key', autoIncrement: true })
          s.createIndex('lesson_id', 'lesson_id')
          s.createIndex('session_id', 'session_id')
          s.createIndex('mistake_type', 'mistake_type')
        }
        // v2: the mistakes rollup became per-profile (key = profile:mistake_type).
        // The old global store is dropped and rebuilt from `answers` on boot.
        if (oldVersion > 0 && oldVersion < 2 && d.objectStoreNames.contains('mistakes')) {
          d.deleteObjectStore('mistakes')
        }
        if (!d.objectStoreNames.contains('mistakes')) {
          const s = d.createObjectStore('mistakes', { keyPath: 'key' })
          s.createIndex('profile_id', 'profile_id')
        }
        if (!d.objectStoreNames.contains('profiles')) {
          d.createObjectStore('profiles', { keyPath: 'profile_id' })
        }
        if (!d.objectStoreNames.contains('srs')) {
          const s = d.createObjectStore('srs', { keyPath: 'key' })
          s.createIndex('profile_id', 'profile_id')
          s.createIndex('due_at', 'due_at')
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' })
        }
        if (!d.objectStoreNames.contains('skill_events')) {
          const s = d.createObjectStore('skill_events', { keyPath: 'key' })
          s.createIndex('profile_id', 'profile_id')
          s.createIndex('answer_id', 'answer_id')
          s.createIndex('profile_skill', ['profile_id', 'skill_id'])
        }
        if (!d.objectStoreNames.contains('skill_profiles')) {
          const s = d.createObjectStore('skill_profiles', { keyPath: 'key' })
          s.createIndex('profile_id', 'profile_id')
          s.createIndex('skill_id', 'skill_id')
        }
      },
    })
  }
  return dbPromise
}

// ---------- Profiles ----------
export async function getProfiles() {
  const d = await db()
  const rows = await d.getAll('profiles')
  return rows.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
}

export async function saveProfile({ profile_id, name }) {
  const d = await db()
  const id = profile_id || `p_${Date.now().toString(36)}`
  const existing = await d.get('profiles', id)
  await d.put('profiles', { profile_id: id, name, created_at: existing?.created_at || Date.now() })
  return id
}

export async function deleteProfile(profile_id) {
  const d = await db()
  await d.delete('profiles', profile_id)
  // The profile's answers/rollups stay in place (harmless, recoverable by
  // recreating a profile with the same id).
}

// One-time boot fixup: guarantee the default profile exists, stamp legacy
// answers with it, and rebuild the mistakes rollup after the v2 migration.
export async function ensureBootstrapped() {
  const d = await db()
  if (!(await d.get('profiles', DEFAULT_PROFILE))) {
    const legacy = await d.count('answers')
    // Only auto-create when the app was already in use or no profile exists.
    const anyProfile = (await d.count('profiles')) > 0
    if (legacy > 0 || !anyProfile) {
      await d.put('profiles', { profile_id: DEFAULT_PROFILE, name: 'Você', created_at: Date.now() })
    }
  }
  const mistakesEmpty = (await d.count('mistakes')) === 0
  const answers = await d.getAll('answers')
  if (mistakesEmpty && answers.length > 0) {
    for (const a of answers) {
      if (!a.is_correct && a.mistake_type) {
        await bumpMistake(a.profile_id || DEFAULT_PROFILE, a.mistake_type, {
          user: a.user_answer, expected: a.expected_answer, lesson_id: a.lesson_id,
        })
      }
    }
  }
}

// ---------- Lessons ----------
export async function saveLesson(lesson) {
  if (!lesson?.lesson_id || !Array.isArray(lesson.questions) || lesson.questions.length === 0) throw new Error('LESSON_INVALID')
  if (lesson.generated) {
    const validation = validateGeneratedLesson(lesson, { expectedCount: lesson.generation_metadata?.requested_questions || null })
    if (!validation.valid) throw new Error(`LESSON_VALIDATION_FAILED:${validation.errors.join(',')}`)
  }
  const owner = lesson.owner_profile_id || lesson.generation_metadata?.profile_id || null
  const seenIds = new Set()
  for (const q of lesson.questions) {
    if (seenIds.has(String(q.id))) throw new Error('QUESTION_ID_DUPLICATE')
    seenIds.add(String(q.id))
    const qOwner = q.owner_profile_id || owner
    if ((owner || q.owner_profile_id) && qOwner !== owner) throw new Error('QUESTION_OWNER_MISMATCH')
    if (lesson.generated && (!q.metadata?.template_id || !q.metadata?.family_id || !q.metadata?.question_signature || !q.metadata?.generator_version)) throw new Error('QUESTION_GENERATION_METADATA_REQUIRED')
  }
  const d = await db()
  const created_at = lesson.created_at || Date.now()
  const tx = d.transaction(['lessons', 'questions'], 'readwrite')
  const lessonStore = tx.objectStore('lessons')
  const qStore = tx.objectStore('questions')
  const existing = await lessonStore.get(lesson.lesson_id)
  if (existing?.owner_profile_id && owner && existing.owner_profile_id !== owner) throw new Error('LESSON_ID_COLLISION')
  const oldKeys = await qStore.index('lesson_id').getAllKeys(lesson.lesson_id)
  for (const k of oldKeys) await qStore.delete(k)
  await lessonStore.put({
    lesson_id: lesson.lesson_id,
    title: lesson.title,
    level: lesson.level,
    focus: lesson.focus,
    raw_content: lesson.raw_content,
    count: lesson.questions.length,
    created_at: existing?.created_at || created_at,
    generated: !!lesson.generated,
    owner_profile_id: owner,
    generation_metadata: lesson.generation_metadata || null,
  })
  for (const q of lesson.questions) {
    const skill_index = indexQuestionSkills({ ...q, lesson_id: lesson.lesson_id }, lesson)
    await qStore.put({
      key: `${lesson.lesson_id}:${q.id}`,
      lesson_id: lesson.lesson_id,
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      prompt_pt: q.prompt_pt,
      context: q.context,
      original: q.original,
      expected_answer: q.expected_answer,
      accepted_answers: q.accepted_answers,
      options: q.options,
      words: q.words,
      skill_target: q.skill_target || q.lesson_focus || q.mistake_focus || null,
      lesson_focus: q.lesson_focus || q.skill_target || q.mistake_focus || null,
      mistake_focus: q.mistake_focus,
      payload: q.payload,
      metadata: q.metadata || q.payload?.metadata || null,
      generated: !!lesson.generated,
      generator_version: q.metadata?.generator_version || lesson.generation_metadata?.generator_version || null,
      owner_profile_id: owner,
      skill_index,
    })
  }
  await tx.done
  return { ...lesson, created_at: existing?.created_at || created_at, owner_profile_id: owner }
}

export async function getLesson(lesson_id, profile_id = null) {
  const d = await db()
  const lesson = await d.get('lessons', lesson_id)
  if (!lesson) return null
  if (!canAccessLesson(lesson, profile_id)) return LESSON_NOT_ACCESSIBLE
  const questions = await d.getAllFromIndex('questions', 'lesson_id', lesson_id)
  questions.sort((a, b) => a.id - b.id)
  return { ...lesson, questions }
}

export async function getQuestion(lesson_id, question_id, profile_id = null) {
  const lesson = await getLesson(lesson_id, profile_id)
  if (isLessonAccessDenied(lesson)) return LESSON_NOT_ACCESSIBLE
  if (!lesson) return null
  return lesson.questions.find((q) => String(q.id) === String(question_id)) || null
}

export async function getLessonQuestions(lesson_id, profile_id = null) {
  const lesson = await getLesson(lesson_id, profile_id)
  if (isLessonAccessDenied(lesson)) return LESSON_NOT_ACCESSIBLE
  return lesson?.questions || []
}

export async function getAllQuestions(profile_id = null) {
  const d = await db()
  const rows = await d.getAll('questions')
  const lessons = Object.fromEntries((await d.getAll('lessons')).map((l) => [l.lesson_id, l]))
  const scoped = profile_id ? rows.filter((q) => canAccessLesson(lessons[q.lesson_id] || q, profile_id) && (!q.owner_profile_id || q.owner_profile_id === profile_id)) : rows
  return scoped.map((q) => q.skill_index?.question_index_version === QUESTION_SKILL_INDEX_VERSION ? q : { ...q, skill_index: indexQuestionSkills(q, q) })
}

export async function getAllLessons(profile_id = null) {
  const d = await db()
  const lessons = await d.getAllFromIndex('lessons', 'created_at')
  return lessons.filter((l) => canAccessLesson(l, profile_id)).reverse()
}

export async function deleteLesson(lesson_id, profile_id = null) {
  const d = await db()
  const lesson = await d.get('lessons', lesson_id)
  if (!lesson) return null
  if (!canAccessLesson(lesson, profile_id)) return LESSON_NOT_ACCESSIBLE
  const tx = d.transaction(['lessons', 'questions'], 'readwrite')
  await tx.objectStore('lessons').delete(lesson_id)
  const qs = await tx.objectStore('questions').index('lesson_id').getAllKeys(lesson_id)
  for (const k of qs) await tx.objectStore('questions').delete(k)
  await tx.done
  return true
}

// ---------- Answers ----------
export async function saveAnswer(answer) {
  const d = await db()
  const rec = {
    ...answer,
    profile_id: answer.profile_id || DEFAULT_PROFILE,
    answered_at: answer.answered_at || Date.now(),
  }
  const key = await d.add('answers', rec)
  await recordSkillEventsForAnswer({ ...rec, key }, key)
  // Roll up recurring mistakes.
  if (!rec.is_correct && rec.mistake_type) {
    await bumpMistake(rec.profile_id, rec.mistake_type, {
      user: rec.user_answer,
      expected: rec.expected_answer,
      lesson_id: rec.lesson_id,
    })
  }
  return key
}

// Patch an existing answer (e.g. the user's self-rated confidence).
export async function updateAnswer(key, patch) {
  const d = await db()
  const rec = await d.get('answers', key)
  if (!rec) return null
  const next = { ...rec, ...patch }
  await d.put('answers', next)
  return next
}

export async function getAnswersForSession(session_id) {
  const d = await db()
  const rows = await d.getAllFromIndex('answers', 'session_id', session_id)
  return rows.sort((a, b) => a.answered_at - b.answered_at)
}

export async function getAllAnswers(profile_id = null) {
  const d = await db()
  const rows = await d.getAll('answers')
  if (!profile_id) return rows
  return rows.filter((a) => (a.profile_id || DEFAULT_PROFILE) === profile_id)
}

// ---------- Mistakes rollup (per profile) ----------
async function bumpMistake(profile_id, mistake_type, example) {
  const d = await db()
  const key = `${profile_id}:${mistake_type}`
  const tx = d.transaction('mistakes', 'readwrite')
  const store = tx.objectStore('mistakes')
  const existing = (await store.get(key)) || { key, profile_id, mistake_type, count: 0, examples: [] }
  existing.count += 1
  existing.examples = [example, ...existing.examples].slice(0, 5)
  existing.updated_at = Date.now()
  await store.put(existing)
  await tx.done
}

export async function getMistakes(profile_id = DEFAULT_PROFILE) {
  const d = await db()
  const rows = await d.getAllFromIndex('mistakes', 'profile_id', profile_id)
  return rows.sort((a, b) => b.count - a.count)
}

// ---------- Granular skill profiles (v3) ----------
export async function recordSkillEventsForAnswer(answer, answer_id = answer.key) {
  if (!answer?.evaluation || String(answer.evaluation.engine_version || '') < '2') return []
  const d = await db()
  const profile_id = answer.profile_id || DEFAULT_PROFILE
  const rows = answer.session_id ? await d.getAllFromIndex('answers', 'session_id', answer.session_id) : await d.getAll('answers')
  const prior = rows.filter((a) => (a.profile_id || DEFAULT_PROFILE) === profile_id
    && a.session_id === answer.session_id
    && a.lesson_id === answer.lesson_id
    && String(a.question_id) === String(answer.question_id)
    && (a.key == null || a.key <= answer_id))
  const attempt_number = Math.max(1, prior.length || 1)
  const assessed_skills = answer.evaluation.assessed_skills?.length
    ? answer.evaluation.assessed_skills
    : inferAssessedSkills({ evaluation: answer.evaluation, question: answer.question || {}, user_answer: answer.user_answer, expected_answer: answer.expected_answer })
  const events = buildSkillEvents({ answer: { ...answer, profile_id, evaluation: { ...answer.evaluation, assessed_skills } }, answer_id, assessed_skills, attempt_number, created_at: answer.answered_at || Date.now() })
  if (!events.length) return []
  const tx = d.transaction(['skill_events', 'skill_profiles'], 'readwrite')
  const eventStore = tx.objectStore('skill_events')
  const profileStore = tx.objectStore('skill_profiles')
  for (const e of events) await eventStore.put(e)
  for (const skill_id of [...new Set(events.map((e) => e.skill_id))]) {
    const skillEvents = await eventStore.index('profile_skill').getAll([profile_id, skill_id])
    await profileStore.put(aggregateSkillProfile(skillEvents, { profile_id, skill_id }))
  }
  await tx.done
  return events
}

export async function getSkillProfiles(profile_id = DEFAULT_PROFILE) {
  const d = await db()
  const rows = await d.getAllFromIndex('skill_profiles', 'profile_id', profile_id)
  return rankSkillsForReview(rows)
}

export async function rebuildSkillProfilesFromEvaluations(profile_id = DEFAULT_PROFILE) {
  const d = await db()
  const answers = (await d.getAll('answers')).filter((a) => (a.profile_id || DEFAULT_PROFILE) === profile_id && String(a.evaluation?.engine_version || '') >= '2')
  const tx = d.transaction(['skill_events', 'skill_profiles'], 'readwrite')
  const eventStore = tx.objectStore('skill_events')
  const profileStore = tx.objectStore('skill_profiles')
  const oldEvents = await eventStore.index('profile_id').getAllKeys(profile_id)
  for (const k of oldEvents) await eventStore.delete(k)
  const oldProfiles = await profileStore.index('profile_id').getAllKeys(profile_id)
  for (const k of oldProfiles) await profileStore.delete(k)
  await tx.done
  const sorted = answers.sort((a, b) => (a.answered_at || 0) - (b.answered_at || 0))
  for (const a of sorted) await recordSkillEventsForAnswer(a, a.key)
  await setSetting(`skill_profile_rebuild_version:${profile_id}`, PROFILE_ENGINE_VERSION)
  return getSkillProfiles(profile_id)
}

// ---------- SRS (spaced repetition) ----------
// Record the outcome of an answered question into the Leitner schedule.
export async function updateSrs({ profile_id, lesson_id, question_id, correct, confidence = null }) {
  const d = await db()
  const key = srsKey(profile_id, lesson_id, question_id)
  const existing = await d.get('srs', key)
  const next = nextSrs(existing, { correct, confidence })
  await d.put('srs', { key, profile_id, lesson_id, question_id, ...next })
}

// Patch the schedule after the student self-rates the answer ("fácil" bumps
// the box one further).
export async function bumpSrsConfidence({ profile_id, lesson_id, question_id, confidence }) {
  if (confidence !== 'easy') return
  const d = await db()
  const key = srsKey(profile_id, lesson_id, question_id)
  const existing = await d.get('srs', key)
  if (!existing || existing.last_result !== 'correct') return
  const next = nextSrs({ box: existing.box - 1 }, { correct: true, confidence: 'easy', now: existing.updated_at })
  await d.put('srs', { ...existing, ...next })
}

// Questions due for review, hydrated from the questions store.
export async function getDueReviews(profile_id, { now = Date.now(), limit = 15 } = {}) {
  const d = await db()
  const rows = await d.getAllFromIndex('srs', 'profile_id', profile_id)
  const due = rows.filter((r) => r.due_at <= now).sort((a, b) => a.due_at - b.due_at).slice(0, limit)
  const out = []
  for (const r of due) {
    const q = await d.get('questions', `${r.lesson_id}:${r.question_id}`)
    if (q && (!q.owner_profile_id || q.owner_profile_id === profile_id)) out.push(q)
  }
  return out
}

export async function countDueReviews(profile_id, now = Date.now()) {
  const d = await db()
  const rows = await d.getAllFromIndex('srs', 'profile_id', profile_id)
  return rows.filter((r) => r.due_at <= now).length
}

// Difficulty-driven practice: the questions this profile misses the most,
// weighted toward its top recurring mistake types.
export async function getAdaptivePracticePlan(profile_id = DEFAULT_PROFILE, { requestedSize = 10, seed = null, targetSkillId = null, now = Date.now() } = {}) {
  const d = await db()
  const [questions, answers, skillProfiles, srsRows, settings] = await Promise.all([
    getAllQuestions(profile_id), getAllAnswers(profile_id), getSkillProfiles(profile_id), d.getAllFromIndex('srs', 'profile_id', profile_id), getSettings(),
  ])
  return buildAdaptivePracticePlan({ profile: { profile_id, level: settings.level }, skillProfiles, questions, answerHistory: answers, srsState: srsRows, requestedSize, seed, targetSkillId, now })
}

export async function persistAdaptiveSession(profile_id, session) {
  await setSetting(`adaptive_session:${profile_id}`, session)
}

export async function getPersistedAdaptiveSession(profile_id = DEFAULT_PROFILE) {
  const d = await db()
  return (await d.get('settings', `adaptive_session:${profile_id}`))?.value || null
}

export async function buildLessonGenerationContext(profile_id = DEFAULT_PROFILE) {
  const [settings, skillProfiles, answers, questions] = await Promise.all([getSettings(), getSkillProfiles(profile_id), getAllAnswers(profile_id), getAllQuestions(profile_id)])
  return buildAdaptiveContextPure({ profileId: profile_id, skillProfiles, answers, questions, level: settings.level })
}

export async function getPracticeQuestions(profile_id, { limit = 12 } = {}) {
  const d = await db()
  const answers = await getAllAnswers(profile_id)
  const top = (await getMistakes(profile_id)).slice(0, 3).map((m) => m.mistake_type)
  const ranked = rankPracticeQuestions({ answers, topMistakeTypes: top, limit })
  const out = []
  for (const r of ranked) {
    const q = await d.get('questions', `${r.lesson_id}:${r.question_id}`)
    if (q && (!q.owner_profile_id || q.owner_profile_id === profile_id)) out.push(q)
  }
  return out
}

// ---------- Settings ----------
const SETTINGS_DEFAULTS = {
  level: 'B1',
  question_count: 30,
  focus_preference: 'professional_conversation',
  correction_mode: 'flexible', // flexible | strict
  nlp_library: 'compromise',
  theme: 'system', // system | light | dark
  active_profile: DEFAULT_PROFILE,
  // audio
  tts_engine: 'system', // system | piper
  piper_voice: 'en_US-hfc_female-medium',
  tts_accent: 'en-US',
  tts_voice: '', // '' = auto-pick best voice for the accent
  tts_rate: 0.95,
  tts_autoplay: true, // speak the correct sentence when feedback opens
}

export async function getSettings() {
  const d = await db()
  const rows = await d.getAll('settings')
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...SETTINGS_DEFAULTS, ...map }
}

export async function setSetting(key, value) {
  const d = await db()
  await d.put('settings', { key, value })
}

// ---------- Stats for history / home ----------
export async function getSessionSummaries(profile_id = null) {
  const d = await db()
  const answers = await d.getAll('answers')
  const lessons = await d.getAll('lessons')
  const lessonById = Object.fromEntries(lessons.map((l) => [l.lesson_id, l]))

  const bySession = new Map()
  for (const a of answers) {
    if (!a.session_id) continue
    if (profile_id && (a.profile_id || DEFAULT_PROFILE) !== profile_id) continue
    if (!bySession.has(a.session_id)) bySession.set(a.session_id, [])
    bySession.get(a.session_id).push(a)
  }
  const out = []
  for (const [session_id, rows] of bySession) {
    const total = rows.length
    const correct = rows.filter((r) => r.verdict === 'correct').length
    const partial = rows.filter((r) => r.verdict === 'partial').length
    const score = Math.round(((correct + partial * 0.5) / total) * 100)
    const first = rows[0]
    const lesson = lessonById[first.lesson_id] || {}
    out.push({
      session_id,
      lesson_id: first.lesson_id,
      focus: lesson.focus || 'general',
      level: lesson.level || 'B1',
      total, correct, partial, score,
      answered_at: Math.max(...rows.map((r) => r.answered_at)),
    })
  }
  return out.sort((a, b) => b.answered_at - a.answered_at)
}

export async function wipeAll() {
  const d = await db()
  const stores = ['lessons', 'questions', 'answers', 'mistakes', 'profiles', 'srs', 'settings', 'skill_events', 'skill_profiles']
  const tx = d.transaction(stores, 'readwrite')
  for (const name of stores) {
    await tx.objectStore(name).clear()
  }
  await tx.done
}
