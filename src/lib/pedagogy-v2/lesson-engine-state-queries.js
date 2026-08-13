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

// ---- capability-gate diagnostics (#106) ------------------------------------
// These rows are the gate itself made observable, not a second implementation.
// capabilityGateMetV2 delegates to capabilityGateTraceV2 below, so a diagnostic
// can never report a threshold different from the predicate used by runtime.

function thresholdView(threshold) {
  return {
    min_mastery: threshold?.min_mastery ?? null,
    min_evidence_level: threshold?.min_evidence_level ?? null,
  }
}

function laneView(lane) {
  return {
    present: !!lane,
    mastery_estimate: lane?.mastery_estimate ?? null,
    evidence_level: lane?.evidence_level ?? 'insufficient',
    assessed_evidence_count: lane?.assessed_evidence_count ?? 0,
    effective_evidence_weight: lane?.effective_evidence_weight ?? 0,
  }
}

function lanePredicate(predicate, lane, threshold, source) {
  return {
    predicate,
    source,
    actual: laneView(lane),
    required: thresholdView(threshold),
    met: laneMeets(lane, threshold),
  }
}

function capabilityAdvancementPredicate(state, capability, threshold, lane = 'overall') {
  const rollup = getCapabilityRollup(state, capability, lane)
  if (rollup) {
    return lanePredicate(
      `${capability}_advancement`, rollup, threshold,
      `capability_rollups.${capability}.${lane}`,
    )
  }
  const keys = CAPABILITY_MODALITY_KEYS[capability] || []
  const lanes = keys.map((key) => ({
    capability_key: key,
    ...laneView(getLane(state, key, lane)),
    meets_threshold: laneMeets(getLane(state, key, lane), threshold),
  }))
  return {
    predicate: `${capability}_advancement`,
    source: 'pre_rollup_modality_fallback',
    actual: { lanes },
    required: thresholdView(threshold),
    met: lanes.some((row) => row.meets_threshold),
  }
}

/**
 * Exact per-target capability-gate decision with machine-readable predicates.
 * Every failed row reports the current value and the required threshold/count.
 */
export function capabilityGateTraceV2(state, capability, modality, thresholds) {
  const adv = thresholds.advancement
  const predicates = []

  switch (capability) {
    case 'recognition': {
      const count = exposureCount(state)
      predicates.push({
        predicate: 'has_exposure',
        actual: { exposure_count: count },
        required: { min_exposure_count: 1 },
        met: count > 0,
      })
      break
    }
    case 'comprehension': {
      const count = exposureCount(state)
      predicates.push({
        predicate: 'has_exposure',
        actual: { exposure_count: count },
        required: { min_exposure_count: 1 },
        met: count > 0,
      })
      predicates.push(capabilityAdvancementPredicate(state, 'recognition', adv))
      const key = `${modality}_recognition`
      const assessed = getLane(state, key, 'overall')?.assessed_evidence_count || 0
      predicates.push({
        predicate: 'same_modality_recognition_evidence',
        actual: { capability_key: key, assessed_evidence_count: assessed },
        required: { min_assessed_evidence_count: 1 },
        met: assessed > 0,
      })
      break
    }
    case 'controlled_production':
      predicates.push(capabilityAdvancementPredicate(state, 'recognition', adv))
      break
    case 'free_production': {
      const key = `${modality}_controlled_production`
      predicates.push(lanePredicate(
        'same_modality_controlled_production_advancement',
        getLane(state, key, 'overall'), adv, `capabilities.${key}.overall`,
      ))
      break
    }
    case 'pronunciation': {
      const lanes = PRODUCTION_CAPABILITY_KEYS.map((key) => ({
        capability_key: key,
        ...laneView(getLane(state, key, 'overall')),
        meets_threshold: laneMeets(getLane(state, key, 'overall'), adv),
      }))
      predicates.push({
        predicate: 'any_production_advancement',
        actual: { lanes },
        required: thresholdView(adv),
        met: lanes.some((row) => row.meets_threshold),
      })
      break
    }
    default:
      predicates.push({
        predicate: 'known_capability', actual: { capability },
        required: { known_capability: true }, met: false,
      })
  }

  return {
    capability,
    modality,
    met: predicates.length > 0 && predicates.every((row) => row.met),
    predicates,
  }
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
 * opened neither rung, while having demonstrably recognised the target. It now
 * requires BOTH recognition at the capability rollup and some assessed
 * recognition evidence in THIS modality.
 *
 * #106 makes this predicate observable through capabilityGateTraceV2. The
 * boolean behavior remains defined by this same source of truth.
 */
export function capabilityGateMetV2(state, capability, modality, thresholds) {
  return capabilityGateTraceV2(state, capability, modality, thresholds).met
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
