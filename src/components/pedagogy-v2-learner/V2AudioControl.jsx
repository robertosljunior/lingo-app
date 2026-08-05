// V2AudioControl.jsx — learner-facing audio affordance with an honest playback
// and voice-route lifecycle. The control remains disabled until the selected
// backend reports onended/interruption/failure; audio.play() starting is not
// treated as playback completion.

import { useEffect, useRef, useState } from 'react'
import { speakSegment } from '../../lib/speech-router.js'
import {
  loadEnglishVoicePreparationState,
  subscribeEnglishVoicePreparation,
} from '../../lib/audio/neural-voice-preparation.js'

export default function V2AudioControl({
  text,
  settings,
  available = true,
  onReplay = null,
  variant = 'pill',
  label = 'Ouvir',
  playingLabel = 'Tocando…',
}) {
  const plays = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [route, setRoute] = useState(null)
  const [voiceState, setVoiceState] = useState(() => loadEnglishVoicePreparationState())

  useEffect(() => subscribeEnglishVoicePreparation(setVoiceState), [])

  if (!available) {
    return (
      <span className="v2lx-translation" data-testid="v2lx-audio-unavailable" style={{ fontSize: 13 }}>
        Áudio indisponível neste dispositivo.
      </span>
    )
  }

  const hero = variant === 'hero'
  const preparationActive = ['downloading', 'waiting'].includes(voiceState.status)
  const routeLabel = route === 'piper'
    ? 'Voz neural pronta para uso offline.'
    : route === 'fallback'
      ? 'Usando a voz do aparelho enquanto a voz neural não está pronta.'
      : route === 'unavailable'
        ? 'O áudio não pôde ser reproduzido agora.'
        : preparationActive
          ? `Preparando voz neural${voiceState.status === 'downloading' ? ` · ${voiceState.progress}%` : ''}. A voz do aparelho continua disponível.`
          : null

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        className={hero ? 'v2lx-audio-hero' : 'v2lx-audio-pill'}
        data-testid="v2lx-audio"
        data-variant={variant}
        data-playing={playing || undefined}
        data-engine={route || undefined}
        aria-label="Ouvir frase"
        disabled={playing}
        onClick={async () => {
          plays.current += 1
          if (plays.current > 1) onReplay?.()
          setPlaying(true)
          setRoute(null)
          try {
            const result = await speakSegment({ text, language: 'en', role: 'exercise_en', settings: settings || {} })
            if (result?.ok) setRoute(result.engine === 'piper' ? 'piper' : (result.fallback_used ? 'fallback' : 'system'))
            else if (result?.code !== 'TTS_INTERRUPTED') setRoute('unavailable')
          } finally {
            setPlaying(false)
          }
        }}
      >
        <span aria-hidden="true">🔊</span>
        <span>{playing ? playingLabel : label}</span>
      </button>
      {routeLabel && (
        <span
          className="v2lx-translation"
          data-testid="v2lx-audio-route"
          data-route={route || voiceState.status}
          aria-live="polite"
          style={{ fontSize: 11, lineHeight: 1.35, maxWidth: hero ? 260 : 220 }}
        >
          {routeLabel}
        </span>
      )}
    </span>
  )
}
