import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'

// RX-4 boundary surface. The old Talk screen is a separate V1 exercise with
// Bob, five fixed phrases and lexical-overlap scoring. Until speaking has a real
// V2 route through Planner → Engine → Assessment, the V2 product must not expose
// that legacy exercise or pretend it contributes learner evidence.
export default function V2TalkUnavailable() {
  const { setTab, SCREENS } = useApp()

  return (
    <div className="phone v2lx" data-testid="v2-talk-unavailable" data-experience="v2" data-surface="talk-unavailable">
      <header style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div className="v2lx-kicker">Prática de fala</div>
        <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--v2-font-display, inherit)', fontSize: 'clamp(30px, 9vw, 42px)', lineHeight: .95 }}>Falar em contexto</h1>
      </header>

      <main className="screen-body" style={{ paddingTop: 12, paddingBottom: 112, display: 'grid', alignContent: 'center' }}>
        <section className="v2lx-card" style={{ textAlign: 'center', padding: '28px 22px' }}>
          <div style={{ width: 68, height: 68, borderRadius: 22, background: 'var(--v2-surface-2, var(--bg-alt))', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
            <I.mic s={30} />
          </div>
          <h2 style={{ margin: 0 }}>A fala aparece dentro das práticas quando o aparelho consegue ouvir sua resposta.</h2>
          <p className="muted" style={{ lineHeight: 1.55, margin: '12px auto 20px', maxWidth: 330 }}>
            Esta área separada ainda não possui uma atividade V2 completa. Por isso não mostramos frases fixas, personagem ou uma nota que não alimentaria seu histórico real.
          </p>
          <button type="button" className="v2lx-cta" onClick={() => setTab(SCREENS.HOME)}>Voltar para praticar</button>
        </section>
      </main>
      <BottomNav active={null} onNavigate={setTab} />
    </div>
  )
}
