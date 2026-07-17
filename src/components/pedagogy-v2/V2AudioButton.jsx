// V2AudioButton.jsx — audio affordance for V2 activities. Speaks the authored
// exemplar sentence through the existing TTS router. From the SECOND play on it
// reports `audio_replay` to the support runtime (the first play is inherent to
// the activity when the plan's baseline already declares audio).

import { useRef, useState } from 'react'
import { I } from '../icons.jsx'
import { speakSegment } from '../../lib/speech-router.js'

export function V2AudioButton({ text, settings, available = true, onReplay = null, label = 'Ouvir' }) {
  const plays = useRef(0)
  const [busy, setBusy] = useState(false)
  if (!available) {
    return <span className="muted" data-testid="v2-audio-unavailable" style={{ fontSize: 12 }}>Áudio indisponível neste dispositivo.</span>
  }
  return (
    <button type="button" className="btn btn-secondary" data-testid="v2-audio-button" disabled={busy}
      aria-label="Ouvir frase"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999 }}
      onClick={async () => {
        plays.current += 1
        if (plays.current > 1) onReplay?.()
        setBusy(true)
        try { await speakSegment({ text, language: 'en', role: 'exercise_en', settings: settings || {} }) } finally { setBusy(false) }
      }}>
      <I.speaker s={18} />{label}
    </button>
  )
}
