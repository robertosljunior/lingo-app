// simulation-runner.js — the pedagogy V2 simulation harness core (Slice V2.7).
// Runs an artificial learner journey through the REAL pipeline:
//
//   Study Planner → StudyFocus → Lesson Engine → ActivityPlan
//     → simulated response → Assessment → Evidence Adapter → Learner Model
//     → new context → …
//
// The runner owns only the in-memory evidence store and the simulated clock;
// every pedagogical decision is made by the real modules (it imports them, they
// never import it). It never touches IndexedDB, never reads Date.now, never
// calls Math.random. Every simulation validates the §11 invariants and HALTS
// with a clear diagnostic (SimulationInvariantError) on any violation.

import { validateSimulationScenarioV2, simulatedTimestamp, SIMULATION_RESULT_VERSION } from './simulation-contracts.js'
import { SIMULATION_INVARIANT_CODES } from './observability-contracts.js'
import { getPersona } from './simulation-personas.js'
import { simulatePersonaResponseV2, SimulationAssessmentServiceV2 } from './simulation-response-model.js'
import { loadPedagogyV2Registry, resolvePedagogyEntity, resolvePedagogyExemplar } from './registry.js'
import { createStudySessionV2, advanceStudySessionV2 } from './study-planner-contracts.js'
import { selectNextStudyFocusV2, studyFocusToLessonScopeV2, studyFocusKeyV2 } from './study-planner.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2, appendActivityToSessionV2 } from './lesson-engine-contracts.js'
import { validateActivityResponseV2 } from './activity-runtime-validator.js'
import { evaluateActivityResponseV2 } from './activity-assessment.js'
import { finalizeSupportUsage, buildInteractionIdV2 } from './activity-runtime-contracts.js'
import { buildLearnerEvidenceBatchFromInteractionV2 } from './assessment-to-evidence.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { indexStatesByTargetId } from './lesson-engine-state-queries.js'
import { computeRecipeRuntimeAvailability, isRecipeExecutable } from './runtime-capabilities.js'
import { buildReviewQueueV2 } from './review-queue.js'

export class SimulationInvariantError extends Error {
  constructor(code, interactionIndex, details) {
    super(`SIMULATION_INVARIANT_VIOLATION:${code}@interaction=${interactionIndex}:${JSON.stringify(details)}`)
    this.name = 'SimulationInvariantError'
    this.code = code
    this.interaction_index = interactionIndex
    this.details = details
  }
}

// Root-level keys that would signal a forbidden GLOBAL mastery on a learner
// state (per-lane mastery_estimate is allowed; a per-target/per-lexeme single
// number is not).
const GLOBAL_MASTERY_KEYS = ['mastery', 'global_mastery', 'mastery_global', 'overall_mastery', 'lexeme_mastery']

function summarizePlannerTrace(trace) {
  return {
    considered: trace.considered,
    selected_key: trace.selected_key,
    pack_switch: trace.pack_switch,
    top_candidates: [...(trace.candidates || [])]
      .sort((a, b) => (b.adjusted_score ?? -Infinity) - (a.adjusted_score ?? -Infinity))
      .slice(0, 3)
      .map((c) => ({ key: c.key, focus_type: c.focus_type, adjusted_score: c.adjusted_score })),
  }
}

function compactPlan(plan) {
  return {
    activity_id: plan.activity_id,
    recipe: plan.recipe,
    activity_kind: plan.activity_kind,
    pack_id: plan.pack_id,
    lexeme_id: plan.lexeme_id,
    exemplar_id: plan.exemplar_id,
    construction_id: plan.construction_id,
    sense_ids: [...(plan.sense_ids || [])],
    capability: plan.capability,
    modality: plan.modality,
    support_tier: plan.support.derived_tier,
    primary_target: { ...plan.primary_target },
    new_item_refs: [...(plan.new_item_refs || [])],
  }
}

/** Mirror of the study session controller's planNext (bounded re-planning). */
function planNext({ registry, learnerStates, recentEvidence, studySession, policy, availability, allowedPackIds, profileId, now, lessonSessions, makeLessonSessionId }) {
  const suppressed = []
  for (let attempt = 0; attempt < 6; attempt++) {
    const plannerDecision = selectNextStudyFocusV2({
      registry, learnerStates, recentEvidence, studySession,
      policy: policy.planner, runtimeAvailability: availability, allowedPackIds,
      suppressedFocusKeys: suppressed,
    })
    if (plannerDecision.status !== 'focus') return { complete: true, plannerDecision }
    const focus = plannerDecision.focus
    const { scope, focus: engineFocus, policyOverride } = studyFocusToLessonScopeV2(focus, registry)
    let lessonSession = lessonSessions[focus.pack_id]
      ?? createLessonSessionV2({ session_id: makeLessonSessionId(focus.pack_id), profile_id: profileId, now })
    const runEngine = (session) => selectNextActivityV2({
      session, scope, focus: engineFocus,
      learnerStates, recentEvidence,
      policy: { ...policy.engine, ...policyOverride },
      runtimeAvailability: availability,
    })
    let engineDecision = runEngine(lessonSession)
    if (engineDecision.status === 'session_complete') {
      lessonSession = createLessonSessionV2({ session_id: makeLessonSessionId(focus.pack_id), profile_id: profileId, now })
      engineDecision = runEngine(lessonSession)
    }
    if (engineDecision.status === 'activity') return { focus, plannerDecision, engineDecision, lessonSession }
    suppressed.push(studyFocusKeyV2(focus))
  }
  return { complete: true, plannerDecision: null }
}

