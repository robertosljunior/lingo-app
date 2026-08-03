import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import { buildV2ReviewPointsFromEvidence } from '../lib/pedagogy-v2/learner-activity-history.js'

function formatDate(ts) {
  if (!ts) return 'Data indisponível'
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function V2ReviewPoints() {
  const { db, activeProfile, navigate, setTab, SCREENS } = useApp()
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setEvents(null)
    setError(null)
    db.getLearnerEvidenceV2(activeProfile)
      .then((rows) => { if (!cancelled) setEvents(rows || []) })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)) })
    return () => { cancelled = true }
  }, [db, activeProfile])

  const points = useMemo(
    () => events == null ? [] : buildV2ReviewPointsFromEvidence(events, registry),
    [events, registry],
  )

  const startReview = () => navigate(SCREENS.PEDAGOGY_V2_LEARNER, { mode: 'review' })

  return (
    <div className="phone v2lx" data-testid="v2-review-points" data-experience="v2" data-surface="review-points">
      <header style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div className="v2lx-kicker">Para retomar</div>
        <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--v2-font-display, inherit)', fontSize: 'clamp(28px, 8vw, 40px)', lineHeight: .98 }}>Pontos para revisar</h1>
        <p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.45 }}>Aqui aparecem respostas V2 parciais ou não alinhadas. Uma atividade assistida ou apenas observada não vira “erro”.</p>
      </header>

      <main className="screen-body" style={{ paddingTop: 12, paddingBottom: 112, gap: 12 }}>
        {events == null && !error && (
          <div className="v2lx-card" data-testid="v2-review-loading">Carregando seus pontos de revisão…</div>
        )}

        {error && (
          <div className="v2lx-card" role="alert" data-testid="v2-review-error">
            <strong>Não foi possível abrir a revisão.</strong>
            <p className="muted" style={{ marginBottom: 0 }}>Seus registros continuam no aparelho; a leitura do armazenamento falhou.</p>
          </div>
        )}

        {events != null && !error && points.length === 0 && (
          <section style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '36px 20px' }} data-testid="v2-review-empty">
            <div>
              <div style={{ width: 72, height: 72, borderRadius: 24, background: 'var(--success-bg)', color: 'var(--success)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
                <I.check s={30} />
              </div>
              <h2 style={{ margin: 0 }}>Nada marcado para revisar agora.</h2>
              <p className="muted" style={{ lineHeight: 1.5, maxWidth: 310 }}>Isso não significa domínio completo. Apenas não há resposta direta parcial ou incorreta registrada neste perfil.</p>
              <button className="v2lx-cta" type="button" onClick={() => setTab(SCREENS.HOME)}>Praticar agora</button>
            </div>
          </section>
        )}

        {points.length > 0 && (
          <button className="v2lx-cta" type="button" onClick={startReview} data-testid="v2-start-review">
            Iniciar revisão
          </button>
        )}

        {points.map((point) => (
          <article key={point.exemplar.exemplar_id || point.latest_at} className="v2lx-card" data-testid="v2-review-point">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, marginTop: 6, flexShrink: 0, background: point.latest_outcome === 'incorrect' ? 'var(--error)' : 'var(--warning, #9a6700)' }} />
              <div style={{ minWidth: 0 }}>
                <div className="v2lx-kicker">{point.latest_outcome === 'partial' ? 'Resposta parcial' : 'Vale tentar de novo'}</div>
                <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.35, marginTop: 5 }}>{point.exemplar.text_en || 'Frase registrada'}</div>
                {point.exemplar.text_pt && <div className="muted" style={{ fontSize: 13, lineHeight: 1.45, marginTop: 5 }}>{point.exemplar.text_pt}</div>}
                <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                  Último registro: {formatDate(point.latest_at)}{point.occurrence_count > 1 ? ` · ${point.occurrence_count} ocorrências` : ''}
                </div>
                <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 0 }}>
                  O registro antigo não contém o texto que você digitou nem um diagnóstico completo. Por isso esta tela não inventa uma correção gramatical ou lexical.
                </p>
              </div>
            </div>
          </article>
        ))}
      </main>
      <BottomNav active="mistakes" onNavigate={setTab} />
    </div>
  )
}
