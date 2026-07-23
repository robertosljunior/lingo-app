// study-focus-resolver.js — Slice V2.16. The SHARED Planner→Engine
// materialization bridge. It sits between the Study Planner ("what is
// pedagogically prioritary?") and the Lesson Engine ("how to practice it?") and
// answers the one question neither owns: "which prioritized focus can actually
// be MATERIALIZED into an activity right now?".
//
// Before this slice, both the study-session-controller and the simulation-runner
// carried a copy of the same suppression walk with a MAGIC CAP:
//   for (let attempt = 0; attempt < 60; attempt++) { planner → engine → suppress }
// The cap (5→60 over V2.11) is a symptom: it terminates by a fixed constant, so
// growing the curriculum re-breaks it. This resolver terminates ONLY by real
// CANDIDATE EXHAUSTION — every unique planner focus key is attempted at most
// once, and resolution ends when the planner has no further eligible focus.
//
// Responsibilities (§1): the resolver owns NO pedagogical weights. It receives
// the planner's ranking, tries materialization in rank order, rejects focuses
// the engine cannot serve, selects the first materializable one, and records a
// resolution trace (observability only — never the Learner Model).
//
// PURE (§32): no Date.now / Math.random; ids come from makeLessonSessionId.

import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { selectNextStudyFocusV2, studyFocusToLessonScopeV2, studyFocusKeyV2 } from './study-planner.js'

export const STUDY_FOCUS_RESOLVER_VERSION = 1

// Structured engine-rejection reason codes (§8). Never parsed from free text —
// derived from the engine decision's STRUCTURED status/reason/excluded enums.
export const RESOLVER_REJECTION_REASON_CODES = Object.freeze([
  'ENGINE_NO_ELIGIBLE_EXEMPLAR',
  'ENGINE_NO_SAFE_RECIPE',
  'ENGINE_PREREQUISITE_UNMET',
  'ENGINE_RUNTIME_UNAVAILABLE',
  'ENGINE_FOCUS_INDEPENDENCE_NOT_EXECUTABLE',
  'ENGINE_FOCUS_MODALITY_NOT_EXECUTABLE',
  'ENGINE_SESSION_EXHAUSTED',
  'ENGINE_NO_ELIGIBLE_ACTIVITY',
])

export const RESOLVER_INVARIANTS = Object.freeze([
  'FOCUS_RESOLUTION_DUPLICATE_ATTEMPT',
  'FOCUS_RESOLUTION_STOPPED_BEFORE_CANDIDATE_EXHAUSTION',
  'FOCUS_RESOLUTION_SELECTED_UNRANKED_CANDIDATE',
  'FOCUS_RESOLUTION_ATTEMPTS_EXCEED_UNIQUE_CANDIDATES',
])

export class FocusResolutionInvariantError extends Error {
  constructor(code, details = {}) {
    super(`${code}:${JSON.stringify(details)}`)
    this.name = 'FocusResolutionInvariantError'
    this.code = code
    this.details = details
  }
}

// The full candidate universe of a planner decision: every focus key the planner
// generated this turn — union of scored candidates AND everything it excluded
// (hard filters, suppression, review caps). Because `buildStudyCandidatesV2` is
// suppression-independent, this universe is identical across the resolution.
function candidateUniverseFromTrace(trace) {
  const keys = new Set()
  for (const c of trace?.candidates || []) if (c.key) keys.add(c.key)
  for (const x of trace?.excluded || []) if (x.key) keys.add(x.key)
  return keys
}

// Map an engine decision the resolver could not materialize to structured §8
// reason codes. Uses the engine's OWN structured enums — no text parsing.
export function engineRejectionReasonCodesV2(engineDecision) {
  const status = engineDecision?.status
  if (status === 'session_complete') return ['ENGINE_SESSION_EXHAUSTED']
  if (status === 'focus_not_executable') {
    return engineDecision?.reason === 'FOCUS_INDEPENDENCE_NOT_EXECUTABLE'
      ? ['ENGINE_FOCUS_INDEPENDENCE_NOT_EXECUTABLE']
      : ['ENGINE_NO_ELIGIBLE_ACTIVITY']
  }
  if (status === 'no_eligible_activity') {
    const reasons = new Set((engineDecision?.trace?.excluded || []).map((x) => x.reason).filter(Boolean))
    const codes = new Set()
    for (const r of reasons) {
      if (r.startsWith('prerequisite_')) codes.add('ENGINE_PREREQUISITE_UNMET')
      else if (r === 'no_safe_options') codes.add('ENGINE_NO_SAFE_RECIPE')
      else if (r === 'not_focus_modality') codes.add('ENGINE_FOCUS_MODALITY_NOT_EXECUTABLE')
      else if (/RUNTIME|AUDIO|SPEECH|STT|TTS|ASSESSMENT/i.test(r)) codes.add('ENGINE_RUNTIME_UNAVAILABLE')
    }
    if (!codes.size) codes.add('ENGINE_NO_ELIGIBLE_EXEMPLAR')
    return [...codes].sort()
  }
  return ['ENGINE_NO_ELIGIBLE_ACTIVITY']
}