function assertInvariants({ i, mode, focus, plan, planned, availability, registry, events, profileId, response, studySessionBudget }) {
  const fail = (code, details) => { throw new SimulationInvariantError(code, i, details) }

  // 12 — active pack matches focus.
  if (plan.pack_id !== focus.pack_id) fail('ACTIVE_PACK_MATCHES_FOCUS', { plan_pack: plan.pack_id, focus_pack: focus.pack_id })

  // 11 — engine respects the focus TARGET restriction.
  if (focus.target) {
    const presented = [plan.primary_target, ...(plan.secondary_targets || [])].map((t) => t.target_id)
    if (!presented.includes(focus.target.target_id)) fail('ENGINE_RESPECTS_FOCUS', { focus_target: focus.target.target_id, presented })
  }
  // 17 / 18 (Slice V2.8) — Planner→Engine domain alignment: when the focus names
  // a capability/modality, the executed plan must train exactly that domain.
  if (focus.capability && plan.recipe !== 'exposure' && plan.capability !== focus.capability) {
    fail('FOCUS_CAPABILITY_NOT_TRAINED', { focus_capability: focus.capability, plan_capability: plan.capability })
  }
  if (focus.modality && plan.recipe !== 'exposure' && plan.modality !== focus.modality) {
    fail('FOCUS_MODALITY_NOT_TRAINED', { focus_modality: focus.modality, plan_modality: plan.modality })
  }
  // 16 (Slice V2.8) — an independence focus must produce UNAIDED evidence; it may
  // NEVER be served as a supported activity (the V2.7 loop, now impossible).
  if (focus.focus_type === 'independence' && plan.support.derived_tier !== 'none') {
    fail('INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY', { tier: plan.support.derived_tier, capability: plan.capability, modality: plan.modality })
  }

  // 4 / 15 — target ids resolve and are typed V2 ids (never a bare V1 skill).
  for (const id of [focus.target?.target_id, plan.primary_target.target_id].filter(Boolean)) {
    if (!id.includes(':')) fail('NO_HIDDEN_V1_SKILL', { target_id: id })
    if (!resolvePedagogyEntity(id, registry)) fail('TARGET_IDS_RESOLVE', { target_id: id })
  }

  // 3 — runtime-compatible focus (the emitted recipe is executable here).
  if (!isRecipeExecutable(availability, plan.recipe, plan.modality)) {
    fail('RUNTIME_COMPATIBLE_FOCUS', { recipe: plan.recipe, modality: plan.modality })
  }

  // 1 — review mode never introduces a new target.
  if (mode === 'review' && focus.is_new_target) fail('REVIEW_MODE_NO_NEW_TARGET', { focus_key: studyFocusKeyV2(focus) })

  // 2 — new-item budget respected (engine per-session budget + study budget).
  const remainingAfter = plan.selection_trace?.budget?.remaining_after
  if (typeof remainingAfter === 'number' && remainingAfter < 0) fail('NEW_ITEM_BUDGET_RESPECTED', { remaining_after: remainingAfter })
  if (focus.is_new_target && studySessionBudget.used >= studySessionBudget.maximum) {
    fail('NEW_ITEM_BUDGET_RESPECTED', { study_budget: studySessionBudget })
  }

  // 13 / 14 — authored sentence only; options come from authored translations.
  const authored = resolvePedagogyExemplar(plan.exemplar_id, registry)?.entity
  if (!authored || authored.text_en !== plan.text_en || authored.text_pt !== plan.text_pt) {
    fail('AUTHORED_SENTENCE_ONLY', { exemplar_id: plan.exemplar_id })
  }
  for (const o of plan.presentation?.options || []) {
    const src = resolvePedagogyExemplar(o.source_exemplar_id, registry)?.entity
    if (!src || src.text_pt !== o.text_pt) fail('NO_GENERATED_TEXT', { option: o.option_id, source: o.source_exemplar_id })
  }

  // 6 / 5 / 7 — deterministic interaction id, unique + isolated evidence.
  const expectedInteractionId = buildInteractionIdV2({ sessionId: plan.session_id, activityId: plan.activity_id, attemptNumber: response.attempt_number })
  if (response.interaction_id !== expectedInteractionId) fail('INTERACTION_IDS_DETERMINISTIC', { got: response.interaction_id, expected: expectedInteractionId })
  for (const e of events) {
    if (e.profile_id !== profileId) fail('EVIDENCE_PROFILE_ISOLATION', { evidence_id: e.evidence_id, profile_id: e.profile_id })
  }

  // 8 — independent variant is unaided (tier none).
  const tier = finalizeSupportUsage(response.support_usage).derived_tier
  if (plan.support.derived_tier === 'none' && tier !== 'none') fail('INDEPENDENT_LANE_UNAIDED', { tier })

  // 9 — exposure never yields an assessed (mastery-moving) outcome.
  if (plan.recipe === 'exposure') {
    for (const e of events) {
      if (e.attribution !== 'exposure' || e.outcome !== 'observed') fail('EXPOSURE_NEVER_MASTERY', { evidence_id: e.evidence_id, attribution: e.attribution, outcome: e.outcome })
    }
  }
}

