import { useApp } from '../store.jsx'
import { BottomNav, ScoreRing } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'

function relDate(ts) {
  const d = new Date(ts)
  const today = new Date()
  const dayMs = 86400000
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / dayMs)
  const hm = new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (days === 0) return `hoje · ${hm}`
  if (days === 1) return `ontem · ${hm}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ` · ${hm}`
}

export default function History() {
  const { sessions, lessons, startLesson, navigate, setTab, SCREENS } = useApp()

  if (sessions.length === 0) {
    return (
      <div className="phone">
        <div style={{ padding: '8px 20px 4px', flexShrink: 0 }}><h1 className="h1">Histórico</h1></div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 14 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--indigo-50)', color: 'var(--indigo-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I.history s={40} />
          </div>
          <h2 className="h2">Ainda nenhuma aula</h2>
          <p className="muted-2" style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 260 }}>
            Importe sua primeira aula em YAML para começar a treinar. Tudo fica salvo offline.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate(SCREENS.IMPORT)}>
            <I.upload s={18} /> Importar primeira aula
          </button>
        </div>
        <BottomNav active="history" onNavigate={setTab} />
      </div>
    )
  }

  const startAgain = (lessonId) => {
    const lesson = lessons.find((l) => l.lesson_id === lessonId)
    if (lesson) startLesson(lesson)
  }

  return (
    <div className="phone">
      <div style={{ padding: '8px 20px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h1 className="h1">Histórico</h1>
        <div className="chip"><I.search s={12} /> {sessions.length} sessões</div>
      </div>
      <div className="screen-body" style={{ paddingTop: 12, paddingBottom: 100, gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="chip chip-indigo">Todas</span>
          <span className="chip">B1</span>
          <span className="chip">&lt; 70%</span>
          <span className="chip">Esta semana</span>
        </div>

        {sessions.map((it) => (
          <button key={it.session_id} className="card tap" onClick={() => startAgain(it.lesson_id)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, width: '100%', textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', font: 'inherit', color: 'var(--ink)' }}>
            <ScoreRing score={it.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-mono)' }}>{it.focus}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{relDate(it.answered_at)} · {it.total} q · {it.level}</div>
            </div>
            <I.chevR />
          </button>
        ))}
      </div>
      <BottomNav active="history" onNavigate={setTab} />
    </div>
  )
}
