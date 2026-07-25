// lesson-engine-state-queries.js — read-side queries the lesson engine uses
// over APPROVED LearnerTargetStateV2 records (learner-model.js aggregation).
// The engine never touches lane internals directly: everything goes through
// these functions, which consume capabilities[capKey].{overall,independent,
// supported}, exposure, retention[capKey], evidence_level, mastery_estimate,
// effective_evidence_weight and trend as produced by the approved model.

const DAY_MS = 24 * 60 * 60 * 1000
const EVIDENCE_LEVEL_RANK = { insufficient: 0, emerging: 1, established: 2 }

export function indexStatesByTargetId(states) {
  const map = new Map()
  for (const s of states || []) if (s?.target?.target_id) map.set(s.target.target_id, s)
  return map
}

export function getLane(state, capabilityKey, lane = 'overall') {
  return state?.capabilities?.[capabilityKey]?.[lane] || null
}

/** Does a lane meet a {min_mastery, min_evidence_level} threshold? */
export function laneMeets(lane, threshold) {
  return !!lane
    && lane.mastery_estimate != null
    && lane.mastery_estimate >= threshold.min_mastery
    && (EVIDENCE_LEVEL_RANK[lane.evidence_level] ?? 0) >= (EVIDENCE_LEVEL_RANK[threshold.min_evidence_level] ?? 0)
}

/** Any capability key of the state whose OVERALL lane meets the threshold. */
export function anyCapabilityMeets(state, threshold) {
  return Object.keys(state?.capabilities || {}).some((k) => laneMeets(getLane(state, k, 'overall'), threshold))
}

/** Capability keys of the state (any lane), for gap scans. */
export function assessedCapabilityKeys(state) {
  return Object.keys(state?.capabilities || {}).sort()
}

export function exposureCount(state) {
  return state?.exposure?.count || 0
}

/**
 * Tri-state prerequisite assessment of one target against its state:
 *   met     — some capability's overall lane meets the threshold
 *   unmet   — assessed evidence exists but no lane meets the threshold
 *   unknown — no state / no assessed evidence at all
 */
export function assessTargetPrerequisite(statesById, targetId, threshold) {
  const state = statesById.get(targetId)
  if (!state || !Object.keys(state.capabilities || {}).length) return 'unknown'
  return anyCapabilityMeets(state, threshold) ? 'met' : 'unmet'
}

/** Best overall mastery across every capability key of the target (0 if none). */
export function bestOverallMastery(state) {
  let best = 0
  for (const k of Object.keys(state?.capabilities || {})) {
    const m = getLane(state, k, 'overall')?.mastery_estimate
    if (m != null && m > best) best = m
  }
  return best
}

/**
 * Independent-lane unlock is per target × capability × modality (capKey):
 * supported success in reading never unlocks independent listening. Unlocked
 * when the supported lane of THIS capKey meets `advancement`, or the
 * independent lane already carries evidence meeting `prerequisite`.
 */
export function independentUnlocked(state, capabilityKey, { advancement, prerequisite }) {
  return laneMeets(getLane(state, capabilityKey, 'supported'), advancement)
    || laneMeets(getLane(state, capabilityKey, 'independent'), prerequisite)
}

// Capability-key families used by the capability gates. Derived from the
// approved learner-model taxonomy — never restated per lexeme.
export const RECOGNITION_CAPABILITY_KEYS = ['reading_recognition', 'listening_recognition', 'multimodal_recognition']
export const PRODUCTION_CAPABILITY_KEYS = ['writing_controlled_production', 'speaking_controlled_production', 'writing_free_production', 'speaking_free_production']

/** Any of the given capability keys whose OVERALL lane meets the threshold. */
export function anyKeyMeets(state, keys, threshold) {
  return keys.some((k) => laneMeets(getLane(state, k, 'overall'), threshold))
}

/**
 * The CAPABILITY ROLLUP lane of a state: the same evidence folded across the
 * capability's modalities (learner-model AGGREGATION_VERSION 2). States
 * produced before that version have no rollups; for those we fall back to the
 * per-modality reading so a synthetic or not-yet-rebuilt state degrades to the
 * old semantics instead of reading as "no evidence at all". Persisted profiles
 * never rely on this path — storage rebuilds on aggregation-version mismatch.
 */
export function getCapabilityRollup(state, capability, lane = 'overall') {
  return state?.capability_rollups?.[capability]?.[lane] ?? null
}

/**
 * Has this target met a ladder rung? Slice V2.21-R3: the question is about the
 * CAPABILITY, so it is answered on the capability rollup — a learner who
 * recognised a construction six times in reading and six times in listening
 * has demonstrated recognition, even though neither lane alone carries the
 * bar. The threshold NUMBERS are unchanged; only the population of evidence
 * the bar is applied to. Per-modality lanes keep their own meaning everywhere
 * else (modality expansion, independence, retention).
 */
