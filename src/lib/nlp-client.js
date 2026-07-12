// nlp-client.js — promise wrapper around the NLP Web Worker.
//
// Lazily boots the worker on first use. If the worker fails to construct (very
// old browsers, blocked workers), transparently falls back to the synchronous
// main-thread analyzer so correction always works.

import { analyzeAnswer } from './correction-engine.js'

let worker = null
let seq = 0
const pending = new Map()

function ensureWorker() {
  if (worker) return worker
  try {
    worker = new Worker(new URL('./nlp-worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, result } = e.data || {}
      const resolve = pending.get(id)
      if (resolve) {
        pending.delete(id)
        resolve(result)
      }
    }
    worker.onerror = () => {
      // Reject nothing loudly — just tear down so callers fall back next time.
      worker = null
    }
  } catch {
    worker = null
  }
  return worker
}

// Warm the worker (and its Compromise bundle) ahead of the first answer.
export function warmupNlp() {
  const w = ensureWorker()
  if (w) {
    analyze({
      user_answer: 'warm up',
      expected_answer: 'warm up',
      accepted_answers: [],
      exercise_type: 'translate_natural',
      mistake_focus: null,
    }).catch(() => {})
  }
}

export function analyze(payload) {
  const w = ensureWorker()
  if (!w) {
    // Synchronous fallback.
    return Promise.resolve(analyzeAnswer({
      user_answer: payload.user_answer,
      expected_answer: payload.expected_answer,
      accepted_answers: payload.accepted_answers || [],
      mistake_focus: payload.mistake_focus || null,
      skill_target: payload.skill_target || null,
      exercise_type: payload.exercise_type || null,
    }))
  }
  const id = ++seq
  return new Promise((resolve) => {
    pending.set(id, resolve)
    w.postMessage({ type: 'analyze_answer', id, payload })
    // Safety timeout: if the worker never replies, fall back. wink-nlp loads
    // its model on the first request, so give it more headroom.
    const timeoutMs = payload.nlp_library === 'wink' ? 10000 : 4000
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        resolve(analyzeAnswer({
          user_answer: payload.user_answer,
          expected_answer: payload.expected_answer,
          accepted_answers: payload.accepted_answers || [],
          mistake_focus: payload.mistake_focus || null,
          skill_target: payload.skill_target || null,
          exercise_type: payload.exercise_type || null,
        }))
      }
    }, timeoutMs)
  })
}
