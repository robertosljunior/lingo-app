import { useState } from 'react'
import { useApp } from '../store.jsx'
import { I } from '../components/icons.jsx'
import BobMascot from '../components/BobMascot.jsx'

// First-run onboarding (no login). Three quick steps: audience (Kids/Adult),
// name, and a friendly self-assessment that maps to the starting CEFR level.
const LEVELS = [
  { id: 'A1', label: 'Não sei quase nada', hint: 'Vamos do começo, no seu ritmo.' },
  { id: 'A2', label: 'Sei algumas palavras', hint: 'Frases curtas do dia a dia.' },
  { id: 'B1', label: 'Entendo, mas travo pra falar', hint: 'Soltar a fala com naturalidade.' },
  { id: 'B2', label: 'Já converso razoavelmente', hint: 'Refinar e ganhar fluência.' },
]

const sky = { background: 'linear-gradient(180deg,#C3E7F9 0%,#EAF7FE 46%,#FFFFFF 82%)' }

export default function Onboarding() {
  const { completeOnboarding } = useApp()
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [level, setLevel] = useState('A1')
  const [busy, setBusy] = useState(false)

  async function finish() {
    if (busy) return
    setBusy(true)
    try { await completeOnboarding({ name, mode: mode || 'adult', level }) }
    finally { setBusy(false) }
  }

  return (
    <div className="phone" style={sky}>
      <div style={{ height: 8 }} />
      <div style={{ padding: '6px 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
        {step > 0 && (
          <button className="back" aria-label="Voltar" onClick={() => setStep((s) => s - 1)}
            style={{ width: 44, height: 44, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I.chevL s={18} />
          </button>
        )}
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: i <= step ? 'var(--indigo-500)' : 'rgba(255,255,255,.7)' }} />
          ))}
        </div>
      </div>

      <div className="screen-body" style={{ padding: '8px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <BobMascot size={116} mode={mode || 'adult'} />
        </div>

        {step === 0 && (
          <>
            <Header title="Oi! Eu sou o Bob 👋" subtitle="Pra quem é esse aprendizado?" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ModeCard testid="onboarding-mode-kids" active={mode === 'kids'} onClick={() => setMode('kids')}
                emoji="🧒" title="Kids" desc="Com histórias e um Bob fofinho." />
              <ModeCard testid="onboarding-mode-adult" active={mode === 'adult'} onClick={() => setMode('adult')}
                emoji="😎" title="Adulto" desc="Direto ao ponto, sem infantilizar." />
            </div>
            <Primary disabled={!mode} onClick={() => setStep(1)}>Continuar</Primary>
          </>
        )}

        {step === 1 && (
          <>
            <Header title="Como podemos te chamar?" subtitle="É só o seu nome — sem cadastro, sem senha." />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '2px solid var(--indigo-500)', borderRadius: 16, padding: '0 14px', height: 56, boxShadow: '0 2px 0 rgba(31,122,175,.12)' }}>
              <I.user s={20} />
              <input data-testid="onboarding-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                placeholder="Seu nome ou apelido" maxLength={24}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep(2) }}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: '700 16px var(--font-sans)', color: 'var(--ink)' }} />
            </div>
            <Primary disabled={!name.trim()} onClick={() => setStep(2)}>Continuar</Primary>
          </>
        )}

        {step === 2 && (
          <>
            <Header title={`Prazer, ${name.trim() || 'pessoa'}!`} subtitle="Quanto de inglês você já sabe?" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LEVELS.map((l) => (
                <button key={l.id} data-testid={`onboarding-level-${l.id}`} onClick={() => setLevel(l.id)}
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, cursor: 'pointer', font: 'inherit',
                    background: '#fff', border: `2px solid ${level === l.id ? 'var(--indigo-500)' : 'var(--border)'}`,
                    boxShadow: level === l.id ? '0 0 0 3px var(--indigo-50)' : 'var(--shadow-sm)' }}>
                  <span style={{ fontWeight: 800, color: 'var(--indigo-700)', fontFamily: 'var(--font-display)', minWidth: 28 }}>{l.id}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--ink)' }}>{l.label}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)' }}>{l.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <Primary onClick={finish} disabled={busy} testid="onboarding-finish">{busy ? 'Preparando…' : 'Bora começar!'}</Primary>
          </>
        )}
      </div>
    </div>
  )
}

function Header({ title, subtitle }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 className="h1" style={{ fontSize: 26 }}>{title}</h1>
      <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--ink-3)' }}>{subtitle}</p>
    </div>
  )
}

function ModeCard({ active, onClick, emoji, title, desc, testid }) {
  return (
    <button data-testid={testid} onClick={onClick}
      style={{ textAlign: 'left', padding: 16, borderRadius: 20, cursor: 'pointer', font: 'inherit',
        background: '#fff', border: `2px solid ${active ? 'var(--indigo-500)' : 'var(--border)'}`,
        boxShadow: active ? '0 0 0 3px var(--indigo-50)' : 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 30 }}>{emoji}</div>
      <div style={{ fontWeight: 800, fontSize: 17, marginTop: 6, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.35, marginTop: 2 }}>{desc}</div>
    </button>
  )
}

function Primary({ children, onClick, disabled, testid }) {
  return (
    <button className="btn btn-primary btn-block" data-testid={testid} onClick={onClick} disabled={disabled}
      style={{ marginTop: 'auto' }}>{children}</button>
  )
}
