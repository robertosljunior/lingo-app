// storage.js — IndexedDB persistence via idb.
//
// Stores (per the spec):
//   lessons   { lesson_id*, title, level, focus, raw_content, created_at }
//   questions { key* (lesson_id:id), lesson_id, id, type, prompt, expected_answer,
//               accepted_answers, mistake_focus, payload }
//   answers   { key* auto, lesson_id, question_id, user_answer, expected_answer,
//               score, is_correct, verdict, mistake_type, feedback, answered_at,
//               session_id }
//   mistakes  { mistake_type*, count, examples, updated_at }
//   settings  { key*, value }

import { openDB } from 'idb'

const DB_NAME = 'app-idiomas'
const DB_VERSION = 1

let dbPromise = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
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
        if (!d.objectStoreNames.contains('mistakes')) {
          d.createObjectStore('mistakes', { keyPath: 'mistake_type' })
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
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
  const rec = { ...answer, answered_at: answer.answered_at || Date.now() }
  const key = await d.add('answers', rec)
  // Roll up recurring mistakes.
  if (!rec.is_correct && rec.mistake_type) {
    await bumpMistake(rec.mistake_type, {
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

export async function getAllAnswers() {
  const d = await db()
  return d.getAll('answers')
}

// ---------- Mistakes rollup ----------
async function bumpMistake(mistake_type, example) {
  const d = await db()
  const tx = d.transaction('mistakes', 'readwrite')
  const store = tx.objectStore('mistakes')
  const existing = (await store.get(mistake_type)) || { mistake_type, count: 0, examples: [] }
  existing.count += 1
  existing.examples = [example, ...existing.examples].slice(0, 5)
  existing.updated_at = Date.now()
  await store.put(existing)
  await tx.done
}

export async function getMistakes() {
  const d = await db()
  const rows = await d.getAll('mistakes')
  return rows.sort((a, b) => b.count - a.count)
}

// ---------- Settings ----------
const SETTINGS_DEFAULTS = {
  level: 'B1',
  question_count: 30,
  focus_preference: 'professional_conversation',
  correction_mode: 'flexible', // flexible | strict
  nlp_library: 'compromise',
  theme: 'system', // system | light | dark
  // audio
  tts_engine: 'system', // system | piper
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
export async function getSessionSummaries() {
  const d = await db()
  const answers = await d.getAll('answers')
  const lessons = await d.getAll('lessons')
  const lessonById = Object.fromEntries(lessons.map((l) => [l.lesson_id, l]))

  const bySession = new Map()
  for (const a of answers) {
    if (!a.session_id) continue
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
  const tx = d.transaction(['lessons', 'questions', 'answers', 'mistakes', 'settings'], 'readwrite')
  for (const name of ['lessons', 'questions', 'answers', 'mistakes', 'settings']) {
    await tx.objectStore(name).clear()
  }
  await tx.done
}
