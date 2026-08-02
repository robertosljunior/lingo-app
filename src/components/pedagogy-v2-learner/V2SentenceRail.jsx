// V2SentenceRail.jsx — Slice V2.22-UX1. The "magnetic rail": the area where the
// learner's sentence is BEING BUILT (handoff §3, Option A — recommended).
//
// The point of the design is that this reads as a sentence in formation, not as
// a box of buttons: a single accent rule under the line, words sitting on it,
// and REAL insertion targets between them ("Inserir na posição 3") instead of
// invisible hit areas.
//
// REORDER WITHOUT DRAG (§10). Three paths reach the same result, none of them a
// drag: tap a gap then a bank word to insert mid-sentence; tap a placed word to
// send it back and place it again; or focus a placed word and press ←/→ to nudge
// it. The arrow-key path is deliberately keyboard-only — the handoff's rail has
// no visible move buttons, and adding two per word would triple the tab stops
// and clutter the line the design is built around.
//
// It expresses NO correctness. The Assessment does not report which word is out
// of place (it compares the whole sequence), so no token here is ever green, red
// or shaken on its own (brief §9). After the answer the whole rail goes quiet.

import V2TokenChip from './V2TokenChip.jsx'

export default function V2SentenceRail({ items, actions = [], hint, locked = false, onGap, onToken, onMove }) {
  const empty = !items.some((it) => it.kind === 'token')
  return (
    <div className="v2lx-rail-wrap">
      <div
        className="v2lx-rail"
        data-testid="v2lx-token-answer"
        data-empty={empty || undefined}
        data-locked={locked || undefined}
        aria-label="Sua frase"
      >
        {empty && <span className="v2lx-rail-empty">Toque nas palavras para montar</span>}
        {items.map((it) => (it.kind === 'gap'
          ? (
            <button
              key={it.key}
              type="button"
              className="v2lx-rail-gap"
              data-testid={`v2lx-gap-${it.at}`}
              data-active={it.active || undefined}
              aria-label={it.label}
              aria-pressed={it.active}
              aria-disabled={locked || undefined}
              onClick={locked ? undefined : () => onGap(it.at)}
            >
              <span className="v2lx-rail-gap-mark" aria-hidden="true" />
            </button>
          )
          : (
            <V2TokenChip
              key={it.key}
              text={it.text}
              label={locked ? `${it.text}, posição ${it.at + 1}.` : `${it.label} Use as setas para mover.`}
              placed
              locked={locked}
              data-testid={`v2lx-placed-${it.i}`}
              onSelect={() => onToken(it.i)}
              onKeyDown={locked || !onMove ? undefined : (e) => {
                if (e.key === 'ArrowLeft' && it.canMoveLeft) { e.preventDefault(); onMove(it.i, -1) }
                if (e.key === 'ArrowRight' && it.canMoveRight) { e.preventDefault(); onMove(it.i, 1) }
              }}
            />
          )
        ))}
      </div>

      {/* Actions only exist once there is something to act on (handoff §3,
          callout 4) — they never occupy empty space. */}
      {(hint || actions.length > 0) && (
        <div className="v2lx-rail-foot">
          {hint && <span className="v2lx-rail-hint">{hint}</span>}
          {actions.length > 0 && (
            <span className="v2lx-rail-actions">
              {actions.map((a) => (
                <button key={a.label} type="button" className="v2lx-textbtn v2lx-rail-action"
                  data-testid={a.testid} data-variant={a.variant} onClick={a.onClick}>{a.label}</button>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