export function capabilityAdvancementMetV2(state, capability, threshold, lane = 'overall') {
  const rollup = getCapabilityRollup(state, capability, lane)
  if (rollup) return laneMeets(rollup, threshold)
  // Pre-rollup state: old per-modality semantics.
  return (CAPABILITY_MODALITY_KEYS[capability] || [])
    .some((k) => laneMeets(getLane(state, k, lane), threshold))
}

// Modality keys per capability, used only by the pre-rollup fallback above.
const CAPABILITY_MODALITY_KEYS = {
  recognition: RECOGNITION_CAPABILITY_KEYS,
  comprehension: ['reading_comprehension', 'listening_comprehension', 'multimodal_comprehension'],
  controlled_production: ['writing_controlled_production', 'speaking_controlled_production'],
  free_production: ['writing_free_production', 'speaking_free_production'],
  pronunciation: ['speaking_pronunciation'],
}

/**
 * SINGLE SOURCE of the per-capability curriculum gate for one target state
 * (Slice V2.9). Says whether `capability` may be practiced in `modality` given
 * the state — the same predicate the lesson engine applies per recipe, now
 * shared so the planner's modality-expansion readiness can never diverge from
 * what the engine will actually serve:
 *   recognition           — the target has been exposed
 *   comprehension         — exposed + recognition at advancement
 *   controlled_production — recognition at advancement
 *   free_production       — SAME-modality controlled production at advancement
 *   pronunciation         — any production key at advancement
 *
 * Slice V2.21-R3 changed ONE clause. Comprehension used to require the SAME
 * modality's recognition lane to carry the whole advancement bar; a learner
 * spreading correct answers over reading and listening halves each lane and so
 * opened neither rung, while having demonstrably recognised the target (the
 * measured case: 5 of 12 targets in the real successful journey). It now
 * requires BOTH
 *   - recognition met on the CAPABILITY rollup (all modalities together), and
 *   - some assessed recognition evidence in THIS modality.
 * The modality axis is therefore not collapsed: a learner who has only ever
 * read still does not walk into listening comprehension. What changed is that
 * the modality no longer has to clear the bar on its own.
 *
 * Free production deliberately KEEPS its same-modality prerequisite: writing
 * fluently is not unlocked by having spoken (V2.9/V2.10 decision, with its own
 * regressions). Receptive modalities inform one capability; productive ones
 * are separate skills.
 */
export function capabilityGateMetV2(state, capability, modality, thresholds) {
  const adv = thresholds.advancement
  switch (capability) {
    case 'recognition':
      return exposureCount(state) > 0
    case 'comprehension':
      return exposureCount(state) > 0
        && capabilityAdvancementMetV2(state, 'recognition', adv)
        && (getLane(state, `${modality}_recognition`, 'overall')?.assessed_evidence_count || 0) > 0
    case 'controlled_production':
      // Unchanged in effect: this clause was already cross-modality
      // (anyKeyMeets over the recognition keys); the rollup states it directly.
      return capabilityAdvancementMetV2(state, 'recognition', adv)
    case 'free_production':
      return laneMeets(getLane(state, `${modality}_controlled_production`, 'overall'), adv)
    case 'pronunciation':
      return anyKeyMeets(state, PRODUCTION_CAPABILITY_KEYS, adv)
    default:
      return false
  }
}

/**
 * Retention pressure of one capability key: how overdue the next retrieval is.
 * Interval = stability_estimate (days) when present, else the policy default.
 * Returns 0 with no retrieval history; ratio 1 = exactly due.
 */
export function retentionDueRatio(state, capabilityKey, { nowMs, defaultIntervalDays }) {
  const r = state?.retention?.[capabilityKey]
  if (!r?.last_retrieval_at) return 0
  const intervalDays = r.stability_estimate ?? defaultIntervalDays
  if (!intervalDays) return 0
  const elapsedDays = Math.max(0, nowMs - Date.parse(r.last_retrieval_at)) / DAY_MS
  return elapsedDays / intervalDays
}

/** Most recent ASSESSED outcome per target id from an evidence list. */
export function lastAssessedOutcomeByTarget(recentEvidence) {
  const sorted = [...(recentEvidence || [])]
    .filter((e) => ['correct', 'partial', 'incorrect'].includes(e.outcome))
    .sort((a, b) => (Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
      || (a.evidence_id < b.evidence_id ? -1 : a.evidence_id > b.evidence_id ? 1 : 0))
  const out = new Map()
  for (const e of sorted) if (e.target?.target_id) out.set(e.target.target_id, e.outcome)
  return out
}
