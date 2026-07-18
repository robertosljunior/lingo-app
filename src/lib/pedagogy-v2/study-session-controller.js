// study-session-controller.js — runtime orchestration of one STUDY session
// (Slice V2.6): the in-memory state machine that alternates between the Study
// Planner (what to study) and the Lesson Engine (how to practice it):
//
//   idle → planning (context + focus + activity) → presenting → submitting
//        → feedback → planning … → complete | error
//
// Hard guarantees (mirroring the pilot controller, proven by tests):
//   - the focus is RE-EVALUATED after every assessed interaction — no fixed
//     playlist is ever generated up front;
//   - StudySessionV2 and LessonSessionV2 never collapse: the study session
//     tracks focus/pack history and the new-target budget, while each pack
//     keeps its own lesson session with the activity history;
//   - no advance without persisted evidence; retry reuses the SAME response
//     (idempotent ids); a new attempt bumps attempt_number;
//   - planner and engine cores stay pure — clock and ids live here.

import { createLessonSessionV2, appendActivityToSessionV2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { validateActivityPlanV2 } from './lesson-engine-validator.js'
import { validateActivityResponseV2 } from './activity-runtime-validator.js'
import { evaluateActivityResponseV2 } from './activity-assessment.js'
import { buildLearnerEvidenceBatchFromInteractionV2 } from './assessment-to-evidence.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { createSupportRuntime, useSupportFeature, buildActivityResponseV2 } from './activity-runtime-contracts.js'
import { createStudySessionV2, advanceStudySessionV2 } from './study-planner-contracts.js'
import { selectNextStudyFocusV2, studyFocusToLessonScopeV2, studyFocusKeyV2 } from './study-planner.js'

export const STUDY_CONTROLLER_STATES = ['idle', 'planning', 'presenting', 'submitting', 'feedback', 'advancing', 'complete', 'error']

export function createStudySessionControllerV2(deps) {
  const {
    profileId, registry, mode, focusedPackId = null,
    now = () => new Date().toISOString(),
    makeStudySessionId = () => `v2study-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    makeLessonSessionId = (packId) => `v2lesson-${packId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    buildPlannerContext, recordBatch,
    assessmentServices = {},
    capabilities,
    plannerPolicy = {},
    enginePolicy = {},
    assessmentPolicy = undefined,
    maxActivities = 12,
  } = deps

  const availability = computeRecipeRuntimeAvailability(capabilities)
  const listeners = new Set()

  let state = {
    status: 'idle',
    studySession: null,
    lessonSessions: {},     // pack_id → LessonSessionV2
    context: null,
    focus: null,
    plannerDecision: null,
    decision: null,
    plan: null,
    transition: null,       // { from_pack, to_pack, code } for the switch banner
    supportRuntime: null,
    assessment: null,
    recordedEvents: null,
    pendingResponse: null,
    error: null,
    interactions: [],
  }

  const emit = () => { for (const l of listeners) l(state) }
  const set = (patch) => { state = { ...state, ...patch }; emit() }

  const allowedPackIds = mode === 'focused'
    ? (focusedPackId ? [focusedPackId] : [])
    : null

  /**
   * One planning round: select a focus, materialize an activity with the
   * engine. Focuses the engine cannot serve are suppressed and planning
   * retries — the planner never loops forever (bounded attempts).
   */
  function planNext(studySession, context, lessonSessions, nowIso) {
    const suppressed = []
    for (let attempt = 0; attempt < 5; attempt++) {
      const plannerDecision = selectNextStudyFocusV2({
        registry,
        learnerStates: context.learner_states,
        recentEvidence: context.recent_evidence,
        studySession,
        policy: plannerPolicy,
        runtimeAvailability: availability,
        allowedPackIds,
        suppressedFocusKeys: suppressed,
      })
      if (plannerDecision.status !== 'focus') return { complete: true, plannerDecision }
      const focus = plannerDecision.focus
      const { scope, focus: engineFocus, policyOverride } = studyFocusToLessonScopeV2(focus, registry)

      let lessonSession = lessonSessions[focus.pack_id]
        ?? createLessonSessionV2({ session_id: makeLessonSessionId(focus.pack_id), profile_id: profileId, now: nowIso })
      let engineDecision = selectNextActivityV2({
        session: lessonSession, scope,
        learnerStates: context.learner_states, recentEvidence: context.recent_evidence,
        policy: { ...enginePolicy, ...policyOverride },
        focus: engineFocus,
        runtimeAvailability: availability,
      })
      if (engineDecision.status === 'session_complete') {
        // The pack's lesson session hit its cap; the STUDY session may go on
        // with a fresh lesson session for that pack.
        lessonSession = createLessonSessionV2({ session_id: makeLessonSessionId(focus.pack_id), profile_id: profileId, now: nowIso })
        engineDecision = selectNextActivityV2({
          session: lessonSession, scope,
          learnerStates: context.learner_states, recentEvidence: context.recent_evidence,
          policy: { ...enginePolicy, ...policyOverride },
          focus: engineFocus,
          runtimeAvailability: availability,
        })
      }
      if (engineDecision.status === 'activity') {
        return { focus, plannerDecision, engineDecision, lessonSession }
      }
      suppressed.push(studyFocusKeyV2(focus))
    }
    return { complete: true, plannerDecision: null }
  }

  function presentPlanned(planned, studySession, context, { interactions, lessonSessions } = {}) {
    const baseSessions = lessonSessions ?? state.lessonSessions
    const baseInteractions = interactions ?? state.interactions
    if (planned.complete) {
      set({
        status: 'complete', studySession, context, focus: null, plan: null, decision: null,
        transition: null, error: null, interactions: baseInteractions, lessonSessions: baseSessions,
      })
      return
    }
    const v = validateActivityPlanV2(planned.engineDecision.plan)
    if (!v.valid) {
      set({
        status: 'error', error: { code: 'PLAN_INVALID', detail: v.errors.join(','), recoverable: false },
        studySession, context, interactions: baseInteractions, lessonSessions: baseSessions,
      })
      return
    }
    const previousPack = studySession.pack_history[studySession.pack_history.length - 1] ?? null
    const transition = previousPack && previousPack !== planned.focus.pack_id
      ? {
          from_pack: previousPack,
          to_pack: planned.focus.pack_id,
          code: planned.plannerDecision.trace.pack_switch?.code ?? null,
        }
      : null
    const nextStudySession = advanceStudySessionV2(studySession, planned.focus, {
      now: studySession.now,
      newTargetsIntroduced: planned.focus.is_new_target ? 1 : 0,
    })
    set({
      status: 'presenting',
      studySession: nextStudySession,
      lessonSessions: { ...baseSessions, [planned.focus.pack_id]: planned.lessonSession },
      context,
      focus: planned.focus,
      plannerDecision: planned.plannerDecision,
      decision: planned.engineDecision,
      plan: planned.engineDecision.plan,
      transition,
      supportRuntime: createSupportRuntime(planned.engineDecision.plan),
      assessment: null, recordedEvents: null, pendingResponse: null, error: null,
      interactions: baseInteractions,
    })
  }

  async function start() {
    if (state.status !== 'idle' && state.status !== 'error') return
    if (mode === 'focused' && !focusedPackId) {
      set({ status: 'error', error: { code: 'PACK_UNKNOWN', detail: 'focused mode requires a pack', recoverable: false } })
      return
    }
    set({ status: 'planning', error: null })
    try {
      const nowIso = now()
      const context = await buildPlannerContext(profileId, { now: nowIso, registry })
      const studySession = createStudySessionV2({
        study_session_id: makeStudySessionId(), mode, profile_id: profileId, now: nowIso,
      })
      const planned = planNext(studySession, context, {}, nowIso)
      presentPlanned(planned, studySession, context, { interactions: [], lessonSessions: {} })
      // presentPlanned merges the planned lesson session over the empty map.
    } catch (e) {
      set({ status: 'error', error: { code: 'START_FAILED', detail: String(e?.message || e), recoverable: true } })
    }
  }

  function recordSupport(feature) {
    if (!state.supportRuntime) return
    set({ supportRuntime: useSupportFeature(state.supportRuntime, feature) })
  }

  async function submit(responseType, payload) {
    if (state.status !== 'presenting') return
    const response = buildActivityResponseV2({
      plan: state.plan, responseType, payload,
      supportRuntime: state.supportRuntime,
      submittedAt: now(), capabilities,
    })
    await runSubmission(response)
  }

  async function retry() {
    if (state.status !== 'error' || !state.pendingResponse) return
    await runSubmission(state.pendingResponse)
  }

  async function runSubmission(response) {
    set({ status: 'submitting', pendingResponse: response, error: null })
    try {
      const validation = validateActivityResponseV2(response, state.plan)
      if (!validation.valid) throw new Error(`RESPONSE_INVALID:${validation.errors.join(',')}`)
      const assessment = await evaluateActivityResponseV2({
        activityPlan: state.plan, response, assessmentServices, policy: assessmentPolicy,
      })
      const events = buildLearnerEvidenceBatchFromInteractionV2({
        activityPlan: state.plan, response, assessment,
        profileId, sessionId: state.plan.session_id,
      })
      if (events.length) await recordBatch(events)
      set({ status: 'feedback', assessment, recordedEvents: events, pendingResponse: response })
    } catch (e) {
      set({ status: 'error', error: { code: 'SUBMIT_FAILED', detail: String(e?.message || e), recoverable: true } })
    }
  }

  function tryAgain() {
    if (state.status !== 'feedback') return
    const prev = state.supportRuntime
    set({
      status: 'presenting',
      supportRuntime: { ...prev, attempt_number: prev.attempt_number + 1 },
      assessment: null, recordedEvents: null, pendingResponse: null, error: null,
    })
  }

  /**
   * After feedback: record the interaction, append to the pack's lesson
   * session, rebuild the planner context from the FRESH persisted state and
   * re-plan — the focus decision is recalculated after every assessed
   * interaction (§21), which may keep or switch the pack.
   */
  async function advance() {
    if (state.status !== 'feedback') return
    const interaction = {
      focus: state.focus,
      plan: state.plan, response: state.pendingResponse,
      assessment: state.assessment, events: state.recordedEvents,
      transition: state.transition,
    }
    set({ status: 'advancing' })
    try {
      const nowIso = now()
      const packId = state.focus.pack_id
      const lessonSession = appendActivityToSessionV2(state.lessonSessions[packId], state.decision, { now: nowIso })
      const lessonSessions = { ...state.lessonSessions, [packId]: lessonSession }
      const interactions = [...state.interactions, interaction]
      if (interactions.length >= maxActivities) {
        set({ status: 'complete', lessonSessions, interactions, plan: null, decision: null, focus: null, transition: null })
        return
      }
      const context = await buildPlannerContext(profileId, { now: nowIso, registry })
      const studySession = { ...state.studySession, now: nowIso }
      const planned = planNext(studySession, context, lessonSessions, nowIso)
      presentPlanned(planned, studySession, context, { interactions, lessonSessions })
    } catch (e) {
      set({ status: 'error', error: { code: 'ADVANCE_FAILED', detail: String(e?.message || e), recoverable: true } })
    }
  }

  return {
    start, submit, retry, advance, tryAgain, recordSupport,
    getState: () => state,
    getAvailability: () => availability,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) },
  }
}

