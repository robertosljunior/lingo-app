import { useEffect, useState } from 'react'
import { useApp } from '../store.jsx'
import { BottomNav } from '../components/ui.jsx'
import { I } from '../components/icons.jsx'
import BobMascot from '../components/BobMascot.jsx'
import { getErrorLog, clearErrorLog, formatErrorLog } from '../lib/error-log.js'
import { ACCENTS, listVoices, onVoicesChanged, speak, speechSupported } from '../lib/audio/tts.js'
import { PIPER_VOICES, piperSupported, storedVoices, downloadVoice, removeVoice } from '../lib/audio/tts-piper.js'
import { PORTUGUESE_VOICES, speakSegment } from '../lib/speech-router.js'
import { getInstallEligibility, requestInstall } from '../lib/pwa-install-controller.js'
import { getKnowledgeOverview, removeInstalledPack, fetchCatalog, installFromCatalogEntry, deriveCatalogState, DEFAULT_CATALOG_URL } from '../lib/language-analysis/knowledge-catalog-service.js'
import { getDefaultModelEntry, getInstalledModel, installModel, removeModel } from '../lib/language-analysis/semantic-model-catalog-service.js'

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

        <SemanticModelSection Row={Row} SectionHead={SectionHead} showToast={showToast} />

        <KnowledgeSection Row={Row} SectionHead={SectionHead} showToast={showToast} />

        <AudioSection Row={Row} SectionHead={SectionHead} Segmented={Segmented} settings={settings} updateSetting={updateSetting} />

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <SectionHead>aplicativo</SectionHead>
          <Row last>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Instalar aplicativo</div>
            <div className="muted" style={{ fontSize: 12, margin: '2px 0 10px' }}>Instale para usar lições e vozes offline.</div>
            <button className="btn btn-secondary" onClick={async()=>{ const e=getInstallEligibility({allowManualFallback:true}); if(e.mode==='prompt') await requestInstall(); else showToast('Para instalar, abra o menu do navegador e escolha “Adicionar à Tela de Início”.') }}>Instalar aplicativo</button>
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

        <div className="card" style={{ padding: 0, overflow: 'hidden' }} data-testid="experimental-settings">
          <SectionHead>experimental</SectionHead>
          <Row last>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Laboratório V2 — still</div>
              <button className={`btn btn-sm ${settings.pedagogy_v2_pilot_enabled ? 'btn-primary' : 'btn-secondary'}`}
                data-testid="toggle-pedagogy-v2-pilot" aria-pressed={!!settings.pedagogy_v2_pilot_enabled}
                onClick={() => updateSetting('pedagogy_v2_pilot_enabled', !settings.pedagogy_v2_pilot_enabled)}>
                {settings.pedagogy_v2_pilot_enabled ? 'Ativado' : 'Desativado'}
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
              O laboratório usa um modelo pedagógico em desenvolvimento: você aprende novos usos da mesma
              palavra por meio de frases completas. Experimental — pode mudar ou ser removido.
            </div>
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
const STATUS_LABEL = {
  installed: 'Instalado',
  available: 'Disponível',
  update_available: 'Atualização disponível',
  downloading: 'Baixando…',
  validating: 'Validando…',
  failed: 'Falha',
  incompatible: 'Incompatível',
}

