// tts-piper.js — Piper neural TTS running locally (WASM, CPU-only).
//
// Models are downloaded once and stored in OPFS by
// @mintplex-labs/piper-tts-web. Speaker buttons never start a model download:
// preparation is owned by neural-voice-preparation.js and playback falls back
// honestly while a model is absent.

import { logInfo, logError } from '../error-log.js'

// Ordered deliberately: RX-7 prepares the US voice first, then the UK voice.
// The remaining voices stay available to legacy Settings without becoming part
// of the automatic preparation contract.
export const PIPER_VOICES = [
  { id: 'en_US-reza_ibrahim-medium', label: 'Reza — americano', accent: 'en-US', flag: '🇺🇸', sizeMB: 63 },
  { id: 'en_GB-cori-medium', label: 'Cori — britânica', accent: 'en-GB', flag: '🇬🇧', sizeMB: 63 },
  { id: 'en_US-hfc_female-medium', label: 'Amy — americana', accent: 'en-US', flag: '🇺🇸', sizeMB: 63 },
  { id: 'en_US-ryan-medium', label: 'Ryan — americano', accent: 'en-US', flag: '🇺🇸', sizeMB: 63 },
  { id: 'en_GB-alan-medium', label: 'Alan — britânico', accent: 'en-GB', flag: '🇬🇧', sizeMB: 63 },
  { id: 'pt_BR-fabiola-medium', label: 'Fabiola — Português do Brasil', accent: 'pt-BR', flag: '🇧🇷', sizeMB: 60 },
]

export const piperSupported = typeof window !== 'undefined'
  && typeof Worker !== 'undefined'
  && !!navigator.storage?.getDirectory

const AUDIO_CACHE = 'piper-audio-v2'
const MODEL_VERSION = '1'

let lib = null
let currentPlayback = null
let activeVoice = null
const downloads = new Map()

async function ensureLib() {
  if (!lib) lib = await import('@mintplex-labs/piper-tts-web')
  return lib
}

export function configurePiper({ piper_voice } = {}) {
  if (piper_voice) activeVoice = piper_voice
}

// ---------- voice management -------------------------------------------------
export async function storedVoices() {
  try {
    const l = await ensureLib()
    return await l.stored()
  } catch {
    return []
  }
}

export async function isVoiceStored(voiceId) {
  return (await storedVoices()).includes(voiceId)
}

export async function downloadVoice(voiceId, onProgress) {
  if (!voiceId) throw new Error('PIPER_VOICE_ID_REQUIRED')
  if (downloads.has(voiceId)) return downloads.get(voiceId)
  const task = (async () => {
    const l = await ensureLib()
    await l.download(voiceId, (p) => {
      if (p.total) onProgress?.(Math.max(0, Math.min(100, Math.round((p.loaded / p.total) * 100))))
    })
    onProgress?.(100)
    logInfo('piper', `Voz ${voiceId} baixada`)
    return true
  })().finally(() => downloads.delete(voiceId))
  downloads.set(voiceId, task)
  return task
}

export async function removeVoice(voiceId) {
  const l = await ensureLib()
  await l.remove(voiceId)
  try {
    const cache = await caches.open(AUDIO_CACHE)
    for (const req of await cache.keys()) {
      if (req.url.includes(`/${voiceId}/`)) await cache.delete(req)
    }
  } catch { /* best effort */ }
  logInfo('piper', `Voz ${voiceId} removida`)
}

// ---------- synthesis --------------------------------------------------------
function hash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

const normalizeText = (text) => String(text || '').trim().replace(/\s+/g, ' ').toLowerCase()
const cacheUrl = (voice, text, rate = 1, language = '') => `https://piper-audio.cache/${voice}/${MODEL_VERSION}/${language || 'auto'}/${rate}/${hash(normalizeText(text))}`

