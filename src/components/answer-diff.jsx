// answer-diff.jsx — token-level visual diff between the student's answer and
// the expected one. Prefer v2 positional alignment; fall back to legacy wordDiff
// for old stored answers.

import { alignTokens, tokenize, wordDiff } from '../lib/correction-engine.js'
import { speakWord, speechSupported } from '../lib/audio/tts.js'

const MARK_STYLE = {
  extra: { textDecoration: 'line-through', opacity: 0.65 },
  missing: { fontWeight: 800, borderBottom: '2px solid currentColor', background: 'var(--feedback-warning-surface)', borderRadius: 4, padding: '0 2px' },
  replace: { fontWeight: 800, borderBottom: '2px solid currentColor', background: 'var(--feedback-warning-surface)', borderRadius: 4, padding: '0 2px' },
  typo: { borderBottom: '2px solid currentColor', background: 'var(--feedback-warning-surface)', borderRadius: 4, padding: '0 2px' },
}

function markFor(rawWord, markedSet, typoSet) {
  const subs = tokenize(rawWord)
  if (subs.length === 0) return null
  if (subs.every((s) => typoSet.has(s))) return 'typo'
  if (subs.every((s) => markedSet.has(s))) return subs.some((s) => typoSet.has(s)) ? null : 'mark'
  return null
}

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

function TokenLine({ label, tokens, marks, inkVar }) {
  const eyebrow = {
    fontSize: 11, fontWeight: 700, color: inkVar, opacity: 0.7,
    letterSpacing: '.08em', textTransform: 'uppercase',
  }
  const tappable = speechSupported
  return (
    <>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 15, marginTop: 4, color: label === 'você' ? 'var(--ink-2)' : undefined, fontWeight: label === 'esperado' ? 700 : 400 }}>
        {tokens.length ? tokens.map((w, i) => (
          <span key={`${label}-${i}`}>
            {i > 0 && ' '}
            <span style={{ ...(MARK_STYLE[marks.get(i)] || {}), ...(tappable ? { cursor: 'pointer' } : {}) }}
              onClick={tappable ? () => speakWord(w) : undefined}>{w}</span>
          </span>
        )) : '—'}
      </div>
    </>
  )
}

function marksFromAlignment(alignment) {
  const expectedMarks = new Map()
  const actualMarks = new Map()
  for (const a of alignment || []) {
    if (a.operation === 'replace') {
      if (a.expected_token_index != null) expectedMarks.set(a.expected_token_index, 'replace')
      if (a.actual_token_index != null) actualMarks.set(a.actual_token_index, 'replace')
    } else if (a.operation === 'delete') {
      if (a.expected_token_index != null) expectedMarks.set(a.expected_token_index, 'missing')
    } else if (a.operation === 'insert') {
      if (a.actual_token_index != null) actualMarks.set(a.actual_token_index, 'extra')
    }
  }
  return { expectedMarks, actualMarks }
}

export function AnswerDiff({ user, target, missing, extra, typos, alignment, inkVar = 'var(--ink-2)' }) {
  const userTokens = tokenize(user || '')
  const targetTokens = tokenize(target || '')
  const aligned = alignment?.length ? alignment : alignTokens(userTokens, targetTokens)
  if (aligned?.length) {
    const { expectedMarks, actualMarks } = marksFromAlignment(aligned)
    return (
      <>
        <TokenLine label="esperado" tokens={targetTokens} marks={expectedMarks} inkVar={inkVar} />
        <div style={{ marginTop: 10 }}>
          <TokenLine label="você" tokens={userTokens} marks={actualMarks} inkVar={inkVar} />
        </div>
      </>
    )
  }

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

export function TypoNote({ typos, inkVar }) {
  if (!typos?.length) return null
  return (
    <div style={{ fontSize: 13, color: inkVar, opacity: 0.85 }}>
      ✏️ Atenção à grafia: {typos.map((t, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <span style={{ borderBottom: '2px solid currentColor' }}>{t.got}</span>
          {' → '}
          <strong>{t.expected}</strong>
        </span>
      ))}
    </div>
  )
}
