import { useApp } from '../store.jsx'
import { BottomNav, Logo } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { prettyFocus } from '../lib/lesson-parser.js'

function StreakStrip({ sessions }) {
  // Derive a 14-day activity heatmap from real session timestamps.
  const now = Date.now()
  const dayMs = 86400000
  const counts = new Array(14).fill(0)
  for (const s of sessions) {
    const daysAgo = Math.floor((now - s.answered_at) / dayMs)
    if (daysAgo >= 0 && daysAgo < 14) counts[13 - daysAgo] += 1
  }
  // current streak = consecutive days (ending today or yesterday) with activity
  let streak = 0
  for (let i = 13; i >= 0; i--) { if (counts[i] > 0) streak++; else if (i < 13) break }
  const lvl = (n) => (n === 0 ? '' : `l${Math.min(n + 1, 4)}`)
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ color: '#D97706' }}><I.flame s={18} /></div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {streak > 0 ? `${streak} ${streak === 1 ? 'dia' : 'dias'} de prática` : 'Comece sua sequência'}
          </span>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>últimos 14 dias</span>
      </div>
      <div className="heat">
        {counts.map((d, i) => <div key={i} className={`cell ${lvl(d)}`} />)}
      </div>
    </div>
  )
}

export default function Home() {
  const { lessons, sessions, mistakes, profiles, activeProfile, startLesson, navigate, setTab, SCREENS } = useApp()
  const latest = lessons[0] || null
  const avgScore = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length)
    : null
  const profile = profiles.find((p) => p.profile_id === activeProfile)

  return (
    <div className="phone">
      <div style={{ padding: '8px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Logo />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {profile && (
            <button className="chip" onClick={() => setTab(SCREENS.SETTINGS)}
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, font: 'inherit', fontSize: 12, fontWeight: 700 }}
              aria-label="Trocar perfil">
              <I.user s={12} /> {profile.name}
            </button>
          )}
          {avgScore != null && (
            <div className="chip chip-indigo" style={{ fontWeight: 800 }}>{latest?.level || 'B1'}</div>
          )}
        </div>
      </div>

      <div className="screen-body" style={{ paddingBottom: 100 }}>
        <div>
          <div className="label-eyebrow">bem-vindo</div>
          <h1 className="h1" style={{ marginTop: 4 }}>{profile && profile.name !== 'Você' ? `Bem-vindo, ${profile.name}.` : 'Bem-vindo de volta.'}</h1>
          <p className="muted-2" style={{ margin: '6px 0 0', fontSize: 14 }}>Pronto pra travar menos hoje?</p>
        </div>

        {/* Continue / start latest lesson */}
        {latest ? (
          <div className="card tap" onClick={() => startLesson(latest)} style={{
            background: 'linear-gradient(135deg, var(--indigo-600), var(--indigo-700))',
            color: 'white', border: 'none', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(67,56,202,.25)',
          }}>
            <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
            <div style={{ position: 'absolute', right: 30, bottom: -50, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .75 }}>Iniciar aula</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.015em', marginTop: 6, lineHeight: 1.15 }}>
                {prettyFocus(latest.focus)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, opacity: .85 }}>
                <span>{latest.level} · {latest.questions?.length || latest.count || 0} perguntas</span>
                <span style={{ opacity: .5 }}>·</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{latest.focus}</span>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 16, background: 'white', color: 'var(--indigo-700)', fontWeight: 800 }}>
                Começar <I.chevR s={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Nenhuma aula ainda</div>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 14px' }}>Importe sua primeira aula em YAML para começar.</p>
            <button className="btn btn-primary btn-block" onClick={() => navigate(SCREENS.IMPORT)}>
              <I.upload s={18} /> Importar aula
            </button>
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card tap" onClick={() => navigate(SCREENS.IMPORT)} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--indigo-50)', color: 'var(--indigo-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.upload s={18} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Importar aula</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>cole YAML / JSON</div>
            </div>
          </div>
          <div className="card tap" onClick={() => navigate(SCREENS.EXPORT)} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.spark s={18} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Gerar prompt</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>para nova aula</div>
            </div>
          </div>
        </div>

        {/* Recurring mistakes preview */}
        {mistakes.length > 0 && (
          <div className="card tap" onClick={() => setTab(SCREENS.MISTAKES)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 className="h3">Erros recorrentes</h3>
              <span style={{ fontSize: 13, color: 'var(--indigo-700)', fontWeight: 700 }}>Ver todos →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mistakes.slice(0, 3).map((m) => (
                <div key={m.mistake_type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-mono)' }}>{m.mistake_type}</div>
                  <span style={{ fontSize: 14, fontWeight: 800, minWidth: 24, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <StreakStrip sessions={sessions} />
      </div>

      <BottomNav active="home" onNavigate={setTab} />
    </div>
  )
}
