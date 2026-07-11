// mic-button.jsx — push-to-talk button over the STT layer.
//
// Tap → starts listening (partial transcript streams to onPartial);
// tap again or pause → resolves and delivers the final transcript.

import { useEffect, useRef, useState } from 'react'
import { I } from './icons.jsx'
import { listen, stopListening, abortListening, sttSupported } from '../lib/audio/stt.js'

export function MicButton({ lang = 'en-US', onResult, onPartial, disabled = false, size = 56, label = null }) {
  const [listening, setListening] = useState(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false; abortListening() }, [])

  if (!sttSupported) return null

  const toggle = async () => {
    if (listening) { stopListening(); return }
    setListening(true)
    const transcript = await listen({ lang, onPartial })
    if (!mounted.current) return
    setListening(false)
    onResult?.(transcript)
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={toggle} disabled={disabled} aria-label={listening ? 'Parar de ouvir' : 'Falar'}
        style={{
          width: size, height: size, borderRadius: '50%', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: listening ? 'var(--error)' : 'var(--indigo-600)', color: 'white',
          boxShadow: listening ? '0 0 0 8px color-mix(in srgb, var(--error) 20%, transparent)' : '0 2px 0 var(--indigo-700)',
          transition: 'background .15s, box-shadow .15s',
          opacity: disabled ? 0.5 : 1,
        }}>
        <I.mic s={Math.round(size * 0.45)} />
      </button>
      {label !== null && (
        <span style={{ fontSize: 12, fontWeight: 700, color: listening ? 'var(--error)' : 'var(--ink-3)' }}>
          {listening ? 'Ouvindo… toque para parar' : label}
        </span>
      )}
    </span>
  )
}
