// activity-runtime-contracts.js — contracts of the V2 pilot runtime layer
// (Slice V2.4): typed user responses, real support usage, deterministic
// interaction/evidence identity, and pure presentation helpers shared by the
// assessment adapter and the UI (masking, token banks).
//
// The runtime layer is IMPURE-ADJACENT (it owns clocks and session ids) but
// everything in this module is pure data + pure functions.

import { deriveSupportTier } from './learner-evidence-contracts.js'

export const ACTIVITY_RESPONSE_VERSION = 1

// Typed response payloads. One per response contract the engine can emit.
export const RESPONSE_TYPES = [
  'continue', // exposure acknowledge
  'single_choice', // meaning/listening recognition
  'text', // completion, guided/free written production
  'token_sequence', // word-order reconstruction
  'speech_transcript', // spoken production via STT
  'pronunciation_attempt', // pronunciation practice (observed-only in V2.4)
]

// recipe → the response types its renderer may legally submit.
export const RESPONSE_TYPES_FOR_RECIPE = {
  exposure: ['continue'],
  meaning_recognition: ['single_choice'],
  listening_recognition: ['single_choice'],
  fixed_element_completion: ['text'],
  word_order_reconstruction: ['token_sequence'],
  guided_production: ['text', 'speech_transcript'],
  free_production: ['text', 'speech_transcript'],
  pronunciation: ['pronunciation_attempt'],
}

// ---- deterministic identity -------------------------------------------------
// interaction:<session>:<activity>:<attempt>
// evidence:<interaction>:<target-type>:<sanitized-target-id>
// Determinism requirements proven by tests: double-click and persistence retry
// reuse the same ids; a new attempt changes them; planned-evidence order never
// influences them.

const sanitizeIdPart = (s) => String(s).replace(/[^a-zA-Z0-9:._-]/g, '_')

export function buildInteractionIdV2({ sessionId, activityId, attemptNumber }) {
  return `interaction:${sanitizeIdPart(sessionId)}:${sanitizeIdPart(activityId)}:${attemptNumber}`
}

export function buildEvidenceIdV2(interactionId, target) {
  return `evidence:${interactionId}:${target.target_type}:${sanitizeIdPart(target.target_id)}`
}

// ---- real support usage -----------------------------------------------------
// The plan declares BASELINE support (inherent to the activity shape); the
// runtime tracks what the learner actually triggered on top of it. The final
// event support is baseline ∪ used, with the tier always re-derived through
// deriveSupportTier — never picked manually.

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

/** Record a learner-triggered support feature (pure — returns a new runtime). */
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

/** Final structured support of the interaction: baseline + actually used. */
export function finalizeSupportUsage(runtime) {
  const features = [...new Set([...runtime.baseline_features, ...runtime.used_features])].sort()
  const support = { features, hint_count: runtime.hint_count, attempt_number: runtime.attempt_number }
  return { ...support, derived_tier: deriveSupportTier(support) }
}

// ---- response factory -------------------------------------------------------

export function buildActivityResponseV2({
  plan, responseType, payload, supportRuntime, submittedAt, capabilities = null,
}) {
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
// Pure helpers used by BOTH the renderer and the assessment adapter so what the
// learner sees and what is graded can never diverge.

const WORD_RE = (w) => new RegExp(`(^|\\W)(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=\\W|$)`, 'i')

/**
 * Fixed-element completion view of an exemplar: masks ONLY the authorized
 * fixed elements of the construction (plan.presentation.masked_text_source
 * .fixed_elements), never arbitrary tokens. Returns
 * { masked_text, expected_tokens } where expected_tokens are the surface forms
 * removed, in sentence order.
 */
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

/** Canonical token sequence of a word-order plan (text_en_whitespace). */
export function canonicalOrderTokens(plan) {
  return plan.text_en.trim().split(/\s+/)
}

/**
 * Initial presentation order of the token bank — comes from the PLAN
 * (presentation_order: 'lexicographic'), so the component never re-shuffles.
 * Contractions and punctuation are preserved verbatim.
 */
export function presentedOrderTokens(plan) {
  const order = plan?.presentation?.token_source?.presentation_order || 'lexicographic'
  const tokens = canonicalOrderTokens(plan)
  if (order === 'lexicographic') {
    return tokens.map((t, i) => ({ t, i }))
      .sort((a, b) => (a.t.toLowerCase() < b.t.toLowerCase() ? -1 : a.t.toLowerCase() > b.t.toLowerCase() ? 1 : a.i - b.i))
      .map((x) => x.t)
  }
  return tokens
}
