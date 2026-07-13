// tts.js — single TTS entry point for the app.
//
// Engine 1 (default): Web Speech API — on Android the voices come from the
// system TTS engine (Google), including several English accents when the
// corresponding voice packs are installed on the device.
// Engine 2 (opt-in): Piper neural voices running locally (see tts-piper.js),
// with automatic fallback to the system engine.
//
// The active configuration (accent, voice, rate, engine) is pushed in by the
// store whenever settings load/change, so callers just speak(text).

export const ACCENTS = [
  { code: 'en-US', label: 'Americano', flag: '🇺🇸' },
  { code: 'en-GB', label: 'Britânico', flag: '🇬🇧' },
  { code: 'en-AU', label: 'Australiano', flag: '🇦🇺' },
  { code: 'en-IN', label: 'Indiano', flag: '🇮🇳' },
]

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

const state = {
  engine: 'system', // system | piper
  accent: 'en-US',
  voiceURI: '', // '' = auto-pick best for accent
  rate: 0.95,
  piperVoice: '',
  overrideVoiceId: '',
  overrideLang: '',
  piper: null, // lazy handle to the piper engine module
}

export function configureTts({ tts_engine, tts_accent, tts_voice, tts_rate, piper_voice } = {}) {
  if (tts_engine) state.engine = tts_engine
  if (tts_accent) state.accent = tts_accent
  state.voiceURI = tts_voice ?? state.voiceURI
  if (tts_rate) state.rate = +tts_rate
  if (piper_voice) state.piperVoice = piper_voice
  state.piper?.configurePiper?.({ piper_voice: state.piperVoice })
}

// ---------- voice enumeration (Web Speech) ----------
// getVoices() is empty until the async `voiceschanged` event on some browsers.
let cachedVoices = []
let allVoices = []
const voiceListeners = new Set()

function refreshVoices() {
  if (!speechSupported) return
  const all = window.speechSynthesis.getVoices() || []
  allVoices = all
  // The English-only list drives the English accent picker in Settings.
  cachedVoices = all.filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
  voiceListeners.forEach((cb) => cb(cachedVoices))
}

// Resolve a device (Web Speech) voice for an arbitrary language tag. Unlike
// listVoices() this is NOT restricted to English — Portuguese explanations must
// never be spoken with an English voice. Returns null when the device has no
// voice for that language family (caller then reports audio unavailable rather
// than silently substituting the wrong language).
function langFamily(tag) { return String(tag || '').toLowerCase().replace('_', '-').split('-')[0] }
export function resolveDeviceVoiceForLanguage(language) {
  if (!speechSupported) return null
  refreshVoices() // always read the live list — voices can arrive after import
  const fam = langFamily(language)
  if (!fam) return null
  const matches = allVoices.filter((v) => langFamily(v.lang) === fam)
  if (!matches.length) return null
  // Prefer an exact region match (pt-BR over pt-PT), then a local/offline voice.
  const region = String(language || '').toLowerCase().replace('_', '-')
  const exact = matches.filter((v) => (v.lang || '').toLowerCase().replace('_', '-') === region)
  const pool = exact.length ? exact : matches
  return pool.find((v) => v.localService) || pool[0]
}

if (speechSupported) {
  refreshVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
}

// English voices available on this device, optionally narrowed to an accent.
export function listVoices(accent = null) {
  if (cachedVoices.length === 0) refreshVoices()
  if (!accent) return cachedVoices
  const code = accent.toLowerCase().replace('_', '-')
  return cachedVoices.filter((v) => (v.lang || '').toLowerCase().replace('_', '-') === code)
}

// Accents that actually have at least one installed voice.
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
  if (forAccent.length) {
    // Prefer local (offline) voices, then Google/network ones.
    return forAccent.find((v) => v.localService) || forAccent[0]
  }
  return voices[0] || null
}

