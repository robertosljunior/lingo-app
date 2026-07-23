// V2LessonExperience.jsx — Slice V2.17 learner-facing lesson screen. This is the
// FIRST learner-facing surface built on the real V2 pipeline:
//
//   Study Planner → Study Focus Resolver → Lesson Engine → ActivityPlan
//     → response → Assessment → Evidence → Learner Model → next planning
//
// It owns the real study-session controller and, on every state change, derives
// the learner-facing presentation with the PURE buildLearnerPresentationV2
// adapter. No React component here chooses a target, pack, recipe, modality or
// the next exercise — the pipeline does. There is NO pre-computed playlist.
//
// Gated behind `v2_learner_experience_enabled` (default false, §2). V1 and the
// diagnostic surfaces (Playground/Inspector/Lab) are untouched (§38).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, SCREENS } from '../store.jsx'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import { buildStudyPlannerContextV2 } from '../lib/pedagogy-v2/study-planner-context.js'
import { createStudySessionControllerV2 } from '../lib/pedagogy-v2/study-session-controller.js'
import { createProductionAssessmentServicesV2 } from '../lib/pedagogy-v2/production-assessment-service.js'
import { detectRuntimeCapabilitiesV2 } from '../lib/pedagogy-v2/runtime-capabilities.js'
import { speechSupported } from '../lib/audio/tts.js'
import { sttSupported } from '../lib/audio/stt.js'
import { buildLearnerPresentationV2, buildLearnerSessionSummaryV2 } from '../lib/pedagogy-v2/learner-presentation-v2.js'
import V2LessonShell from '../components/pedagogy-v2-learner/V2LessonShell.jsx'
import V2SessionSummary from '../components/pedagogy-v2-learner/V2SessionSummary.jsx'
import { useReducedMotion } from '../components/pedagogy-v2-learner/useReducedMotion.js'

export function v2LearnerExperienceEnabled(settings) {
  return !!settings?.v2_learner_experience_enabled
}

export default function V2LessonExperience() {
  const { settings, activeProfile, db, setTab, params } = useApp()
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const capabilities = useMemo(() => detectRuntimeCapabilitiesV2({ ttsSupported: speechSupported, sttSupported }), [])
  const reducedMotion = useReducedMotion(settings?.reduced_motion)

  const [state, setState] = useState(null)
  const controllerRef = useRef(null)

  // Start the real controller once, when the screen mounts. Focused mode is
  // available via params (used by tests); the default is an adaptive session.
  useEffect(() => {
    if (controllerRef.current) return undefined
    if (!v2LearnerExperienceEnabled(settings)) return undefined
    const focusedPackId = params?.pack || null
    const controller = createStudySessionControllerV2({
      profileId: activeProfile,
      registry,
      mode: focusedPackId ? 'focused' : 'adaptive',
      focusedPackId,
      buildPlannerContext: (profileId, opts) => buildStudyPlannerContextV2(profileId, opts),
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      capabilities,
      assessmentServices: createProductionAssessmentServicesV2(),
    })
    controllerRef.current = controller
    const unsub = controller.subscribe(setState)
    setState(controller.getState())
    controller.start()
    return () => { unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const c = controllerRef.current
  const s = state

  // Derive the learner-facing presentation from the CURRENT pipeline state. Pure
  // — no analysis, no storage. Recomputed on each state change.
  const presentation = useMemo(() => {
    if (!s || !s.plan) return null
    return buildLearnerPresentationV2({
      plan: s.plan,
      response: s.pendingResponse,
      assessment: s.assessment,
      focus: s.focus,
      transition: s.transition,
      registry,
      recordedEvidence: s.recordedEvents,
      // Learner state from the planning context (built BEFORE this activity) —
      // lets the adapter prove real familiarity with the current lexeme (§2).
      learnerStates: s.context?.learner_states ?? null,
    })
  }, [s?.plan, s?.assessment, s?.pendingResponse, s?.focus, s?.transition, registry, s?.recordedEvents, s?.context])

  const summary = useMemo(() => {
    if (s?.status !== 'complete') return null
    return buildLearnerSessionSummaryV2({ interactions: s.interactions, registry })
  }, [s?.status, s?.interactions, registry])

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

  const goHome = () => setTab(SCREENS.TRAINING)

  return (
    <div className="phone" data-testid="v2lx-screen" style={{ overflow: 'hidden' }}>
      {(!s || s.status === 'idle' || s.status === 'planning') && (
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2lx-loading">Preparando sua prática…</p>
        </div>
      )}

      {s && s.status === 'complete' && (
        <V2SessionSummary summary={summary} onFinish={goHome} />
      )}

      {s && (s.plan || s.status === 'error') && ['presenting', 'submitting', 'feedback', 'advancing', 'error'].includes(s.status) && (
        <V2LessonShell
          state={s}
          presentation={presentation}
          capabilities={capabilities}
          settings={settings}
          reducedMotion={reducedMotion}
          activityNumber={s.interactions.length + 1}
          onSubmit={(type, payload) => c.submit(type, payload)}
          onAdvance={() => c.advance()}
          onSupport={(f) => c.recordSupport(f)}
          onRetry={() => c.retry()}
          onClose={goHome}
        />
      )}
    </div>
  )
}
