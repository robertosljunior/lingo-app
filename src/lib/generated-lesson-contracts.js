import { normalize } from './lexical-bank.js'

export const PROHIBITED_CORRECT_ANSWERS = [
  'I am working in this company since two years.',
  'Are they have any opening jobs?',
  'We need to do a decision.',
  "I'm responsible of the deployment.",
  'How long have works there?',
  "I've been worked here for three years.",
  'I can update the tomorrow today.',
  'The I is important.',
  'We check the this week every day.',
  'We check the this week every day please?',
]
const prohibited = new Set(PROHIBITED_CORRECT_ANSWERS.map(normalize))
export function linguisticQualityIssues(text){
  const s = ` ${canonicalText(text)} `
  const issues = []
  if (prohibited.has(normalize(text))) issues.push('PROHIBITED_KNOWN_BAD_SENTENCE')
  if (/\b(incorrect|correct):/i.test(String(text||''))) issues.push('TECHNICAL_PREFIX')
  if (/^\s*(choose_best|translate_natural|there_is_are|skill_id|exercise_type|contexto base\b)/i.test(String(text||''))) issues.push('PLACEHOLDER_OR_METADATA')
  if (/\bthe\s+(i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|our|their|this|today|tomorrow|yesterday)\b/i.test(s)) issues.push('MALFORMED_DETERMINER')
  if (/\b(a|an|the|this|my|your|his|her|our|their)\s+(a|an|the|this|my|your|his|her|our|their)\b/i.test(s)) issues.push('DUPLICATE_DETERMINER')
  if (/\b(tomorrow\s+today|today\s+tomorrow|yesterday\s+tomorrow|tomorrow\s+yesterday)\b/i.test(s)) issues.push('INCOMPATIBLE_TIME_EXPRESSIONS')
  if (/\bare\s+\w+\s+have\b/i.test(s)) issues.push('ARE_HAVE_QUESTION')
  if (/\bhave\s+works\b/i.test(s)) issues.push('HAVE_WORKS')
  if (/\bhave\s+been\s+worked\b/i.test(s)) issues.push('HAVE_BEEN_WORKED')
  return issues
}
export function isProhibitedCorrectAnswer(text){ return linguisticQualityIssues(text).length > 0 }
export function canonicalText(text){ return normalize(String(text||'').replace(/[’‘]/g,"'").replace(/\s+([.,!?])/g,'$1')) }
export function tokenizeBuildSentence(text){ return String(text||'').replace(/[’‘]/g,"'").match(/[A-Za-z]+(?:'[A-Za-z]+)?|[.,!?]/g)||[] }
export function canonicalBuildSentence(tokensOrText){
  const text = Array.isArray(tokensOrText) ? tokensOrText.join(' ') : String(tokensOrText||'')
  return canonicalText(text.replace(/\s+([.,!?])/g,'$1'))
}
// ---- language contract (Slice 7.4) ----
// Every question carries explicit locales so the UI never infers language from
// the exercise type. `hide_answer` marks types whose model/expected answer must
// not be shown before submission; `hide_source` marks types (listening) whose
// source text (the spoken transcript) must stay hidden.
const HIDE_ANSWER_TYPES = new Set(['translate_natural', 'build_sentence', 'speak_sentence', 'listen_type', 'fill_blank', 'choose_best', 'answer_question'])
const HIDE_SOURCE_TYPES = new Set(['listen_type'])
// Types whose visible source is intentionally English (rewrite the given
// English sentence; recognition over an English sentence).
const EN_SOURCE_TYPES = new Set(['rewrite_natural', 'fill_blank', 'choose_best', 'listen_type'])

export function questionLanguageContract(q = {}) {
  const type = q.type || q.t
  const instruction_pt = String(q.prompt_pt || q.prompt || '').trim()
  const expected = q.expected_answer ?? q.a ?? ''
  const expected_answers = [expected, ...(q.accepted_answers || q.alt || [])].filter(Boolean)
  let source_locale = 'pt-BR'
  let source_text = String(q.prompt_pt || '').trim()
  if (type === 'rewrite_natural') { source_locale = 'en'; source_text = String(q.original || '').trim() }
  else if (type === 'listen_type') { source_locale = 'en'; source_text = String(expected || '').trim() }
  else if (type === 'fill_blank' || type === 'choose_best') { source_locale = 'en'; source_text = String(q.prompt || '').trim() }
  return {
    type,
    instruction_locale: 'pt-BR',
    instruction_pt,
    source_locale,
    source_text,
    answer_locale: 'en',
    expected_answers,
    model_answers: type === 'speak_sentence' ? [expected].filter(Boolean) : [],
    hide_answer: HIDE_ANSWER_TYPES.has(type),
    hide_source: HIDE_SOURCE_TYPES.has(type),
  }
}

// Validator: returns a list of contract violations for a generated question.
// A visible field is one the UI renders before the learner submits.
export function questionLanguageIssues(q = {}) {
  const c = questionLanguageContract(q)
  const issues = []
  const visible = [q.prompt_pt, q.prompt, q.context, q.ctx, c.hide_source ? '' : c.source_text]
    .filter(Boolean).map((s) => canonicalText(s))
  const answerCanon = c.expected_answers.map(canonicalText).filter(Boolean)
  if (!c.instruction_pt) issues.push('MISSING_INSTRUCTION')
  // The exact answer must never appear inside a visible prompt field for a
  // hide-answer type (translation / guided / free / listen / recognition slot).
  if (c.hide_answer && answerCanon.some((a) => a && visible.includes(a))) issues.push('PROMPT_LEAKS_ANSWER')
  // PT→EN translation must present a Portuguese source.
  if (c.type === 'translate_natural' && c.source_locale !== 'pt-BR') issues.push('TRANSLATION_SOURCE_NOT_PT')
  // Guided / free writing must not surface the model answer as source or context.
  if ((c.type === 'speak_sentence' || c.type === 'build_sentence') && c.source_text && answerCanon.includes(canonicalText(c.source_text))) issues.push('MODEL_ANSWER_EXPOSED')
  // Listening must keep the transcript hidden — it must not appear in any visible field.
  if (c.type === 'listen_type') {
    const transcript = canonicalText(c.expected_answers[0] || '')
    if (transcript && [q.prompt_pt, q.prompt, q.context, q.ctx].filter(Boolean).map(canonicalText).includes(transcript)) issues.push('TRANSCRIPT_EXPOSED')
  }
  return issues
}

export function equivalentAnswers(a,b){ return canonicalText(a)===canonicalText(b) }
export function uniqueNormalized(values){ const seen=new Set(); for(const v of values||[]){ const n=canonicalText(v); if(!n||seen.has(n)) return false; seen.add(n) } return true }
