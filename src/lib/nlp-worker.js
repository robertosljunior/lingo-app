// nlp-worker.js — NLP analysis off the main thread using Compromise.
//
// Message in:
//   { type: 'analyze_answer', id, payload: {
//       user_answer, expected_answer, accepted_answers,
//       exercise_type, mistake_focus } }
// Message out:
//   { id, result: {
//       normalized_user_answer, normalized_expected_answer, similarity_score,
//       missing_words, extra_words, possible_mistake_type,
//       is_probably_correct, feedback, verdict, target } }
//
// Compromise refines the base heuristic classification with real POS info:
// detecting a missing question auxiliary, contractions, and verb-tense drift.
// The architecture is ready for wink-nlp to be added later behind the same
// message contract without touching callers.

import nlp from 'compromise'
import {
  analyzeAnswer,
  tokenize,
  normalize,
  buildFeedback,
  FEEDBACK_BY_TYPE,
} from './correction-engine.js'

function structuralRefine(base, payload) {
  const { user_answer, expected_answer, exercise_type } = payload
  if (base.is_probably_correct) return base

  const expectedDoc = nlp(expected_answer)
  const userDoc = nlp(user_answer)

  const expectedIsQuestion = expectedDoc.questions().found || /\?\s*$/.test(expected_answer)
  const expectedFirst = tokenize(expected_answer)[0]
  const userFirst = tokenize(user_answer)[0]

  const AUX = new Set(['do', 'does', 'did', 'is', 'are', 'am', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should'])

  // Question that should open with an auxiliary but the answer doesn't.
  if (expectedIsQuestion && AUX.has(expectedFirst) && !AUX.has(userFirst)) {
    base.possible_mistake_type = 'question_structure'
  }

  // Verb-tense drift: compare the primary verb's conjugation tags.
  const expVerbs = expectedDoc.verbs()
  const usrVerbs = userDoc.verbs()
  if (expVerbs.found && usrVerbs.found) {
    const expTense = verbTense(expVerbs)
    const usrTense = verbTense(usrVerbs)
    if (expTense && usrTense && expTense !== usrTense && base.possible_mistake_type === 'vocabulary') {
      base.possible_mistake_type = 'verb_tense'
    }
  }

  base.feedback = buildFeedback(base.is_probably_correct, base.verdict === 'partial', base.possible_mistake_type)
  return base
}

function verbTense(verbs) {
  try {
    const j = verbs.json()[0]
    if (!j) return null
    const c = (j.verb && j.verb.conjugation) || null
    return c
  } catch {
    return null
  }
}

self.onmessage = (e) => {
  const { type, id, payload } = e.data || {}
  if (type !== 'analyze_answer') return
  try {
    const base = analyzeAnswer({
      user_answer: payload.user_answer,
      expected_answer: payload.expected_answer,
      accepted_answers: payload.accepted_answers || [],
      mistake_focus: payload.mistake_focus || null,
    })
    const result = structuralRefine(base, payload)
    self.postMessage({ id, result })
  } catch (err) {
    // Never leave a request hanging — return a safe fallback so the UI proceeds.
    self.postMessage({
      id,
      result: {
        normalized_user_answer: normalize(payload.user_answer),
        normalized_expected_answer: normalize(payload.expected_answer),
        similarity_score: 0,
        missing_words: [],
        extra_words: [],
        typos: [],
        user_tokens: [],
        target_tokens: [],
        possible_mistake_type: payload.mistake_focus || 'unnatural_translation',
        is_probably_correct: false,
        verdict: 'incorrect',
        target: payload.expected_answer,
        feedback: FEEDBACK_BY_TYPE[payload.mistake_focus]?.wrong || 'Não deu para analisar — compare com a resposta esperada.',
        error: String(err),
      },
    })
  }
}