/**
 * Resolve the next materializable study activity. PURE.
 *
 * @returns one of:
 *   { status: 'activity', focus, planner_decision, engine_decision,
 *     lesson_session, resolution_trace }
 *   { status: 'planner_empty', planner_decision, resolution_trace }   // no eligible focus at all
 *   { status: 'no_materializable_focus', planner_decision, resolution_trace } // focuses exist, none serve
 */
export function resolveNextStudyActivityV2({
  registry,
  learnerStates = [],
  recentEvidence = [],
  studySession,
  lessonSessions = {},
  plannerPolicy = {},
  enginePolicy = {},
  runtimeAvailability = null,
  allowedPackIds = null,
  profileId = null,
  now,
  makeLessonSessionId,
  // Internal seams (default to the real planner/engine). Injected only by the
  // synthetic scalability tests (§27) — the app always uses the real ones.
  selectFocus = selectNextStudyFocusV2,
  selectActivity = selectNextActivityV2,
} = {}) {
  if (typeof makeLessonSessionId !== 'function') throw new Error('RESOLVER_MAKE_LESSON_SESSION_ID_REQUIRED')

  const suppressed = []
  const attemptedKeys = new Set()
  const attempts = []
  let universe = null // Set of focus keys — established on the first planner call

  const trace = (selected, plannerDecision) => ({
    resolver_version: STUDY_FOCUS_RESOLVER_VERSION,
    candidate_count: universe ? universe.size : 0,
    unique_candidate_count: universe ? universe.size : 0,
    attempted_count: attempts.length,
    selected: selected ? { focus_key: selected.focus_key, planner_rank: selected.planner_rank } : null,
    attempts: attempts.map((a) => ({ ...a })),
    planner_status: plannerDecision?.status ?? null,
  })

  for (;;) {
    const plannerDecision = selectFocus({
      registry, learnerStates, recentEvidence, studySession,
      policy: plannerPolicy, runtimeAvailability, allowedPackIds,
      suppressedFocusKeys: suppressed,
    })

    if (universe === null) universe = candidateUniverseFromTrace(plannerDecision.trace)

    if (plannerDecision.status !== 'focus') {
      // The planner has no further eligible focus → true exhaustion.
      if (attempts.length === 0) {
        return { status: 'planner_empty', planner_decision: plannerDecision, resolution_trace: trace(null, plannerDecision) }
      }
      return { status: 'no_materializable_focus', planner_decision: plannerDecision, resolution_trace: trace(null, plannerDecision) }
    }

    const focus = plannerDecision.focus
    const key = studyFocusKeyV2(focus)
    const rank = attempts.length + 1

    // §13 invariants — bugs, never silent session-complete.
    if (attemptedKeys.has(key)) {
      throw new FocusResolutionInvariantError('FOCUS_RESOLUTION_DUPLICATE_ATTEMPT', { focus_key: key, rank })
    }
    if (universe.size && !universe.has(key)) {
      throw new FocusResolutionInvariantError('FOCUS_RESOLUTION_SELECTED_UNRANKED_CANDIDATE', { focus_key: key, universe_size: universe.size })
    }
    attemptedKeys.add(key)
    if (attemptedKeys.size > (universe.size || Infinity)) {
      throw new FocusResolutionInvariantError('FOCUS_RESOLUTION_ATTEMPTS_EXCEED_UNIQUE_CANDIDATES', { attempted: attemptedKeys.size, universe_size: universe.size })
    }

    // Engine materialization. A pack lesson session at its cap is recreated once
    // (§9) — the STUDY session may continue even when a lesson session is full.
    const { scope, focus: engineFocus, policyOverride } = studyFocusToLessonScopeV2(focus, registry)
    const runEngine = (session) => selectActivity({
      session, scope, focus: engineFocus,
      learnerStates, recentEvidence,
      policy: { ...enginePolicy, ...policyOverride },
      runtimeAvailability,
    })
    let lessonSession = lessonSessions[focus.pack_id]
      ?? createLessonSessionV2({ session_id: makeLessonSessionId(focus.pack_id), profile_id: profileId, now })
    let engineDecision = runEngine(lessonSession)
    if (engineDecision.status === 'session_complete') {
      lessonSession = createLessonSessionV2({ session_id: makeLessonSessionId(focus.pack_id), profile_id: profileId, now })
      engineDecision = runEngine(lessonSession)
    }

    if (engineDecision.status === 'activity') {
      attempts.push({ focus_key: key, planner_rank: rank, result: 'selected' })
      return {
        status: 'activity',
        focus,
        planner_decision: plannerDecision,
        engine_decision: engineDecision,
        lesson_session: lessonSession,
        resolution_trace: trace({ focus_key: key, planner_rank: rank }, plannerDecision),
      }
    }

    // Rejected — record structured reason codes, suppress this key, try the next.
    attempts.push({
      focus_key: key,
      planner_rank: rank,
      result: 'rejected',
      engine_status: engineDecision.status,
      reason_codes: engineRejectionReasonCodesV2(engineDecision),
    })
    suppressed.push(key)
  }
}

