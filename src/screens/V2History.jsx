import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { loadPedagogyV2Registry } from '../lib/pedagogy-v2/registry.js'
import {
  getDurableStudySessionsV2,
  getDurableLearnerInteractionsV2,
} from '../lib/pedagogy-v2/durable-interaction-storage.js'
import { buildCombinedV2History } from '../lib/pedagogy-v2/durable-history-presentation.js'

const ACTIVITY_LABELS = Object.freeze({
  exposure: 'Leitura e observação',
  meaning_recognition: 'Reconhecimento de sentido',
  listening_recognition: 'Compreensão auditiva',
  context_recognition: 'Reconhecimento de contexto',
  fixed_element_completion: 'Completar frase',
  word_order_reconstruction: 'Montar frase',
  guided_production: 'Escrita guiada',
  free_production: 'Produção livre',
  pronunciation: 'Pronúncia',
})

function formatDate(ts) {
  if (!ts) return 'Data indisponível'
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function outcomeText(outcomes) {
  const assessed = (outcomes.correct || 0) + (outcomes.partial || 0) + (outcomes.incorrect || 0)
  const observed = outcomes.observed || 0
  const notAssessed = outcomes.not_assessed || 0
  const parts = []
  if (assessed) parts.push(`${assessed} ${assessed === 1 ? 'resposta avaliada' : 'respostas avaliadas'}`)
  if (observed) parts.push(`${observed} ${observed === 1 ? 'exposição' : 'exposições'}`)
  if (notAssessed) parts.push(`${notAssessed} ${notAssessed === 1 ? 'resposta preservada sem avaliação' : 'respostas preservadas sem avaliação'}`)
  return parts.join(' · ') || 'Atividade registrada'
}

function outcomeLabel(outcome, recoveryStatus) {
  if (recoveryStatus === 'interrupted_before_assessment') return 'resposta preservada · avaliação interrompida'
  if (outcome === 'partial') return 'resposta parcial'
  if (outcome === 'incorrect') return 'vale tentar de novo'
  if (outcome === 'correct') return 'resposta alinhada'
  return 'observada'
}

function sessionStatusText(status) {
  if (status === 'interrupted') return 'Sessão interrompida. O que já havia sido salvo permanece no histórico.'
  if (status === 'abandoned') return 'Sessão encerrada antes do fim.'
  if (status === 'active') return 'Sessão em andamento ou ainda não reconciliada.'
  return null
}

export default function V2History() {
  const { db, activeProfile, setTab, SCREENS } = useApp()
  const registry = useMemo(() => loadPedagogyV2Registry(), [])
  const [records, setRecords] = useState(null)
  const [error, setError] = useState(null)
  const [openSession, setOpenSession] = useState(null)

  useEffect(() => {
    let cancelled = false
    setRecords(null)
    setError(null)
    Promise.all([
      getDurableStudySessionsV2(activeProfile),
      getDurableLearnerInteractionsV2(activeProfile),
      db.getLearnerEvidenceV2(activeProfile),
    ]).then(([sessions, interactions, evidence]) => {
      if (!cancelled) setRecords({ sessions, interactions, evidence })
    }).catch((e) => { if (!cancelled) setError(String(e?.message || e)) })
    return () => { cancelled = true }
  }, [db, activeProfile])

  const sessions = useMemo(
    () => records == null ? [] : buildCombinedV2History(records, registry),
    [records, registry],
  )

  return (
    <div className="phone v2lx" data-testid="v2-history" data-experience="v2" data-surface="history">
      <header style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div className="v2lx-kicker">Sua prática</div>
        <h1 style={{ margin: '4px 0 0', fontFamily: 'var(--v2-font-display, inherit)', fontSize: 'clamp(30px, 9vw, 42px)', lineHeight: .95 }}>Histórico</h1>
      </header>

      <main className="screen-body" style={{ paddingTop: 12, paddingBottom: 112, gap: 12 }}>
        {records == null && !error && (
          <div className="v2lx-card" data-testid="v2-history-loading">Carregando suas práticas…</div>
        )}

        {error && (
          <div className="v2lx-card" role="alert" data-testid="v2-history-error">
            <strong>Não foi possível abrir o histórico.</strong>
            <p className="muted" style={{ marginBottom: 0 }}>Seus dados não foram apagados. O armazenamento local respondeu com uma falha.</p>
          </div>
        )}

        {records != null && !error && sessions.length === 0 && (
          <section style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '40px 20px' }} data-testid="v2-history-empty">
            <div>
              <div style={{ width: 72, height: 72, borderRadius: 24, background: 'var(--v2-surface-2, var(--bg-alt))', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
                <I.history s={30} />
              </div>
              <h2 style={{ margin: 0 }}>Sua primeira prática aparecerá aqui.</h2>
              <p className="muted" style={{ lineHeight: 1.5, maxWidth: 300 }}>Depois de responder uma atividade V2, o registro permanece neste aparelho.</p>
              <button className="v2lx-cta" type="button" onClick={() => setTab(SCREENS.HOME)}>Praticar agora</button>
            </div>
          </section>
        )}

        {sessions.map((session) => {
          const expanded = openSession === session.session_id
          const title = session.collection_title_pt || 'Prática geral'
          const statusText = sessionStatusText(session.status)
          return (
            <section key={session.session_id} className="v2lx-card" data-testid="v2-history-session" data-source={session.source} data-status={session.status || undefined} style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpenSession(expanded ? null : session.session_id)}
                aria-expanded={expanded}
                style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', padding: 18, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--v2-surface-2, var(--bg-alt))', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <I.history s={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{formatDate(session.last_activity_at || session.ended_at)}</div>
                    <div style={{ fontSize: 13, marginTop: 9 }}>{session.interaction_count} {session.interaction_count === 1 ? 'atividade' : 'atividades'} · {outcomeText(session.outcomes)}</div>
                    {statusText && <div className="muted" data-testid="v2-history-session-status" style={{ fontSize: 11, marginTop: 5 }}>{statusText}</div>}
                  </div>
                  <span aria-hidden="true" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 160ms ease' }}><I.chevR s={18} /></span>
                </div>
              </button>

              {expanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '4px 18px 18px' }}>
                  {session.limited && (
                    <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }} data-testid="v2-history-limited">
                      Este registro é anterior ao histórico completo. Ele preserva a atividade e o resultado, mas não contém sua resposta nem o diagnóstico exibido naquele momento.
                    </p>
                  )}
                  <div style={{ display: 'grid', gap: 10 }}>
                    {session.interactions.map((interaction) => (
                      <div key={interaction.interaction_id} style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }} data-testid="v2-history-interaction" data-recovery-status={interaction.recovery_status || undefined}>
                        <div style={{ fontWeight: 750, lineHeight: 1.35 }}>{interaction.exemplar.text_en || 'Frase registrada'}</div>
                        {interaction.exemplar.text_pt && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{interaction.exemplar.text_pt}</div>}
                        {interaction.response?.text && (
                          <div style={{ fontSize: 13, marginTop: 8 }} data-testid="v2-history-response"><strong>Sua resposta:</strong> {interaction.response.text}</div>
                        )}
                        {interaction.response?.kind === 'choice' && !interaction.response.text && (
                          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Alternativa escolhida registrada.</div>
                        )}
                        {interaction.recovery_status === 'interrupted_before_assessment' && (
                          <div className="muted" data-testid="v2-history-recovery-note" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
                            A resposta foi salva, mas a avaliação foi interrompida. Ela não alterou sua progressão e não foi adicionada aos pontos para revisar.
                          </div>
                        )}
                        {interaction.diagnosis?.summary && (
                          <div className="muted" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 6 }} data-testid="v2-history-diagnosis">{interaction.diagnosis.summary}</div>
                        )}
                        <div className="muted" style={{ fontSize: 11, marginTop: 7 }}>
                          {ACTIVITY_LABELS[interaction.activity_kind] || 'Atividade V2'} · {outcomeLabel(interaction.outcome, interaction.recovery_status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </main>
      <BottomNav active="history" onNavigate={setTab} />
    </div>
  )
}
