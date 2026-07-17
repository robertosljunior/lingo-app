// pilot-session-controller.js — the V2 pilot runtime: an explicit,
// framework-free state machine orchestrating one in-memory lesson session:
//
//   idle → loading (context + first selection) → presenting → submitting
//        (validate → evaluate → build batch → record atomically) → feedback
//        → advancing (append history → reload context → select next)
//        → presenting … → complete | error
//
// Hard guarantees (proven by tests):
//   - no concurrent/double submission: submit() is a no-op outside `presenting`
//     and while a submission is in flight;
//   - the session NEVER advances unless the evidence batch persisted; on
//     failure the state is a recoverable `error` and retry reuses the SAME
//     response object (same interaction/evidence ids → idempotent);
//   - a deliberate new attempt (try again) bumps attempt_number → new ids;
//   - the engine core stays pure: clock and session id live here.
//
// All effects are injected so the controller is fully unit-testable:
//   { profileId, pack, now(), makeSessionId(), buildContext(profileId,{now}),
//     recordBatch(events), assessmentServices, capabilities, policy }

import { createLessonSessionV2, appendActivityToSessionV2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { validateActivityPlanV2 } from './lesson-engine-validator.js'
import { validateActivityResponseV2 } from './activity-runtime-validator.js'
import { evaluateActivityResponseV2 } from './activity-assessment.js'
import { buildLearnerEvidenceBatchFromInteractionV2 } from './assessment-to-evidence.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import {
  createSupportRuntime, useSupportFeature, buildActivityResponseV2,
} from './activity-runtime-contracts.js'

export const PILOT_STATES = ['idle', 'loading', 'presenting', 'submitting', 'feedback', 'advancing', 'complete', 'error']

export function createPilotSessionController(deps) {
  const {
    profileId, pack,
    now = () => new Date().toISOString(),
    makeSessionId = () => `v2pilot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    buildContext, recordBatch,
    assessmentServices = {},
    capabilities,
    enginePolicy = {},
    assessmentPolicy = undefined,
  } = deps

  const availability = computeRecipeRuntimeAvailability(capabilities)
  const listeners = new Set()

  let state = {
    status: 'idle',
    session: null,
    context: null,
    plan: null,
    decision: null,
    supportRuntime: null,
    assessment: null,
    recordedEvents: null,
    pendingResponse: null, // survives a persistence failure for idempotent retry
    error: null,
    interactions: [], // completed interactions (for the session summary)
  }

  const emit = () => { for (const l of listeners) l(state) }
  const set = (patch) => { state = { ...state, ...patch }; emit() }

  function selectNext(session, context) {
    return selectNextActivityV2({
      session, pack, context, runtimeAvailability: availability, policy: enginePolicy,
    })
  }

  function present(decision, session, context, extra = {}) {
    if (decision.status === 'activity') {
      const v = validateActivityPlanV2(decision.plan)
      if (!v.valid) {
        set({ status: 'error', error: { code: 'PLAN_INVALID', detail: v.errors.join(','), recoverable: false }, session, context, ...extra })
        return
      }
      set({
        status: 'presenting', decision, plan: decision.plan, session, context,
        supportRuntime: createSupportRuntime(decision.plan),
        assessment: null, recordedEvents: null, pendingResponse: null, error: null, ...extra,
      })
    } else {
      set({ status: 'complete', decision, plan: null, session, context, error: null, ...extra })
    }
  }

  async function start() {
    if (state.status !== 'idle' && state.status !== 'error') return
    set({ status: 'loading', error: null })
    try {
      const nowIso = now()
      const context = await buildContext(profileId, { now: nowIso, packId: pack?.manifest?.pack_id })
      const session = createLessonSessionV2({ session_id: makeSessionId(), profile_id: profileId, now: nowIso })
      present(selectNext(session, context), session, context, { interactions: [] })
    } catch (e) {
      set({ status: 'error', error: { code: 'START_FAILED', detail: String(e?.message || e), recoverable: true } })
    }
  }

  /** Record a learner-triggered support feature on the current activity. */
  function recordSupport(feature) {
    if (!state.supportRuntime) return
    set({ supportRuntime: useSupportFeature(state.supportRuntime, feature) })
  }

  /**
   * Submit the current activity. `payload` is the typed payload for the plan's
   * response type. Double-clicks are ignored (state guard). On persistence
   * failure the response is kept so retry() reuses the same ids.
   */
  async function submit(responseType, payload) {
    if (state.status !== 'presenting') return
    const response = buildActivityResponseV2({
      plan: state.plan, responseType, payload,
      supportRuntime: state.supportRuntime,
      submittedAt: now(), capabilities,
    })
    await runSubmission(response)
  }

  /** Retry a failed evaluation/persistence with the SAME response (same ids). */
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
        profileId, sessionId: state.session.session_id,
      })
      if (events.length) await recordBatch(events) // atomic + idempotent (storage)
      set({ status: 'feedback', assessment, recordedEvents: events, pendingResponse: response })
    } catch (e) {
      // Session does NOT advance; the answer stays available; retry is safe.
      set({ status: 'error', error: { code: 'SUBMIT_FAILED', detail: String(e?.message || e), recoverable: true } })
    }
  }

  /** After feedback: retry the SAME activity as a NEW attempt (new ids). */
  function tryAgain() {
    if (state.status !== 'feedback') return
    const prev = state.supportRuntime
    set({
      status: 'presenting',
      supportRuntime: { ...prev, attempt_number: prev.attempt_number + 1 },
      assessment: null, recordedEvents: null, pendingResponse: null, error: null,
    })
  }

  /** After feedback: append to history, reload context, select next activity. */
  async function advance() {
    if (state.status !== 'feedback') return
    const interaction = {
      plan: state.plan, response: state.pendingResponse,
      assessment: state.assessment, events: state.recordedEvents,
    }
    set({ status: 'advancing' })
    try {
      const nowIso = now()
      const session = appendActivityToSessionV2(state.session, state.decision, { now: nowIso })
      const context = await buildContext(profileId, { now: nowIso, packId: pack?.manifest?.pack_id })
      present(selectNext(session, context), session, context, {
        interactions: [...state.interactions, interaction],
      })
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

/** Fact-based summary for the session-complete screen (no mastery claims). */
export function summarizePilotSession(interactions = []) {
  const exemplars = new Set(); const constructions = new Set(); const modalities = new Set(); const senses = new Set()
  let assessed = 0; let exposures = 0
  for (const it of interactions) {
    exemplars.add(it.plan.exemplar_id)
    constructions.add(it.plan.construction_id)
    modalities.add(it.plan.modality)
    for (const s of it.plan.sense_ids || []) senses.add(s)
    if (it.assessment?.status === 'assessed') assessed++
    if (it.plan.recipe === 'exposure') exposures++
  }
  return {
    sentences_seen: exemplars.size,
    constructions_practiced: constructions.size,
    modalities_practiced: [...modalities],
    senses_encountered: senses.size,
    assessed_interactions: assessed,
    exposures,
  }
}
