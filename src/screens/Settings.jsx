import { useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { useAI } from '../ai/useAI.js'
import { MODELS, formatSize } from '../ai/models.js'
import { CAPABILITY_MANIFEST } from '../ai/capabilities.js'
import { getErrorLog, clearErrorLog, formatErrorLog } from '../lib/error-log.js'

export default function Settings() {
  const { settings, updateSetting, setTab, showToast, db, refreshLibrary, SCREENS } = useApp()
  const ai = useAI()
  const [log, setLog] = useState(() => getErrorLog())
  if (!settings) return null

  const selectModel = (id) => {
    updateSetting('ai_model', id)
    ai.setPreferredModel(id)
  }
  const activate = async () => {
    const ok = await ai.loadModel(settings.ai_model)
    if (ok) { updateSetting('ai_enabled', true); showToast('Tutor IA pronto') }
  }

  const Row = ({ children, last }) => (
    <div style={{ padding: '14px 16px', borderBottom: last ? 'none' : '1px solid var(--border)' }}>{children}</div>
  )

  const SectionHead = ({ children }) => (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div className="label-eyebrow">{children}</div>
    </div>
  )

  const Segmented = ({ value, options, onChange }) => (
    <div style={{ display: 'flex', gap: 6, background: 'var(--bg-alt)', padding: 4, borderRadius: 12 }}>
      {options.map((o) => {
        const active = value === o.k
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{
            flex: 1, padding: 8, borderRadius: 8, textAlign: 'center', border: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: active ? 700 : 600, fontSize: 13,
            background: active ? 'var(--surface)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-3)',
            boxShadow: active ? 'var(--shadow-sm)' : 'none',
          }}>{o.l}</button>
        )
      })}
    </div>
  )

  return (
    <div className="phone">
      <div style={{ padding: '8px 20px 4px', flexShrink: 0 }}><h1 className="h1">Configurações</h1></div>
      <div className="screen-body" style={{ paddingTop: 12, paddingBottom: 100, gap: 12 }}>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHead>perfil</SectionHead>
          <Row>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Nível atual</div>
            <div className="muted" style={{ fontSize: 12, margin: '2px 0 10px' }}>Usado nos prompts de exportação</div>
            <Segmented value={settings.level} onChange={(k) => updateSetting('level', k)}
              options={[{ k: 'A2', l: 'A2' }, { k: 'B1', l: 'B1' }, { k: 'B2', l: 'B2' }]} />
          </Row>
          <Row last>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Foco preferido</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Inglês profissional · conversação real</div>
          </Row>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHead>aulas</SectionHead>
          <Row>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Perguntas por aula</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--indigo-700)', fontVariantNumeric: 'tabular-nums' }}>{settings.question_count}</div>
            </div>
            <input type="range" min="20" max="50" step="5" value={settings.question_count}
              onChange={(e) => updateSetting('question_count', +e.target.value)} aria-label="Perguntas por aula" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              <span>20</span><span>50</span>
            </div>
          </Row>
          <Row>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Modo de correção</div>
            <Segmented value={settings.correction_mode} onChange={(k) => updateSetting('correction_mode', k)}
              options={[{ k: 'flexible', l: 'Flexível' }, { k: 'strict', l: 'Estrito' }]} />
            <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>
              Flexível aceita variações naturais (accepted_answers). Estrito exige o padrão da aula.
            </div>
          </Row>
          <Row last>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Biblioteca NLP</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>análise local no Web Worker</div>
              </div>
              <span className="chip" style={{ fontFamily: 'var(--font-mono)' }}>compromise.js</span>
            </div>
          </Row>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="label-eyebrow">inteligência artificial</div>
            <span className="chip chip-indigo" style={{ fontSize: 10, padding: '2px 7px' }}>beta</span>
          </div>

          <Row>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Tutor no dispositivo</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {ai.supported === false ? 'WebGPU indisponível neste navegador'
                    : ai.status === 'ready' ? 'Ativo · pronto para conversar'
                    : ai.status === 'loading' ? `Baixando… ${Math.round((ai.progress?.ratio || 0) * 100)}%`
                    : 'Roda um modelo localmente, offline após o download'}
                </div>
              </div>
              <StatusDot ai={ai} />
            </div>
            {ai.status === 'loading' && (
              <div className="progress" style={{ marginTop: 10 }}><div className="fill" style={{ width: `${Math.round((ai.progress?.ratio || 0) * 100)}%` }} /></div>
            )}
            {ai.status === 'error' && (
              <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 8, lineHeight: 1.4 }}>{ai.error}</div>
            )}
            {ai.supported !== false && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {ai.status === 'ready' ? (
                  <>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setTab(SCREENS.CHAT)}>Abrir tutor</button>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={async () => { await ai.unloadModel(); updateSetting('ai_enabled', false); showToast('Modelo descarregado') }}>Descarregar</button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-sm btn-block" disabled={ai.status === 'loading'} onClick={activate}>
                    <I.spark s={16} /> {ai.status === 'loading' ? 'Baixando…' : 'Baixar e ativar'}
                  </button>
                )}
              </div>
            )}
          </Row>

          <Row>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Modelo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MODELS.map((m) => {
                const active = settings.ai_model === m.id
                return (
                  <button key={m.id} onClick={() => selectModel(m.id)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', cursor: 'pointer',
                    padding: 12, borderRadius: 12, fontFamily: 'inherit', color: 'var(--ink)',
                    border: `1.5px solid ${active ? 'var(--indigo-600)' : 'var(--border)'}`,
                    background: active ? 'var(--indigo-50)' : 'var(--surface)',
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: `2px solid ${active ? 'var(--indigo-600)' : 'var(--border-strong)'}`, background: active ? 'var(--indigo-600)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{active && <I.check s={11} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</span>
                        <span className="chip" style={{ fontSize: 10, padding: '1px 7px' }}>{formatSize(m.sizeMB)}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{m.note}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            {ai.status === 'ready' && (
              <button className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 10 }} onClick={activate}>
                Aplicar modelo selecionado
              </button>
            )}
          </Row>

          <Row last>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Recursos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CAPABILITY_MANIFEST.map((c) => (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span className="muted-2">{c.label}</span>
                  <span className={`chip ${c.status === 'available' ? 'chip-success' : ''}`} style={{ fontSize: 11 }}>
                    {c.status === 'available' ? 'disponível' : 'em breve'}
                  </span>
                </div>
              ))}
            </div>
          </Row>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHead>aparência</SectionHead>
          <Row last>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Tema</div>
            <Segmented value={settings.theme} onChange={(k) => updateSetting('theme', k)}
              options={[{ k: 'system', l: 'Sistema' }, { k: 'light', l: 'Claro' }, { k: 'dark', l: 'Escuro' }]} />
          </Row>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHead>diagnóstico</SectionHead>
          <Row last>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, flexShrink: 0 }}>Log de eventos</div>
              {log.length > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm btn-ghost" style={{ padding: '6px 10px' }}
                    onClick={() => { navigator.clipboard?.writeText(formatErrorLog()); showToast('Log copiado') }}>
                    <I.copy s={14} /> Copiar
                  </button>
                  <button className="btn btn-sm btn-ghost" style={{ padding: '6px 10px', color: 'var(--error)' }}
                    onClick={() => { clearErrorLog(); setLog([]); showToast('Log limpo') }}>
                    Limpar
                  </button>
                </div>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {log.length === 0
                ? 'Nenhum evento registrado. Erros e marcos do app (ex.: download de modelo) aparecem aqui.'
                : `${log.length} ${log.length === 1 ? 'evento' : 'eventos'} — erros e marcos do app`}
            </div>
            {log.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', marginTop: 10 }}>
                {log.slice(0, 20).map((e, i) => (
                  <div key={i} style={{ background: 'var(--bg-alt)', borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`chip ${e.level === 'error' ? 'chip-error' : ''}`}
                        style={{ fontSize: 10, padding: '1px 7px', fontFamily: 'var(--font-mono)' }}>
                        {e.source}
                      </span>
                      <span className="muted" style={{ fontSize: 11, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {new Date(e.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12, lineHeight: 1.45, marginTop: 6, wordBreak: 'break-word',
                      color: e.level === 'error' ? 'var(--error-ink)' : 'var(--ink-2)',
                    }}>{e.message}</div>
                  </div>
                ))}
              </div>
            )}
          </Row>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHead>dados</SectionHead>
          <Row last>
            <button className="btn btn-ghost" style={{ color: 'var(--error)', padding: 0, minHeight: 'auto', fontWeight: 700, fontSize: 14 }}
              onClick={async () => {
                if (confirm('Apagar todas as aulas, respostas e histórico? Isso não pode ser desfeito.')) {
                  await db.wipeAll(); await refreshLibrary(); showToast('Dados apagados')
                }
              }}>
              Apagar todos os dados
            </button>
          </Row>
        </div>

        <p className="muted" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
          App Idiomas · funciona 100% offline · seus dados ficam só neste dispositivo
        </p>
      </div>
      <BottomNav active="settings" onNavigate={setTab} onTutor={() => setTab(SCREENS.CHAT)} />
    </div>
  )
}

function StatusDot({ ai }) {
  const color = ai.supported === false ? 'var(--ink-4)'
    : ai.status === 'ready' ? 'var(--success)'
    : ai.status === 'loading' ? 'var(--warn)'
    : ai.status === 'error' ? 'var(--error)'
    : 'var(--ink-4)'
  return <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent)` }} />
}
