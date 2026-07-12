// srs.js — Leitner-box spaced repetition over the `srs` store, plus the
// difficulty-driven practice selector ("treino dirigido").
//
// Boxes 1..5. A correct answer promotes one box (two when self-rated easy),
// a wrong answer demotes back to box 1. Each box maps to a review interval:
//   box:      1     2     3     4     5
//   interval: 1d    2d    4d    8d    16d
// Questions never answered are not scheduled — the SRS only tracks what the
// student has actually seen.

const DAY = 86400000
export const BOX_INTERVALS = { 1: 1 * DAY, 2: 2 * DAY, 3: 4 * DAY, 4: 8 * DAY, 5: 16 * DAY }
const MAX_BOX = 5

export function srsKey(profile_id, lesson_id, question_id) {
  return `${profile_id}:${lesson_id}:${question_id}`
}

// Deterministic automatic rating policy:
// incorrect -> again, partial -> hard, correct after retry/hint -> hard,
// correct on the first attempt -> good. Easy is never assigned automatically.
export function automaticSrsRating({ verdict, attempt_number = 1, hint_used = false } = {}) {
  if (verdict === 'correct' && attempt_number <= 1 && !hint_used) return 'good'
  if (verdict === 'correct' || verdict === 'partial') return 'hard'
  return 'again'
}

// Compute the next SRS record after an answer.
export function nextSrs(existing, { correct, confidence = null, now = Date.now() }) {
  const cur = existing?.box || 0
  let box
  if (!correct) box = 1
  else box = Math.min(MAX_BOX, cur + (confidence === 'easy' ? 2 : 1))
  return {
    box,
    due_at: now + BOX_INTERVALS[box],
    last_result: correct ? 'correct' : 'wrong',
    srs_rating: confidence || (correct ? 'good' : 'again'),
    updated_at: now,
  }
}

// Rank a student's already-answered questions by how much they need practice:
// how often it was missed, whether its mistake type is among the profile's
// top recurring ones, and how recent the misses are.
export function rankPracticeQuestions({ answers, topMistakeTypes = [], limit = 12 }) {
  const topSet = new Set(topMistakeTypes)
  const byQ = new Map()
  for (const a of answers) {
    const k = `${a.lesson_id}:${a.question_id}`
    const cur = byQ.get(k) || { key: k, lesson_id: a.lesson_id, question_id: a.question_id, wrong: 0, total: 0, lastWrongAt: 0, mistake_types: new Set() }
    cur.total += 1
    if (a.verdict !== 'correct') {
      cur.wrong += 1
      cur.lastWrongAt = Math.max(cur.lastWrongAt, a.answered_at || 0)
      if (a.mistake_type) cur.mistake_types.add(a.mistake_type)
    }
    byQ.set(k, cur)
  }
  const scored = [...byQ.values()]
    .filter((q) => q.wrong > 0)
    .map((q) => ({
      ...q,
      score: q.wrong * 2
        + ([...q.mistake_types].some((t) => topSet.has(t)) ? 3 : 0)
        + (q.wrong / q.total),
    }))
    .sort((a, b) => b.score - a.score || b.lastWrongAt - a.lastWrongAt)
  return scored.slice(0, limit)
}

export function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