// "Conhecimento linguístico" — the semantic knowledge packs powering the local
// tutor engine. Builtin packs ship with the app (offline). Additional packs can
// be installed from the allowlisted, checksum-verified catalog.
const CATALOG_STATE_LABEL = {
  available: 'Disponível',
  installed: 'Instalado',
  update_available: 'Atualização disponível',
  incompatible: 'Incompatível',
  downloading: 'Baixando…',
  validating: 'Verificando…',
  installing: 'Instalando…',
  failed: 'Falha',
}
function formatBytes(n) {
  if (!n && n !== 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
const CATALOG_URL = () => {
  try { return (typeof window !== 'undefined' && window.__LINGO_E2E__ && window.__LINGO_E2E__.knowledgeCatalogUrl) || DEFAULT_CATALOG_URL }
  catch { return DEFAULT_CATALOG_URL }
}

// "Análise semântica" — the optional, opt-in offline model that lets the app
// understand intent, meaning and natural alternatives. The app works fully
// without it (grammar + rules + packs); when absent the tutor runs in "modo
// básico". No technical terms (USE / TensorFlow / embedding) in the main UI.
const MODEL_STATE_LABEL = {
  not_installed: 'Não instalado',
  downloading: 'Baixando…',
  verifying: 'Verificando…',
  installing: 'Instalando…',
  ready: 'Pronto para uso offline',
  failed: 'Falha',
}
function SemanticModelSection({ Row, SectionHead, showToast }) {
  const entry = getDefaultModelEntry()
  const [installed, setInstalled] = useState(null)   // metadata row or null
  const [phase, setPhase] = useState('idle')          // idle|downloading|verifying|installing
  const [progress, setProgress] = useState(0)         // 0..1
  const [failed, setFailed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [ctrl, setCtrl] = useState(null)

  async function refresh() { try { setInstalled(await getInstalledModel()) } catch { setInstalled(null) } }
  useEffect(() => { refresh() }, [])

  async function onDownload() {
    setFailed(null); setBusy(true); setProgress(0); setPhase('downloading')
    const controller = new AbortController(); setCtrl(controller)
    const res = await installModel(entry, {
      signal: controller.signal,
      onProgress: (p) => {
        setPhase(p.phase)
        if (p.totalBytes) setProgress(Math.min(1, (p.bytes || 0) / p.totalBytes))
      },
    })
    setBusy(false); setCtrl(null); setPhase('idle')
    if (res.ok) { setProgress(1); showToast('Análise semântica pronta — disponível offline.'); await refresh() }
    else if (res.code === 'CANCELLED') { showToast('Download cancelado.') }
    else { setFailed(res.code || 'FALHA'); showToast('Não foi possível instalar a análise semântica.') }
  }
  function onCancel() { if (ctrl) ctrl.abort() }
  async function onRemove() {
    setBusy(true)
    try { await removeModel(entry.model_id); showToast('Análise semântica removida. Modo básico ativo.'); await refresh() }
    catch { showToast('Não foi possível remover.') }
    finally { setBusy(false) }
  }

  const state = installed ? 'ready' : (phase !== 'idle' ? phase : (failed ? 'failed' : 'not_installed'))
  const pct = Math.round(progress * 100)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }} data-testid="semantic-model-settings">
      <SectionHead>análise semântica</SectionHead>
      <Row last>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{entry.title_pt}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{entry.description_pt}</div>
          </div>
          <span className="chip" data-testid="semantic-model-status" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{MODEL_STATE_LABEL[state] || state}</span>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Tamanho: {formatBytes(entry.size_bytes)} · download único, funciona offline depois.</div>

        {!installed && phase === 'idle' && (
          <div style={{ marginTop: 10 }}>
            <div className="muted" data-testid="semantic-model-mode" style={{ fontSize: 12, marginBottom: 8 }}>
              Modo básico ativo. A correção gramatical continua disponível; a análise avançada de significado ainda não está instalada.
            </div>
            <button className="btn btn-primary btn-sm" data-testid="semantic-model-download" disabled={busy} onClick={onDownload}>Baixar</button>
            {failed && <button className="btn btn-secondary btn-sm" data-testid="semantic-model-retry" style={{ marginLeft: 8 }} onClick={onDownload}>Tentar novamente</button>}
          </div>
        )}

        {phase !== 'idle' && (
          <div style={{ marginTop: 10 }} data-testid="semantic-model-progress">
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do download"
              style={{ height: 8, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary, #4F46E5)', transition: 'width .2s' }} />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{MODEL_STATE_LABEL[phase] || phase} {pct}%</div>
            <button className="btn btn-ghost btn-sm" data-testid="semantic-model-cancel" style={{ marginTop: 6 }} onClick={onCancel}>Cancelar</button>
          </div>
        )}

        {installed && (
          <div style={{ marginTop: 10 }}>
            <div className="muted" data-testid="semantic-model-ready" style={{ fontSize: 12, marginBottom: 8 }}>Pronto para uso offline. O app entende melhor intenção e significado.</div>
            <button className="btn btn-ghost btn-sm" data-testid="semantic-model-remove" disabled={busy} onClick={onRemove}>{busy ? 'Removendo…' : 'Remover'}</button>
          </div>
        )}
      </Row>
    </div>
  )
}

function KnowledgeSection({ Row, SectionHead, showToast }) {
  const [packs, setPacks] = useState([])
  const [busy, setBusy] = useState(null)
  const [catalog, setCatalog] = useState(null)          // derived catalog entries
  const [catalogError, setCatalogError] = useState(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [entryState, setEntryState] = useState({})       // pack_id -> transient UI state

  async function refresh() { try { setPacks(await getKnowledgeOverview()) } catch { setPacks([]) } }
  useEffect(() => { refresh() }, [])

  async function onRemove(pack_id) {
    setBusy(pack_id)
    try { await removeInstalledPack(pack_id); await refresh(); showToast('Pacote removido — histórico preservado.') }
    catch { showToast('Não foi possível remover o pacote.') }
    finally { setBusy(null) }
  }

  async function loadCatalog() {
    setLoadingCatalog(true); setCatalogError(null)
    try {
      const res = await fetchCatalog({ url: CATALOG_URL() })
      if (!res.ok) { setCatalogError(res.code); setCatalog([]); return }
      const overview = await getKnowledgeOverview()
      setCatalog(deriveCatalogState(res.catalog.packs, overview))
    } catch (e) {
      setCatalogError(String(e?.message || e)); setCatalog([])
    } finally { setLoadingCatalog(false) }
  }

  async function onDownload(entry) {
    setEntryState((s) => ({ ...s, [entry.pack_id]: 'downloading' }))
    const res = await installFromCatalogEntry(entry, { onProgress: (step) => setEntryState((s) => ({ ...s, [entry.pack_id]: step })) })
    if (res.ok) {
      setEntryState((s) => ({ ...s, [entry.pack_id]: 'installed' }))
      showToast('Pacote instalado e disponível offline.')
      await refresh(); await loadCatalog()
    } else {
      const label = res.code === 'CHECKSUM_MISMATCH' ? 'checksum' : res.code
      setEntryState((s) => ({ ...s, [entry.pack_id]: 'failed' }))
      showToast(`Falha ao instalar (${label}).`)
    }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }} data-testid="knowledge-packs-settings">
      <SectionHead>conhecimento linguístico</SectionHead>
      <Row>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Conhecimento que alimenta a análise de escrita e fala livre. Funciona offline após instalado.
        </div>
        <button className="btn btn-sm btn-secondary" data-testid="knowledge-load-catalog" disabled={loadingCatalog} onClick={loadCatalog}>
          {loadingCatalog ? 'Carregando catálogo…' : 'Verificar catálogo'}
        </button>
        {catalogError && <div className="muted" data-testid="knowledge-catalog-error" style={{ fontSize: 11, marginTop: 8, color: 'var(--error, #c00)' }}>Não foi possível carregar o catálogo ({catalogError}).</div>}
        {catalog && catalog.length > 0 && (
          <div data-testid="knowledge-catalog" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {catalog.map((e) => {
              const st = entryState[e.pack_id] || e.state
              const canDownload = (e.state === 'available' || e.state === 'update_available') && !['downloading', 'validating', 'installing', 'failed'].includes(st)
              return (
                <div key={e.pack_id} data-testid={`catalog-pack-${e.pack_id}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{e.title_pt || e.pack_id}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{e.pack_id} · v{e.version} · {(e.levels || []).join('/')} · {formatBytes(e.size_bytes)}</div>
                    </div>
                    <span className="chip" data-testid={`catalog-state-${e.pack_id}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{CATALOG_STATE_LABEL[st] || st}</span>
                  </div>
                  {e.coverage && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>cobertura: {Object.entries(e.coverage.levels || {}).map(([l, s]) => `${l} ${s === 'complete_for_scope' ? '✓' : s}`).join(' · ')}</div>}
                  {e.state === 'incompatible'
                    ? <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Incompatível com esta versão do app.</div>
                    : canDownload
                      ? <button className="btn btn-sm btn-primary" data-testid={`catalog-download-${e.pack_id}`} style={{ marginTop: 6 }} onClick={() => onDownload(e)}>{e.state === 'update_available' ? 'Atualizar' : 'Baixar'}</button>
                      : st === 'failed'
                        ? <button className="btn btn-sm btn-secondary" data-testid={`catalog-retry-${e.pack_id}`} style={{ marginTop: 6 }} onClick={() => onDownload(e)}>Tentar novamente</button>
                        : null}
                </div>
              )
            })}
          </div>
        )}
      </Row>
      <Row last>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Instalados</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
          {packs.map((p) => (
            <div key={p.pack_id} data-testid={`knowledge-pack-${p.pack_id}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{p.title_pt}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {p.pack_id} · v{p.version} · {(p.levels || []).join('/')} · {p.source === 'builtin' ? 'embutido' : p.source}
                  </div>
                </div>
                <span className="chip" data-testid={`knowledge-status-${p.pack_id}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{STATUS_LABEL[p.status] || p.status}</span>
              </div>
              {p.coverage && (
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  cobertura: {Object.entries(p.coverage.levels || {}).map(([lvl, st]) => `${lvl} ${st === 'complete_for_scope' ? '✓' : st}`).join(' · ')}
                  {(p.coverage.known_gaps || []).length ? ` · lacunas: ${p.coverage.known_gaps.join(', ')}` : ''}
                </div>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                dependências: {(p.dependencies || []).join(', ') || '—'}
                {p.installed_at ? ` · instalado em ${new Date(p.installed_at).toLocaleDateString('pt-BR')}` : ''}
              </div>
              {p.source !== 'builtin' && (
                <button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} disabled={busy === p.pack_id} onClick={() => onRemove(p.pack_id)}>
                  {busy === p.pack_id ? 'Removendo…' : 'Remover'}
                </button>
              )}
            </div>
          ))}
        </div>
      </Row>
    </div>
  )
}

// Single-user: just the learner's name (editable) with a Bob avatar. No profile
// switching/adding/removing — that is no longer a user-facing feature.
function ProfilesRow() {
  const { profiles, activeProfile, settings, renameActiveProfile } = useApp()
  const current = profiles.find((p) => p.profile_id === activeProfile)
  const [name, setName] = useState(current?.name && current.name !== 'Você' ? current.name : '')
  const mode = settings?.profile_mode === 'kids' ? 'kids' : 'adult'
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Seu nome</div>
      <div className="muted" style={{ fontSize: 12, margin: '2px 0 10px' }}>
        Como o Bob vai te chamar durante as lições
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BobMascot size={44} mode={mode} float={false} />
        <input
          data-testid="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => renameActiveProfile(name)}
          placeholder="Seu nome ou apelido"
          maxLength={24}
          style={{ flex: 1, height: 46, borderRadius: 14, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', padding: '0 14px', font: '700 15px var(--font-sans)', color: 'var(--ink)', outline: 'none' }}
        />
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
            Se a voz escolhida não estiver baixada, o app mostra fallback explícito e usa a voz padrão do dispositivo sem alterar sua preferência.
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
              <button onClick={() => { updateSetting('piper_voice', v.id); if (v.accent?.startsWith('en')) updateSetting('english_voice_id', v.id); if (v.accent?.startsWith('pt')) updateSetting('portuguese_explanation_voice_id', v.id) }}
                aria-label={`Usar voz ${v.label}`}
                style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  border: `2px solid ${isActive ? 'var(--indigo-600)' : 'var(--border-strong)'}`,
                  background: isActive ? 'var(--indigo-600)' : 'transparent',
                  opacity: 1,
                }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{v.flag} {v.label}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {pct != null ? `Baixando… ${pct}%` : isStored ? 'Pronta · no aparelho · offline' : `Não baixada · ${v.sizeMB} MB · sem download automático`}
                </div>
                {!isStored && pct == null && isActive && (
                  <div style={{ fontSize: 11, color: 'var(--warn-ink)', background: 'var(--warn-bg)', borderRadius: 8, padding: '6px 8px', marginTop: 6 }}>
                    A voz Fabiola ainda não está instalada. A explicação será lida com a voz padrão do dispositivo.
                  </div>
                )}
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
                  <I.download s={14} /> Baixar voz offline
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
