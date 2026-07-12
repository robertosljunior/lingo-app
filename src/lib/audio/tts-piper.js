// tts-piper.js — Piper neural TTS running locally (WASM, CPU-only).
//
// Models (~60 MB per voice) are downloaded once from Hugging Face and stored
// in OPFS by @mintplex-labs/piper-tts-web; the ONNX/phonemizer WASM runtimes
// come from CDNs and are cached by the service worker, so after the first
// download everything speaks 100% offline. Synthesized sentences are cached
// in the Cache API — each phrase is only synthesized once per voice.
//
// This module is loaded lazily by tts.js only when the user enables the
// neural engine. Every entry point returns false instead of throwing so the
// caller can fall back to the system engine.

import { logInfo, logError } from '../error-log.js'

// Curated catalog: two accents × two voices, all medium quality (best
// size/quality tradeoff on phones).
export const PIPER_VOICES = [
  { id: 'en_US-hfc_female-medium', label: 'Amy — feminina', accent: 'en-US', flag: '🇺🇸', sizeMB: 63 },
  { id: 'en_US-ryan-medium', label: 'Ryan — masculina', accent: 'en-US', flag: '🇺🇸', sizeMB: 63 },
  { id: 'en_GB-cori-medium', label: 'Cori — feminina', accent: 'en-GB', flag: '🇬🇧', sizeMB: 63 },
  { id: 'en_GB-alan-medium', label: 'Alan — masculina', accent: 'en-GB', flag: '🇬🇧', sizeMB: 63 },
  { id: 'pt_BR-fabiola-medium', label: 'Fabiola — Português do Brasil', accent: 'pt-BR', flag: '🇧🇷', sizeMB: 60 },
]

export const piperSupported = typeof window !== 'undefined'
  && typeof Worker !== 'undefined'
  && !!navigator.storage?.getDirectory // OPFS, where models are kept

const AUDIO_CACHE = 'piper-audio-v2'
const MODEL_VERSION = '1'

let lib = null // the piper-tts-web module, loaded on demand
let currentAudio = null
let activeVoice = null // VoiceId chosen in settings

async function ensureLib() {
  if (!lib) lib = await import('@mintplex-labs/piper-tts-web')
  return lib
}

export function configurePiper({ piper_voice } = {}) {
  if (piper_voice) activeVoice = piper_voice
}

// ---------- voice management (Settings UI) ----------
export async function storedVoices() {
  try {
    const l = await ensureLib()
    return await l.stored()
  } catch {
    return []
  }
}

export async function downloadVoice(voiceId, onProgress) {
  const l = await ensureLib()
  await l.download(voiceId, (p) => {
    if (p.total) onProgress?.(Math.round((p.loaded / p.total) * 100))
  })
  logInfo('piper', `Voz ${voiceId} baixada`)
}

export async function removeVoice(voiceId) {
  const l = await ensureLib()
  await l.remove(voiceId)
  try {
    const cache = await caches.open(AUDIO_CACHE)
    for (const req of await cache.keys()) {
      if (req.url.includes(`/${voiceId}/`)) await cache.delete(req)
    }
  } catch { /* cache cleanup is best-effort */ }
  logInfo('piper', `Voz ${voiceId} removida`)
}

// ---------- synthesis ----------
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
    // Only speak with a voice that is already on device — never trigger a
    // 60 MB download from a speaker button.
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

// Called by tts.js. Returns false so the caller falls back to the system voice.
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
    timestamp: Date.now(),
  })
}

export async function speak(text, { slow = false, rate = 0.95, accent = 'en-US', voiceId: requestedVoiceId = null, requestedVoiceId: explicitRequested = null, language = '', role = 'exercise_en' } = {}) {
  if (!piperSupported) return false
  const requested = explicitRequested || requestedVoiceId || activeVoice
  const voiceId = requestedVoiceId || activeVoice
    || PIPER_VOICES.find((v) => v.accent === accent)?.id
    || PIPER_VOICES[0].id
  const blob = await synthesize(text, voiceId, { rate, language: language || accent })
  if (!blob) {
    recordTtsEvent({ requested_voice_id: requested || voiceId, effective_voice_id: '', language: language || accent, role, rate, fallback_used: true, fallback_reason: 'MODEL_NOT_INSTALLED', model_state: 'not_installed' })
    return false
  }
  stop()
  const audio = new Audio(URL.createObjectURL(blob))
  currentAudio = audio
  audio.playbackRate = slow ? Math.max(0.55, rate * 0.65) : rate
  audio.onended = () => URL.revokeObjectURL(audio.src)
  try {
    await audio.play()
    recordTtsEvent({ requested_voice_id: requested || voiceId, effective_voice_id: voiceId, language: language || accent, role, rate: audio.playbackRate, fallback_used: false, fallback_reason: '', model_state: 'ready' })
    return true
  } catch {
    URL.revokeObjectURL(audio.src)
    return false
  }
}

// Pre-synthesize a batch of sentences (e.g. a whole lesson right after
// import) so playback is instant and offline later.
export async function warmCache(texts, voiceId = activeVoice) {
  if (!piperSupported || !voiceId) return 0
  let done = 0
  for (const t of texts) {
    if (await synthesize(t, voiceId, { language: PIPER_VOICES.find(v=>v.id===voiceId)?.accent || '' })) done++
  }
  return done
}

export function stop() {
  try {
    currentAudio?.pause()
    currentAudio = null
  } catch { /* noop */ }
}
