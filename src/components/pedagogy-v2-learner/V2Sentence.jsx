// V2Sentence.jsx — Slice V2.20 §5. The single component that renders the
// protagonist of an activity: the target sentence / stimulus.
//
// The V2.19 implementation wrapped this in a white card with a shadow in
// Exposure, Completion and Speaking, so the sentence competed with its own
// container. The polish pass removed that variant entirely: there is now ONLY
// "on the background", with the size chosen by CONTEXT (exposure 34 / completion
// 29 / speaking 27 / prompt 23) via CSS custom properties, so no call site
// hardcodes a font-size and the responsive step-down happens in one place (§35).
//
// It renders text it is given. It never formats, translates, masks or decides
// anything — masking comes from the runtime contracts, copy from the adapters.

const VARIANTS = new Set(['exposure', 'completion', 'speaking', 'prompt'])

export default function V2Sentence({
  variant = 'exposure',
  children,
  as: Tag = 'div',
  className = '',
  ...rest
}) {
  const v = VARIANTS.has(variant) ? variant : 'exposure'
  return (
    <Tag
      className={`v2lx-sentence v2lx-sentence--${v} ${className}`.trim()}
      data-sentence-variant={v}
      {...rest}
    >
      {children}
    </Tag>
  )
}
