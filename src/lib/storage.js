// storage.js — IndexedDB persistence via idb.
//
// Stores (v2):
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

import { openDB } from 'idb'
import { srsKey, nextSrs, rankPracticeQuestions } from './srs.js'

const DB_NAME = 'app-idiomas'
const DB_VERSION = 2

export const DEFAULT_PROFILE = 'default'

let dbPromise = null

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
  const d = await db()
  const created_at = lesson.created_at || Date.now()
  const tx = d.transaction(['lessons', 'questions'], 'readwrite')
  await tx.objectStore('lessons').put({
    lesson_id: lesson.lesson_id,
    title: lesson.title,
    level: lesson.level,
    focus: lesson.focus,
    raw_content: lesson.raw_content,
    count: lesson.questions.length,
    created_at,
  })
  const qStore = tx.objectStore('questions')
  for (const q of lesson.questions) {
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
    })
  }
  await tx.done
  return { ...lesson, created_at }
}

export async function getLesson(lesson_id) {
  const d = await db()
  const lesson = await d.get('lessons', lesson_id)
  if (!lesson) return null
  const questions = await d.getAllFromIndex('questions', 'lesson_id', lesson_id)
  questions.sort((a, b) => a.id - b.id)
  return { ...lesson, questions }
}

export async function getAllLessons() {
  const d = await db()
  const lessons = await d.getAllFromIndex('lessons', 'created_at')
  return lessons.reverse() // newest first
}

export async function deleteLesson(lesson_id) {
  const d = await db()
  const tx = d.transaction(['lessons', 'questions'], 'readwrite')
  await tx.objectStore('lessons').delete(lesson_id)
  const qs = await tx.objectStore('questions').index('lesson_id').getAllKeys(lesson_id)
  for (const k of qs) await tx.objectStore('questions').delete(k)
  await tx.done
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
    if (q) out.push(q)
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
export async function getPracticeQuestions(profile_id, { limit = 12 } = {}) {
  const d = await db()
  const answers = await getAllAnswers(profile_id)
  const top = (await getMistakes(profile_id)).slice(0, 3).map((m) => m.mistake_type)
  const ranked = rankPracticeQuestions({ answers, topMistakeTypes: top, limit })
  const out = []
  for (const r of ranked) {
    const q = await d.get('questions', `${r.lesson_id}:${r.question_id}`)
    if (q) out.push(q)
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
  const stores = ['lessons', 'questions', 'answers', 'mistakes', 'profiles', 'srs', 'settings']
  const tx = d.transaction(stores, 'readwrite')
  for (const name of stores) {
    await tx.objectStore(name).clear()
  }
  await tx.done
}
