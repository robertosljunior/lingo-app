// activity-runtime-contracts.js — contracts of the V2 pilot runtime layer
// (Slice V2.4): typed user responses, real support usage, deterministic
// interaction/evidence identity, and pure presentation helpers shared by the
// assessment adapter and the UI (masking, token banks).
//
// The runtime layer is IMPURE-ADJACENT (it owns clocks and session ids) but
// everything in this module is pure data + pure functions.

import { deriveSupportTier } from './learner-evidence-contracts.js'

export const ACTIVITY_RESPONSE_VERSION = 1

export const RESPONSE_TYPES = [
  'continue',
  'single_choice',
  'text',
  'token_sequence',
  'speech_transcript',
  'pronunciation_attempt',
]

export const RESPONSE_TYPES_FOR_RECIPE = {
  exposure: ['continue'],
  meaning_recognition: ['single_choice'],
  context_recognition: ['single_choice'],
  listening_recognition: ['single_choice'],
  fixed_element_completion: ['text'],
  word_order_reconstruction: ['token_sequence'],
  guided_production: ['text', 'speech_transcript'],
  free_production: ['text', 'speech_transcript'],
  pronunciation: ['pronunciation_attempt'],
}

const sanitizeIdPart = (s) => String(s).replace(/[^a-zA-Z0-9:._-]/g, '_')

export function buildInteractionIdV2({ sessionId, activityId, attemptNumber }) {
  return `interaction:${sanitizeIdPart(sessionId)}:${sanitizeIdPart(activityId)}:${attemptNumber}`
}

export function buildEvidenceIdV2(interactionId, target) {
  return `evidence:${interactionId}:${target.target_type}:${sanitizeIdPart(target.target_id)}`
}

export function createSupportRuntime(plan, { attemptNumber = 1 } = {}) {
  return {
    baseline_features: [...(plan?.support?.features || [])],
    used_features: [],
    hint_count: 0,
    attempt_number: attemptNumber,
    audio_replay_count: 0,
    answer_revealed: false,
  }
}

export function useSupportFeature(runtime, feature) {
  const next = {
    ...runtime,
    used_features: runtime.used_features.includes(feature)
      ? runtime.used_features
      : [...runtime.used_features, feature],
  }
  if (feature === 'hint') next.hint_count = runtime.hint_count + 1
  if (feature === 'audio_replay') next.audio_replay_count = runtime.audio_replay_count + 1
  if (feature === 'answer_reveal') next.answer_revealed = true
  return next
}

export function finalizeSupportUsage(runtime) {
  const features = [...new Set([...runtime.baseline_features, ...runtime.used_features])].sort()
  const support = { features, hint_count: runtime.hint_count, attempt_number: runtime.attempt_number }
  return { ...support, derived_tier: deriveSupportTier(support) }
}

// ---- response factory -------------------------------------------------------

/**
 * Response types are constrained twice: first by the authored/runtime response
 * contract (when present), then by recipe + modality. Production recipes have
 * two legitimate renderers, but one concrete ActivityPlan never has both:
 * writing accepts `text`; speaking accepts `speech_transcript`. This prevents a
 * UI fallback from silently recording written work as speaking evidence.
 */
export function allowedResponseTypesForPlanV2(plan) {
  const declared = Array.isArray(plan?.response_contract?.accepted_response_types)
    && plan.response_contract.accepted_response_types.length
    ? plan.response_contract.accepted_response_types
    : (RESPONSE_TYPES_FOR_RECIPE[plan?.recipe] || [])
  let allowed = [...new Set(declared)]
  if (['guided_production', 'free_production'].includes(plan?.recipe)) {
    if (plan?.modality === 'speaking') allowed = allowed.filter((type) => type === 'speech_transcript')
    if (plan?.modality === 'writing') allowed = allowed.filter((type) => type === 'text')
  }
  return allowed
}

function assertResponseExecutableV2({ plan, responseType, capabilities }) {
  if (!RESPONSE_TYPES.includes(responseType)) {
    throw new Error(`ACTIVITY_RESPONSE_TYPE_UNKNOWN:${responseType}`)
  }
  const allowed = allowedResponseTypesForPlanV2(plan)
  if (!allowed.includes(responseType)) {
    throw new Error(`ACTIVITY_RESPONSE_TYPE_NOT_ALLOWED:${responseType}:${plan?.recipe || 'unknown'}:${plan?.modality || 'unknown'}`)
  }
  if (responseType === 'speech_transcript' && capabilities && capabilities.speech_input !== true) {
    throw new Error('ACTIVITY_RESPONSE_RUNTIME_UNAVAILABLE:speech_input')
  }
  if (responseType === 'text' && capabilities && capabilities.text_input !== true) {
    throw new Error('ACTIVITY_RESPONSE_RUNTIME_UNAVAILABLE:text_input')
  }
  if (responseType === 'pronunciation_attempt' && capabilities && capabilities.pronunciation_assessment !== true) {
    throw new Error('ACTIVITY_RESPONSE_RUNTIME_UNAVAILABLE:pronunciation_assessment')
  }
}

export function buildActivityResponseV2({
  plan, responseType, payload, supportRuntime, submittedAt, capabilities = null,
}) {
  assertResponseExecutableV2({ plan, responseType, capabilities })
  const attempt = supportRuntime?.attempt_number ?? 1
  return {
    response_version: ACTIVITY_RESPONSE_VERSION,
    response_type: responseType,
    activity_id: plan.activity_id,
    session_id: plan.session_id,
    interaction_id: buildInteractionIdV2({
      sessionId: plan.session_id, activityId: plan.activity_id, attemptNumber: attempt,
    }),
    attempt_number: attempt,
    submitted_at: submittedAt,
    payload: { ...payload },
    support_usage: supportRuntime ? { ...supportRuntime } : createSupportRuntime(plan),
    runtime_capabilities: capabilities ? { ...capabilities } : null,
  }
}

// ---- shared presentation derivations ---------------------------------------

const WORD_RE = (w) => new RegExp(`(^|\\W)(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=\\W|$)`, 'i')

export function buildMaskedCompletion(plan) {
  const fixed = plan?.presentation?.masked_text_source?.fixed_elements || []
  let masked = plan.text_en
  const expected = []
  for (const el of fixed) {
    const re = WORD_RE(el)
    const m = masked.match(re)
    if (!m) continue
    expected.push(m[2])
    masked = masked.replace(re, `$1___`)
  }
  return { masked_text: masked, expected_tokens: expected }
}

export function canonicalOrderTokens(plan) {
  return plan.text_en.trim().split(/\s+/)
}

export function presentedOrderTokens(plan) {
  const src = plan?.presentation?.token_source
  const order = src?.presentation_order || 'lexicographic'
  const tokens = canonicalOrderTokens(plan)
  if (order === 'seeded_shuffle' && Array.isArray(src?.presented_tokens)) {
    return src.presented_tokens.slice()
  }
  if (order === 'lexicographic') {
    return tokens.map((t, i) => ({ t, i }))
      .sort((a, b) => (a.t.toLowerCase() < b.t.toLowerCase() ? -1 : a.t.toLowerCase() > b.t.toLowerCase() ? 1 : a.i - b.i))
      .map((x) => x.t)
  }
  return tokens
}
