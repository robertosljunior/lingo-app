// V2LessonShell.jsx — Slice V2.17 learner lesson orchestrator (handoff §02/§03,
// spec §1/§29/§31). It owns ONLY presentation state: the horizontal slide phase,
// the single-CTA state machine and the "advance on animation end" flow. It does
// NOT own any pedagogy — the controller (passed in via callbacks) decides the
// next activity. The next ActivityPlan only appears AFTER `advance()` runs, so
// there is never a pre-computed playlist here.
//
// CTA state machine (§31), one primary CTA at a time:
//   exposure/transition     → Continuar (records exposure, then advances)
//   recognition (incl. context) → tap = answer (no footer CTA before feedback)
//   check recipes           → Verificar (enabled when the recipe is submittable)
//   evaluation in flight    → Avaliando… (inert; V2.22-UX1 / handoff §3.4)
//   feedback shown          → Continuar (advances)
//
// V2.22-UX1 §3.4 makes the in-flight state VISIBLE. It already existed as a
// guard (`busy`); showing it is what makes a double submit impossible by
// construction rather than by a hidden check — the learner can see that the
// answer is on its way. The activity itself stays visible and untouched.

import { useCallback, useEffect, useRef, useState } from 'react'
import V2LessonHeader from './V2LessonHeader.jsx'
import V2ActivityStage from './V2ActivityStage.jsx'
import V2LearnerActivity from './V2LearnerActivity.jsx'
import V2FeedbackPanel from './V2FeedbackPanel.jsx'
import V2NewUseBanner from './V2NewUseBanner.jsx'
import V2PackTransition from './V2PackTransition.jsx'

const CHECK_RECIPES = new Set(['fixed_element_completion', 'word_order_reconstruction', 'guided_production', 'free_production', 'pronunciation'])
// Recipes that evaluate ON TAP: the contract already submits the choice, so a
// "Verificar" CTA would be a second, redundant primary action (§31). V2.20 adds
// the V2.19 `context_recognition` here — it shares the single_choice contract.
const TAP_RECIPES = new Set(['meaning_recognition', 'listening_recognition', 'context_recognition'])

