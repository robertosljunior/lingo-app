// V2AudioControl.jsx — Slice V2.20 §7/§10. The learner-facing audio affordance,
// in two visual weights driven ONLY by how important the audio is to the recipe:
//
//   variant="pill"  — Exposure: audio is a SECONDARY action next to the sentence
//                     the learner can already read (ghost pill).
//   variant="hero"  — Listening recognition: the audio IS the stimulus, so the
//                     button is the protagonist of the interaction — bigger, with
//                     a pulse halo while it plays and an explicit playing state.
//
// No waveform is drawn: there is no real amplitude data behind it, and inventing
// one would be a fake signal (§10). Replay accounting is unchanged from V2.17 —
// every play after the first reports `audio_replay` to the support runtime.

import { useRef, useState } from 'react'
import { speakSegment } from '../../lib/speech-router.js'

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

  if (!available) {
    return (
      <span className="v2lx-translation" data-testid="v2lx-audio-unavailable" style={{ fontSize: 13 }}>
        Áudio indisponível neste dispositivo.
      </span>
    )
  }

  const hero = variant === 'hero'
  return (
    <button
      type="button"
      className={hero ? 'v2lx-audio-hero' : 'v2lx-audio-pill'}
      data-testid="v2lx-audio"
      data-variant={variant}
      data-playing={playing || undefined}
      aria-label="Ouvir frase"
      disabled={playing}
      onClick={async () => {
        plays.current += 1
        if (plays.current > 1) onReplay?.()
        setPlaying(true)
        try {
          await speakSegment({ text, language: 'en', role: 'exercise_en', settings: settings || {} })
        } finally {
          setPlaying(false)
        }
      }}
    >
      <span aria-hidden="true">{hero ? '🔊' : '🔊'}</span>
      <span>{playing ? playingLabel : label}</span>
    </button>
  )
}
