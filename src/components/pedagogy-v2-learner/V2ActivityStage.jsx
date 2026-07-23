// V2ActivityStage.jsx — Slice V2.17 (§29). The animated container that hosts
// one activity + its feedback and banners. It slides out/in horizontally; the
// feedback expands in place BELOW the activity (never a modal). The stage NEVER
// contains pedagogical logic — it renders children and reports when the exit
// animation ends so the shell can advance (§41). A duplicate `animationend` must
// not advance twice — the shell guards that; the stage only forwards the event
// for the OUT phase of the stage element itself.

export default function V2ActivityStage({ phase, reducedMotion, onStageEnd, children }) {
  return (
    <div className="v2lx-scroll">
      <div className="v2lx-content">
        <div
          className="v2lx-stage"
          data-testid="v2lx-stage"
          data-phase={reducedMotion ? 'static' : phase}
          onAnimationEnd={(e) => {
            // Only the stage's own out-animation should trigger advance — ignore
            // bubbled animations from feedback/banners/children.
            if (e.target !== e.currentTarget) return
            onStageEnd?.()
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
