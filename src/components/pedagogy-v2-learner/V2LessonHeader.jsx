// V2LessonHeader.jsx — Slice V2.17 (handoff §02, spec §26). Back/close, a
// discreet progress indicator and the contextual focus chip. CRITICAL: there is
// NO fixed V2 playlist, so the header NEVER shows step/total or a fake
// percentage (§26). It shows a FACTUAL activity counter and a progress bar that
// grows with completed activities without implying a total.

export default function V2LessonHeader({ focusLabel, activityNumber, onClose, reducedMotion = false }) {
  // A bounded, monotonically-growing fill that never claims a denominator: it
  // asymptotically approaches (but never reaches) 100% as activities accrue.
  // This is decorative only — the factual signal is the numeric counter.
  const completed = Math.max(0, (activityNumber || 1) - 1)
  const fillPct = Math.round((1 - 1 / (completed + 1)) * 100)
  return (
    <div className="v2lx-header">
      <div className="v2lx-headrow">
        <button type="button" className="v2lx-iconbtn" data-testid="v2lx-close" aria-label="Voltar" onClick={onClose}>✕</button>
        <div
          className="v2lx-progress-track"
          role="progressbar"
          aria-label="Progresso da sessão"
          aria-valuetext={`Atividade ${activityNumber}`}
        >
          <div
            className="v2lx-progress-fill"
            data-testid="v2lx-progress-fill"
            style={{ width: `${fillPct}%`, transition: reducedMotion ? 'none' : undefined }}
          />
        </div>
        {focusLabel && (
          <div className="v2lx-focus-chip" data-testid="v2lx-focus-chip">{focusLabel}</div>
        )}
      </div>
      <div className="v2lx-eyebrow" data-testid="v2lx-step-counter" style={{ marginTop: 8, textTransform: 'none', fontSize: 12 }}>
        Atividade {activityNumber}
      </div>
    </div>
  )
}
