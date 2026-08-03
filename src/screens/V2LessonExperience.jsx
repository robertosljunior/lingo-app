// V2LessonExperience.jsx — learner-facing lesson screen on the real V2
// Planner → Resolver → Engine → Assessment → Evidence pipeline.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import { buildStudyPlannerContextV2 } from '../lib/pedagogy-v2/study-planner-context.js'
import { createStudySessionControllerV2 } from '../lib/pedagogy-v2/study-session-controller.js'
import { createProductionAssessmentServicesV2 } from '../lib/pedagogy-v2/production-assessment-service.js'
import { detectRuntimeCapabilitiesV2 } from '../lib/pedagogy-v2/runtime-capabilities.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import { buildLearnerPresentationV2 } from '../lib/pedagogy-v2/learner-presentation-v2.js'
import { buildLearnerSessionResultV2, resolveLessonModeV2, buildContextualSessionEntryV2, buildRecipePreferenceNoticeV2 } from '../lib/pedagogy-v2/learner-home-presentation.js'
import { buildStudyScopeFromCollectionV2 } from '../lib/pedagogy-v2/study-scope.js'
import { recordDurableLearnerInteractionV2, finalizeDurableStudySessionV2 } from '../lib/pedagogy-v2/durable-interaction-storage.js'
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
  const controllerRef = useRef(null)

  const restartWithMode = (mode) => setSession((current) => ({ mode, pack: null, error: null, nonce: current.nonce + 1 }))

  useEffect(() => {
    if (!v2LearnerExperienceEnabled(settings)) return undefined
    if (session.error) return undefined
    const controller = createStudySessionControllerV2({
      profileId: activeProfile,
      registry,
      mode: session.mode,
      focusedPackId: session.pack,
      studyScope: scopeError ? null : studyScope,
      recipePreference: initial.recipePreference,
      buildPlannerContext: (profileId, opts) => buildStudyPlannerContextV2(profileId, opts),
      // Kept for diagnostic/controller compatibility. The learner-facing path
      // uses persistInteraction below, which records the interaction and these
      // evidence events in one IndexedDB transaction.
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      persistInteraction: recordDurableLearnerInteractionV2,
      finalizeSession: finalizeDurableStudySessionV2,
      capabilities,
      assessmentServices: createProductionAssessmentServicesV2(),
    })
    controllerRef.current = controller
    const unsubscribe = controller.subscribe(setState)
    setState(controller.getState())
    controller.start()
    return () => { unsubscribe?.(); controllerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.mode, session.pack, session.nonce])

  const controller = controllerRef.current
  const current = state

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__e2e) return
    window.__e2e.v2Activity = current?.plan
      ? {
        recipe: current.plan.recipe,
        text_en: current.plan.text_en ?? null,
        correct_option_id: current.plan.response_contract?.correct_option_id ?? null,
        exemplar_id: current.plan.exemplar_id ?? null,
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
          onSubmit={(type, payload) => controller.submit(type, payload)}
          onAdvance={() => controller.advance()}
          onSupport={(feature) => controller.recordSupport(feature)}
          onRetry={() => controller.retry()}
          onClose={goHome}
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
