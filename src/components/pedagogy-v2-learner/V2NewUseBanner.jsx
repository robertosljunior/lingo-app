// V2NewUseBanner.jsx — Slice V2.17 (§14–§16). A contextual banner shown over an
// activity when the learner meets a NEW USE of a word they already know. It
// reinforces that the previous use stays valid — the old form is NEVER struck
// through or shown as replaced (§16). Purely presentational; receives the
// already-resolved `new_use` object (no reason codes / ids reach the learner).

export default function V2NewUseBanner({ newUse, reducedMotion = false }) {
  if (!newUse) return null
  return (
    <div className={`v2lx-banner${reducedMotion ? '' : ' v2lx-rise'}`} data-testid="v2lx-new-use">
      <div className="v2lx-banner-icon" aria-hidden="true">✦</div>
      <div>
        <div className="v2lx-banner-text" data-testid="v2lx-new-use-headline">{newUse.headline}</div>
        <div className="v2lx-banner-text" style={{ fontWeight: 700, color: 'var(--v2-muted)' }}>{newUse.subhead}</div>
        {newUse.cross_pack_hint && (
          <div className="v2lx-banner-text" data-testid="v2lx-cross-pack" style={{ fontWeight: 700, color: 'var(--v2-muted)', marginTop: 4 }}>
            {newUse.cross_pack_hint}
          </div>
        )}
      </div>
    </div>
  )
}
