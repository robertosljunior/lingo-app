import { useEffect, useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import { getErrorLog, clearErrorLog, formatErrorLog } from '../lib/error-log.js'
import { ACCENTS, listVoices, onVoicesChanged, speak, speechSupported } from '../lib/audio/tts.js'

export default function Settings() {
  const { settings, updateSetting, setTab, showToast, db, refreshLibrary } = useApp()
  const [log, setLog] = useState(() => getErrorLog())
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Biblioteca NLP</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>análise local no Web Worker</div>
              </div>
              <span className="chip" style={{ fontFamily: 'var(--font-mono)' }}>compromise.js</span>
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
        <SectionHead>áudio</SectionHead>
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
      <SectionHead>áudio</SectionHead>

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
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Voz</div>
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
          <div style={{ fontWeight: 700, fontSize: 15 }}>Velocidade da fala</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--indigo-700)', fontVariantNumeric: 'tabular-nums' }}>{Number(settings.tts_rate).toFixed(2)}×</div>
        </div>
        <input type="range" min="0.5" max="1.2" step="0.05" value={settings.tts_rate}
          onChange={(e) => updateSetting('tts_rate', +e.target.value)} aria-label="Velocidade da fala" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
          <span>0.5× devagar</span><span>1.2× rápido</span>
        </div>
      </Row>

      <Row>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Falar resposta ao corrigir</div>
        <Segmented value={settings.tts_autoplay ? 'on' : 'off'}
          onChange={(k) => updateSetting('tts_autoplay', k === 'on')}
          options={[{ k: 'on', l: 'Sim' }, { k: 'off', l: 'Não' }]} />
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Ao abrir o resultado, a frase correta é falada em voz alta.</div>
      </Row>

      <Row last>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => speak(TEST_SENTENCE)}>
          <I.speaker s={18} /> Testar voz
        </button>
      </Row>
    </div>
  )
}
