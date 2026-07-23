// V2PackTransition.jsx — Slice V2.17 (§17). A PRESENTATIONAL interstitial shown
// when the controller reports a real pack transition. It is NOT an activity and
// produces NO evidence. The previous form is presented as still-valid — never
// struck through / replaced (§16). Receives the resolved `transition` object.

export default function V2PackTransition({ transition, reducedMotion = false }) {
  if (!transition) return null
  return (
    <div className={`v2lx-card${reducedMotion ? '' : ' v2lx-rise'}`} data-testid="v2lx-pack-transition" style={{ marginBottom: 18, textAlign: 'center' }}>
      <div className="v2lx-focus-chip" style={{ display: 'inline-flex', marginBottom: 14 }}>✦ Novo uso</div>
      <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--v2-ink)', lineHeight: 1.3 }} data-testid="v2lx-pack-transition-headline">
        {transition.headline}
      </div>
      <div className="v2lx-fb-body" style={{ color: 'var(--v2-muted)', marginTop: 8 }}>{transition.subhead}</div>
      {transition.cross_pack_hint && (
        <div className="v2lx-fb-body" data-testid="v2lx-pack-cross-hint" style={{ color: 'var(--v2-muted)', marginTop: 10, background: 'var(--v2-surface-alt)', borderRadius: 12, padding: '10px 14px' }}>
          {transition.cross_pack_hint}
        </div>
      )}
    </div>
  )
}
