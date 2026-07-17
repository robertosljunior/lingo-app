// learner-model.js — pure, deterministic aggregation of LearnerEvidenceV2
// events into LearnerTargetStateV2 records. No I/O, no Date.now(): the state is
// a FUNCTION OF THE EVENTS ONLY (updated_at = latest occurred_at), so the
// incrementally-maintained state and a full rebuild are identical by
// construction, and aggregation is independent of insertion order (events are
// deduped by evidence_id and sorted by occurred_at + evidence_id internally).
//
// All formulas here are versioned pedagogical heuristics (AGGREGATION_VERSION),
// not scientifically validated models. See docs/pedagogy-v2-learner-model.md.
//
// Deliberately absent: any root-level mastery for a target. Mastery only exists
// per capability key (modality_capability) and per lane (overall / independent
// / supported), because recognition ≠ production, reading ≠ listening and
// supported ≠ independent.

import {
  AGGREGATION_VERSION, LEARNER_MODEL_VERSION,
  ATTRIBUTION_WEIGHT, SUPPORT_TIER_WEIGHT, INDEPENDENT_TIERS,
  ASSESSED_OUTCOMES, attemptFactor,
  MASTERY_PRIOR_SUCCESS, MASTERY_PRIOR_TOTAL,
  EVIDENCE_LEVEL_THRESHOLDS, TREND_WINDOW, TREND_MIN_EVENTS, TREND_DELTA,
  DELAYED_RETRIEVAL_MS, STABILITY_GROWTH, STABILITY_DECAY, STABILITY_MAX_DAYS,
} from './learner-model-constants.js'
import { deriveSupportTier, deriveCapabilityKey, learnerTargetStateKey } from './learner-evidence-contracts.js'

const DAY_MS = 24 * 60 * 60 * 1000
const round4 = (n) => +Number(n).toFixed(4)

function outcomeScore(event) {
  if (event.outcome === 'correct') return 1
  if (event.outcome === 'partial') return event.partial_score ?? 0.5
  return 0
}

function isAssessed(event) {
  return ASSESSED_OUTCOMES.includes(event.outcome) && event.attribution !== 'exposure'
}

/**
 * Effective weight of one event on mastery lanes:
 *   attribution (direct 1 / indirect 0.5 / exposure 0)
 *   × support tier (none 1 / low .85 / medium .6 / high .4 / answer_revealed .15)
 *   × attempt (1st 1 / 2nd .5 / 3rd+ .25)
 *   × assessment_confidence (0..1, default 1)
 * Non-assessed outcomes (observed / not_assessed) and exposure attribution
 * weigh 0 — they never move mastery.
 */
export function getEvidenceWeight(event) {
  if (!isAssessed(event)) return 0
  const tier = deriveSupportTier(event.support)
  const attribution = ATTRIBUTION_WEIGHT[event.attribution] ?? 0
  const support = SUPPORT_TIER_WEIGHT[tier] ?? 0
  const attempt = attemptFactor(event.support?.attempt_number ?? 1)
  const confidence = event.assessment_confidence ?? 1
  return round4(attribution * support * attempt * confidence)
}

function emptyLane() {
  return {
    assessed_evidence_count: 0,
    effective_evidence_weight: 0,
    weighted_success: 0,
    weighted_failure: 0,
    mastery_estimate: null,
    evidence_level: 'insufficient',
    assessment_confidence: 0,
    first_assessed_at: null,
    last_assessed_at: null,
    current_streak: 0,
    best_streak: 0,
    trend: 'insufficient',
    // internal accumulators, stripped on finalize
    _confidence_sum: 0,
    _recent_scores: [],
  }
}

function foldLane(lane, event, weight, score) {
  lane.assessed_evidence_count += 1
  lane.effective_evidence_weight += weight
  lane.weighted_success += weight * score
  lane.weighted_failure += weight * (1 - score)
  lane._confidence_sum += event.assessment_confidence ?? 1
  lane.first_assessed_at = lane.first_assessed_at ?? event.occurred_at
  lane.last_assessed_at = event.occurred_at
  if (event.outcome === 'correct') {
    lane.current_streak += 1
    lane.best_streak = Math.max(lane.best_streak, lane.current_streak)
  } else {
    lane.current_streak = 0
  }
  lane._recent_scores = [...lane._recent_scores, score].slice(-TREND_WINDOW)
}

