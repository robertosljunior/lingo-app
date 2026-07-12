import { normalize } from './lexical-bank.js'

export const PROHIBITED_CORRECT_ANSWERS = [
  'I am working in this company since two years.',
  'Are they have any opening jobs?',
  'We need to do a decision.',
  "I'm responsible of the deployment.",
  'How long have works there?',
  "I've been worked here for three years.",
]
const prohibited = new Set(PROHIBITED_CORRECT_ANSWERS.map(normalize))
export function isProhibitedCorrectAnswer(text){ return prohibited.has(normalize(text)) }
export function canonicalText(text){ return normalize(String(text||'').replace(/[’‘]/g,"'").replace(/\s+([.,!?])/g,'$1')) }
export function tokenizeBuildSentence(text){ return String(text||'').replace(/[’‘]/g,"'").match(/[A-Za-z]+(?:'[A-Za-z]+)?|[.,!?]/g)||[] }
export function canonicalBuildSentence(tokensOrText){
  const text = Array.isArray(tokensOrText) ? tokensOrText.join(' ') : String(tokensOrText||'')
  return canonicalText(text.replace(/\s+([.,!?])/g,'$1'))
}
export function equivalentAnswers(a,b){ return canonicalText(a)===canonicalText(b) }
export function uniqueNormalized(values){ const seen=new Set(); for(const v of values||[]){ const n=canonicalText(v); if(!n||seen.has(n)) return false; seen.add(n) } return true }
