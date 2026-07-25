// V2LessonExperience.jsx — Slice V2.17 learner-facing lesson screen, extended in
// V2.18 with explicit STUDY-MODE routing. It is the learner surface built on the
// real V2 pipeline:
//
//   Study Planner → Study Focus Resolver → Lesson Engine → ActivityPlan
//     → response → Assessment → Evidence → Learner Model → next planning
//
// The screen owns the real study-session controller and derives the learner-
// facing presentation with the PURE adapters. No React code chooses a target,
// pack, recipe, modality or the next exercise — the pipeline does. The only
// thing the caller picks is the Study `mode` (adaptive / explore / review /
// focused) — the SAME createStudySessionControllerV2, never a parallel one (§12).
//
// Gated by resolveLearnerExperienceMode (V2.20 §2): explicit setting wins, and an
// unset flag defaults to V2 in dev/dogfood builds and to V1 in production. V1 and
// the diagnostic surfaces (Playground/Inspector/Lab) are untouched.

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
import { buildLearnerSessionResultV2, resolveLessonModeV2 } from '../lib/pedagogy-v2/learner-home-presentation.js'
import V2LessonShell from '../components/pedagogy-v2-learner/V2LessonShell.jsx'
import V2SessionSummary from '../components/pedagogy-v2-learner/V2SessionSummary.jsx'
import { useReducedMotion } from '../components/pedagogy-v2-learner/useReducedMotion.js'
import { learnerExperienceV2Enabled } from '../lib/pedagogy-v2/learner-experience-mode.js'

// V2.20 §2 — the gate is the shared three-valued resolver, so a dev/dogfood build
// lands on V2 by default while production keeps its existing rollout.
export function v2LearnerExperienceEnabled(settings) {
  return learnerExperienceV2Enabled(settings)
}

export default function V2LessonExperience() {
  const { settings, activeProfile, db, setTab, params } = useApp()
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const capabilities = useMemo(() => detectRuntimeCapabilitiesV2({ ttsSupported: speechSupported, sttSupported }), [])
  const reducedMotion = useReducedMotion(settings?.reduced_motion)

  // The requested mode is resolved ONCE from the entry params; empty-state
  // actions restart in-place with a new mode via `session` (no re-navigation).
  const initial = useMemo(() => resolveLessonModeV2(params), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [session, setSession] = useState({ mode: initial.mode, pack: initial.focusedPackId, error: initial.error ?? null, nonce: 0 })
  const [state, setState] = useState(null)
  const controllerRef = useRef(null)

  const restartWithMode = (mode) => setSession((s) => ({ mode, pack: null, error: null, nonce: s.nonce + 1 }))

  // Create/replace the real controller when the (mode, pack, nonce) changes. The
  // ONLY difference between modes is the `mode` argument — same controller (§12).
  useEffect(() => {
    if (!v2LearnerExperienceEnabled(settings)) return undefined
    if (session.error) return undefined
    const controller = createStudySessionControllerV2({
      profileId: activeProfile,
      registry,
      mode: session.mode,
      focusedPackId: session.pack,
      buildPlannerContext: (profileId, opts) => buildStudyPlannerContextV2(profileId, opts),
      recordBatch: (events) => db.recordLearnerEvidenceBatchV2(events),
      capabilities,
      assessmentServices: createProductionAssessmentServicesV2(),
    })
    controllerRef.current = controller
    const unsub = controller.subscribe(setState)
    setState(controller.getState())
    controller.start()
    return () => { unsub?.(); controllerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.mode, session.pack, session.nonce])

  const c = controllerRef.current
  const s = state

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
      // lets the adapter prove real familiarity with the current lexeme.
      learnerStates: s.context?.learner_states ?? null,
    })
  }, [s?.plan, s?.assessment, s?.pendingResponse, s?.focus, s?.transition, registry, s?.recordedEvents, s?.context])

  // Mode-aware session result: a completed factual summary OR an honest empty
  // state (zero activities is NEVER "você praticou 0 atividades") (§18).
  const sessionResult = useMemo(() => {
    if (s?.status !== 'complete') return null
    return buildLearnerSessionResultV2({ interactions: s.interactions, mode: session.mode, registry })
  }, [s?.status, s?.interactions, session.mode, registry])

  // V2.20-R §9: closing a lesson and finishing a session return to the ROOT
  // Home, which is the V2 Home now — not to Training. Same destination the
  // bottom-nav "Início" reaches, so there is one V2 home, not two.
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

  // Invalid mode / focused-without-pack: a safe, learner-facing error — no
  // arbitrary fallback session (§29).
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
    <div className="phone" data-testid="v2lx-screen" data-experience="v2" data-surface="lesson" data-mode={session.mode} style={{ overflow: 'hidden' }}>
      {(!s || s.status === 'idle' || s.status === 'planning') && (
        <div className="screen-body" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <p className="muted" data-testid="v2lx-loading">Preparando sua prática…</p>
        </div>
      )}

      {s && s.status === 'complete' && (
        <V2SessionSummary
          result={sessionResult}
          onFinish={goHome}
          onAction={(mode) => restartWithMode(mode)}
        />
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
