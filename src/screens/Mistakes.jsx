import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'

export default function Mistakes() {
  const { mistakes, setTab, navigate, SCREENS, startPracticeSession } = useApp()

  if (mistakes.length === 0) {
    return (
      <div className="phone">
        <div style={{ padding: '8px 20px 4px', flexShrink: 0 }}><h1 className="h1">Erros recorrentes</h1></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 14 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I.check s={40} />
          </div>
          <h2 className="h2">Nenhum erro registrado</h2>
          <p className="muted-2" style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 260 }}>
            Conforme você responde exercícios, os erros são classificados e aparecem aqui como um ranking.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setTab(SCREENS.HOME)}>Ir treinar</button>
        </div>
        <BottomNav active="mistakes" onNavigate={setTab} />
      </div>
    )
  }

  const max = Math.max(...mistakes.map((m) => m.count), 1)

  return (
    <div className="phone">
      <div style={{ padding: '8px 20px 4px', flexShrink: 0 }}>
        <h1 className="h1">Erros recorrentes</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Classificados por tipo, do mais frequente ao menos</p>
      </div>
      <div className="screen-body" style={{ paddingTop: 12, paddingBottom: 100, gap: 10 }}>
        <button className="btn btn-primary btn-block" onClick={startPracticeSession}>
          <I.trend s={18} /> Treinar minhas dificuldades
        </button>
        {mistakes.map((m, i) => {
          const ex = m.examples?.[0]
          return (
            <div key={m.mistake_type} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 24, fontSize: 13, fontWeight: 800, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{m.mistake_type}</div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${(m.count / max) * 100}%`, background: 'var(--indigo-600)', borderRadius: 999 }} />
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.count}</div>
              </div>
              {i === 0 && ex && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="label-eyebrow" style={{ marginBottom: 6 }}>último exemplo</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--error)', textDecoration: 'line-through' }}>"{ex.user || '—'}"</span>
                    {' → '}
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>"{ex.expected}"</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <BottomNav active="mistakes" onNavigate={setTab} />
    </div>
  )
}