function trendFrom(scores) {
  if (scores.length < TREND_MIN_EVENTS) return 'insufficient'
  const prev = scores.slice(-6, -3)
  const recent = scores.slice(-3)
  const avg = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length
  const diff = avg(recent) - avg(prev)
  if (diff >= TREND_DELTA) return 'improving'
  if (diff <= -TREND_DELTA) return 'declining'
  return 'stable'
}

function finalizeLane(lane) {
  const { _confidence_sum, _recent_scores, ...out } = lane
  out.effective_evidence_weight = round4(out.effective_evidence_weight)
  out.weighted_success = round4(out.weighted_success)
  out.weighted_failure = round4(out.weighted_failure)
  // Bayesian smoothing: (success + 1) / (weight + 2); null with zero evidence
  // so an untouched lane never reads as "50% mastery".
  out.mastery_estimate = out.effective_evidence_weight > 0
    ? round4((out.weighted_success + MASTERY_PRIOR_SUCCESS) / (out.effective_evidence_weight + MASTERY_PRIOR_TOTAL))
    : null
  out.evidence_level = out.effective_evidence_weight < EVIDENCE_LEVEL_THRESHOLDS.emerging ? 'insufficient'
    : out.effective_evidence_weight < EVIDENCE_LEVEL_THRESHOLDS.established ? 'emerging' : 'established'
  out.assessment_confidence = out.assessed_evidence_count ? round4(_confidence_sum / out.assessed_evidence_count) : 0
  out.trend = trendFrom(_recent_scores)
  return out
}

function emptyRetention() {
  return {
    assessed_retrievals: 0,
    successful_retrievals: 0,
    failed_retrievals: 0,
    delayed_retrievals: 0,
    successful_delayed_retrievals: 0,
    failed_delayed_retrievals: 0,
    last_retrieval_at: null,
    previous_retrieval_at: null,
    last_retrieval_interval: null,
    maximum_successful_interval: null,
    stability_estimate: null,
  }
}

// A retrieval = assessed + direct + not answer_revealed. Delayed when the gap
// since the previous retrieval of the SAME capability key ≥ DELAYED_RETRIEVAL_MS.
function foldRetention(r, event, tier) {
  const at = Date.parse(event.occurred_at)
  const prevAt = r.last_retrieval_at != null ? Date.parse(r.last_retrieval_at) : null
  const interval = prevAt != null ? at - prevAt : null
  const success = event.outcome === 'correct'

  r.assessed_retrievals += 1
  if (success) r.successful_retrievals += 1
  else r.failed_retrievals += 1

  if (interval != null && interval >= DELAYED_RETRIEVAL_MS) {
    const intervalDays = interval / DAY_MS
    r.delayed_retrievals += 1
    if (success) {
      r.successful_delayed_retrievals += 1
      const prev = r.stability_estimate
      const next = prev == null ? intervalDays : Math.max(prev * STABILITY_GROWTH, (prev + intervalDays) / 2)
      r.stability_estimate = round4(Math.min(next, STABILITY_MAX_DAYS))
    } else {
      r.failed_delayed_retrievals += 1
      if (r.stability_estimate != null) r.stability_estimate = round4(r.stability_estimate * STABILITY_DECAY)
    }
  }
  if (success && interval != null) {
    r.maximum_successful_interval = Math.max(r.maximum_successful_interval ?? 0, interval)
  }
  r.previous_retrieval_at = r.last_retrieval_at
  r.last_retrieval_at = event.occurred_at
  r.last_retrieval_interval = interval
  void tier
}

/**
 * Canonical event order: occurred_at, then evidence_id (total, deterministic).
 * Duplicated evidence_ids are collapsed to a single occurrence, which makes the
 * aggregation idempotent regardless of what the caller passes in.
 */
