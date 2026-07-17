// learner-contracts.js — canonical constants and key helpers for the learner
// model V2 ("learner_model_v2"). Same isolation rule as contracts.js: nothing
// here imports the frozen V1 core (skill-profile.js, srs.js, storage.js).
//
// Central modelling decision (mirrors the content model): there is NO global
// mastery of a target. Evidence and state are keyed by the full learning
// domain — target × capability × modality × support lane — because a learner
// who reads "I still live here." confidently may be unable to produce it in
// speech, and supported success says nothing about independent success.

export const LEARNER_MODEL_V2_SCHEMA_VERSION = '1'

// Capability axis. Recognition is separate from production, and controlled
// production (scaffolded: reorder, fill, transform a given exemplar) is a
// different capability from free production (the learner supplies the
// sentence). Retention is tracked per capability — see retention intervals in
// the lesson-engine policy.
export const CAPABILITIES_V2 = ['recognition', 'controlled_production', 'free_production']

// Modality axis. Reading is separate from listening (input), writing is
// separate from speaking (output). A modality is only meaningful for the
// capabilities listed here — recognition consumes input, production emits
// output.
export const MODALITIES_V2 = ['reading', 'listening', 'writing', 'speaking']
export const CAPABILITY_MODALITIES_V2 = {
  recognition: ['reading', 'listening'],
  controlled_production: ['writing', 'speaking'],
  free_production: ['writing', 'speaking'],
}

// Support-lane axis: did the learner have scaffolding (translation visible,
// options shown, model sentence available) or act independently?
export const SUPPORT_LANES_V2 = ['supported', 'independent']

// Outcome of one evidence event. `partial` counts as half a success in the
// state fold.
export const EVIDENCE_OUTCOMES_V2 = ['correct', 'partial', 'incorrect']
export const OUTCOME_VALUE_V2 = { correct: 1, partial: 0.5, incorrect: 0 }

// Typed prefix for evidence ids, consistent with the content-model prefixes.
export const EVIDENCE_ID_PREFIX = 'evidence:'

// The kinds of pedagogical target evidence may attach to (same union as the
// content model's TARGET_TYPES; lexeme_usage targets carry a lexeme: id).
export const EVIDENCE_TARGET_TYPES = ['sense', 'construction', 'communicative_function', 'lexeme_usage']

export function isCapabilityModalityValid(capability, modality) {
  return (CAPABILITY_MODALITIES_V2[capability] || []).includes(modality)
}

export function isSupportLane(lane) {
  return SUPPORT_LANES_V2.includes(lane)
}

// Canonical key of one learning domain. This is the identity of a
// learner_target_states_v2 row (scoped by profile in the store).
export function learnerDomainKey({ target_id, capability, modality, support_lane }) {
  return `${target_id}|${capability}|${modality}|${support_lane}`
}

export function parseLearnerDomainKey(key) {
  const [target_id, capability, modality, support_lane] = String(key || '').split('|')
  return { target_id, capability, modality, support_lane }
}
