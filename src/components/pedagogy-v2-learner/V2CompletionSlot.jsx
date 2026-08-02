// V2CompletionSlot.jsx — Slice V2.22-UX1. ONE gap of a completion sentence.
//
// The gap stays visually PART of the sentence (handoff §4 / brief §11): it
// inherits the sentence's font and sits on the same baseline, underlined by the
// accent rule. It is never an input floating in a form below the text.
//
// Two shapes, chosen by the PLAN, never by the component:
//   • `word_bank` in plan.support.features → the slot is a button; tapping a
//     filled slot returns its chip to the bank (reversible, §12);
//   • otherwise → a real <input> (§13). Not contenteditable: a native input
//     keeps the mobile keyboard, IME composition, autofill semantics and
//     assistive-tech behaviour that contenteditable would have to re-implement.
//
// It never knows the expected token. The empty width is a FIXED measure, so the
// slot can never leak how long the answer is.

export default function V2CompletionSlot({
  gapIndex,
  value = '',
  interactive = true,
  mode = 'bank', // 'bank' | 'input'
  active = false,
  locked = false,
  onSelect,
  onChange,
  onSubmitRequest,
}) {
  const filled = !!String(value ?? '').trim()
  const name = filled ? `Lacuna ${gapIndex + 1}: ${value}.` : `Lacuna ${gapIndex + 1} vazia`

  if (mode === 'input') {
    return (
      <input
        className="v2lx-slot v2lx-slot--input"
        data-testid={`v2lx-slot-${gapIndex}`}
        data-gap={gapIndex}
        data-filled={filled ? 'true' : undefined}
        // Grows with what the LEARNER typed — never with the expected token.
        size={Math.max(6, String(value ?? '').length + 1)}
        value={value ?? ''}
        disabled={locked}
        aria-label={`Lacuna ${gapIndex + 1}`}
        // IME (§13): while a composition is active, Enter is the composer's key,
        // not ours. `isComposing` is the standard signal and survives the
        // keydown → compositionend ordering differences between engines.
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          if (e.nativeEvent?.isComposing || e.nativeEvent?.keyCode === 229) return
          e.preventDefault()
          onSubmitRequest?.()
        }}
        onChange={(e) => onChange?.(gapIndex, e.target.value)}
      />
    )
  }

  return (
    <button
      type="button"
      className="v2lx-slot v2lx-slot--bank"
      data-testid={`v2lx-slot-${gapIndex}`}
      data-gap={gapIndex}
      data-filled={filled ? 'true' : undefined}
      data-active={active || undefined}
      aria-label={filled ? `${name} Toque para limpar.` : name}
      aria-disabled={locked || !interactive || undefined}
      onClick={locked || !interactive ? undefined : () => onSelect?.(gapIndex)}
    >
      {filled ? value : <span className="v2lx-slot-blank" aria-hidden="true" />}
    </button>
  )
}
