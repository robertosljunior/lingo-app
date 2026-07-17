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
