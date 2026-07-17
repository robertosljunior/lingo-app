// learner-evidence-contracts.js — shape and pure derivations of the
// LearnerEvidenceV2 event. An event is an IMMUTABLE record of ONE piece of
// evidence about EXACTLY ONE pedagogical target; a single learner interaction
// may emit several events (one per assessed target) sharing an interaction_id.
//
// Targets reuse the V2.1 content contract verbatim (TARGET_TYPES /
// TARGET_TYPE_PREFIX from contracts.js) — no divergent enumeration, no V1
// skill_ids.

import { TARGET_TYPES, TARGET_TYPE_PREFIX, ID_PREFIXES } from './contracts.js'
import {
  SUPPORT_FEATURE_TIER, SUPPORT_TIERS, CAPABILITY_MODALITIES,
} from './learner-model-constants.js'

export const EVIDENCE_ID_PREFIX = 'evidence:'

export { TARGET_TYPES, TARGET_TYPE_PREFIX, ID_PREFIXES }

/**
 * Derive the support tier from structured support data. Pure and centralized:
 * callers never pick a tier themselves. Highest applicable tier wins;
 * `answer_reveal` dominates everything; 2+ hints escalate medium → high.
 */
export function deriveSupportTier(support = {}) {
  const features = support.features || []
  const hintCount = support.hint_count || 0
  if (features.includes('answer_reveal')) return 'answer_revealed'
  let tier = 'none'
  const rank = (t) => SUPPORT_TIERS.indexOf(t)
  for (const f of features) {
    const t = SUPPORT_FEATURE_TIER[f]
    if (t && rank(t) > rank(tier)) tier = t
  }
  if (hintCount >= 2 && rank('high') > rank(tier)) tier = 'high'
  else if (hintCount === 1 && rank('medium') > rank(tier)) tier = 'medium'
  return tier
}

/**
 * Derive the unambiguous capability key (`modality_capability`, e.g.
 * "reading_recognition", "speaking_free_production") an event feeds. Returns
 * null for incompatible pairs — evidence can never update an incompatible key.
 */
export function deriveCapabilityKey(activity = {}) {
  const { capability, modality } = activity
  if (!CAPABILITY_MODALITIES[capability]?.includes(modality)) return null
  return `${modality}_${capability}`
}

/** All capability keys the model can track (derived, not hand-listed). */
export function allCapabilityKeys() {
  const out = []
  for (const [capability, modalities] of Object.entries(CAPABILITY_MODALITIES)) {
    for (const modality of modalities) out.push(`${modality}_${capability}`)
  }
  return out
}

/** Serialized logical key of a target state record (repo convention of
 * serialized keys, cf. skill_profiles/srs in storage.js). */
export function learnerTargetStateKey(profileId, target) {
  return `${profileId}:${target.target_type}:${target.target_id}`
}

/**
 * Convenience factory for a well-formed event skeleton. Fills defaults only —
 * validation stays in learner-evidence-validator.js.
 */
export function buildLearnerEvidenceV2(fields) {
  return {
    schema_version: 1,
    learner_model_version: 1,
    partial_score: null,
    assessment_confidence: 1,
    support: { features: [], hint_count: 0, attempt_number: 1 },
    source: { source_type: 'v2_activity' },
    ...fields,
    target: { ...fields.target },
    activity: { ...fields.activity },
  }
}

/**
 * Target resolver against loaded pedagogical_v2 packs, injectable into the
 * validator so the learner model never duplicates registry content. Returns
 * true when the target id exists in any given pack.
 */
export function createPackTargetResolver(packs) {
  const ids = new Set()
  for (const p of packs || []) {
    for (const s of p.senses || []) ids.add(s.sense_id)
    for (const c of p.constructions || []) ids.add(c.construction_id)
    for (const f of p.communicative_functions || []) ids.add(f.function_id)
    for (const l of p.lexemes || []) ids.add(l.lexeme_id)
  }
  return (target) => ids.has(target?.target_id)
}
