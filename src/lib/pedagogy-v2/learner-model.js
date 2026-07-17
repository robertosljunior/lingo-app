// learner-model.js — pure core of the learner model V2.
//
// Two data shapes:
//   learner_evidence_v2      — immutable, append-only events: one observation
//                              of one target in one full learning domain.
//   learner_target_states_v2 — derived, fully reconstructible states: a
//                              deterministic fold over the evidence log.
//
// Everything here is side-effect free; persistence lives in learner-store.js.
// There is deliberately NO function that aggregates a target across
// capabilities into a single mastery number.

import {
  LEARNER_MODEL_V2_SCHEMA_VERSION,
  CAPABILITIES_V2, EVIDENCE_OUTCOMES_V2, OUTCOME_VALUE_V2,
  EVIDENCE_ID_PREFIX, EVIDENCE_TARGET_TYPES,
  isCapabilityModalityValid, isSupportLane, learnerDomainKey,
} from './learner-contracts.js'
import { TARGET_TYPE_PREFIX } from './contracts.js'
import { getExemplar } from './query.js'

// Exponential moving average factor for strength: recent evidence dominates,
// old evidence decays but is never erased (the log is the source of truth).
const STRENGTH_ALPHA = 0.35

// ---- evidence validation ----

// Structural validation of one evidence event. When `packs` (validated
// pedagogy-v2 packs) are provided, target_id and exemplar_id must resolve in
// the registry — evidence about content that does not exist is rejected.
export function validateLearnerEvidenceV2(event, { packs = null } = {}) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!event || typeof event !== 'object') return { valid: false, errors: ['EVIDENCE_REQUIRED'] }

  const where = event.evidence_id || 'evidence[?]'
  if (typeof event.evidence_id !== 'string' || !event.evidence_id.startsWith(EVIDENCE_ID_PREFIX) || event.evidence_id.length <= EVIDENCE_ID_PREFIX.length) {
    err('EVIDENCE_ID_INVALID', String(event.evidence_id))
  }
  if (event.schema_version !== LEARNER_MODEL_V2_SCHEMA_VERSION) err('EVIDENCE_SCHEMA_VERSION_INVALID', where)
  if (!event.profile_id) err('EVIDENCE_PROFILE_REQUIRED', where)
  if (!event.session_id) err('EVIDENCE_SESSION_REQUIRED', where)
  if (!Number.isFinite(event.created_at) || event.created_at <= 0) err('EVIDENCE_CREATED_AT_INVALID', where)

  if (!EVIDENCE_TARGET_TYPES.includes(event.target_type)) {
    err('EVIDENCE_TARGET_TYPE_INVALID', `${where}.target_type=${event.target_type}`)
  } else {
    const prefix = TARGET_TYPE_PREFIX[event.target_type]
    if (typeof event.target_id !== 'string' || !event.target_id.startsWith(prefix)) {
      err('EVIDENCE_TARGET_ID_PREFIX_MISMATCH', `${where}=${event.target_id} (expected prefix "${prefix}")`)
    }
  }

  if (!isCapabilityModalityValid(event.capability, event.modality)) {
    err('EVIDENCE_DOMAIN_INVALID', `${where} capability=${event.capability} modality=${event.modality}`)
  }
  if (!isSupportLane(event.support_lane)) err('EVIDENCE_SUPPORT_LANE_INVALID', `${where}=${event.support_lane}`)
  if (!EVIDENCE_OUTCOMES_V2.includes(event.outcome)) err('EVIDENCE_OUTCOME_INVALID', `${where}=${event.outcome}`)
  if (event.score != null && !(event.score >= 0 && event.score <= 1)) err('EVIDENCE_SCORE_INVALID', `${where}=${event.score}`)

  if (packs) {
    const targetKnown = packs.some((p) =>
      (p.senses || []).some((s) => s.sense_id === event.target_id)
      || (p.constructions || []).some((c) => c.construction_id === event.target_id)
      || (p.communicative_functions || []).some((f) => f.function_id === event.target_id)
      || (p.lexemes || []).some((l) => l.lexeme_id === event.target_id))
    if (!targetKnown) err('EVIDENCE_TARGET_UNRESOLVED', `${where}→${event.target_id}`)
    if (event.exemplar_id && !packs.some((p) => getExemplar(p, event.exemplar_id))) {
      err('EVIDENCE_EXEMPLAR_UNRESOLVED', `${where}→${event.exemplar_id}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// Convenience builder: fills schema_version and derives a stable evidence_id
// from profile + session + a caller-provided sequence number. Deterministic —
// no randomness, no clock reads.
export function buildLearnerEvidenceV2({
  profile_id, session_id, seq,
  pack_id = null, exemplar_id = null,
  target_id, target_type,
  capability, modality, support_lane,
  outcome, score = null, created_at,
}) {
  return {
    evidence_id: `${EVIDENCE_ID_PREFIX}${profile_id}.${session_id}.${seq}`,
    schema_version: LEARNER_MODEL_V2_SCHEMA_VERSION,
    profile_id, session_id,
    pack_id, exemplar_id,
    target_id, target_type,
    capability, modality, support_lane,
    outcome,
    score: score == null ? OUTCOME_VALUE_V2[outcome] ?? null : score,
    created_at,
  }
}

// ---- state reconstruction ----

// Deterministic fold of an evidence log into learner_target_states_v2 rows.
// Events are ordered by (created_at, evidence_id) so the result is a pure
// function of the log, independent of insertion order. Each state row covers
// exactly one learning domain; nothing is summed across capabilities.
export function reduceLearnerStatesV2(events) {
  const ordered = [...(events || [])].sort((a, b) =>
    (a.created_at - b.created_at) || String(a.evidence_id).localeCompare(String(b.evidence_id)))
  const states = new Map()
  for (const e of ordered) {
    const key = learnerDomainKey(e)
    let s = states.get(key)
    if (!s) {
      s = {
        state_key: key,
        schema_version: LEARNER_MODEL_V2_SCHEMA_VERSION,
        target_id: e.target_id,
        target_type: e.target_type,
        capability: e.capability,
        modality: e.modality,
        support_lane: e.support_lane,
        attempts: 0,
        successes: 0,
        streak: 0,
        strength: 0,
        first_evidence_at: e.created_at,
        last_evidence_at: e.created_at,
        last_success_at: null,
        last_outcome: null,
      }
      states.set(key, s)
    }
    const value = e.score != null ? e.score : (OUTCOME_VALUE_V2[e.outcome] ?? 0)
    s.attempts += 1
    s.successes += OUTCOME_VALUE_V2[e.outcome] ?? 0
    s.streak = e.outcome === 'correct' ? s.streak + 1 : 0
    s.strength = s.attempts === 1 ? value : s.strength + STRENGTH_ALPHA * (value - s.strength)
    s.last_evidence_at = e.created_at
    if (e.outcome !== 'incorrect') s.last_success_at = e.created_at
    s.last_outcome = e.outcome
  }
  // Round strength so reconstructed states compare cleanly across platforms.
  return [...states.values()].map((s) => ({ ...s, strength: Math.round(s.strength * 1000) / 1000 }))
}

// ---- read helpers over a state list ----

export function indexStatesByDomain(states) {
  return new Map((states || []).map((s) => [s.state_key, s]))
}

export function getStatesForTarget(states, target_id) {
  return (states || []).filter((s) => s.target_id === target_id)
}

// Strongest evidence for a target within ONE capability (across modalities and
// lanes). This is the ladder question — "can this learner recognize the
// target at all?" — not a global mastery: callers must always name the
// capability they care about.
export function capabilityStrength(states, target_id, capability) {
  let best = null
  for (const s of getStatesForTarget(states, target_id)) {
    if (s.capability !== capability) continue
    if (!best || s.strength > best.strength) best = s
  }
  return best ? { strength: best.strength, attempts: best.attempts } : { strength: 0, attempts: 0 }
}

// A target is "known" (for prerequisite checks) when any of its domains meets
// the threshold — production evidence counts, since producing implies knowing.
export function isTargetKnown(states, target_id, { min_strength = 0.55, min_attempts = 1 } = {}) {
  return getStatesForTarget(states, target_id)
    .some((s) => s.attempts >= min_attempts && s.strength >= min_strength)
}

export function isTargetSeen(states, target_id) {
  return getStatesForTarget(states, target_id).length > 0
}

// Retention status of one state under a per-capability interval policy.
// overdue_ratio: 0 = just practiced, 1 = exactly at the interval, >1 overdue.
export function retentionStatusV2(state, { now, intervals }) {
  const interval_ms = intervals?.[state.capability]
  if (!interval_ms || !state.last_evidence_at) return { interval_ms: interval_ms || null, elapsed_ms: null, overdue_ratio: 0 }
  const elapsed_ms = Math.max(0, now - state.last_evidence_at)
  return { interval_ms, elapsed_ms, overdue_ratio: elapsed_ms / interval_ms }
}
