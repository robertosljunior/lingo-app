// V2DevExperienceSwitch.jsx — Slice V2.20 §2/§32. A DEV-ONLY, deliberately
// visible switch between the V2 learner experience and the legacy V1 hub.
//
// It exists so nobody has to discover a hidden IndexedDB key to see V2 (§2), and
// so the V1 regression path stays one tap away without contaminating the V2
// product surface (§33). It is NEVER rendered for an ordinary production learner
// — the caller gates it on `experienceSwitcherAvailable`.
//
// Choosing a side writes the EXPLICIT boolean, so the choice survives reloads and
// overrides the environment default in both directions.

export default function V2DevExperienceSwitch({ mode, onChange }) {
  const opt = (value, label, hint) => {
    const active = mode === value
    return (
      <button
        type="button"
        className="v2lx-devswitch-opt"
        data-testid={`v2lx-dev-experience-${value}`}
        aria-pressed={active}
        data-active={active || undefined}
        onClick={() => onChange(value)}
      >
        <span className="v2lx-devswitch-dot" aria-hidden="true">{active ? '●' : '○'}</span>
        <span>
          <span className="v2lx-devswitch-label">{label}</span>
          <span className="v2lx-devswitch-hint">{hint}</span>
        </span>
      </button>
    )
  }

  return (
    <div className="v2lx-devswitch" data-testid="v2lx-dev-experience" data-mode={mode}>
      <div className="v2lx-devswitch-title">DEV · Experiência de aprendizagem</div>
      <div className="v2lx-devswitch-opts">
        {opt('v2', 'V2', 'Experiência nova')}
        {opt('v1', 'Legado V1', 'Apenas regressão')}
      </div>
    </div>
  )
}
