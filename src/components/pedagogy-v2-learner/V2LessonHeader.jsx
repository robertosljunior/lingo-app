// V2LessonHeader.jsx — Slice V2.17 (handoff §02, spec §26) + V2.17-R §1. Back/
// close, the contextual focus chip and a FACTUAL activity counter. CRITICAL:
// there is NO fixed V2 playlist, so the header shows NO percentage progress bar
// and NO implicit denominator — a growing fill would imply a session length that
// does not exist. Only the verifiable "Atividade N" is shown, plus a neutral,
// non-growing divider.

export default function V2LessonHeader({ focusLabel, activityNumber, onClose }) {
  return (
    <div className="v2lx-header">
      <div className="v2lx-headrow">
        <button type="button" className="v2lx-iconbtn" data-testid="v2lx-close" aria-label="Voltar" onClick={onClose}>✕</button>
        {/* Neutral spacer — pushes the focus chip to the right. It carries no
            width-based progress meaning (V2.17-R §1). */}
        <div className="v2lx-head-spacer" aria-hidden="true" />
        {focusLabel && (
          <div className="v2lx-focus-chip" data-testid="v2lx-focus-chip">{focusLabel}</div>
        )}
      </div>
      <div className="v2lx-eyebrow" data-testid="v2lx-step-counter" style={{ marginTop: 8, textTransform: 'none', fontSize: 12 }}>
        Atividade {activityNumber}
      </div>
      {/* Static divider — decorative only, fixed width, never grows with the
          activity number (no fake progress). */}
      <div className="v2lx-head-divider" aria-hidden="true" />
    </div>
  )
}