export function canonicalizeEvidence(events) {
  const byId = new Map()
  for (const e of events || []) {
    if (e?.evidence_id && !byId.has(e.evidence_id)) byId.set(e.evidence_id, e)
  }
  return [...byId.values()].sort((a, b) =>
    (Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
    || (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0)
    || (a.evidence_id < b.evidence_id ? -1 : a.evidence_id > b.evidence_id ? 1 : 0))
}

/**
 * Aggregate all evidence about ONE (profile, target) pair into its state.
 * Events not matching profile/target are ignored (defensive filter).
 */
export function aggregateTargetEvidence(events, { profile_id, target }) {
  const relevant = canonicalizeEvidence(events).filter((e) =>
    e.profile_id === profile_id
    && e.target?.target_type === target.target_type
    && e.target?.target_id === target.target_id)

  const state = {
    key: learnerTargetStateKey(profile_id, target),
    profile_id,
    target: { target_type: target.target_type, target_id: target.target_id },
    aggregation_version: AGGREGATION_VERSION,
    learner_model_version: LEARNER_MODEL_VERSION,
    evidence_count: relevant.length,
    exposure: { count: 0, exposure_only_count: 0, first_seen_at: null, last_seen_at: null },
    capabilities: {},
    support_summary: {},
    retention: {},
    updated_at: null,
  }

  const supportAcc = {}

  for (const event of relevant) {
    // Every event is an encounter with the target; attribution 'exposure'
    // additionally increments the exposure-only counter. Neither touches mastery.
    state.exposure.count += 1
    if (event.attribution === 'exposure') state.exposure.exposure_only_count += 1
    state.exposure.first_seen_at = state.exposure.first_seen_at ?? event.occurred_at
    state.exposure.last_seen_at = event.occurred_at
    state.updated_at = event.occurred_at

    if (!isAssessed(event)) continue

    const capKey = deriveCapabilityKey(event.activity)
    if (!capKey) continue // incompatible pairs never update any capability
    const tier = deriveSupportTier(event.support)
    const weight = getEvidenceWeight(event)
    const score = outcomeScore(event)

    if (!state.capabilities[capKey]) {
      state.capabilities[capKey] = { overall: emptyLane(), independent: emptyLane(), supported: emptyLane() }
    }
    const cap = state.capabilities[capKey]
    foldLane(cap.overall, event, weight, score)
    if (INDEPENDENT_TIERS.includes(tier)) foldLane(cap.independent, event, weight, score)
    else foldLane(cap.supported, event, weight, score)

    for (const feature of event.support?.features || []) {
      const acc = supportAcc[feature] || (supportAcc[feature] = { evidence_count: 0, success_sum: 0, last_used_at: null })
      acc.evidence_count += 1
      acc.success_sum += score
      acc.last_used_at = event.occurred_at
    }

    if (event.attribution === 'direct' && tier !== 'answer_revealed') {
      if (!state.retention[capKey]) state.retention[capKey] = emptyRetention()
      foldRetention(state.retention[capKey], event, tier)
    }
  }

  for (const capKey of Object.keys(state.capabilities)) {
    const cap = state.capabilities[capKey]
    state.capabilities[capKey] = {
      overall: finalizeLane(cap.overall),
      independent: finalizeLane(cap.independent),
      supported: finalizeLane(cap.supported),
    }
  }
  for (const [feature, acc] of Object.entries(supportAcc)) {
    state.support_summary[feature] = {
      feature,
      evidence_count: acc.evidence_count,
      // Same smoothing as mastery so one aided answer never reads as 100%.
      success_estimate: round4((acc.success_sum + MASTERY_PRIOR_SUCCESS) / (acc.evidence_count + MASTERY_PRIOR_TOTAL)),
      last_used_at: acc.last_used_at,
    }
  }
  return state
}

/** Aggregate a heterogeneous event list into one state per (profile, target). */
export function aggregateProfileEvidence(events) {
  const groups = new Map()
  for (const e of canonicalizeEvidence(events)) {
    if (!e.profile_id || !e.target?.target_id) continue
    const key = learnerTargetStateKey(e.profile_id, e.target)
    if (!groups.has(key)) groups.set(key, { profile_id: e.profile_id, target: { ...e.target }, events: [] })
    groups.get(key).events.push(e)
  }
  return [...groups.values()]
    .map((g) => aggregateTargetEvidence(g.events, g))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

/**
 * Structural comparison of two target states (both being pure functions of the
 * evidence, equal states are deeply identical). Returns the differing paths so
 * rebuild-equivalence failures are debuggable.
 */
export function compareTargetStates(a, b, { maxDifferences = 20 } = {}) {
  const differences = []
  const walk = (x, y, path) => {
    if (differences.length >= maxDifferences) return
    if (x === y) return
    if (typeof x !== typeof y || x == null || y == null || typeof x !== 'object') {
      differences.push(`${path || '.'}: ${JSON.stringify(x)} != ${JSON.stringify(y)}`)
      return
    }
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()
    for (const k of keys) walk(x[k], y[k], path ? `${path}.${k}` : k)
  }
  walk(a, b, '')
  return { equal: differences.length === 0, differences }
}
