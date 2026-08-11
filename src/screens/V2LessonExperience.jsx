// V2LessonExperience.jsx — learner-facing lesson screen on the real V2
// Planner → Resolver → Engine → Assessment → Evidence pipeline.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import { buildStudyPlannerContextV2 } from '../lib/pedagogy-v2/study-planner-context.js'
import { createStudySessionControllerV2 } from '../lib/pedagogy-v2/study-session-controller.js'
import { createProductionAssessmentServicesV2 } from '../lib/pedagogy-v2/production-assessment-service.js'
import { detectRuntimeCapabilitiesV2 } from '../lib/pedagogy-v2/runtime-capabilities.js'
import { buildActivityResponseV2, buildMaskedCompletion } from '../lib/pedagogy-v2/activity-runtime-contracts.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import { buildLearnerPresentationV2 } from '../lib/pedagogy-v2/learner-presentation-v2.js'
import { buildLearnerSessionResultV2, resolveLessonModeV2, buildContextualSessionEntryV2, buildRecipePreferenceNoticeV2 } from '../lib/pedagogy-v2/learner-home-presentation.js'
import { buildStudyScopeFromCollectionV2 } from '../lib/pedagogy-v2/study-scope.js'
import { recordDurableLearnerInteractionV2, finalizeDurableStudySessionV2 } from '../lib/pedagogy-v2/durable-interaction-storage.js'
import {
  stageDurableLearnerSubmissionV2,
  settleDurableLearnerSubmissionV2,
  reconcileInterruptedStudySessionsV2,
  closeDurableStudySessionV2,
} from '../lib/pedagogy-v2/durable-submission-recovery.js'
import V2LessonShell from '../components/pedagogy-v2-learner/V2LessonShell.jsx'
import V2SessionSummary from '../components/pedagogy-v2-learner/V2SessionSummary.jsx'
import { useReducedMotion } from '../components/pedagogy-v2-learner/useReducedMotion.js'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'

export function v2LearnerExperienceEnabled(settings) {
  return learnerExperienceV2Enabled(settings)
}

