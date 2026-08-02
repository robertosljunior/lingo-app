// V2WordBank.jsx — Slice V2.22-UX1. The row of available words, shared by word
// order and by completion with a `word_bank`.
//
// The chips are EXACTLY the tokens the plan/runtime provided. The bank never
// adds a distractor, never sorts, never re-shuffles (§12/§43) — order is the
// Engine's decision and arrives already fixed.
//
// A used chip fades to 0.32 and says "já usada" in its accessible name rather
// than disappearing or being natively disabled: the learner keeps the reference
// of what they have spent, and the tab order does not collapse under them
// (handoff §3, callout 5).

import V2TokenChip from './V2TokenChip.jsx'

export default function V2WordBank({ items, locked = false, testid = 'v2lx-token-bank', label = 'Palavras disponíveis', onSelect }) {
  if (!items.length) return null
  return (
    <div className="v2lx-bank" data-testid={testid} aria-label={label}>
      {items.map((it) => (
        <V2TokenChip
          key={it.key}
          text={it.t}
          label={it.label}
          used={it.used}
          locked={locked}
          data-testid={`v2lx-token-${it.i}`}
          onSelect={() => onSelect(it)}
        />
      ))}
    </div>
  )
}