function assertNoGlobalMastery(states, i) {
  for (const s of states) {
    for (const k of GLOBAL_MASTERY_KEYS) {
      if (k in s) throw new SimulationInvariantError('NO_GLOBAL_MASTERY', i, { key: k, target: s.target?.target_id })
    }
  }
}

/**
 * Run a SimulationScenarioV2. Options: { registry, assessmentServices,
 * plannerPolicy, enginePolicy, recentEvidenceLimit }. Returns a deterministic
 * SimulationResultV2. Throws SimulationInvariantError on any invariant breach.
 */
export async function runSimulationV2(scenario, opts = {}) {
  const v = validateSimulationScenarioV2(scenario)
  if (!v.valid) throw new Error(`SIMULATION_SCENARIO_INVALID:${v.errors.join(',')}`)

  const registry = opts.registry ?? loadPedagogyV2Registry()
  const persona = getPersona(scenario.persona)
  const availability = computeRecipeRuntimeAvailability(scenario.runtime_capabilities)
  const assessmentServices = opts.assessmentServices ?? SimulationAssessmentServiceV2
  const profileId = scenario.profile_id
  const seed = String(scenario.seed)
  const startMs = Date.parse(scenario.start_at)
  const recentLimit = opts.recentEvidenceLimit ?? 100
  const allowedPackIds = scenario.mode === 'focused' ? [scenario.focused_pack_id] : null
  const policy = {
    planner: scenario.policy_overrides?.planner ?? {},
    engine: scenario.policy_overrides?.engine ?? {},
    assessment: scenario.policy_overrides?.assessment,
  }
  // Deterministically-unique lesson-session id per (pack) creation: a recreated
  // session (after its cap) must not reuse an id, or activity/interaction/
  // evidence ids would collide. A monotonic counter keeps it deterministic.
  const lessonSessionCounter = {}
  const makeLessonSessionId = (packId) => {
    lessonSessionCounter[packId] = (lessonSessionCounter[packId] || 0) + 1
    return `sim-lesson:${scenario.scenario_id}:${packId}:${lessonSessionCounter[packId]}`
  }

  // In-memory evidence store (dedupe by evidence_id, like storage).
  const evidence = []
  const seenEvidenceIds = new Set()
  const addEvidence = (e) => { if (!seenEvidenceIds.has(e.evidence_id)) { seenEvidenceIds.add(e.evidence_id); evidence.push(e) } }
  for (const e of scenario.initial_evidence || []) addEvidence(e)

  let studySession = createStudySessionV2({
    study_session_id: `sim:${scenario.scenario_id}`, mode: scenario.mode,
    profile_id: profileId, now: simulatedTimestamp(startMs, scenario.clock, 0), seed,
  })
  const lessonSessions = {}
  const interactions = []
  let lastNow = studySession.now

  for (let i = 0; i < scenario.maximum_interactions; i++) {
    const now = simulatedTimestamp(startMs, scenario.clock, i)
    lastNow = now
    const learnerStates = aggregateProfileEvidence(evidence)
    assertNoGlobalMastery(learnerStates, i)
    const statesById = indexStatesByTargetId(learnerStates)
    const recentEvidence = evidence.slice(-recentLimit)
    studySession = { ...studySession, now }

    const planned = planNext({
      registry, learnerStates, recentEvidence, studySession, policy, availability,
      allowedPackIds, profileId, now, lessonSessions, makeLessonSessionId,
    })
    if (planned.complete) break

    const { focus, plannerDecision, engineDecision } = planned
    const plan = engineDecision.plan
    const packBefore = studySession.pack_history[studySession.pack_history.length - 1] ?? null

    // Simulated response through the REAL runtime contracts.
    const { response, intended_success } = simulatePersonaResponseV2({
      persona, plan, statesById, seed, interactionIndex: i, now, capabilities: scenario.runtime_capabilities,
    })
    const rv = validateActivityResponseV2(response, plan)
    if (!rv.valid) throw new SimulationInvariantError('RUNTIME_COMPATIBLE_FOCUS', i, { response_errors: rv.errors })

    const assessment = await evaluateActivityResponseV2({ activityPlan: plan, response, assessmentServices, policy: policy.assessment })
    const events = buildLearnerEvidenceBatchFromInteractionV2({ activityPlan: plan, response, assessment, profileId, sessionId: plan.session_id })

    // Invariants (halt on any violation).
    assertInvariants({
      i, mode: scenario.mode, focus, plan, planned, availability, registry, events, profileId, response,
      studySessionBudget: studySession.new_target_budget,
    })
    for (const e of events) {
      if (seenEvidenceIds.has(e.evidence_id)) throw new SimulationInvariantError('EVIDENCE_IDS_UNIQUE', i, { evidence_id: e.evidence_id })
    }

    // Advance the study session (records focus/pack history + budget) and the
    // pack's lesson session (activity history) — never collapsed.
    studySession = advanceStudySessionV2(studySession, focus, { now, newTargetsIntroduced: focus.is_new_target ? 1 : 0 })
    lessonSessions[focus.pack_id] = appendActivityToSessionV2(planned.lessonSession, engineDecision, { now })
    for (const e of events) addEvidence(e)

    interactions.push({
      index: i,
      timestamp: now,
      study_focus: {
        focus_type: focus.focus_type, pack_id: focus.pack_id, lexeme_id: focus.lexeme_id,
        target: focus.target ? { ...focus.target } : null, capability: focus.capability, modality: focus.modality,
        is_new_target: focus.is_new_target, reason_codes: [...focus.reason_codes],
      },
      planner_trace: summarizePlannerTrace(plannerDecision.trace),
      // Domains (capability_modality) that were ELIGIBLE this step (a viable,
      // scored candidate existed) — powers opportunity-aware coverage, which
      // separates "couldn't practice" from "could and never chose to" (§22).
      eligible_domains: [...new Set((plannerDecision.trace?.candidates || [])
        .filter((c) => c.adjusted_score != null && c.capability && c.modality)
        .map((c) => `${c.capability}_${c.modality}`))].sort(),
      pack_switch: plannerDecision.trace.pack_switch,
      activity_plan: compactPlan(plan),
      response: { response_type: response.response_type, intended_success, support_tier: finalizeSupportUsage(response.support_usage).derived_tier },
      assessment: { status: assessment.status, outcome: assessment.outcome, partial_score: assessment.partial_score },
      assessed_targets: (assessment.target_assessments || []).map((t) => `${t.target_type}:${t.target_id}`),
      direct_targets: (plan.planned_evidence || [])
        .filter((pe) => pe.attribution === 'direct' && !pe.condition)
        .map((pe) => `${pe.target.target_type}:${pe.target.target_id}`),
      new_item_refs: [...(plan.new_item_refs || [])],
      evidence_ids: events.map((e) => e.evidence_id),
      pack_before: packBefore,
      pack_after: focus.pack_id,
      target: { ...plan.primary_target },
      capability: plan.capability,
      modality: plan.modality,
      support_tier: plan.support.derived_tier,
      recipe: plan.recipe,
      activity_kind: plan.activity_kind,
    })
  }

  const finalLearnerStates = aggregateProfileEvidence(evidence)
  assertNoGlobalMastery(finalLearnerStates, interactions.length)
  const finalReviewQueue = buildReviewQueueV2({ registry, learnerStates: finalLearnerStates, recentEvidence: evidence.slice(-recentLimit), now: lastNow })

  // Serializable scenario copy (never carry the registry object into output).
  const { registry: _drop, ...scenarioOut } = scenario

  return {
    result_version: SIMULATION_RESULT_VERSION,
    scenario: scenarioOut,
    interactions,
    study_focus_history: interactions.map((it) => it.study_focus),
    activity_history: interactions.map((it) => it.activity_plan),
    pack_history: interactions.map((it) => it.pack_after),
    target_history: interactions.map((it) => it.target.target_id),
    evidence_generated: evidence.filter((e) => !(scenario.initial_evidence || []).some((s) => s.evidence_id === e.evidence_id)),
    final_learner_states: finalLearnerStates,
    final_review_queue: finalReviewQueue,
    invariants: { checked: [...SIMULATION_INVARIANT_CODES], violations: [] },
  }
}