export default function V2LessonShell({
  state,
  presentation,
  capabilities,
  settings,
  reducedMotion = false,
  activityNumber,
  // V2.22-UX2 §17 — an optional, session-level context strip. It belongs INSIDE
  // the shell's flex column: the shell is `height:100%` inside an
  // `overflow:hidden` phone, so a sibling above it would push the footer CTA off
  // the viewport and make Verificar unreachable. Here it is a `flex:none` row
  // like the header, and the scroll area absorbs the difference.
  contextBanner = null,
  onSubmit,
  onAdvance,
  onSupport,
  onRetry,
  onClose,
}) {
  const [phase, setPhase] = useState('in')
  const [pending, setPending] = useState(null) // { type, payload } | null (submittable)
  const nextRef = useRef(null)

  const plan = state?.plan
  const recipe = plan?.recipe
  const status = state?.status
  const answered = status === 'feedback' || status === 'advancing'
  const busy = status === 'submitting'

  // A new activity resets the local CTA/animation state (never a stale payload).
  useEffect(() => {
    setPending(null)
    setPhase('in')
    nextRef.current = null
  }, [plan?.activity_id])

  // The transition to the NEXT activity: slide out, then run the intent on the
  // out-animation end (or immediately when motion is reduced). A duplicate
  // animationend cannot double-run because the ref is cleared before use (§41).
  const goNext = useCallback((intentFn) => {
    if (phase === 'out') return // already transitioning — ignore double taps
    if (reducedMotion) { Promise.resolve(intentFn()).then(() => setPhase('in')); return }
    nextRef.current = intentFn
    setPhase('out')
  }, [phase, reducedMotion])

  const onStageEnd = useCallback(() => {
    if (phase !== 'out') return
    const fn = nextRef.current
    nextRef.current = null
    if (!fn) return
    Promise.resolve(fn()).then(() => setPhase('in'))
  }, [phase])

  // Submit the current recipe's payload IN PLACE (feedback expands below — no
  // slide). Guarded against double submit.
  const check = useCallback(() => {
    if (busy || answered || !pending) return
    onSubmit(pending.type, pending.payload)
  }, [busy, answered, pending, onSubmit])

  const advanceIntent = useCallback(() => onAdvance(), [onAdvance])
  // Exposure: one Continuar records the observed evidence AND advances.
  const exposureIntent = useCallback(async () => { await onSubmit('continue', {}); await onAdvance() }, [onSubmit, onAdvance])

  const requestClose = useCallback(() => {
    // The write-ahead receipt already protects reload/crash. Explicit close is
    // locked only while assessment is in flight so an abandoned-session write
    // cannot race the final atomic interaction transaction.
    if (busy) return
    if (pending && typeof window !== 'undefined' && window.confirm) {
      // §32 — local-first: an unsubmitted answer is discarded after confirmation.
      if (!window.confirm('Sair agora? Sua resposta atual não será salva.')) return
    }
    onClose()
  }, [busy, pending, onClose])

  // ---- error -----------------------------------------------------------------
  if (status === 'error') {
    return (
      <div className="v2lx-shell v2lx" data-reduced-motion={reducedMotion || undefined} data-testid="v2lx-shell">
        <V2LessonHeader focusLabel={presentation?.focus?.label} activityNumber={activityNumber} onClose={requestClose} closeDisabled={busy} />
        <div className="v2lx-scroll"><div className="v2lx-content">
          <div className="v2lx-card" data-testid="v2lx-error">
            <div style={{ fontWeight: 900, fontSize: 17 }}>Algo deu errado</div>
            <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)', marginTop: 6 }}>Não foi possível concluir esta etapa. Tente novamente.</div>
            <button type="button" className="v2lx-cta" style={{ marginTop: 16 }} data-testid="v2lx-retry" onClick={onRetry}>Tentar novamente</button>
          </div>
        </div></div>
      </div>
    )
  }

  const feedback = answered ? presentation?.feedback : null

  // ---- footer CTA ------------------------------------------------------------
  let cta = null
  if (answered) {
    cta = { label: 'Continuar', disabled: status === 'advancing' || phase === 'out', onClick: () => goNext(advanceIntent), testid: 'v2lx-continue' }
  } else if (recipe === 'exposure') {
    cta = { label: 'Continuar', disabled: busy || phase === 'out', onClick: () => goNext(exposureIntent), testid: 'v2lx-continue' }
  } else if (TAP_RECIPES.has(recipe)) {
    cta = null // tap = answer (§31)
  } else if (CHECK_RECIPES.has(recipe)) {
    cta = { label: busy ? 'Avaliando…' : 'Verificar', disabled: busy || !pending, onClick: check, testid: 'v2lx-check' }
  }

  return (
    <div className="v2lx-shell v2lx" data-reduced-motion={reducedMotion || undefined} data-testid="v2lx-shell" data-status={status}>
      <V2LessonHeader focusLabel={presentation?.focus?.label} activityNumber={activityNumber} onClose={requestClose} closeDisabled={busy} reducedMotion={reducedMotion} />

      {contextBanner && (
        <div className="v2lx-context-strip">
          <div className="v2lx-content">{contextBanner}</div>
        </div>
      )}

      <V2ActivityStage phase={phase} reducedMotion={reducedMotion} onStageEnd={onStageEnd}>
        {presentation?.transition && <V2PackTransition transition={presentation.transition} reducedMotion={reducedMotion} />}
        {presentation?.new_use && <V2NewUseBanner newUse={presentation.new_use} reducedMotion={reducedMotion} />}

        {plan && (
          <V2LearnerActivity
            plan={plan}
            capabilities={capabilities}
            settings={settings}
            busy={busy}
            answered={answered}
            assessment={state.assessment}
            onSubmit={onSubmit}
            onSupport={onSupport}
            onSubmittable={setPending}
            // Enter inside a completion slot routes through the SAME guarded
            // submit the footer CTA uses — never a second, unguarded path (§13).
            onRequestSubmit={check}
          />
        )}

        {feedback && <V2FeedbackPanel feedback={feedback} reducedMotion={reducedMotion} />}
      </V2ActivityStage>

      {cta && (
        <div className="v2lx-footer">
          <div className="v2lx-content">
            <button type="button" className="v2lx-cta" data-testid={cta.testid} disabled={cta.disabled} onClick={cta.onClick}>
              {cta.label}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
