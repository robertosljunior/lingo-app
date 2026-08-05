import { useEffect, useState } from 'react'
import { useApp } from '../store.jsx'
import {
  dismissInstallPrompt,
  getInstallEligibility,
  initPwaInstallController,
  isStandalone,
  loadFabiolaState,
  markStandaloneLaunch,
  requestInstall,
  saveFabiolaState,
  FABIOLA_VOICE_ID,
} from '../lib/pwa-install-controller.js'
import {
  loadEnglishVoicePreparationState,
  preparePriorityEnglishVoices,
  subscribeEnglishVoicePreparation,
} from '../lib/audio/neural-voice-preparation.js'
import { PRIMARY_ENGLISH_PIPER_VOICE_ID } from '../lib/audio/tts.js'

const TERMINAL_ENGLISH_STATES = new Set(['ready', 'partial', 'failed', 'unsupported', 'disabled'])

export default function PwaInstallController() {
  const { settings, updateSetting } = useApp()
  const [eligible, setEligible] = useState(null)
  const [voice, setVoice] = useState(() => loadFabiolaState())
  const [englishVoice, setEnglishVoice] = useState(() => loadEnglishVoicePreparationState())

  useEffect(() => {
    initPwaInstallController()
    const timer = setTimeout(() => setEligible(getInstallEligibility({ allowManualFallback: true })), 1200)
    return () => clearTimeout(timer)
  }, [])

  // RX-7: preparation starts automatically on a normal learner boot. It is
  // sequential and idempotent: US Reza first, then UK Cori. Speaker buttons
  // never trigger a model download; they use the system fallback while this
  // controller reports real progress.
  useEffect(() => {
    const unsubscribe = subscribeEnglishVoicePreparation(setEnglishVoice)
    const start = () => preparePriorityEnglishVoices({ onState: setEnglishVoice }).catch(() => {})
    start()
    window.addEventListener('online', start)
    return () => {
      unsubscribe()
      window.removeEventListener('online', start)
    }
  }, [])

  // Once the primary neural voice is physically present, make it the effective
  // English route. Existing explicit non-legacy Piper selections are preserved;
  // the old hfc default is migrated because it was never prepared automatically.
  useEffect(() => {
    if (!englishVoice.primary_ready || !settings) return
    const legacyVoice = !settings.english_voice_id || settings.english_voice_id === 'en_US-hfc_female-medium'
    const writes = []
    if (settings.tts_engine !== 'piper') writes.push(updateSetting('tts_engine', 'piper'))
    if (legacyVoice && settings.english_voice_id !== PRIMARY_ENGLISH_PIPER_VOICE_ID) {
      writes.push(updateSetting('english_voice_id', PRIMARY_ENGLISH_PIPER_VOICE_ID))
    }
    if ((!settings.piper_voice || settings.piper_voice === 'en_US-hfc_female-medium') && settings.piper_voice !== PRIMARY_ENGLISH_PIPER_VOICE_ID) {
      writes.push(updateSetting('piper_voice', PRIMARY_ENGLISH_PIPER_VOICE_ID))
    }
    if (writes.length) Promise.all(writes).catch(() => {})
  }, [englishVoice.primary_ready, settings, updateSetting])

  // Portuguese preparation remains standalone-only and starts after the English
  // priority path has reached a terminal state, avoiding three simultaneous
  // model downloads on first launch.
  useEffect(() => {
    if (!TERMINAL_ENGLISH_STATES.has(englishVoice.status)) return
    if (markStandaloneLaunch() || isStandalone()) startFabiolaDownload(setVoice)
  }, [englishVoice.status])

  if (['downloading', 'waiting', 'failed', 'partial'].includes(englishVoice.status)) {
    return (
      <EnglishVoiceBanner
        state={englishVoice}
        onRetry={() => preparePriorityEnglishVoices({ force: true, onState: setEnglishVoice }).catch(() => {})}
      />
    )
  }
  if (voice.fabiola_status && voice.fabiola_status !== 'ready') {
    return <PortugueseVoiceBanner state={voice} onRetry={() => startFabiolaDownload(setVoice, true)} />
  }
  if (!eligible?.eligible) return null

  return (
    <div
      className="card"
      role="dialog"
      aria-label="Instalar o aplicativo"
      data-testid="pwa-install-card"
      style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(88px + env(safe-area-inset-bottom))', zIndex: 50, padding: 16, boxShadow: 'var(--shadow-lg)' }}
    >
      <div style={{ fontWeight: 800, fontSize: 16 }}>Instalar o aplicativo</div>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.45, margin: '6px 0 12px' }}>Use as lições e vozes offline mesmo sem internet.</p>
      {eligible.mode === 'manual' && <p data-testid="pwa-manual-instructions" style={{ fontSize: 13 }}>Para instalar, abra o menu do navegador e escolha “Adicionar à Tela de Início”.</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => { dismissInstallPrompt(); setEligible(null) }}>Agora não</button>
        {eligible.mode === 'prompt' && <button className="btn btn-primary" onClick={async () => { await requestInstall(); setEligible(null) }}>Instalar</button>}
      </div>
    </div>
  )
}

