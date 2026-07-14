import { useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import BobMascot from '../components/BobMascot.jsx'
import { speakSegment } from '../lib/speech-router.js'

// Kids-only illustrated mini-stories. Content is static and fully local (no
// engine, no network) — each panel is an English line with a Portuguese gloss
// and a scene emoji. Everything is unlocked.
const STORIES = [
  {
    id: 'brave_rabbit', title: 'O Coelho Corajoso', emoji: '🐰', minutes: 2,
    panels: [
      { scene: '🌳🐰', en: 'A little rabbit lives near the forest.', pt: 'Um coelhinho mora perto da floresta.' },
      { scene: '🎒', en: 'Today he wants to find his friend.', pt: 'Hoje ele quer encontrar seu amigo.' },
      { scene: '🌧️', en: 'It starts to rain, but he is brave.', pt: 'Começa a chover, mas ele é corajoso.' },
      { scene: '🐇🐇', en: 'Finally, he finds his friend. They play together.', pt: 'Enfim, ele encontra seu amigo. Eles brincam juntos.' },
    ],
  },
  {
    id: 'lion_house', title: 'Os Leõezinhos', emoji: '🦁', minutes: 2,
    panels: [
      { scene: '🏠🦁', en: 'Two baby lions live in a warm house.', pt: 'Dois leõezinhos moram em uma casa quentinha.' },
      { scene: '🍽️', en: 'They are hungry, so they look for food.', pt: 'Eles estão com fome, então procuram comida.' },
      { scene: '🌙', en: 'At night, their mother comes home.', pt: 'À noite, a mãe deles volta para casa.' },
      { scene: '😴🦁', en: 'They eat, and then they sleep happily.', pt: 'Eles comem e depois dormem felizes.' },
    ],
  },
]

export default function Stories() {
  const { settings, setTab } = useApp()
  const mode = settings?.profile_mode === 'kids' ? 'kids' : 'adult'
  const [open, setOpen] = useState(null)

  if (open) return <StoryPlayer story={open} mode={mode} onBack={() => setOpen(null)} />

  return (
    <div className="phone">
      <div style={{ padding: '10px 20px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}><div className="label-eyebrow">para você</div><h1 className="h1" style={{ marginTop: 4 }}>Histórias</h1></div>
        <BobMascot size={54} mode={mode} />
      </div>
      <div className="screen-body" style={{ paddingBottom: 100, gap: 12 }}>
        {STORIES.map((s) => (
          <button key={s.id} className="card tap" data-testid={`story-${s.id}`} onClick={() => setOpen(s)}
            style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: 16, font: 'inherit', cursor: 'pointer' }}>
            <div style={{ fontSize: 40 }}>{s.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-display)' }}>{s.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>⏱ {s.minutes} min · inglês com apoio em português</div>
            </div>
            <span className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>Ler <I.chevR s={14} /></span>
          </button>
        ))}
      </div>
      <BottomNav active="stories" onNavigate={setTab} />
    </div>
  )
}

function StoryPlayer({ story, mode, onBack }) {
  const { settings, setTab } = useApp()
  const [i, setI] = useState(0)
  const done = i >= story.panels.length
  const panel = story.panels[Math.min(i, story.panels.length - 1)]

  return (
    <div className="phone">
      <div style={{ padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button className="back" aria-label="Voltar" onClick={onBack} style={{ width: 40, height: 40 }}><I.chevL s={18} /></button>
        <div style={{ flex: 1 }}><Bar value={((Math.min(i, story.panels.length)) / story.panels.length) * 100} /></div>
      </div>
      <div className="screen-body" style={{ paddingBottom: 120, justifyContent: 'center', gap: 18 }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <BobMascot size={120} mode={mode} />
            <h1 className="h1" style={{ marginTop: 10 }}>Fim! 🎉</h1>
            <p className="muted-2" style={{ fontSize: 14, marginTop: 6 }}>Você leu "{story.title}". Mandou muito bem!</p>
            <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} data-testid="story-finish" onClick={onBack}>Voltar às histórias</button>
          </div>
        ) : (
          <>
            <div className="card" style={{ textAlign: 'center', padding: 24, background: 'linear-gradient(180deg, var(--indigo-50), var(--surface))' }}>
              <div style={{ fontSize: 64, lineHeight: 1.1 }}>{panel.scene}</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.3 }}>{panel.en}</div>
              <div className="muted-2" style={{ fontSize: 14, marginTop: 8 }}>{panel.pt}</div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} aria-label="Ouvir"
                onClick={() => speakSegment({ text: panel.en, language: 'en', role: 'exercise_en', settings })}>
                <I.speaker s={16} /> Ouvir
              </button>
            </div>
          </>
        )}
      </div>
      {!done && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 20px calc(24px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
          <button className="btn btn-primary btn-block" data-testid="story-next" onClick={() => setI((v) => v + 1)}>
            {i === story.panels.length - 1 ? 'Terminar' : 'Próxima'} <I.chevR s={18} />
          </button>
        </div>
      )}
    </div>
  )
}

function Bar({ value }) {
  return (
    <div style={{ height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: 'var(--indigo-500)', borderRadius: 999, transition: 'width .2s ease' }} />
    </div>
  )
}
