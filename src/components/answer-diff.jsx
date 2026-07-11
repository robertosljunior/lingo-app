// answer-diff.jsx — word-level visual diff between the student's answer and
// the expected one, driven by the correction engine's missing/extra/typo sets.
//
// Marks (all currentColor so they read on any sheet/card tint):
//   extra   → riscado (word the student added that the target doesn't have)
//   missing → negrito sublinhado (word the target has and the answer lacks)
//   typo    → sublinhado ondulado (near-miss spelling, paired by the engine)

import { tokenize, wordDiff } from '../lib/correction-engine.js'
import { speakWord, speechSupported } from '../lib/audio/tts.js'

const MARK_STYLE = {
  extra: { textDecoration: 'line-through', opacity: 0.65 },
  missing: { fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3 },
  typo: { textDecoration: 'underline wavy', textUnderlineOffset: 3 },
}

// Decide the mark for a raw (displayed) word by normalizing it and checking
// every resulting token — "don't" normalizes to two tokens, both must match.
function markFor(rawWord, markedSet, typoSet) {
  const subs = tokenize(rawWord)
  if (subs.length === 0) return null
  if (subs.every((s) => typoSet.has(s))) return 'typo'
  if (subs.every((s) => markedSet.has(s))) return subs.some((s) => typoSet.has(s)) ? null : 'mark'
  return null
}

// Render `text` word by word, marking each word per the provided sets.
// When TTS is available every word is tappable and speaks itself.
export function MarkedText({ text, marked = [], typos = [], variant = 'missing', style, speakable = true }) {
  const markedSet = new Set(marked)
  const typoSet = new Set(typos)
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return <span style={style}>—</span>
  const tappable = speakable && speechSupported
  return (
    <span style={style}>
      {words.map((w, i) => {
        const m = markFor(w, markedSet, typoSet)
        const s = m === 'typo' ? MARK_STYLE.typo : m === 'mark' ? MARK_STYLE[variant] : null
        return (
          <span key={i}>
            {i > 0 && ' '}
            <span style={{ ...(s || {}), ...(tappable ? { cursor: 'pointer' } : {}) }}
              onClick={tappable ? () => speakWord(w) : undefined}>{w}</span>
          </span>
        )
      })}
    </span>
  )
}

// Two labeled lines (esperado / você) with diff marks. Accepts a fresh
// analysis result; when sets are absent (e.g. old stored answers) they are
// recomputed with the same engine used to grade.
export function AnswerDiff({ user, target, missing, extra, typos, inkVar = 'var(--ink-2)' }) {
  let m = missing, x = extra, t = typos
  if (!m || !x || !t) {
    const d = wordDiff(user || '', target || '')
    m = d.missing_words; x = d.extra_words; t = d.typos
  }
  const typoGot = t.map((p) => p.got)
  const typoExpected = t.map((p) => p.expected)
  const eyebrow = {
    fontSize: 11, fontWeight: 700, color: inkVar, opacity: 0.7,
    letterSpacing: '.08em', textTransform: 'uppercase',
  }
  return (
    <>
      <div style={eyebrow}>esperado</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
        <MarkedText text={target} marked={m} typos={typoExpected} variant="missing" />
      </div>
      <div style={{ ...eyebrow, marginTop: 10 }}>você</div>
      <div style={{ fontSize: 15, marginTop: 4, color: 'var(--ink-2)' }}>
        <MarkedText text={user} marked={x} typos={typoGot} variant="extra" />
      </div>
    </>
  )
}

// One-line spelling note for answers that are correct apart from typos.
export function TypoNote({ typos, inkVar }) {
  if (!typos?.length) return null
  return (
    <div style={{ fontSize: 13, color: inkVar, opacity: 0.85 }}>
      ✏️ Atenção à grafia: {typos.map((t, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <span style={{ textDecoration: 'underline wavy', textUnderlineOffset: 3 }}>{t.got}</span>
          {' → '}
          <strong>{t.expected}</strong>
        </span>
      ))}
    </div>
  )
}
