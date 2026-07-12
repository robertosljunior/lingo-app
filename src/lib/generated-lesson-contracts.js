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
export function equivalentAnswers(a,b){ return canonicalText(a)===canonicalText(b) }
export function uniqueNormalized(values){ const seen=new Set(); for(const v of values||[]){ const n=canonicalText(v); if(!n||seen.has(n)) return false; seen.add(n) } return true }
