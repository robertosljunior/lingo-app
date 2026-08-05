// tts.js — single TTS entry point for the app.
//
// Piper is preferred when its selected model is ready. Until then the app uses
// a matching system voice and reports that fallback honestly. Every speak()
// promise resolves only after playback ends, is interrupted or fails — never
// merely because HTMLMediaElement.play() accepted the request.

export const ACCENTS = [
  { code: 'en-US', label: 'Americano', flag: '🇺🇸' },
  { code: 'en-GB', label: 'Britânico', flag: '🇬🇧' },
  { code: 'en-AU', label: 'Australiano', flag: '🇦🇺' },
  { code: 'en-IN', label: 'Indiano', flag: '🇮🇳' },
]

export const PRIMARY_ENGLISH_PIPER_VOICE_ID = 'en_US-reza_ibrahim-medium'
export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

const state = {
  engine: 'piper',
  accent: 'en-US',
  voiceURI: '',
  rate: 0.95,
  piperVoice: PRIMARY_ENGLISH_PIPER_VOICE_ID,
  overrideVoiceId: '',
  overrideLang: '',
  piper: null,
}

export function configureTts({ tts_engine, tts_accent, tts_voice, tts_rate, piper_voice, english_voice_id } = {}) {
  if (tts_engine) state.engine = tts_engine
  if (tts_accent) state.accent = tts_accent
  state.voiceURI = tts_voice ?? state.voiceURI
  if (tts_rate) state.rate = +tts_rate
  const selectedPiperVoice = english_voice_id || piper_voice
  if (selectedPiperVoice) state.piperVoice = selectedPiperVoice
  state.piper?.configurePiper?.({ piper_voice: state.piperVoice })
}

// ---------- voice enumeration ------------------------------------------------
let cachedVoices = []
let allVoices = []
const voiceListeners = new Set()

function refreshVoices() {
  if (!speechSupported) return
  const all = window.speechSynthesis.getVoices() || []
  allVoices = all
  cachedVoices = all.filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
  voiceListeners.forEach((cb) => cb(cachedVoices))
}

function langFamily(tag) { return String(tag || '').toLowerCase().replace('_', '-').split('-')[0] }

export function resolveDeviceVoiceForLanguage(language) {
  if (!speechSupported) return null
  refreshVoices()
  const fam = langFamily(language)
  if (!fam) return null
  const matches = allVoices.filter((v) => langFamily(v.lang) === fam)
  if (!matches.length) return null
  const region = String(language || '').toLowerCase().replace('_', '-')
  const exact = matches.filter((v) => (v.lang || '').toLowerCase().replace('_', '-') === region)
  const pool = exact.length ? exact : matches
  return pool.find((v) => v.localService) || pool[0]
}

if (speechSupported) {
  refreshVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
}

export function listVoices(accent = null) {
  if (cachedVoices.length === 0) refreshVoices()
  if (!accent) return cachedVoices
  const code = accent.toLowerCase().replace('_', '-')
  return cachedVoices.filter((v) => (v.lang || '').toLowerCase().replace('_', '-') === code)
}

export function availableAccents() {
  return ACCENTS.filter((a) => listVoices(a.code).length > 0)
}

export function onVoicesChanged(cb) {
  voiceListeners.add(cb)
  return () => voiceListeners.delete(cb)
}

function pickVoice() {
  const voices = listVoices()
  const wanted = state.overrideVoiceId || state.voiceURI
  if (wanted) {
    const chosen = voices.find((v) => v.voiceURI === wanted)
    if (chosen) return chosen
  }
  const forAccent = listVoices(state.accent)
  if (forAccent.length) return forAccent.find((v) => v.localService) || forAccent[0]
  return voices[0] || null
}

// ---------- observable playback lifecycle -----------------------------------
function recordTtsEvent(event) {
  if (typeof window === 'undefined' || !window.__LINGO_E2E__?.ttsEvents) return
  window.__LINGO_E2E__.ttsEvents.push({
    requested_voice_id: event.requested_voice_id || '',
    effective_voice_id: event.effective_voice_id || '',
    language: event.language || '',
    role: event.role || 'exercise_en',
    engine: event.engine || state.engine,
    rate: event.rate ?? state.rate,
    fallback_used: !!event.fallback_used,
    fallback_reason: event.fallback_reason || '',
    model_state: event.model_state || '',
    playback_state: event.playback_state || '',
    timestamp: Date.now(),
  })
}

let activeSystemPlayback = null

function finishSystemPlayback(playback, result) {
  if (!playback || playback.settled) return
  playback.settled = true
  clearTimeout(playback.timeout)
  playback.utterance.onend = null
  playback.utterance.onerror = null
  if (activeSystemPlayback === playback) activeSystemPlayback = null
  playback.resolve(result)
}

function stopSystemPlayback() {
  const playback = activeSystemPlayback
  if (!playback) {
    try { if (speechSupported) window.speechSynthesis.cancel() } catch { /* noop */ }
    return false
  }
  try { window.speechSynthesis.cancel() } catch { /* noop */ }
  finishSystemPlayback(playback, { ok: false, code: 'TTS_INTERRUPTED', engine: 'system', playback_state: 'interrupted' })
  return true
}

