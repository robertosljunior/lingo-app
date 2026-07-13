// BobMascot — the app's friendly bear, drawn inline (SVG, offline-safe, themeable).
// `mode` switches the vibe: 'kids' is round and cuddly; 'adult' adds cool shades
// so the same character reads a bit older/cooler. `float` adds the idle bob.
export default function BobMascot({ size = 120, mode = 'adult', float = true, style = {}, ...rest }) {
  const cls = float ? 'bob-float' : undefined
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={cls} style={style}
      role="img" aria-label="Bob, o mascote" {...rest}>
      {/* ears */}
      <circle cx="30" cy="30" r="16" fill="#E8843C" />
      <circle cx="90" cy="30" r="16" fill="#E8843C" />
      <circle cx="30" cy="30" r="8" fill="#F6B98A" />
      <circle cx="90" cy="30" r="8" fill="#F6B98A" />
      {/* head */}
      <ellipse cx="60" cy="66" rx="42" ry="40" fill="#F2914A" />
      {/* muzzle */}
      <ellipse cx="60" cy="82" rx="24" ry="18" fill="#F8CBA0" />
      <ellipse cx="60" cy="74" rx="6" ry="4.5" fill="#5A3B22" />
      <path d="M60 78 v6 M60 84 q-7 6 -13 2 M60 84 q7 6 13 2" stroke="#5A3B22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {mode === 'kids' ? (
        <>
          {/* big cute eyes */}
          <circle cx="45" cy="58" r="7.5" fill="#3B2A1C" />
          <circle cx="75" cy="58" r="7.5" fill="#3B2A1C" />
          <circle cx="47" cy="55.5" r="2.4" fill="#fff" />
          <circle cx="77" cy="55.5" r="2.4" fill="#fff" />
          {/* rosy cheeks */}
          <circle cx="34" cy="74" r="6" fill="#F7A98C" opacity=".7" />
          <circle cx="86" cy="74" r="6" fill="#F7A98C" opacity=".7" />
        </>
      ) : (
        <>
          {/* cool shades */}
          <rect x="34" y="52" width="22" height="13" rx="6" fill="#22333E" />
          <rect x="64" y="52" width="22" height="13" rx="6" fill="#22333E" />
          <rect x="56" y="56" width="8" height="3" rx="1.5" fill="#22333E" />
          <rect x="37" y="55" width="7" height="4" rx="2" fill="#47B8F2" opacity=".8" />
          <rect x="67" y="55" width="7" height="4" rx="2" fill="#47B8F2" opacity=".8" />
        </>
      )}
    </svg>
  )
}
