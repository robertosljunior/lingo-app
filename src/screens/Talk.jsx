import { useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import BobMascot from '../components/BobMascot.jsx'
import { MicButton } from '../components/mic-button.jsx'
import { sttSupported } from '../lib/audio/stt.js'
import { speakSegment } from '../lib/speech-router.js'
import { canonicalText } from '../lib/generated-lesson-contracts.js'

// "Fale com o Bob" — a light speaking practice. The Bob prompts a phrase, the
// learner repeats it (speech recognition, or typing where unavailable), and the
// transcript is matched to the target locally. No new engine: reuses the STT
// layer, the speech router and canonicalText for the comparison.
const PHRASES = [
  { en: 'Good morning! How are you today?', pt: 'Bom dia! Como você está hoje?' },
  { en: 'Can I have a coffee, please?', pt: 'Posso tomar um café, por favor?' },
  { en: 'I would like to practice English.', pt: 'Eu gostaria de praticar inglês.' },
  { en: 'See you tomorrow. Have a nice day!', pt: 'Até amanhã. Tenha um bom dia!' },
  { en: 'Where is the train station?', pt: 'Onde fica a estação de trem?' },
]

function scoreSpoken(said, target) {
  const t = canonicalText(target).split(' ').filter(Boolean)
  const s = new Set(canonicalText(said).split(' ').filter(Boolean))
  if (!t.length) return 0
  return t.filter((w) => s.has(w)).length / t.length
}

export default function Talk() {
  const { settings, setTab } = useApp()
  const mode = settings?.profile_mode === 'kids' ? 'kids' : 'adult'
  const [idx, setIdx] = useState(0)
  const [said, setSaid] = useState('')
  const [partial, setPartial] = useState('')
  const [result, setResult] = useState(null) // null | 'correct' | 'retry'
  const phrase = PHRASES[idx % PHRASES.length]

  function evaluate(text) {
    setSaid(text)
    setPartial('')
    setResult(scoreSpoken(text, phrase.en) >= 0.6 ? 'correct' : 'retry')
  }
  function next() {
    setResult(null); setSaid(''); setPartial(''); setIdx((v) => v + 1)
  }

  const bg = result === 'correct' ? 'var(--success-bg)' : result === 'retry' ? 'var(--error-bg)' : 'var(--surface-2)'

  return (
    <div className="phone">
      <div style={{ padding: '10px 20px 8px', flexShrink: 0 }}>
        <div className="label-eyebrow">conversa</div>
        <h1 className="h1" style={{ marginTop: 4 }}>Fale com o Bob</h1>
      </div>

      <div className="screen-body" style={{ paddingBottom: 110, gap: 16 }}>
        {/* Bob scene + speech bubble */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, background: bg }}>
          <BobMascot size={84} mode={mode} float={result !== 'retry'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {result === 'correct' ? 'Boa! Ficou ótimo 👏' : result === 'retry' ? 'Quase! Tenta de novo 🙂' : 'Repita depois de mim'}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.25, marginTop: 4 }}>{phrase.en}</div>
            <div className="muted-2" style={{ fontSize: 13, marginTop: 4 }}>{phrase.pt}</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} aria-label="Ouvir a frase"
              onClick={() => speakSegment({ text: phrase.en, language: 'en', role: 'exercise_en', settings })}>
              <I.speaker s={16} /> Ouvir o Bob
            </button>
          </div>
        </div>

        {/* what the app heard */}
        <div className="card" style={{ minHeight: 64, padding: 14 }}>
          <div className="label-eyebrow" style={{ marginBottom: 6 }}>o que você disse</div>
          <div data-testid="talk-heard" style={{ fontSize: 16, fontWeight: 600, color: said || partial ? 'var(--ink)' : 'var(--ink-4)' }}>
            {said || partial || (sttSupported ? 'Toque no microfone e fale…' : 'Digite a frase abaixo…')}
          </div>
        </div>

        {sttSupported ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <MicButton lang="en-US" label={said ? 'Falar de novo' : 'Toque para falar'}
              onPartial={setPartial} onResult={(t) => t && evaluate(t)} />
          </div>
        ) : (
          <div>
            <textarea className="input" placeholder="Type the phrase…" data-testid="talk-input"
              value={said} onChange={(e) => setSaid(e.target.value)} style={{ minHeight: 80 }} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => evaluate(said)} disabled={!said.trim()}>Verificar</button>
          </div>
        )}
      </div>

      {result && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 64, padding: '12px 20px', background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
          {result === 'correct'
            ? <button className="btn btn-primary btn-block" data-testid="talk-next" onClick={next}>Próxima frase <I.chevR s={18} /></button>
            : <button className="btn btn-secondary btn-block" data-testid="talk-retry" onClick={() => { setResult(null); setSaid('') }}>Tentar de novo</button>}
        </div>
      )}

      <BottomNav active="talk" onNavigate={setTab} />
    </div>
  )
}
