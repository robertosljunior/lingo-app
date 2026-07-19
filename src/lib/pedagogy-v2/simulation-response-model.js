// simulation-response-model.js — deterministic simulated responses for the
// pedagogy V2 harness (Slice V2.7). Given an ActivityPlanV2, a persona, the
// current learner states, the interaction index and the seed, it produces the
// typed response the runtime would submit — with a PURELY deterministic
// success draw (seeded FNV-1a hash, never Math.random). It also exposes a
// deterministic SimulationAssessmentServiceV2 for production recipes; that
// service has an explicit contract and is NEVER used by the real runtime.
//
// The persona picks WHETHER to answer correctly; it never fabricates learner
// state and never bypasses the assessment/evidence pipeline — the runner still
// runs the real assessment and evidence adapter over these responses.

import {
  createSupportRuntime, buildActivityResponseV2,
  buildMaskedCompletion, canonicalOrderTokens,
} from './activity-runtime-contracts.js'
import { getPersona } from './simulation-personas.js'

const DAY_MS = 24 * 60 * 60 * 1000

// FNV-1a → [0,1). Deterministic substitute for randomness.
export function hash01(str) {
  let h = 2166136261
  const s = String(str)
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967296
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

function normalizeSentence(s) {
  return String(s ?? '').normalize('NFC').trim().toLowerCase()
    .replace(/\s+/g, ' ').replace(/[.?!]+$/g, '')
}

/**
 * Deterministic success probability of the persona for this activity.
 * Modulated by: prior practice on the exact capability key (learning curve),
 * support tier (bonus when aided, penalty when independent), and — for
 * forgetful personas — the gap since the last retrieval of this key.
 */
export function personaSuccessProbability(persona, plan, statesById) {
  const capKey = `${plan.modality}_${plan.capability}`
  const base = persona.skill_by_key?.[capKey]
    ?? persona.skill?.[plan.capability]
    ?? 0.5
  const state = statesById.get(plan.primary_target.target_id)
  const prior = state?.capabilities?.[capKey]?.overall?.assessed_evidence_count || 0
  const lr = persona.learning_rate_by_key?.[capKey] ?? persona.learning_rate
  let p = base + Math.min(lr * prior, persona.max_learning_gain)

  const tier = plan.support?.derived_tier || 'none'
  if (tier === 'none') p -= persona.independent_penalty
  else p += persona.support_bonus

  if (persona.forgetting?.enabled) {
    const r = state?.retention?.[capKey]
    if (r?.last_retrieval_at && plan?.__now_ms != null) {
      const days = Math.max(0, (plan.__now_ms - Date.parse(r.last_retrieval_at)) / DAY_MS)
      const factor = Math.max(0.15, Math.pow(0.5, days / persona.forgetting.half_life_days))
      p *= factor
    }
  }
  return clamp(p, 0.02, 0.98)
}

/** Deterministic success/fail draw for an interaction. */
export function personaSucceeds(persona, plan, statesById, { seed, interactionIndex }) {
  const p = personaSuccessProbability(persona, plan, statesById)
  const u = hash01(`${seed}|${interactionIndex}|${plan.modality}_${plan.capability}|${plan.primary_target.target_id}|${plan.recipe}`)
  return u < p
}

function wrongOptionId(plan, correctId) {
  const opt = (plan.presentation?.options || []).find((o) => o.option_id !== correctId)
  return opt ? opt.option_id : correctId // ≥3 options guaranteed by the engine
}

/**
 * Build the typed response + support runtime for the persona's answer.
 * Returns { responseType, payload, supportRuntime, success (bool|null) }.
 */
export function buildPersonaResponsePayload(persona, plan, statesById, ctx) {
  const supportRuntime = createSupportRuntime(plan) // baseline support only; no extra features used
  const success = ['exposure', 'pronunciation'].includes(plan.recipe)
    ? null
    : personaSucceeds(persona, plan, statesById, ctx)

  switch (plan.recipe) {
    case 'exposure':
      return { responseType: 'continue', payload: {}, supportRuntime, success }
    case 'meaning_recognition':
    case 'listening_recognition': {
      const correctId = plan.response_contract.correct_option_id
      return { responseType: 'single_choice', payload: { option_id: success ? correctId : wrongOptionId(plan, correctId) }, supportRuntime, success }
    }
    case 'fixed_element_completion': {
      const { expected_tokens } = buildMaskedCompletion(plan)
      const text = success ? expected_tokens.join(' ') : expected_tokens.map(() => 'zzz').join(' ')
      return { responseType: 'text', payload: { text }, supportRuntime, success }
    }
    case 'word_order_reconstruction': {
      const tokens = canonicalOrderTokens(plan)
      const answer = success ? tokens : (tokens.length > 1 ? [...tokens].reverse() : ['zzz'])
      return { responseType: 'token_sequence', payload: { tokens: answer }, supportRuntime, success }
    }
    case 'guided_production':
    case 'free_production': {
      const good = plan.text_en
      const text = success ? good : `${good} zzz`
      if (plan.modality === 'speaking') {
        return { responseType: 'speech_transcript', payload: { transcript: text, stt_confidence: 0.95 }, supportRuntime, success }
      }
      return { responseType: 'text', payload: { text }, supportRuntime, success }
    }
    case 'pronunciation':
      return { responseType: 'pronunciation_attempt', payload: { transcript: plan.text_en }, supportRuntime, success }
    default:
      return { responseType: 'continue', payload: {}, supportRuntime, success: null }
  }
}

/**
 * Build the full ActivityResponseV2 for a persona answering a plan.
 * `now` (ISO) is the simulated clock; `nowMs` powers persona forgetting.
 */
export function simulatePersonaResponseV2({ persona: personaInput, plan, statesById, seed, interactionIndex, now, capabilities = null }) {
  const persona = getPersona(personaInput)
  if (!persona) throw new Error(`SIMULATION_PERSONA_UNKNOWN:${personaInput?.id ?? personaInput}`)
  const planWithNow = { ...plan, __now_ms: Date.parse(now) }
  const { responseType, payload, supportRuntime, success } = buildPersonaResponsePayload(persona, planWithNow, statesById, { seed, interactionIndex })
  const response = buildActivityResponseV2({ plan, responseType, payload, supportRuntime, submittedAt: now, capabilities })
  return { response, intended_success: success }
}

// ---- deterministic simulation assessment service (§5) -----------------------
// Explicit contract, deterministic, NEVER used by the real runtime. Maps a
// production text to a semantic verdict purely by comparing it to the authored
// target sentence: an exact (normalized) match is `valid`; anything else is
// `needs_revision` with a high-severity error. No linguistic modeling.
export const SimulationAssessmentServiceV2 = Object.freeze({
  __simulation_only: true,
  async analyzeSemantics({ text, equivalentTarget }) {
    const match = normalizeSentence(text) === normalizeSentence(equivalentTarget)
    if (match) {
      return { verdict: 'valid', confidence: 1, detected_errors: [], corrected_version: null, natural_alternatives: [] }
    }
    return {
      verdict: 'needs_revision',
      confidence: 1,
      detected_errors: [{ severity: 'high', rule_id: 'simulation.mismatch' }],
      corrected_version: equivalentTarget,
      natural_alternatives: [],
    }
  },
})
