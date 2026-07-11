// speak-button.jsx — the app's audio affordances.
//
// SpeakButton: round speaker button, Duolingo-style, with an optional turtle
// companion that replays the same sentence slowly.
// SpeakableText: renders a sentence word by word; tapping a word speaks it.

import { useState } from 'react'
import { I } from './icons.jsx'
import { speak, speakWord, speechSupported } from '../lib/audio/tts.js'

export function SpeakButton({ text, size = 'md', turtle = false, label = null, disabled = false }) {
  const [active, setActive] = useState(null) // 'normal' | 'slow' while flashing
  if (!speechSupported || !text) return null

  const flash = (kind) => {
    setActive(kind)
    setTimeout(() => setActive(null), 700)
  }
  const dims = size === 'lg' ? { pad: '18px 26px', icon: 22 } : size === 'sm' ? { pad: '6px 10px', icon: 14 } : { pad: '10px 14px', icon: 18 }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button type="button" className="btn btn-secondary" disabled={disabled}
        onClick={() => { speak(text); flash('normal') }}
        aria-label="Ouvir frase"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: dims.pad, borderRadius: 999,
          ...(active === 'normal' ? { borderColor: 'var(--indigo-600)', color: 'var(--indigo-700)' } : {}),
        }}>
        <I.speaker s={dims.icon} />{label}
      </button>
      {turtle && (
        <button type="button" className="btn btn-secondary" disabled={disabled}
          onClick={() => { speak(text, { slow: true }); flash('slow') }}
          aria-label="Ouvir devagar"
          style={{
            display: 'inline-flex', alignItems: 'center', padding: dims.pad, borderRadius: 999,
            ...(active === 'slow' ? { borderColor: 'var(--indigo-600)', color: 'var(--indigo-700)' } : {}),
          }}>
          <I.turtle s={dims.icon} />
        </button>
      )}
    </span>
  )
}

// Each word is tappable and speaks itself — the "tap a word to hear it" drill.
export function SpeakableText({ text, style }) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!speechSupported || words.length === 0) return <span style={style}>{text}</span>
  return (
    <span style={style}>
      {words.map((w, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span role="button" tabIndex={0}
            onClick={() => speakWord(w)}
            onKeyDown={(e) => { if (e.key === 'Enter') speakWord(w) }}
            style={{ cursor: 'pointer', textDecorationLine: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, textDecorationColor: 'color-mix(in srgb, currentColor 35%, transparent)' }}>
            {w}
          </span>
        </span>
      ))}
    </span>
  )
}
