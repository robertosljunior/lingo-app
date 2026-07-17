// learner-model-query.js — pure filter/lookup helpers over evidence lists and
// target states. storage.js delegates its filter semantics here so persistence
// stays free of pedagogical logic.

export function filterEvidence(events, filters = {}) {
  const { targetId, targetType, interactionId, exemplarId, since, until } = filters
  const sinceMs = since != null ? Date.parse(since) : null
  const untilMs = until != null ? Date.parse(until) : null
  return (events || []).filter((e) => {
    if (targetId && e.target?.target_id !== targetId) return false
    if (targetType && e.target?.target_type !== targetType) return false
    if (interactionId && e.interaction_id !== interactionId) return false
    if (exemplarId && e.exemplar_id !== exemplarId) return false
    const at = Date.parse(e.occurred_at)
    if (sinceMs != null && !(at >= sinceMs)) return false
    if (untilMs != null && !(at <= untilMs)) return false
    return true
  }).sort((a, b) => (Date.parse(a.occurred_at) - Date.parse(b.occurred_at)) || (a.evidence_id < b.evidence_id ? -1 : 1))
}

/** Lane of one capability key: getCapabilityLane(state, 'reading_recognition', 'independent'). */
export function getCapabilityLane(state, capabilityKey, lane = 'overall') {
  return state?.capabilities?.[capabilityKey]?.[lane] || null
}

/** Capability keys that actually accumulated assessed evidence (states are sparse). */
export function listAssessedCapabilities(state) {
  return Object.keys(state?.capabilities || {}).sort()
}

export function getRetention(state, capabilityKey) {
  return state?.retention?.[capabilityKey] || null
}

export function getSupportFeatureSummary(state, feature) {
  return state?.support_summary?.[feature] || null
}
