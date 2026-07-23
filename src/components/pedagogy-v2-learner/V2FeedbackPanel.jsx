// V2FeedbackPanel.jsx — Slice V2.17 learner feedback (handoff §05, spec §8–§13).
// Renders the learner-facing `feedback` block produced by
// buildLearnerPresentationV2. It NEVER decides anything linguistic: it only
// presents the fields it receives. Appears BELOW the activity (never a modal),
// with an aria-live region so it is announced when it expands (§35).

import { useState } from 'react'

const VARIANT_ICON = {
  correct: '✓', suggestion: '✦', partial: '◑', linguistic: '↺', semantic: '↔', unknown: '…',
}

// A single linguistic issue: a short line + optional deeper explanation. The
// span highlight is intentionally not invented here (§9/§14).
function V2FeedbackIssue({ issue }) {
  return (
    <div className="v2lx-fb-body" data-testid="v2lx-fb-issue" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
      <span aria-hidden="true" style={{ color: 'var(--v2-fb-accent)', fontWeight: 900, flex: 'none' }}>·</span>
      <span>{issue.text}</span>
    </div>
  )
}

// A naturalness suggestion / reference form block (§12/§13). Amber tone; never
// error language.
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
  if (!feedback) return null
  const { visual_variant: variant, tone, headline, body, correct_points, issues, suggestions, target_form, target_form_note, detail } = feedback
  const icon = VARIANT_ICON[tone] || '…'
  // The reference form shows with the first suggestion when one exists; if there
  // is a target form but no suggestion, show it as its own reference block.
  const primarySuggestion = suggestions[0] || null

  return (
    <div
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

      {/* A standalone reference form (no suggestion) — e.g. a different target
          form with aligned meaning (§13). Never "Resposta correta". */}
      {!primarySuggestion && target_form && (
        <div className="v2lx-fb-note" data-testid="v2lx-fb-target-form">
          <div className="v2lx-fb-note-label">{target_form.label}</div>
          <div className="v2lx-fb-target">{target_form.text_en}</div>
          {target_form.text_pt && <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)' }}>{target_form.text_pt}</div>}
        </div>
      )}

      {target_form_note && <div className="v2lx-fb-body" data-testid="v2lx-fb-target-note" style={{ marginTop: 8, color: 'var(--v2-muted)' }}>{target_form_note}</div>}

      {/* Progressive disclosure — ONLY when real deeper content exists (§8). */}
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
            <div className={`v2lx-fb-note${reducedMotion ? '' : ' v2lx-rise'}`} data-testid="v2lx-fb-detail">
              <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)' }}>{detail}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