/** Fact-based study-session summary: session facts only, never global mastery. */
export function summarizeStudySessionV2(interactions = []) {
  const packs = new Set(); const exemplars = new Set(); const constructions = new Set()
  const senses = new Set(); const lemmaByPack = new Map()
  let transitions = 0; let assessed = 0; let exposures = 0; let reviews = 0; let introductions = 0
  for (const it of interactions) {
    packs.add(it.plan.pack_id)
    if (it.plan.lexeme_lemma) lemmaByPack.set(it.plan.pack_id, it.plan.lexeme_lemma)
    exemplars.add(it.plan.exemplar_id)
    constructions.add(it.plan.construction_id)
    for (const s of it.plan.sense_ids || []) senses.add(s)
    if (it.transition) transitions++
    if (it.assessment?.status === 'assessed') assessed++
    if (it.plan.recipe === 'exposure') exposures++
    if (it.focus?.focus_type === 'review' || it.focus?.focus_type === 'remediate') reviews++
    if (it.focus?.is_new_target) introductions++
  }
  return {
    packs_practiced: [...packs].sort(),
    lemmas_practiced: [...lemmaByPack.values()].sort(),
    sentences_seen: exemplars.size,
    constructions_practiced: constructions.size,
    senses_encountered: senses.size,
    pack_transitions: transitions,
    assessed_interactions: assessed,
    exposures,
    review_focuses: reviews,
    new_uses_introduced: introductions,
  }
}
