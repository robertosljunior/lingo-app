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
import { srsKey, nextSrs, rankPracticeQuestions, automaticSrsRating } from './srs.js'
import { buildSkillEvents, aggregateSkillProfile, inferAssessedSkills, rankSkillsForReview, PROFILE_ENGINE_VERSION } from './skill-profile.js'
import { validateGeneratedLesson } from './generated-lesson-validator.js'
import { indexQuestionSkills, buildAdaptivePracticePlan, buildLessonGenerationContext as buildAdaptiveContextPure, QUESTION_SKILL_INDEX_VERSION } from './adaptive-planner.js'
import { BUILTIN_CONTENT_PACKS, getBuiltinContentPack } from './content-pack-loader.js'
import { validateContentPacks } from './content-pack-validator.js'
import { validateLearnerEvidenceBatchV2 } from './pedagogy-v2/learner-evidence-validator.js'
import { aggregateTargetEvidence } from './pedagogy-v2/learner-model.js'
import { learnerTargetStateKey } from './pedagogy-v2/learner-evidence-contracts.js'
import { filterEvidence } from './pedagogy-v2/learner-model-query.js'
import { createRegistryTargetResolver } from './pedagogy-v2/registry.js'

const DB_NAME = 'app-idiomas'
// v5: pedagogy V2 learner-model stores (learner_evidence_v2 +
// learner_target_states_v2). Purely additive — every V1 store is preserved and
// no V1 data is migrated, reinterpreted or reprocessed on boot.
export const DB_VERSION = 5

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
        if (!d.objectStoreNames.contains('content_packs')) {
          const s = d.createObjectStore('content_packs', { keyPath: 'pack_id' })
          s.createIndex('theme', 'theme')
          s.createIndex('level', 'level')
          s.createIndex('enabled', 'enabled')
          s.createIndex('source', 'source')
          s.createIndex('theme_level', ['theme', 'level'])
        }
        if (!d.objectStoreNames.contains('lexical_items')) {
          const s = d.createObjectStore('lexical_items', { keyPath: 'item_id' })
          s.createIndex('pack_id', 'pack_id')
          s.createIndex('theme', 'theme')
          s.createIndex('level', 'level')
          s.createIndex('semantic_type', 'semantic_type')
          s.createIndex('pack_semantic_type', ['pack_id', 'semantic_type'])
        }
        if (!d.objectStoreNames.contains('template_definitions')) {
          const s = d.createObjectStore('template_definitions', { keyPath: 'template_id' })
          s.createIndex('pack_id', 'pack_id')
          s.createIndex('family_id', 'family_id')
          s.createIndex('level', 'level')
          s.createIndex('theme', 'theme')
          s.createIndex('primary_skill_id', 'primary_skill_id')
          s.createIndex('pack_primary_skill', ['pack_id', 'primary_skill_id'])
        }
        if (!d.objectStoreNames.contains('collocations')) {
          const s = d.createObjectStore('collocations', { keyPath: 'collocation_id' })
          s.createIndex('pack_id', 'pack_id')
          s.createIndex('theme', 'theme')
          s.createIndex('level', 'level')
          s.createIndex('canonical', 'canonical')
          s.createIndex('pack_level', ['pack_id', 'level'])
        }
        // v5 — pedagogy V2 learner model (evidence events + derived states).
        // Serialized state key (`profile:target_type:target_id`) follows the
        // repo convention used by srs/skill_profiles.
        if (!d.objectStoreNames.contains('learner_evidence_v2')) {
          const s = d.createObjectStore('learner_evidence_v2', { keyPath: 'evidence_id' })
          s.createIndex('profile_id', 'profile_id')
          s.createIndex('interaction_id', 'interaction_id')
          s.createIndex('occurred_at', 'occurred_at')
          s.createIndex('exemplar_id', 'exemplar_id')
          s.createIndex('target_id', 'target.target_id')
          s.createIndex('target_type', 'target.target_type')
          s.createIndex('profile_target', ['profile_id', 'target.target_id'])
        }
        if (!d.objectStoreNames.contains('learner_target_states_v2')) {
          const s = d.createObjectStore('learner_target_states_v2', { keyPath: 'key' })
          s.createIndex('profile_id', 'profile_id')
          s.createIndex('target_id', 'target.target_id')
          s.createIndex('target_type', 'target.target_type')
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
  await seedBuiltinContentPacks().catch(() => {})
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
  const throwDenied = !!(profile_id && typeof profile_id === 'object')
  if (throwDenied) profile_id = profile_id.profile_id || null
  const d = await db()
  const lesson = await d.get('lessons', lesson_id)
  if (!lesson) return null
  if (!canAccessLesson(lesson, profile_id)) { if (throwDenied) throw LESSON_NOT_ACCESSIBLE; return LESSON_NOT_ACCESSIBLE }
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
  if (profile_id && typeof profile_id === 'object') profile_id = profile_id.profile_id || null
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
export async function updateSrs({ profile_id, lesson_id, question_id, correct, confidence = null, verdict = null, attempt_number = 1, hint_used = false }) {
  const d = await db()
  const key = srsKey(profile_id, lesson_id, question_id)
  const existing = await d.get('srs', key)
  const auto = confidence || automaticSrsRating({ verdict: verdict || (correct ? 'correct' : 'incorrect'), attempt_number, hint_used })
  const next = nextSrs(existing, { correct, confidence: auto })
  await d.put('srs', { key, profile_id, lesson_id, question_id, ...next, srs_rating_source: 'automatic', verdict: verdict || (correct ? 'correct' : 'incorrect'), attempt_number, hint_used })
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
  english_voice_id: 'en_US-hfc_female-medium',
  portuguese_explanation_voice_id: 'pt_BR-fabiola-medium',
  auto_read_explanations: false,
  auto_read_correct_answer: true,
  english_voice_rate: 1,
  portuguese_voice_rate: 1,
  tts_accent: 'en-US',
  tts_voice: '', // '' = auto-pick best voice for the accent
  tts_rate: 0.95,
  tts_autoplay: true, // speak the correct sentence when feedback opens
  // Slice V2.4: experimental "Laboratório V2" pilot. Default OFF — existing
  // users see no behavioral change; a settings default needs no migration.
  pedagogy_v2_pilot_enabled: false,
}

export async function getSettings() {
  const d = await db()
  const rows = await d.getAll('settings')
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const merged = { ...SETTINGS_DEFAULTS, ...map }
  if (!map.english_voice_id && map.piper_voice) merged.english_voice_id = map.piper_voice
  if (!map.english_voice_rate && map.tts_rate) merged.english_voice_rate = map.tts_rate
  return merged
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
  const stores = ['lessons', 'questions', 'answers', 'mistakes', 'profiles', 'srs', 'settings', 'skill_events', 'skill_profiles', 'learner_evidence_v2', 'learner_target_states_v2']
  const tx = d.transaction(stores, 'readwrite')
  for (const name of stores) {
    await tx.objectStore(name).clear()
  }
  await tx.done
}

// ---------- Content packs (v4) ----------
function stableHash(value){ const s=JSON.stringify(value,Object.keys(value).sort()); let h=2166136261; for(const ch of s){h^=ch.charCodeAt(0); h=Math.imul(h,16777619)} return (h>>>0).toString(16).padStart(8,'0') }
function packChecksum(pack){ return stableHash(pack) }
export async function seedBuiltinContentPacks(){
  const validation=validateContentPacks(BUILTIN_CONTENT_PACKS); if(!validation.valid) throw new Error(`CONTENT_PACKS_INVALID:${validation.errors.join(',')}`)
  const d=await db(); const installed=[]; const skipped=[]
  for(const pack of BUILTIN_CONTENT_PACKS){ const m=pack.manifest; const checksum=packChecksum(pack); const existing=await d.get('content_packs',m.pack_id); if(existing?.source && existing.source!=='builtin'){ skipped.push(m.pack_id); continue } if(existing?.version===m.version && existing?.checksum===checksum){ skipped.push(m.pack_id); continue }
    const tx=d.transaction(['content_packs','lexical_items','template_definitions','collocations'],'readwrite')
    for(const storeName of ['lexical_items','template_definitions','collocations']){ const keys=await tx.objectStore(storeName).index('pack_id').getAllKeys(m.pack_id); for(const k of keys) await tx.objectStore(storeName).delete(k) }
    const counts={lexical_items:pack.lexical_items.length,template_definitions:pack.template_definitions.length,collocations:pack.collocations.length}
    await tx.objectStore('content_packs').put({pack_id:m.pack_id,...m,enabled:existing?.enabled ?? m.enabled_by_default,checksum,counts,validation_status:'valid',seeded_at:Date.now()})
    for(const row of pack.lexical_items) await tx.objectStore('lexical_items').put({...row,pack_id:m.pack_id,theme:m.theme,level:m.level})
    for(const row of pack.template_definitions) await tx.objectStore('template_definitions').put({...row,pack_id:m.pack_id,theme:m.theme,level:m.level})
    for(const row of pack.collocations) await tx.objectStore('collocations').put({...row,pack_id:m.pack_id,theme:m.theme,level:m.level})
    await tx.done; installed.push(m.pack_id)
  }
  await setSetting('content_pack_seed_marker',{version:1,pack_count:BUILTIN_CONTENT_PACKS.length,seeded_at:Date.now()})
  return {installed,skipped,total:BUILTIN_CONTENT_PACKS.length}
}
export async function listContentPacks(){ const d=await db(); return (await d.getAll('content_packs')).sort((a,b)=>a.pack_id.localeCompare(b.pack_id)) }
export async function getContentPack(packId){ const d=await db(); return d.get('content_packs',packId) }
export async function getEnabledContentPacks(){ return (await listContentPacks()).filter(p=>p.enabled) }
export async function getContentPacksByThemeAndLevel(theme,level){ const d=await db(); return d.getAllFromIndex('content_packs','theme_level',[theme,level]) }
async function getRows(store, packIds){ const d=await db(); const out=[]; for(const id of packIds) out.push(...await d.getAllFromIndex(store,'pack_id',id)); return out.sort((a,b)=>(a.template_id||a.item_id||a.collocation_id).localeCompare(b.template_id||b.item_id||b.collocation_id)) }
export const getLexicalItemsForPacks=(ids)=>getRows('lexical_items',ids)
export const getTemplatesForPacks=(ids)=>getRows('template_definitions',ids)
export const getCollocationsForPacks=(ids)=>getRows('collocations',ids)
export async function resolveContentSnapshot({theme='workplace',level='B1',packIds=null}={}){ await seedBuiltinContentPacks(); const desired=packIds?.length?packIds:[`core_${level.toLowerCase()}`,`${theme}_${level.toLowerCase()}`]; const packs=[]; for(const id of desired){ const p=await getContentPack(id); if(!p||!p.enabled) continue; for(const dep of p.dependencies||[]){ const dp=await getContentPack(dep); if(dp?.enabled&&!packs.find(x=>x.pack_id===dep)) packs.push(dp) } if(!packs.find(x=>x.pack_id===id)) packs.push(p) } const filtered=packs.filter(p=>p.level===level); const ids=filtered.map(p=>p.pack_id).sort(); const [lexical_items,template_definitions,collocations]=await Promise.all([getLexicalItemsForPacks(ids),getTemplatesForPacks(ids),getCollocationsForPacks(ids)]); const pack_versions=Object.fromEntries(filtered.map(p=>[p.pack_id,p.version])); const checksum=stableHash({ids,pack_versions,lexical_items:lexical_items.map(x=>x.item_id),template_definitions:template_definitions.map(x=>x.template_id),collocations:collocations.map(x=>x.collocation_id)}); return Object.freeze({pack_ids:ids,pack_versions,checksum,lexical_items:Object.freeze(lexical_items),template_definitions:Object.freeze(template_definitions),collocations:Object.freeze(collocations)}) }
export async function enableContentPack(packId){ const d=await db(); const p=await d.get('content_packs',packId); if(!p) return null; await d.put('content_packs',{...p,enabled:true}); return true }
export async function disableContentPack(packId){ const d=await db(); const p=await d.get('content_packs',packId); if(!p) return null; await d.put('content_packs',{...p,enabled:false}); return true }
export async function restoreBuiltinContentPack(packId){ const pack=getBuiltinContentPack(packId); if(!pack) return null; const d=await db(); await d.delete('content_packs',packId); return seedBuiltinContentPacks() }
export function buildImportedLessonId(lesson, policy='yaml_import_v1') { return `import_${String(lesson.level||'b1').toLowerCase()}_${stableHash({source_lesson_id:lesson.lesson_id,raw_content:lesson.raw_content||'',questions:(lesson.questions||[]).map(q=>({t:q.type,p:q.prompt,a:q.expected_answer})),schema:'1',policy}).slice(0,10)}` }
export async function importLessonCopy(lesson){ const source_lesson_id=lesson.lesson_id; const lesson_id=buildImportedLessonId(lesson); const existing=await getLesson(lesson_id,null); if(existing) return existing; return saveLesson({...lesson,lesson_id,source_lesson_id,imported:true,owner_profile_id:null,generated:false,questions:lesson.questions.map(q=>({...q,owner_profile_id:null})),generation_metadata:null}) }

// ---------- Slice 6 training hub preferences/progress ----------
export async function getTrainingPreferences(profile_id = DEFAULT_PROFILE) {
  return (await db().then(d => d.get('settings', `training_preferences:${profile_id}`)))?.value || { preferred_theme: null, preferred_level: null, last_training_mode: null }
}
export async function setTrainingPreferences(profile_id = DEFAULT_PROFILE, patch = {}) {
  const current = await getTrainingPreferences(profile_id)
  const next = { ...current, ...patch }
  await setSetting(`training_preferences:${profile_id}`, next)
  return next
}
export async function getTrainingHubSummary(profile_id = DEFAULT_PROFILE) {
  await seedBuiltinContentPacks().catch(() => {})
  const [packs, answers, skillProfiles, prefs] = await Promise.all([listContentPacks(), getAllAnswers(profile_id), getSkillProfiles(profile_id), getTrainingPreferences(profile_id)])
  const themes = packs.filter(p => p.theme !== 'core').reduce((m, p) => {
    const row = m.get(p.theme) || { theme: p.theme, title: p.title, description: p.description, levels: [], packs: [], question_count: 0, last_activity: null, enabled_levels: [] }
    row.packs.push(p); if (!row.levels.includes(p.level)) row.levels.push(p.level); if (p.enabled && !row.enabled_levels.includes(p.level)) row.enabled_levels.push(p.level)
    m.set(p.theme, row); return m
  }, new Map())
  for (const a of answers) {
    const meta = a.evaluation?.content || a.question?.metadata || {}
    const ids = a.evaluation?.content_pack_ids || a.evaluation?.generation_metadata?.content_pack_ids || []
    for (const t of themes.keys()) if (ids.some(id => id.startsWith(`${t}_`)) || meta.theme === t) { const row = themes.get(t); row.question_count++; row.last_activity = Math.max(row.last_activity || 0, a.answered_at || 0) }
  }
  return { profile_id, preferences: prefs, themes: [...themes.values()].map(t => ({ ...t, levels: t.levels.sort(), enabled_levels: t.enabled_levels.sort() })), priority_skills: skillProfiles.slice(0, 6) }
}
// ---------- Pedagogy V2 learner model (v5) ----------
// storage.js only COORDINATES persistence here; validation lives in
// learner-evidence-validator.js and all pedagogical math in learner-model.js.
// Not wired to any UI/exercise/submitAnswer flow in this slice.

// Slice V2.5: targets resolve against the validated multi-pack registry —
// evidence for ANY registered pack (still, but, …) is accepted; unknown targets
// keep being rejected.
let _v2TargetResolver = null
function defaultV2TargetResolver() {
  if (!_v2TargetResolver) _v2TargetResolver = createRegistryTargetResolver()
  return _v2TargetResolver
}

async function evidenceForTargetTx(tx, profile_id, target) {
  const rows = await tx.objectStore('learner_evidence_v2').index('profile_target').getAll([profile_id, target.target_id])
  return rows.filter((e) => e.target?.target_type === target.target_type)
}

/**
 * Atomically record a batch of evidence events and refresh the affected target
 * states. ALL events are validated up front — an invalid batch writes nothing.
 * Re-recording an existing evidence_id is an idempotent no-op (its influence is
 * never duplicated). Several events may share one interaction_id and hit
 * different targets.
 */
export async function recordLearnerEvidenceBatchV2(events, opts = {}) {
  const resolveTarget = opts.targetResolver ?? defaultV2TargetResolver()
  const validation = validateLearnerEvidenceBatchV2(events, { resolveTarget })
  if (!validation.valid) throw new Error(`LEARNER_EVIDENCE_INVALID:${validation.errors.join(',')}`)
  const d = await db()
  const tx = d.transaction(['learner_evidence_v2', 'learner_target_states_v2'], 'readwrite')
  const evidenceStore = tx.objectStore('learner_evidence_v2')
  const stateStore = tx.objectStore('learner_target_states_v2')
  const recorded = []
  const skipped = []
  const affected = new Map() // state key → { profile_id, target }
  for (const event of events) {
    const existing = await evidenceStore.get(event.evidence_id)
    if (existing) skipped.push(event.evidence_id)
    else { await evidenceStore.put(event); recorded.push(event.evidence_id) }
    affected.set(learnerTargetStateKey(event.profile_id, event.target), { profile_id: event.profile_id, target: { ...event.target } })
  }
  const stateKeys = []
  for (const { profile_id, target } of affected.values()) {
    const rows = await evidenceForTargetTx(tx, profile_id, target)
    const state = aggregateTargetEvidence(rows, { profile_id, target })
    await stateStore.put(state)
    stateKeys.push(state.key)
  }
  await tx.done
  return { recorded, skipped, state_keys: stateKeys.sort() }
}

/** Record a single evidence event (thin wrapper over the batch API). */
export async function recordLearnerEvidenceV2(event, opts = {}) {
  const result = await recordLearnerEvidenceBatchV2([event], opts)
  return { recorded: result.recorded.length === 1, state_key: result.state_keys[0] }
}

export async function getLearnerEvidenceV2(profile_id, filters = {}) {
  const d = await db()
  const rows = await d.getAllFromIndex('learner_evidence_v2', 'profile_id', profile_id)
  return filterEvidence(rows, filters)
}

export async function getLearnerTargetStateV2(profile_id, target) {
  const d = await db()
  return (await d.get('learner_target_states_v2', learnerTargetStateKey(profile_id, target))) || null
}

export async function getLearnerTargetStatesV2(profile_id, { targetType = null } = {}) {
  const d = await db()
  const rows = await d.getAllFromIndex('learner_target_states_v2', 'profile_id', profile_id)
  return rows.filter((s) => !targetType || s.target?.target_type === targetType).sort((a, b) => (a.key < b.key ? -1 : 1))
}

/** Rebuild one target state from its stored events. Deletes the state when no
 * evidence remains (a state is strictly derived data). */
export async function rebuildLearnerTargetStateV2(profile_id, target) {
  const d = await db()
  const tx = d.transaction(['learner_evidence_v2', 'learner_target_states_v2'], 'readwrite')
  const rows = await evidenceForTargetTx(tx, profile_id, target)
  const key = learnerTargetStateKey(profile_id, target)
  if (!rows.length) { await tx.objectStore('learner_target_states_v2').delete(key); await tx.done; return null }
  const state = aggregateTargetEvidence(rows, { profile_id, target })
  await tx.objectStore('learner_target_states_v2').put(state)
  await tx.done
  return state
}

/** Rebuild every target state of a profile from evidence, dropping stale ones. */
export async function rebuildLearnerTargetStatesV2(profile_id) {
  const d = await db()
  const tx = d.transaction(['learner_evidence_v2', 'learner_target_states_v2'], 'readwrite')
  const stateStore = tx.objectStore('learner_target_states_v2')
  const oldKeys = await stateStore.index('profile_id').getAllKeys(profile_id)
  for (const k of oldKeys) await stateStore.delete(k)
  const events = await tx.objectStore('learner_evidence_v2').index('profile_id').getAll(profile_id)
  const groups = new Map()
  for (const e of events) {
    const key = learnerTargetStateKey(profile_id, e.target)
    if (!groups.has(key)) groups.set(key, { target: { ...e.target }, events: [] })
    groups.get(key).events.push(e)
  }
  const states = []
  for (const { target, events: rows } of groups.values()) {
    const state = aggregateTargetEvidence(rows, { profile_id, target })
    await stateStore.put(state)
    states.push(state)
  }
  await tx.done
  return states.sort((a, b) => (a.key < b.key ? -1 : 1))
}

export async function getThemeLevelProgress(profile_id = DEFAULT_PROFILE, theme, level) {
  const [packs, answers, templates] = await Promise.all([listContentPacks(), getAllAnswers(profile_id), getTemplatesForPacks([`core_${String(level).toLowerCase()}`, `${theme}_${String(level).toLowerCase()}`])])
  const relevantPacks = packs.filter(p => (p.theme === theme || p.theme === 'core') && p.level === level)
  const themePack = relevantPacks.find(p => p.theme === theme)
  const ids = relevantPacks.filter(p => p.enabled).map(p => p.pack_id)
  const practiced = answers.filter(a => (a.evaluation?.content_pack_ids || a.evaluation?.generation_metadata?.content_pack_ids || []).some(id => ids.includes(id)))
  const last = practiced.reduce((m, a) => Math.max(m, a.answered_at || 0), 0)
  const skills = [...new Set(templates.map(t => t.primary_skill_id).filter(Boolean))].slice(0, 5)
  return { profile_id, theme, level, available: !!themePack?.enabled, disabled_reason: themePack && !themePack.enabled ? 'Pacote deste tema desabilitado nas configurações.' : null, pack_count: relevantPacks.length, template_count: templates.length, question_count: practiced.length, last_activity: last || null, evidence: practiced.length ? 'answers' : 'insufficient', status: practiced.length ? 'Em andamento' : 'Ainda sem dados suficientes', skills }
}