// ---- observability metrics (§21) -------------------------------------------
// Architecture metrics over a set of resolution traces. NOT pedagogical scoring
// and never fed to the Planner.

/**
 * @param {Array<{ status, resolution_trace }>} resolutions
 */
export function buildFocusMaterializationMetricsV2(resolutions = []) {
  const reasonDistribution = {}
  let activity = 0
  let plannerEmpty = 0
  let noMaterializable = 0
  let topRankMaterialized = 0
  let selectedRankSum = 0
  let rejectedBeforeSum = 0
  let maxRejectedBefore = 0
  let materializedCount = 0

  for (const r of resolutions) {
    const t = r?.resolution_trace
    if (r?.status === 'planner_empty') plannerEmpty += 1
    else if (r?.status === 'no_materializable_focus') noMaterializable += 1
    else if (r?.status === 'activity') {
      activity += 1
      materializedCount += 1
      const rank = t?.selected?.planner_rank ?? 1
      selectedRankSum += rank
      const rejectedBefore = Math.max(0, (t?.attempted_count ?? 1) - 1)
      rejectedBeforeSum += rejectedBefore
      maxRejectedBefore = Math.max(maxRejectedBefore, rejectedBefore)
      if (rank === 1) topRankMaterialized += 1
    }
    for (const a of t?.attempts || []) {
      if (a.result === 'rejected') {
        for (const code of a.reason_codes || []) reasonDistribution[code] = (reasonDistribution[code] || 0) + 1
      }
    }
  }

  const resolvedTurns = activity + plannerEmpty + noMaterializable
  return {
    resolution_count: resolvedTurns,
    focus_materialization_rate: resolvedTurns ? round4(activity / resolvedTurns) : 0,
    top_rank_materialization_rate: materializedCount ? round4(topRankMaterialized / materializedCount) : 0,
    mean_selected_rank: materializedCount ? round4(selectedRankSum / materializedCount) : 0,
    mean_rejected_before_selection: materializedCount ? round4(rejectedBeforeSum / materializedCount) : 0,
    max_rejected_before_selection: maxRejectedBefore,
    rejection_reason_distribution: reasonDistribution,
    planner_empty_count: plannerEmpty,
    no_materializable_focus_count: noMaterializable,
  }
}

/**
 * MATERIALIZATION_REJECTION_PRESSURE finding (§22): a diagnostic WARNING when a
 * high fraction of well-ranked focuses is repeatedly rejected before an activity
 * materializes. It never adjusts weights — it points at premature planning /
 * missing exemplars / prerequisite or recipe-coverage gaps. Advisory only.
 */
export function detectMaterializationRejectionPressureV2(metrics, {
  meanRejectedThreshold = 3, materializationRateFloor = 0.6,
} = {}) {
  const findings = []
  if (!metrics || !metrics.resolution_count) return findings
  if (metrics.mean_rejected_before_selection >= meanRejectedThreshold
    || metrics.focus_materialization_rate < materializationRateFloor) {
    findings.push({
      code: 'MATERIALIZATION_REJECTION_PRESSURE',
      severity: 'warning',
      mean_rejected_before_selection: metrics.mean_rejected_before_selection,
      focus_materialization_rate: metrics.focus_materialization_rate,
      no_materializable_focus_count: metrics.no_materializable_focus_count,
      rejection_reason_distribution: metrics.rejection_reason_distribution,
    })
  }
  return findings
}

function round4(n) { return Math.round(n * 1e4) / 1e4 }