export default function V2LessonExperience() {
  const { settings, activeProfile, db, setTab, params } = useApp()
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const capabilities = useMemo(() => detectRuntimeCapabilitiesV2({ ttsSupported: speechSupported, sttSupported }), [])
  const reducedMotion = useReducedMotion(settings?.reduced_motion)

  const initial = useMemo(() => resolveLessonModeV2(params), []) // eslint-disable-line react-hooks/exhaustive-deps
  const studyScope = useMemo(
    () => buildStudyScopeFromCollectionV2(initial.collectionId, registry),
    [initial.collectionId, registry],
  )
  const scopeError = studyScope?.error ?? null
  const [session, setSession] = useState({
    mode: initial.mode,
    pack: initial.focusedPackId,
    error: initial.error ?? scopeError ?? null,
    nonce: 0,
  })
  const [state, setState] = useState(null)
  const [submissionPersistenceError, setSubmissionPersistenceError] = useState(null)
  const controllerRef = useRef(null)
  const submissionLockRef = useRef(false)

  const restartWithMode = (mode) => setSession((current) => ({ mode, pack: null, error: null, nonce: current.nonce + 1 }))

  useEffect(() => {
    if (!v2LearnerExperienceEnabled(settings)) return undefined
    if (session.error) return undefined
    let reconciledPreviousRuntime = false
    const controller = createStudySessionControllerV2({
      profileId: activeProfile,
      registry,
      mode: session.mode,
      focusedPackId: session.pack,
      studyScope: scopeError ? null : studyScope,
      recipePreference: initial.recipePreference,
      // RX-1C: the first planner read is also the recovery boundary. Any active
      // durable session belongs to a previous page/runtime and becomes
      // interrupted before a new study_session_id is created.
      buildPlannerContext: async (profileId, opts) => {
        if (!reconciledPreviousRuntime) {
          await reconcileInterruptedStudySessionsV2(profileId)
          reconciledPreviousRuntime = true
        }
        return buildStudyPlannerContextV2(profileId, opts)
      },
      // Kept for diagnostic/controller compatibility. The learner-facing path
      // uses persistInteraction below, which records the interaction and these
      // evidence events in one IndexedDB transaction.
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      persistInteraction: async (input) => {
        const result = await recordDurableLearnerInteractionV2(input)
        // The receipt is auxiliary. Final interaction + evidence remains the
        // atomic source of truth; receipt cleanup is idempotent and any crash
        // here is cleaned by the next reconciliation.
        await settleDurableLearnerSubmissionV2(input.response.interaction_id, { profileId: input.profileId })
        return result
      },
      finalizeSession: finalizeDurableStudySessionV2,
      capabilities,
      assessmentServices: createProductionAssessmentServicesV2(),
    })
    controllerRef.current = controller
    const unsubscribe = controller.subscribe((next) => {
      setState(next)
      if (next.status !== 'error') setSubmissionPersistenceError(null)
    })
    setState(controller.getState())
    controller.start()
    return () => { unsubscribe?.(); controllerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.mode, session.pack, session.nonce])

  const controller = controllerRef.current
  const current = state

  // E2E-only decision telemetry. Present exclusively when `window.__e2e` exists
  // (the harness sets `sessionStorage['e2e:enabled']` before boot), so no
  // learner build carries it. Everything here is READ from the plan the real
  // pipeline already produced — the hook observes the decision, it never
  // influences it. The anti-repetition E2E needs the selection trace as well as
  // the answer key: a harness that clicks "the first option" measures a learner
  // who is guessing, not one who is getting it right.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__e2e) return
    const plan = current?.plan
    const diversity = plan?.selection_trace?.experience_diversity ?? null
    window.__e2e.v2Activity = plan
      ? {
        recipe: plan.recipe,
        text_en: plan.text_en ?? null,
        correct_option_id: plan.response_contract?.correct_option_id ?? null,
        exemplar_id: plan.exemplar_id ?? null,
        // identity of the decision
        study_session_id: current.studySession?.study_session_id ?? null,
        lesson_session_id: plan.session_id ?? null,
        activity_id: plan.activity_id ?? null,
        planner_focus_key: current.focus
          ? [current.focus.pack_id, current.focus.focus_type, current.focus.target?.target_id ?? '-',
            current.focus.capability ?? '-', current.focus.modality ?? '-'].join('|')
          : null,
        focus_type: current.focus?.focus_type ?? null,
        pack_id: plan.pack_id ?? null,
        target_id: plan.primary_target?.target_id ?? null,
        capability: plan.capability ?? null,
        modality: plan.modality ?? null,
        lane: plan.support?.derived_tier === 'none' ? 'independent' : 'supported',
        construction_id: plan.construction_id ?? null,
        engine_version: plan.selection_trace?.engine_version ?? null,
        policy_version: plan.selection_trace?.policy_version ?? null,
        // pool / band observability (V2.21 §9)
        total_candidates: diversity?.pool?.total_candidates ?? null,
        same_focus_candidates: diversity?.pool?.same_focus_candidates ?? null,
        band_size: diversity?.pool?.band_size ?? null,
        band_exemplars: diversity?.pool?.band_exemplars ?? [],
        band_recipes: diversity?.pool?.band_recipes ?? [],
        fresh_candidates: diversity?.pool?.fresh_candidates ?? null,
        selected_exemplar_recent: diversity?.exemplar_within_recent_window ?? null,
        interactions_since_seen: diversity?.interactions_since_seen ?? null,
        recent_window: diversity?.recent_window ?? null,
        // answer keys, so the harness can respond CORRECTLY rather than guess
        response_type: plan.response_contract?.response_type ?? null,
        canonical_tokens: plan.text_en ? plan.text_en.trim().split(/\s+/) : null,
        expected_completion_tokens: plan.recipe === 'fixed_element_completion'
          ? buildMaskedCompletion(plan).expected_tokens
          : null,
      }
      : null
    window.__e2e.v2Scope = (studyScope && !studyScope.error)
      ? { collection_id: studyScope.collection_id, allowed_exemplar_ids: studyScope.allowed_exemplar_ids }
      : null
  }, [current?.plan, studyScope])

  const presentation = useMemo(() => {
    if (!current || !current.plan) return null
    return buildLearnerPresentationV2({
      plan: current.plan,
      response: current.pendingResponse,
      assessment: current.assessment,
      focus: current.focus,
      transition: current.transition,
      registry,
      recordedEvidence: current.recordedEvents,
      learnerStates: current.context?.learner_states ?? null,
      studyScope: scopeError ? null : studyScope,
    })
  }, [current?.plan, current?.assessment, current?.pendingResponse, current?.focus, current?.transition, registry, current?.recordedEvents, current?.context, studyScope, scopeError])

  const sessionResult = useMemo(() => {
    if (current?.status !== 'complete') return null
    return buildLearnerSessionResultV2({ interactions: current.interactions, mode: session.mode, registry })
  }, [current?.status, current?.interactions, session.mode, registry])

  const contextEntry = useMemo(
    () => buildContextualSessionEntryV2({
      collectionTitle: scopeError ? null : (studyScope?.title_pt ?? null),
      format: params?.format ?? 'mixed',
    }),
    [studyScope, scopeError, params?.format],
  )

  const preferenceNotice = useMemo(() => {
    if (!initial.recipePreference || !current?.plan) return null
    if (current.plan.recipe === initial.recipePreference) return null
    if (current.interactions?.some((interaction) => interaction.plan?.recipe === initial.recipePreference)) return null
    return buildRecipePreferenceNoticeV2({
      format: params?.format ?? 'mixed',
      collectionTitle: scopeError ? null : (studyScope?.title_pt ?? null),
    })
  }, [initial.recipePreference, current?.plan, current?.interactions, params?.format, studyScope, scopeError])

  const goHome = () => setTab(SCREENS.HOME)

  async function submitWithWriteAhead(responseType, payload) {
    if (submissionLockRef.current || !controller || current?.status !== 'presenting' || !current?.plan) return
    submissionLockRef.current = true
    setSubmissionPersistenceError(null)
    try {
      const receiptResponse = buildActivityResponseV2({
        plan: current.plan,
        responseType,
        payload,
        supportRuntime: current.supportRuntime,
        submittedAt: new Date().toISOString(),
        capabilities,
      })
      await stageDurableLearnerSubmissionV2({
        profileId: activeProfile,
        studySession: current.studySession,
        studyScope: scopeError ? null : studyScope,
        recipePreference: initial.recipePreference,
        focus: current.focus,
        plan: current.plan,
        response: receiptResponse,
      })

      // Test-only interruption seam: it stops after the real write-ahead receipt
      // and before controller assessment. Production never sets this flag.
      if (typeof window !== 'undefined' && window.__e2e?.v2PauseAfterSubmissionStage) {
        window.__e2e.v2StagedInteractionId = receiptResponse.interaction_id
        return
      }
      await controller.submit(responseType, payload)
    } catch (error) {
      setSubmissionPersistenceError(String(error?.message || error))
    } finally {
      submissionLockRef.current = false
    }
  }

  async function closeToHome() {
    const snapshot = controller?.getState()
    const studySessionId = snapshot?.studySession?.study_session_id
    try {
      if (studySessionId) {
        await closeDurableStudySessionV2(studySessionId, {
          profileId: activeProfile,
          status: 'abandoned',
        })
      }
    } catch (error) {
      // Do not claim the session closed when the local journal failed. The
      // next boot reconciliation remains able to recover the active record.
      setSubmissionPersistenceError(String(error?.message || error))
      return
    }
    goHome()
  }

  if (!v2LearnerExperienceEnabled(settings)) {
    return (
      <div className="phone">
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2lx-unavailable">A nova experiência V2 está desativada. Ative-a nas configurações experimentais.</p>
          <button className="btn btn-secondary" onClick={() => setTab(SCREENS.HOME)}>Voltar</button>
        </div>
      </div>
    )
  }

  if (session.error) {
    return (
      <div className="phone v2lx" data-testid="v2lx-screen" data-experience="v2" data-surface="lesson">
        <div className="v2lx-scroll"><div className="v2lx-content" style={{ textAlign: 'center', paddingTop: 60 }}>
          <div className="v2lx-card" data-testid="v2lx-mode-error">
            <div style={{ fontWeight: 900, fontSize: 18 }}>Não foi possível abrir esta prática.</div>
            <button type="button" className="v2lx-cta" style={{ marginTop: 16 }} onClick={goHome}>Voltar</button>
          </div>
        </div></div>
      </div>
    )
  }

  return (
    <div className="phone" data-testid="v2lx-screen" data-experience="v2" data-surface="lesson" data-mode={session.mode} data-pack={current?.plan?.pack_id ?? session.pack ?? null} style={{ overflow: 'hidden' }}>
      {submissionPersistenceError && (
        <div role="alert" data-testid="v2lx-storage-error" style={{ position: 'absolute', zIndex: 20, top: 12, left: 16, right: 16, padding: 12, borderRadius: 12, background: 'var(--error-bg)', color: 'var(--error-ink)', fontSize: 13, fontWeight: 700 }}>
          Não foi possível salvar esta resposta no aparelho. Tente novamente antes de sair.
        </div>
      )}

      {(!current || current.status === 'idle' || current.status === 'planning') && (
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2lx-loading">Preparando sua prática…</p>
        </div>
      )}

      {current && current.status === 'complete' && (
        <V2SessionSummary
          result={sessionResult}
          onFinish={goHome}
          onAction={(mode) => restartWithMode(mode)}
        />
      )}

      {current && (current.plan || current.status === 'error') && ['presenting', 'submitting', 'feedback', 'advancing', 'error'].includes(current.status) && (
        <V2LessonShell
          state={current}
          presentation={presentation}
          capabilities={capabilities}
          settings={settings}
          reducedMotion={reducedMotion}
          activityNumber={current.interactions.length + 1}
          onSubmit={submitWithWriteAhead}
          onAdvance={() => controller.advance()}
          onSupport={(feature) => controller.recordSupport(feature)}
          onRetry={() => controller.retry()}
          onClose={closeToHome}
          contextBanner={contextEntry?.context_title ? (
            <div className="v2lx-context-banner" data-testid="v2lx-context-banner" data-collection={initial.collectionId}>
              <div className="v2lx-context-banner-row">
                <span className="v2lx-context-banner-label">Contexto</span>
                <span className="v2lx-context-banner-title">{contextEntry.context_title}</span>
                {contextEntry.format_label && (
                  <span className="v2lx-context-format" data-testid="v2lx-context-format">{contextEntry.format_label}</span>
                )}
              </div>
              {preferenceNotice && (
                <span className="v2lx-context-notice" data-testid="v2lx-preference-notice">
                  {preferenceNotice.headline} {preferenceNotice.body}
                </span>
              )}
            </div>
          ) : null}
        />
      )}
    </div>
  )
}
