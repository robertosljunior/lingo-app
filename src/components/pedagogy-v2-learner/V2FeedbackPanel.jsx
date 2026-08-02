// V2FeedbackPanel.jsx — learner feedback, FLATTENED in Slice V2.20 (§16–§25).
//
// CRITICAL: the design changed, the SEMANTICS did not. This component still only
// presents the `feedback` block produced by buildLearnerPresentationV2. It never
// decides anything linguistic, never reclassifies a variant, never turns a
// semantic mismatch into "Vocabulário" and never turns naturalness into an error
// (§18/§22/§26/§27). Absence of a structured cause stays an honest, unspecific
// message — the component cannot invent a category.
//
// What V2.20 changed, per the Polish Pass:
//   • the outer card is compact (16px radius, tighter padding) (§17);
//   • the suggestion / reference-form / disclosure blocks are NO LONGER nested
//     cards — they are separated by a hairline rule + spacing + typography (§17);
//   • `correct` is the fastest state to consume: icon + headline + points (§19);
//   • `unable_to_assess` reads as "not confirmed", never as a failure (§24).
//
// It stays BELOW the activity on the SAME screen (never a modal, never a route
// change) with an aria-live region so it is announced when it expands (§16/§37).
//
// V2.22-UX1 (handoff §3.5) adds ONE purely visual thing: a continuity rule down
// the left edge, tinted by the tone, so the answer above and the feedback below
// read as one column instead of two unrelated blocks. It carries no meaning of
// its own — the tone already has a glyph and a headline — and it changes NOTHING
// about which variant is chosen or what it is allowed to say. The variant, tone,
// headline, body, issues and suggestions all still arrive fully decided from
// buildLearnerPresentationV2.

import { useEffect, useRef, useState } from 'react'

const VARIANT_ICON = {
  correct: '✓', suggestion: '✦', partial: '◑', linguistic: '↺', semantic: '↔', unknown: '…',
}

// A single linguistic issue: a short line. The span highlight is intentionally
// not invented here.
function V2FeedbackIssue({ issue }) {
  return (
    <div className="v2lx-fb-body" data-testid="v2lx-fb-issue" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
      <span aria-hidden="true" style={{ color: 'var(--v2-fb-accent)', fontWeight: 900, flex: 'none' }}>·</span>
      <span>{issue.text}</span>
    </div>
  )
}

// A naturalness suggestion / reference form block (§20/§25). It is a hairline
// SECTION of the panel now, not a card inside a card. The label always comes
// from the adapter — the component never writes "Forma correta" / "Resposta
// correta" anywhere (§25, mandatory regression gate).
function V2FeedbackSuggestion({ suggestion, targetForm }) {
  return (
    <div className="v2lx-fb-note" data-testid="v2lx-fb-suggestion">
      <div className="v2lx-fb-note-label">{suggestion.label}</div>
      {suggestion.text && <div className="v2lx-fb-body" style={{ marginBottom: targetForm ? 6 : 0 }}>{suggestion.text}</div>}
      {targetForm && <div className="v2lx-fb-target">{targetForm.text_en}</div>}
    </div>
  )
}

export default function V2FeedbackPanel({ feedback, reducedMotion = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // §30 — on mobile the panel often expands below the fold. Scroll the MINIMUM
  // needed to expose the headline + first content + CTA, never to the top, and
  // never steal focus (the aria-live region already announces it). `nearest`
  // keeps the activity above still visible, so the learner stays oriented (§29).
  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined' || !el.scrollIntoView) return
    const prefersReduced = reducedMotion ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    try {
      el.scrollIntoView({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' })
    } catch {
      el.scrollIntoView(false)
    }
  }, [feedback?.visual_variant, reducedMotion])

  if (!feedback) return null
  const { visual_variant: variant, tone, headline, body, correct_points, issues, suggestions, target_form, target_form_note, detail } = feedback
  const icon = VARIANT_ICON[tone] || '…'
  // The reference form shows with the first suggestion when one exists; if there
  // is a target form but no suggestion, it becomes its own reference section.
  const primarySuggestion = suggestions[0] || null

  return (
    <div
      ref={ref}
      className={`v2lx-fb${reducedMotion ? ' v2lx-fb--noanim' : ''}`}
      data-testid="v2lx-feedback"
      data-variant={variant}
      data-outcome={feedback.outcome_status}
      data-tone={tone}
      role="status"
      aria-live="polite"
    >
      <div className="v2lx-fb-head">
        <div className="v2lx-fb-icon" aria-hidden="true">{icon}</div>
        <div className="v2lx-fb-headline" data-testid="v2lx-fb-headline">{headline}</div>
      </div>

      {correct_points.map((p, i) => (
        <div key={i} className="v2lx-fb-body" data-testid="v2lx-fb-correct" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
          <span aria-hidden="true" style={{ color: 'var(--v2-fb-correct)', fontWeight: 900, flex: 'none' }}>✓</span>
          <span>{p.text}</span>
        </div>
      ))}

      {body && <div className="v2lx-fb-body" data-testid="v2lx-fb-body">{body}</div>}

      {issues.map((it, i) => <V2FeedbackIssue key={i} issue={it} />)}

      {primarySuggestion && <V2FeedbackSuggestion suggestion={primarySuggestion} targetForm={target_form} />}
      {suggestions.slice(1).map((s, i) => <V2FeedbackSuggestion key={i} suggestion={s} targetForm={null} />)}

      {/* A standalone reference form (no suggestion). Label comes from the
          adapter — "Uma forma possível" / "Forma de referência" (§25). */}
      {!primarySuggestion && target_form && (
        <div className="v2lx-fb-note" data-testid="v2lx-fb-target-form">
          <div className="v2lx-fb-note-label">{target_form.label}</div>
          <div className="v2lx-fb-target">{target_form.text_en}</div>
          {target_form.text_pt && <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)' }}>{target_form.text_pt}</div>}
        </div>
      )}

      {target_form_note && <div className="v2lx-fb-body" data-testid="v2lx-fb-target-note" style={{ marginTop: 8, color: 'var(--v2-muted)' }}>{target_form_note}</div>}

      {/* Progressive disclosure — ONLY when real deeper content exists. §21: the
          revealed text lands DIRECTLY in this panel; no second card, no extra
          border, just the rise+fade. */}
      {detail && (
        <>
          <button
            type="button"
            className="v2lx-disclose"
            data-testid="v2lx-fb-disclose"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Entender melhor <span className="v2lx-disclose-chev" aria-hidden="true">›</span>
          </button>
          {open && (
            <div className={`v2lx-fb-detail${reducedMotion ? '' : ' v2lx-rise'}`} data-testid="v2lx-fb-detail">
              {detail}
            </div>
          )}
        </>
      )}
    </div>
  )
}