function EnglishVoiceBanner({ state, onRetry }) {
  const status = {
    waiting: 'Aguardando internet — a voz do aparelho continua disponível.',
    downloading: `Baixando ${state.current_voice_id?.startsWith('en_GB') ? 'a voz britânica' : 'a voz americana'}${state.progress != null ? ` · ${state.progress}%` : ''}`,
    partial: 'A voz americana está pronta. A voz britânica será preparada quando possível.',
    failed: 'Não foi possível preparar a voz neural. A voz do aparelho continua disponível.',
  }[state.status] || 'Preparando a voz neural.'
  const canRetry = ['waiting', 'partial', 'failed'].includes(state.status)
  return (
    <div
      className="card"
      role="status"
      data-testid="piper-preparation-card"
      data-status={state.status}
      data-progress={state.progress ?? 0}
      style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(88px + env(safe-area-inset-bottom))', zIndex: 45, padding: 14 }}
    >
      <div style={{ fontWeight: 800 }}>Preparando uma voz mais natural</div>
      <div className="muted" style={{ fontSize: 12 }}>Depois do download, as frases em inglês funcionam offline.</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>{status}</div>
      {state.status === 'downloading' && (
        <progress data-testid="piper-preparation-progress" max="100" value={state.progress ?? 0} style={{ width: '100%', marginTop: 8 }} />
      )}
      {canRetry && <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={onRetry}>Tentar novamente</button>}
    </div>
  )
}

function PortugueseVoiceBanner({ state, onRetry }) {
  const label = { waiting: 'Aguardando internet', downloading: 'Baixando', validating: 'Validando', failed: 'Falha — tentar novamente' }[state.fabiola_status] || 'Baixando'
  return (
    <div className="card" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(88px + env(safe-area-inset-bottom))', zIndex: 45, padding: 14 }}>
      <div style={{ fontWeight: 800 }}>Preparando a voz em português</div>
      <div className="muted" style={{ fontSize: 12 }}>A explicação falada ficará disponível offline.</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>{label}{state.fabiola_progress != null ? ` · ${state.fabiola_progress}%` : ''}</div>
      {state.fabiola_status === 'failed' && <button className="btn btn-sm btn-secondary" onClick={onRetry}>Tentar novamente</button>}
    </div>
  )
}

async function startFabiolaDownload(setVoice, force = false) {
  const current = loadFabiolaState()
  if (!force && (current.fabiola_status === 'ready' || current.fabiola_auto_download_started)) return
  if (navigator.onLine === false) {
    setVoice(saveFabiolaState({ fabiola_status: 'waiting' }))
    return
  }
  setVoice(saveFabiolaState({ fabiola_auto_download_started: true, fabiola_status: 'downloading', fabiola_progress: 0, fabiola_model_version: '1' }))
  import('../lib/audio/tts-piper.js').then(async (piper) => {
    const have = await piper.storedVoices()
    if (have.includes(FABIOLA_VOICE_ID)) {
      setVoice(saveFabiolaState({ fabiola_status: 'ready', fabiola_progress: 100 }))
      return
    }
    await piper.downloadVoice(FABIOLA_VOICE_ID, (pct) => setVoice(saveFabiolaState({ fabiola_status: 'downloading', fabiola_progress: pct })))
    setVoice(saveFabiolaState({ fabiola_status: 'ready', fabiola_progress: 100 }))
  }).catch(() => setVoice(saveFabiolaState({ fabiola_status: 'failed' })))
}