// ---------- speak ----------
// opts: { slow: bool (turtle mode), rate: override, interrupt: bool }
export async function speak(text, opts = {}) {
  const t = String(text || '').trim()
  if (!t) return false

  const prevOverride = { voice: state.overrideVoiceId, lang: state.overrideLang }
  state.overrideVoiceId = opts.voiceId || ''
  state.overrideLang = opts.language || ''
  let fallbackOpts = opts
  if (state.engine === 'piper' || opts.voiceId) {
    const ok = await speakPiper(t, opts)
    if (ok?.ok || ok === true) { state.overrideVoiceId = prevOverride.voice; state.overrideLang = prevOverride.lang; return { ok: true, engine: 'piper' } } // otherwise fall through to the system engine
    fallbackOpts = { ...opts, requestedVoiceId: opts.requestedVoiceId || opts.voiceId || state.piperVoice, fallback_used: true, fallback_reason: 'MODEL_NOT_INSTALLED' }
  }
  const ok = speakSystem(t, fallbackOpts)
  state.overrideVoiceId = prevOverride.voice; state.overrideLang = prevOverride.lang
  if (!ok) {
    // Record an honest unavailable event so observers never see a wrong-language
    // substitution — effective voice/language stay empty, not the English voice.
    recordTtsEvent({
      requested_voice_id: opts.requestedVoiceId || opts.voiceId || opts.language || '',
      effective_voice_id: '', language: opts.language || '', role: opts.role,
      engine: 'system', rate: opts.rate ?? state.rate, fallback_used: true,
      fallback_reason: 'NO_VOICE_FOR_LANGUAGE', model_state: 'unavailable',
    })
  }
  return ok ? { ok: true, engine: 'system', fallback_used: !!fallbackOpts.fallback_used } : unavailable(opts)
}

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
    timestamp: Date.now(),
  })
}

function speakSystem(text, opts = {}) {
  try {
    if (!speechSupported) return false
    const reqLang = opts.language || state.overrideLang || ''
    const fam = langFamily(reqLang)
    // Non-English requests (Portuguese explanations) must use a matching-language
    // device voice — never an English one. If the device has no such voice we
    // report unavailable so the caller can surface "áudio indisponível".
    if (fam && fam !== 'en') {
      const nativeVoice = resolveDeviceVoiceForLanguage(reqLang)
      if (!nativeVoice) return false
      if (opts.interrupt !== false) window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.voice = nativeVoice
      u.lang = nativeVoice.lang
      u.rate = opts.slow ? Math.max(0.5, (opts.rate ?? state.rate) * 0.6) : (opts.rate ?? state.rate)
      window.speechSynthesis.speak(u)
      recordTtsEvent({
        requested_voice_id: opts.requestedVoiceId || opts.voiceId || reqLang,
        effective_voice_id: nativeVoice.voiceURI || nativeVoice.lang,
        language: reqLang, role: opts.role, engine: 'system', rate: u.rate,
        fallback_used: !!opts.fallback_used, fallback_reason: opts.fallback_reason || '',
        model_state: 'system_native_voice_selected',
      })
      return true
    }
    if (opts.interrupt !== false) window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else {
      u.lang = state.overrideLang || state.accent
    }
    const base = opts.rate ?? state.rate
    u.rate = opts.slow ? Math.max(0.5, base * 0.6) : base
    window.speechSynthesis.speak(u)
    recordTtsEvent({
      requested_voice_id: opts.requestedVoiceId || opts.voiceId || state.overrideVoiceId || state.voiceURI || state.overrideLang || state.accent,
      effective_voice_id: voice?.voiceURI || u.lang || state.accent,
      language: opts.language || u.lang || state.accent,
      role: opts.role,
      engine: 'system',
      rate: u.rate,
      fallback_used: !!opts.fallback_used,
      fallback_reason: opts.fallback_reason || '',
      model_state: voice ? 'system_voice_selected' : 'system_default',
    })
    return true
  } catch {
    return false
  }
}

async function speakPiper(text, opts) {
  try {
    if (!state.piper) {
      state.piper = await import('./tts-piper.js')
      state.piper.configurePiper?.({ piper_voice: state.piperVoice })
    }
    return await state.piper.speak(text, { ...opts, rate: opts.rate ?? state.rate, accent: state.accent, voiceId: opts.voiceId || state.piperVoice, requestedVoiceId: opts.requestedVoiceId || opts.voiceId || state.piperVoice, language: opts.language || state.accent })
  } catch {
    return unavailable(opts)
  }
}
function unavailable(opts = {}) {
  return { ok: false, code: 'TTS_BACKEND_UNAVAILABLE', requested_voice_id: opts.requestedVoiceId || opts.voiceId || state.piperVoice || state.voiceURI || state.accent, fallback_available: speechSupported, message: 'O áudio não está disponível agora. Você pode continuar a lição normalmente.' }
}

export function stopSpeaking() {
  try {
    if (speechSupported) window.speechSynthesis.cancel()
    state.piper?.stop?.()
  } catch { /* noop */ }
}

// Speak a single word slightly slower — used by tap-a-word in diffs/answers.
export function speakWord(word) {
  const clean = String(word || '').replace(/[.,!?;:"“”()\[\]]/g, '').trim()
  if (!clean) return false
  return speak(clean, { rate: Math.min(state.rate, 0.9) })
}
