import { useEffect, useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { getErrorLog, clearErrorLog, formatErrorLog } from '../lib/error-log.js'
import { ACCENTS, listVoices, onVoicesChanged, speak, speechSupported } from '../lib/audio/tts.js'
import { PIPER_VOICES, piperSupported, storedVoices, downloadVoice, removeVoice } from '../lib/audio/tts-piper.js'
import { PORTUGUESE_VOICES, speakSegment } from '../lib/speech-router.js'

export default function Settings() {
  const { settings, updateSetting, setTab, showToast, db, refreshLibrary } = useApp()
  const [log, setLog] = useState(() => getErrorLog())
  const [contentPacks, setContentPacks] = useState([])
  useEffect(() => { db.seedBuiltinContentPacks?.().then(() => db.listContentPacks?.()).then((rows) => setContentPacks(rows || [])).catch(() => {}) }, [db])
  async function refreshPacks(){ setContentPacks(await db.listContentPacks()) }
  if (!settings) return null

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
            <ProfilesRow />
          </Row>
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
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Biblioteca NLP</div>
            <Segmented value={settings.nlp_library} onChange={(k) => updateSetting('nlp_library', k)}
              options={[{ k: 'compromise', l: 'Compromise' }, { k: 'wink', l: 'wink-nlp' }]} />
            <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>
              Análise local no Web Worker. wink-nlp tem análise gramatical (POS) mais precisa para
              classificar erros de tempo verbal e estrutura; carrega na primeira correção.
            </div>
          </Row>
        </div>


        <div className="card" style={{ padding: 0, overflow: 'hidden' }} data-testid="content-packs-settings">
          <SectionHead>pacotes de conteúdo</SectionHead>
          <Row last>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>28 pacotes builtin versionados, agrupados por tema e nível.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {contentPacks.map((p) => (
                <div key={p.pack_id} data-testid={`content-pack-${p.pack_id}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div><div style={{ fontWeight: 800, fontSize: 13 }}>{p.title?.pt || p.pack_id}</div><div className="muted" style={{ fontSize: 11 }}>{p.pack_id} · v{p.version} · {p.source} · {p.level} · {p.validation_status}</div></div>
                    <button className="btn btn-sm btn-secondary" data-testid={`toggle-pack-${p.pack_id}`} onClick={async()=>{ p.enabled ? await db.disableContentPack(p.pack_id) : await db.enableContentPack(p.pack_id); await refreshPacks() }}>{p.enabled ? 'Desabilitar' : 'Habilitar'}</button>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>lexical {p.counts?.lexical_items || 0} · templates {p.counts?.template_definitions || 0} · collocations {p.counts?.collocations || 0} · deps {(p.dependencies||[]).join(',') || '—'}</div>
                  {p.source === 'builtin' && <button className="btn btn-sm btn-ghost" onClick={async()=>{ await db.restoreBuiltinContentPack(p.pack_id); await refreshPacks(); showToast('Pacote restaurado') }}>Restaurar builtin</button>}
                </div>
              ))}
            </div>
          </Row>
        </div>

        <AudioSection Row={Row} SectionHead={SectionHead} Segmented={Segmented} settings={settings} updateSetting={updateSetting} />

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
      <BottomNav active="settings" onNavigate={setTab} />
    </div>
  )
}

// Family profiles: each member keeps their own history, mistakes and reviews.
function ProfilesRow() {
  const { profiles, activeProfile, switchProfile, addProfile, removeProfile, showToast } = useApp()
  const handleAdd = async () => {
    const name = prompt('Nome do novo perfil (ex.: Ana):')?.trim()
    if (!name) return
    await addProfile(name)
    showToast(`Perfil "${name}" criado`)
  }
  const handleRemove = async (p) => {
    if (!confirm(`Remover o perfil "${p.name}"? O histórico dele fica guardado, mas some da lista.`)) return
    await removeProfile(p.profile_id)
    showToast('Perfil removido')
  }
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Quem está estudando</div>
      <div className="muted" style={{ fontSize: 12, margin: '2px 0 10px' }}>
        Cada perfil tem seu próprio histórico, erros e revisões
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {profiles.map((p) => {
          const active = p.profile_id === activeProfile
          return (
            <span key={p.profile_id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button className="btn btn-sm btn-secondary"
                onClick={() => switchProfile(p.profile_id)}
                style={{
                  minHeight: 38, padding: '6px 12px',
                  ...(active ? { borderColor: 'var(--indigo-600)', color: 'var(--indigo-700)', background: 'var(--indigo-50)', fontWeight: 800 } : {}),
                }}>
                <I.user s={14} /> {p.name}
              </button>
              {active && profiles.length > 1 && (
                <button className="btn btn-sm btn-ghost" aria-label={`Remover perfil ${p.name}`}
                  onClick={() => handleRemove(p)}
                  style={{ padding: '4px 6px', minHeight: 0, color: 'var(--error)' }}>
                  <I.x s={12} />
                </button>
              )}
            </span>
          )
        })}
        <button className="btn btn-sm btn-secondary" onClick={handleAdd} style={{ minHeight: 38, padding: '6px 12px' }}>
          <I.plus s={14} /> Novo
        </button>
      </div>
    </>
  )
}

const TEST_SENTENCE = 'Hello! This is how your lessons will sound.'

// Audio preferences: accent, specific voice, speed, autoplay — everything the
// TTS layer reads. Voices come from the device's TTS engine, so the list can
// change (voiceschanged) and differs per phone.
function AudioSection({ Row, SectionHead, Segmented, settings, updateSetting }) {
  const [voices, setVoices] = useState(() => listVoices())
  useEffect(() => onVoicesChanged(setVoices), [])

  if (!speechSupported) {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <SectionHead>Voz e áudio</SectionHead>
        <Row last>
          <div className="muted" style={{ fontSize: 13 }}>Este navegador não tem síntese de voz. No Android, use o Chrome.</div>
        </Row>
      </div>
    )
  }

  const accentVoices = voices.filter((v) => (v.lang || '').toLowerCase().replace('_', '-') === settings.tts_accent.toLowerCase())
  const accentHasVoice = (code) => voices.some((v) => (v.lang || '').toLowerCase().replace('_', '-') === code.toLowerCase())

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHead>Voz e áudio</SectionHead>

      <Row>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Sotaque do inglês</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ACCENTS.map((a) => {
            const active = settings.tts_accent === a.code
            const available = accentHasVoice(a.code)
            return (
              <button key={a.code} className="btn btn-sm btn-secondary"
                onClick={() => { updateSetting('tts_accent', a.code); updateSetting('tts_voice', '') }}
                style={{
                  minHeight: 38, padding: '6px 12px', opacity: available ? 1 : 0.5,
                  ...(active ? { borderColor: 'var(--indigo-600)', color: 'var(--indigo-700)', background: 'var(--indigo-50)' } : {}),
                }}>
                {a.flag} {a.label}
              </button>
            )
          })}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>
          Sotaques esmaecidos não têm voz instalada neste aparelho. No Android, baixe mais vozes em
          Configurações → Sistema → Conversão de texto em voz.
        </div>
      </Row>

      <Row>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Voz dos exercícios em inglês</div>
        <select className="input" style={{ fontSize: 14, padding: '10px 12px' }}
          value={settings.tts_voice || ''}
          onChange={(e) => updateSetting('tts_voice', e.target.value)}
          aria-label="Voz do inglês">
          <option value="">Automática (melhor voz do sotaque)</option>
          {accentVoices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}{v.localService ? ' · offline' : ''}
            </option>
          ))}
        </select>
      </Row>

      <Row>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Velocidade do inglês</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--indigo-700)', fontVariantNumeric: 'tabular-nums' }}>{Number(settings.tts_rate).toFixed(2)}×</div>
        </div>
        <input type="range" min="0.5" max="1.2" step="0.05" value={settings.tts_rate}
          onChange={(e) => { updateSetting('tts_rate', +e.target.value); updateSetting('english_voice_rate', +e.target.value) }} aria-label="Velocidade do inglês" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
          <span>0.5× devagar</span><span>1.2× rápido</span>
        </div>
      </Row>

      <Row>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Ler a resposta correta depois da explicação</div>
        <Segmented value={settings.auto_read_correct_answer !== false ? 'on' : 'off'}
          onChange={(k) => { updateSetting('auto_read_correct_answer', k === 'on'); updateSetting('tts_autoplay', k === 'on') }}
          options={[{ k: 'on', l: 'Sim' }, { k: 'off', l: 'Não' }]} />
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Quando a leitura automática estiver ativa, a forma correta em inglês é falada após a explicação.</div>
      </Row>

      <Row>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Ler explicações automaticamente</div>
        <Segmented value={settings.auto_read_explanations ? 'on' : 'off'}
          onChange={(k) => updateSetting('auto_read_explanations', k === 'on')}
          options={[{ k: 'on', l: 'Sim' }, { k: 'off', l: 'Não' }]} />
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Usa uma voz offline em português quando estiver disponível.</div>
      </Row>

      <Row>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Velocidade das explicações</div>
        <input type="range" min="0.5" max="1.2" step="0.05" value={settings.portuguese_voice_rate || 1}
          onChange={(e) => updateSetting('portuguese_voice_rate', +e.target.value)} aria-label="Velocidade das explicações" />
      </Row>

      {piperSupported && (
        <Row>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Motor de voz</div>
          <Segmented value={settings.tts_engine} onChange={(k) => updateSetting('tts_engine', k)}
            options={[{ k: 'system', l: 'Sistema' }, { k: 'piper', l: 'Neural offline' }]} />
          <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>
            Neural offline usa vozes Piper de alta qualidade rodando no aparelho (baixe uma voz abaixo).
            Se a voz escolhida não estiver baixada, o app volta sozinho para a voz do sistema.
          </div>
        </Row>
      )}

      {piperSupported && settings.tts_engine === 'piper' && (
        <PiperVoicesRow settings={settings} updateSetting={updateSetting} />
      )}

      <Row last>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => speakSegment({ text: TEST_SENTENCE, language: 'en', role: 'ui_preview', settings })}>
          <I.speaker s={18} /> Testar voz
        </button>
      </Row>
    </div>
  )
}

// Download manager for the Piper neural voices (~60 MB each, stored on the
// device; first download needs internet, everything after is offline).
function PiperVoicesRow({ settings, updateSetting }) {
  const { showToast } = useApp()
  const [stored, setStored] = useState([])
  const [progress, setProgress] = useState({}) // voiceId -> % while downloading

  const refresh = () => { storedVoices().then(setStored) }
  useEffect(refresh, [])

  const handleDownload = async (v) => {
    setProgress((p) => ({ ...p, [v.id]: 0 }))
    try {
      await downloadVoice(v.id, (pct) => setProgress((p) => ({ ...p, [v.id]: pct })))
      showToast(`${v.label} pronta para uso offline`)
      updateSetting('piper_voice', v.id); if (v.accent?.startsWith('en')) updateSetting('english_voice_id', v.id); if (v.accent?.startsWith('pt')) updateSetting('portuguese_explanation_voice_id', v.id)
    } catch {
      showToast('Falha no download — verifique a internet')
    } finally {
      setProgress((p) => { const n = { ...p }; delete n[v.id]; return n })
      refresh()
    }
  }

  const handleRemove = async (v) => {
    if (!confirm(`Apagar a voz ${v.label} (~${v.sizeMB} MB)?`)) return
    await removeVoice(v.id)
    refresh()
  }

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Vozes neurais (Piper)</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        ~60 MB por voz · baixa uma vez, fala offline para sempre
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PIPER_VOICES.map((v) => {
          const isStored = stored.includes(v.id)
          const isActive = (v.accent?.startsWith('pt') ? settings.portuguese_explanation_voice_id : (settings.english_voice_id || settings.piper_voice)) === v.id
          const pct = progress[v.id]
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-alt)', borderRadius: 12, padding: '10px 12px' }}>
              <button onClick={() => { if (!isStored) return; updateSetting('piper_voice', v.id); if (v.accent?.startsWith('en')) updateSetting('english_voice_id', v.id); if (v.accent?.startsWith('pt')) updateSetting('portuguese_explanation_voice_id', v.id) }}
                aria-label={`Usar voz ${v.label}`} disabled={!isStored}
                style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: isStored ? 'pointer' : 'default',
                  border: `2px solid ${isActive ? 'var(--indigo-600)' : 'var(--border-strong)'}`,
                  background: isActive ? 'var(--indigo-600)' : 'transparent',
                  opacity: isStored ? 1 : 0.4,
                }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{v.flag} {v.label}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {pct != null ? `Baixando… ${pct}%` : isStored ? 'No aparelho · offline' : `${v.sizeMB} MB`}
                </div>
                {pct != null && (
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--indigo-600)' }} />
                  </div>
                )}
              </div>
              {pct == null && (isStored ? (
                <button className="btn btn-sm btn-ghost" style={{ padding: '4px 8px', color: 'var(--error)' }} onClick={() => handleRemove(v)}>
                  Apagar
                </button>
              ) : (
                <button className="btn btn-sm btn-secondary" style={{ padding: '4px 10px' }} onClick={() => handleDownload(v)}>
                  <I.download s={14} /> Baixar
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