async function synthesize(text, voiceId, { rate = 1, language = '' } = {}) {
  try {
    const cache = await caches.open(AUDIO_CACHE)
    const hit = await cache.match(cacheUrl(voiceId, text, rate, language))
    if (hit) return await hit.blob()
    const l = await ensureLib()
    const have = await l.stored()
    if (!have.includes(voiceId)) return null
    const blob = await l.predict({ text, voiceId })
    await cache.put(cacheUrl(voiceId, text, rate, language), new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/wav' } }))
    return blob
  } catch (err) {
    logError('piper', err)
    return null
  }
}

function recordTtsEvent(event) {
  if (typeof window === 'undefined' || !window.__LINGO_E2E__?.ttsEvents) return
  window.__LINGO_E2E__.ttsEvents.push({
    requested_voice_id: event.requested_voice_id || '',
    effective_voice_id: event.effective_voice_id || '',
    language: event.language || '',
    role: event.role || 'exercise_en',
    engine: 'piper',
    rate: event.rate ?? 1,
    fallback_used: !!event.fallback_used,
    fallback_reason: event.fallback_reason || '',
    model_state: event.model_state || '',
    playback_state: event.playback_state || '',
    timestamp: Date.now(),
  })
}

function finishPlayback(playback, result) {
  if (!playback || playback.settled) return
  playback.settled = true
  try {
    playback.audio.onended = null
    playback.audio.onerror = null
    playback.audio.onabort = null
    URL.revokeObjectURL(playback.url)
  } catch { /* noop */ }
  if (currentPlayback === playback) currentPlayback = null
  playback.resolve(result)
}

export async function speak(text, {
  slow = false,
  rate = 0.95,
  accent = 'en-US',
  voiceId: requestedVoiceId = null,
  requestedVoiceId: explicitRequested = null,
  language = '',
  role = 'exercise_en',
} = {}) {
  if (!piperSupported) return { ok: false, code: 'PIPER_UNSUPPORTED', engine: 'piper' }
  const requested = explicitRequested || requestedVoiceId || activeVoice
  const voiceId = requestedVoiceId || activeVoice
    || PIPER_VOICES.find((v) => v.accent === accent)?.id
    || PIPER_VOICES[0].id
  const blob = await synthesize(text, voiceId, { rate, language: language || accent })
  if (!blob) {
    recordTtsEvent({ requested_voice_id: requested || voiceId, effective_voice_id: '', language: language || accent, role, rate, fallback_used: true, fallback_reason: 'MODEL_NOT_INSTALLED', model_state: 'not_installed', playback_state: 'not_started' })
    return { ok: false, code: 'PIPER_MODEL_NOT_INSTALLED', engine: 'piper', requested_voice_id: requested || voiceId }
  }

  stop()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.playbackRate = slow ? Math.max(0.55, rate * 0.65) : rate

  return await new Promise((resolve) => {
    const playback = { audio, url, resolve, settled: false }
    currentPlayback = playback
    audio.onended = () => {
      recordTtsEvent({ requested_voice_id: requested || voiceId, effective_voice_id: voiceId, language: language || accent, role, rate: audio.playbackRate, model_state: 'ready', playback_state: 'ended' })
      finishPlayback(playback, { ok: true, engine: 'piper', voice_id: voiceId, playback_state: 'ended' })
    }
    audio.onerror = () => finishPlayback(playback, { ok: false, code: 'PIPER_PLAYBACK_FAILED', engine: 'piper' })
    audio.onabort = () => finishPlayback(playback, { ok: false, code: 'TTS_INTERRUPTED', engine: 'piper' })

    Promise.resolve(audio.play()).then(() => {
      recordTtsEvent({ requested_voice_id: requested || voiceId, effective_voice_id: voiceId, language: language || accent, role, rate: audio.playbackRate, model_state: 'ready', playback_state: 'playing' })
    }).catch(() => finishPlayback(playback, { ok: false, code: 'PIPER_PLAYBACK_BLOCKED', engine: 'piper' }))
  })
}

// Pre-synthesize a batch of sentences so playback is instant and offline later.
export async function warmCache(texts, voiceId = activeVoice) {
  if (!piperSupported || !voiceId) return 0
  let done = 0
  for (const t of texts) {
    if (await synthesize(t, voiceId, { language: PIPER_VOICES.find((v) => v.id === voiceId)?.accent || '' })) done++
  }
  return done
}

export function stop() {
  const playback = currentPlayback
  if (!playback) return false
  try { playback.audio.pause() } catch { /* noop */ }
  finishPlayback(playback, { ok: false, code: 'TTS_INTERRUPTED', engine: 'piper', playback_state: 'interrupted' })
  return true
}
