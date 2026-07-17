// learner-evidence-validator.js — structural validation of LearnerEvidenceV2
// events. Same error convention as the V2 pack validator: `CODE:detail`.
//
// The target is validated against the V2.1 content contract (typed prefixes) —
// a bare V1 skill_id is rejected explicitly. Resolution against actual pack
// content happens through an injectable `resolveTarget` so the learner model
// stays decoupled from the registry implementation.

import { TARGET_TYPES, TARGET_TYPE_PREFIX, ID_PREFIXES } from './contracts.js'
import {
  LEARNER_EVIDENCE_SCHEMA_VERSION, LEARNER_MODEL_VERSION,
  ACTIVITY_KINDS, ACTIVITY_KIND_RULES, CAPABILITIES, MODALITIES,
  ATTRIBUTIONS, OUTCOMES, SUPPORT_FEATURES, SOURCE_TYPES,
} from './learner-model-constants.js'
import { EVIDENCE_ID_PREFIX, deriveCapabilityKey } from './learner-evidence-contracts.js'

const isFiniteIn01 = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1

export function validateLearnerEvidenceV2(event, { resolveTarget = null } = {}) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)

  if (!event || typeof event !== 'object') return { valid: false, errors: ['EVENT_REQUIRED'] }

  // ---- identity & versions ----
  if (typeof event.evidence_id !== 'string' || !event.evidence_id.startsWith(EVIDENCE_ID_PREFIX) || event.evidence_id.length <= EVIDENCE_ID_PREFIX.length) {
    err('EVIDENCE_ID_INVALID', event.evidence_id)
  }
  if (event.schema_version !== LEARNER_EVIDENCE_SCHEMA_VERSION) err('SCHEMA_VERSION_INVALID', String(event.schema_version))
  if (event.learner_model_version !== LEARNER_MODEL_VERSION) err('LEARNER_MODEL_VERSION_INVALID', String(event.learner_model_version))
  if (!event.profile_id || typeof event.profile_id !== 'string') err('PROFILE_ID_REQUIRED')
  if (!event.interaction_id || typeof event.interaction_id !== 'string') err('INTERACTION_ID_REQUIRED')

  // ---- target (reuses V2.1 contract; V1 skills forbidden) ----
  const t = event.target
  if (!t || typeof t !== 'object') err('TARGET_REQUIRED')
  else {
    if (!TARGET_TYPES.includes(t.target_type)) err('TARGET_TYPE_INVALID', t.target_type)
    else {
      const prefix = TARGET_TYPE_PREFIX[t.target_type]
      if (typeof t.target_id !== 'string' || !t.target_id) err('TARGET_ID_REQUIRED')
      else if (!t.target_id.includes(':')) err('TARGET_V1_SKILL_FORBIDDEN', t.target_id)
      else if (!t.target_id.startsWith(prefix)) err('TARGET_ID_PREFIX_MISMATCH', `${t.target_id} (expected "${prefix}")`)
      else if (resolveTarget && !resolveTarget(t)) err('TARGET_UNRESOLVED', t.target_id)
    }
  }

  if (event.exemplar_id != null && (typeof event.exemplar_id !== 'string' || !event.exemplar_id.startsWith(ID_PREFIXES.exemplar))) {
    err('EXEMPLAR_ID_INVALID', event.exemplar_id)
  }

  // ---- activity (kind + capability + modality coherence) ----
  const a = event.activity
  if (!a || typeof a !== 'object') err('ACTIVITY_REQUIRED')
  else {
    if (!ACTIVITY_KINDS.includes(a.activity_kind)) err('ACTIVITY_KIND_INVALID', a.activity_kind)
    if (!CAPABILITIES.includes(a.capability)) err('CAPABILITY_INVALID', a.capability)
    if (!MODALITIES.includes(a.modality)) err('MODALITY_INVALID', a.modality)
    if (CAPABILITIES.includes(a.capability) && MODALITIES.includes(a.modality) && !deriveCapabilityKey(a)) {
      err('CAPABILITY_MODALITY_INCOMPATIBLE', `${a.capability}+${a.modality}`)
    }
    const rules = ACTIVITY_KIND_RULES[a.activity_kind]
    if (rules) {
      if (CAPABILITIES.includes(a.capability) && !rules.capabilities.includes(a.capability)) err('ACTIVITY_CAPABILITY_INCOMPATIBLE', `${a.activity_kind}+${a.capability}`)
      if (MODALITIES.includes(a.modality) && !rules.modalities.includes(a.modality)) err('ACTIVITY_MODALITY_INCOMPATIBLE', `${a.activity_kind}+${a.modality}`)
    }
  }

  // ---- attribution / outcome coherence ----
  if (!ATTRIBUTIONS.includes(event.attribution)) err('ATTRIBUTION_INVALID', event.attribution)
  if (!OUTCOMES.includes(event.outcome)) err('OUTCOME_INVALID', event.outcome)
  if (event.outcome === 'partial') {
    if (!isFiniteIn01(event.partial_score)) err('PARTIAL_SCORE_REQUIRED', String(event.partial_score))
  } else if (event.partial_score != null) {
    if (!isFiniteIn01(event.partial_score)) err('PARTIAL_SCORE_OUT_OF_RANGE', String(event.partial_score))
  }
  // Pure encounters never carry an assessed outcome, and vice versa.
  if (event.attribution === 'exposure' && ['correct', 'partial', 'incorrect'].includes(event.outcome)) {
    err('EXPOSURE_CANNOT_BE_ASSESSED', event.outcome)
  }
  if (event.activity?.activity_kind === 'exposure' && event.attribution !== 'exposure') {
    err('EXPOSURE_ACTIVITY_REQUIRES_EXPOSURE_ATTRIBUTION', event.attribution)
  }

  if (event.assessment_confidence != null && !isFiniteIn01(event.assessment_confidence)) {
    err('ASSESSMENT_CONFIDENCE_OUT_OF_RANGE', String(event.assessment_confidence))
  }

  // ---- support ----
  const s = event.support
  if (!s || typeof s !== 'object') err('SUPPORT_REQUIRED')
  else {
    if (!Array.isArray(s.features)) err('SUPPORT_FEATURES_REQUIRED')
    else for (const f of s.features) if (!SUPPORT_FEATURES.includes(f)) err('SUPPORT_FEATURE_INVALID', f)
    if (!Number.isInteger(s.hint_count) || s.hint_count < 0) err('HINT_COUNT_INVALID', String(s.hint_count))
    if (!Number.isInteger(s.attempt_number) || s.attempt_number < 1) err('ATTEMPT_NUMBER_INVALID', String(s.attempt_number))
  }

  // ---- source ----
  const src = event.source
  if (!src || typeof src !== 'object' || !SOURCE_TYPES.includes(src.source_type)) {
    err('SOURCE_TYPE_INVALID', src?.source_type)
  }

  // ---- time ----
  if (typeof event.occurred_at !== 'string' || Number.isNaN(Date.parse(event.occurred_at))) {
    err('OCCURRED_AT_INVALID', String(event.occurred_at))
  }

  return { valid: errors.length === 0, errors }
}

export function validateLearnerEvidenceBatchV2(events, opts = {}) {
  if (!Array.isArray(events) || !events.length) return { valid: false, errors: ['BATCH_EMPTY'], results: [] }
  const results = events.map((e) => validateLearnerEvidenceV2(e, opts))
  const errors = results.flatMap((r, i) => r.errors.map((e) => `events[${i}]:${e}`))
  const seen = new Set()
  events.forEach((e, i) => {
    if (e?.evidence_id && seen.has(e.evidence_id)) errors.push(`events[${i}]:DUPLICATE_EVIDENCE_ID_IN_BATCH:${e.evidence_id}`)
    if (e?.evidence_id) seen.add(e.evidence_id)
  })
  return { valid: errors.length === 0, errors, results }
}
