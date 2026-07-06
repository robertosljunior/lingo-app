import { useApp } from '../store.jsx'
import { I } from '../components/icons.jsx'

export default function Result() {
  const { activeLesson, session, navigate, setTab, SCREENS } = useApp()
  const answers = session.answers
  const total = activeLesson.questions.length
  const correct = answers.filter((a) => a.verdict === 'correct').length
  const partial = answers.filter((a) => a.verdict === 'partial').length
  const wrong = answers.filter((a) => a.verdict === 'incorrect').length
  const score = total ? Math.round(((correct + partial * 0.5) / total) * 100) : 0

  const ringDash = 2 * Math.PI * 76

  const mistakeCounts = {}
  for (const a of answers) {
    if (a.verdict === 'correct') continue
    const t = a.mistake_type || 'unknown'
    mistakeCounts[t] = (mistakeCounts[t] || 0) + 1
  }
  const maxCount = Math.max(1, ...Object.values(mistakeCounts))
  const reviewable = wrong + partial

  return (
    <div className="phone">
      <div className="app-header">
        <button className="back" onClick={() => setTab(SCREENS.HOME)} aria-label="Início"><I.close /></button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Resultado</div>
        <button className="back" onClick={() => navigate(SCREENS.EXPORT)} aria-label="Exportar"><I.download s={18} /></button>
      </div>

      <div className="screen-body" style={{ paddingBottom: 20 }}>
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <div className="label-eyebrow" style={{ fontFamily: 'var(--font-mono)' }}>{activeLesson.focus} · {activeLesson.level}</div>
          <div style={{ position: 'relative', width: 180, height: 180, margin: '20px auto 0' }}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="76" stroke="var(--border)" strokeWidth="14" fill="none" />
              <circle cx="90" cy="90" r="76" stroke="var(--indigo-600)" strokeWidth="14" fill="none"
                strokeDasharray={`${ringDash * (score / 100)} ${ringDash}`} strokeLinecap="round"
                transform="rotate(-90 90 90)" style={{ transition: 'stroke-dasharray .8s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}<span style={{ fontSize: 22, color: 'var(--ink-3)' }}>%</span></div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 4 }}>score</div>
            </div>
          </div>
          <h1 className="h2" style={{ marginTop: 20 }}>
            {score >= 80 ? 'Mandou bem!' : score >= 60 ? 'Bom trabalho — dá pra refinar.' : 'Vamos revisar com calma.'}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Stat n={correct} label="acertos" color="var(--success)" />
          <Stat n={partial} label="parciais" color="var(--warn)" />
          <Stat n={wrong} label="erros" color="var(--error)" />
        </div>

        {Object.keys(mistakeCounts).length > 0 && (
          <div className="card">
            <div className="label-eyebrow" style={{ marginBottom: 10 }}>tipos de erro</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(mistakeCounts).map(([t, n]) => (
                <div key={t}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t}</span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(n / maxCount) * 100}%`, background: 'var(--error)', borderRadius: '999px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate(SCREENS.EXPORT)}>
            <I.download s={18} /> Exportar
          </button>
          {reviewable > 0 ? (
            <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => navigate(SCREENS.REVIEW)}>
              Revisar {reviewable} {reviewable === 1 ? 'erro' : 'erros'} <I.chevR s={18} />
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => setTab(SCREENS.HOME)}>Voltar ao início</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ n, label, color }) {
  return (
    <div className="card" style={{ padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</div>
    </div>
  )
}
