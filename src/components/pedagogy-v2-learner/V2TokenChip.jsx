// V2TokenChip.jsx — Slice V2.22-UX1. One tappable word.
//
// Small on purpose (§28): it knows nothing about the activity, the plan or the
// answer. It is given a label, a few presentation flags and a callback.
//
// A11Y: it stays a real <button> and is NEVER natively `disabled` when it merely
// becomes "already used" — a disabled element drops out of the tab order and the
// browser moves focus to <body>, which is exactly the "focus is lost after the
// move" failure the handoff calls out (§10). Instead it carries `aria-disabled`
// and the click handler refuses the action, so the chip keeps its place in the
// reading order and the learner keeps their position.

export default function V2TokenChip({
  text,
  label,
  placed = false,
  used = false,
  locked = false,
  onSelect,
  className = '',
  ...rest
}) {
  const inert = used || locked
  return (
    <button
      type="button"
      className={`v2lx-chip${placed ? ' v2lx-chip--placed' : ''} ${className}`.trim()}
      data-used={used || undefined}
      data-locked={locked || undefined}
      aria-disabled={inert || undefined}
      aria-label={label}
      onClick={inert ? undefined : onSelect}
      {...rest}
    >
      {text}
    </button>
  )
}