async function speakSystem(text, opts = {}) {
  if (!speechSupported) return null
  const reqLang = opts.language || state.overrideLang || ''
  const fam = langFamily(reqLang)
  let voice = null
  if (fam && fam !== 'en') {
    voice = resolveDeviceVoiceForLanguage(reqLang)
    if (!voice) return null
  } else {
    voice = pickVoice()
  }

  if (opts.interrupt !== false) stopSystemPlayback()
  const utterance = new SpeechSynthesisUtterance(text)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = state.overrideLang || state.accent
  }
  const base = opts.rate ?? state.rate
  utterance.rate = opts.slow ? Math.max(0.5, base * 0.6) : base

  return await new Promise((resolve) => {
    const playback = { utterance, resolve, settled: false, timeout: null }
    activeSystemPlayback = playback
    utterance.onend = () => {
      recordTtsEvent({
        requested_voice_id: opts.requestedVoiceId || opts.voiceId || reqLang || state.accent,
        effective_voice_id: voice?.voiceURI || utterance.lang || state.accent,
        language: reqLang || utterance.lang || state.accent,
        role: opts.role,
        engine: 'system',
        rate: utterance.rate,
        fallback_used: !!opts.fallback_used,
        fallback_reason: opts.fallback_reason || '',
        model_state: voice ? 'system_voice_selected' : 'system_default',
        playback_state: 'ended',
      })
      finishSystemPlayback(playback, {
        ok: true,
        engine: 'system',
        fallback_used: !!opts.fallback_used,
        playback_state: 'ended',
      })
    }
    utterance.onerror = () => finishSystemPlayback(playback, { ok: false, code: 'SYSTEM_PLAYBACK_FAILED', engine: 'system' })
    // Browser engines occasionally omit onend after an OS-level TTS failure.
    // This is a failure timeout, not an optimistic completion signal.
    playback.timeout = setTimeout(() => {
      try { window.speechSynthesis.cancel() } catch { /* noop */ }
      finishSystemPlayback(playback, { ok: false, code: 'SYSTEM_PLAYBACK_TIMEOUT', engine: 'system' })
    }, Math.min(90000, Math.max(15000, text.length * 320)))

    recordTtsEvent({
      requested_voice_id: opts.requestedVoiceId || opts.voiceId || reqLang || state.accent,
      effective_voice_id: voice?.voiceURI || utterance.lang || state.accent,
      language: reqLang || utterance.lang || state.accent,
      role: opts.role,
      engine: 'system',
      rate: utterance.rate,
      fallback_used: !!opts.fallback_used,
      fallback_reason: opts.fallback_reason || '',
      model_state: voice ? 'system_voice_selected' : 'system_default',
      playback_state: 'playing',
    })
    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      finishSystemPlayback(playback, { ok: false, code: 'SYSTEM_PLAYBACK_FAILED', engine: 'system' })
    }
  })
}

async function speakPiper(text, opts) {
  try {
    if (!state.piper) {
      state.piper = await import('./tts-piper.js')
      state.piper.configurePiper?.({ piper_voice: state.piperVoice })
    }
    return await state.piper.speak(text, {
      ...opts,
      rate: opts.rate ?? state.rate,
      accent: state.accent,
      voiceId: opts.voiceId || state.piperVoice,
      requestedVoiceId: opts.requestedVoiceId || opts.voiceId || state.piperVoice,
      language: opts.language || state.accent,
    })
  } catch {
    return { ok: false, code: 'PIPER_BACKEND_UNAVAILABLE', engine: 'piper' }
  }
}

function unavailable(opts = {}, code = 'TTS_BACKEND_UNAVAILABLE') {
  return {
    ok: false,
    code,
    requested_voice_id: opts.requestedVoiceId || opts.voiceId || state.piperVoice || state.voiceURI || state.accent,
    fallback_available: speechSupported,
    message: 'O áudio não está disponível agora. Você pode continuar a lição normalmente.',
  }
}

// opts: { slow, rate, interrupt, voiceId, requestedVoiceId, language, role }
export async function speak(text, opts = {}) {
  const clean = String(text || '').trim()
  if (!clean) return unavailable(opts, 'TTS_TEXT_EMPTY')

  const previousOverride = { voice: state.overrideVoiceId, lang: state.overrideLang }
  state.overrideVoiceId = opts.voiceId || ''
  state.overrideLang = opts.language || ''
  try {
    let fallbackReason = ''
    if (state.engine === 'piper' || opts.voiceId) {
      const piperResult = await speakPiper(clean, opts)
      if (piperResult?.ok) return piperResult
      if (piperResult?.code === 'TTS_INTERRUPTED') return piperResult
      fallbackReason = piperResult?.code || 'PIPER_BACKEND_UNAVAILABLE'
    }

    const systemResult = await speakSystem(clean, {
      ...opts,
      fallback_used: !!fallbackReason,
      fallback_reason: fallbackReason,
    })
    if (systemResult) return systemResult

    recordTtsEvent({
      requested_voice_id: opts.requestedVoiceId || opts.voiceId || opts.language || '',
      effective_voice_id: '',
      language: opts.language || '',
      role: opts.role,
      engine: 'system',
      rate: opts.rate ?? state.rate,
      fallback_used: true,
      fallback_reason: 'NO_VOICE_FOR_LANGUAGE',
      model_state: 'unavailable',
      playback_state: 'not_started',
    })
    return unavailable(opts, 'NO_VOICE_FOR_LANGUAGE')
  } finally {
    state.overrideVoiceId = previousOverride.voice
    state.overrideLang = previousOverride.lang
  }
}

export function stopSpeaking() {
  try {
    stopSystemPlayback()
    state.piper?.stop?.()
  } catch { /* noop */ }
}

export function speakWord(word) {
  const clean = String(word || '').replace(/[.,!?;:"“”()\[\]]/g, '').trim()
  if (!clean) return Promise.resolve(unavailable({}, 'TTS_TEXT_EMPTY'))
  return speak(clean, { rate: Math.min(state.rate, 0.9) })
}
