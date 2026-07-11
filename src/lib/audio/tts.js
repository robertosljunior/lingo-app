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
  piper: null, // lazy handle to the piper engine module
}

export function configureTts({ tts_engine, tts_accent, tts_voice, tts_rate } = {}) {
  if (tts_engine) state.engine = tts_engine
  if (tts_accent) state.accent = tts_accent
  state.voiceURI = tts_voice ?? state.voiceURI
  if (tts_rate) state.rate = +tts_rate
}

// ---------- voice enumeration (Web Speech) ----------
// getVoices() is empty until the async `voiceschanged` event on some browsers.
let cachedVoices = []
const voiceListeners = new Set()

function refreshVoices() {
  if (!speechSupported) return
  const all = window.speechSynthesis.getVoices() || []
  cachedVoices = all.filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
  voiceListeners.forEach((cb) => cb(cachedVoices))
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
  if (state.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === state.voiceURI)
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

  if (state.engine === 'piper') {
    const ok = await speakPiper(t, opts)
    if (ok) return true // otherwise fall through to the system engine
  }
  return speakSystem(t, opts)
}

function speakSystem(text, opts = {}) {
  try {
    if (!speechSupported) return false
    if (opts.interrupt !== false) window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else {
      u.lang = state.accent
    }
    const base = opts.rate ?? state.rate
    u.rate = opts.slow ? Math.max(0.5, base * 0.6) : base
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

async function speakPiper(text, opts) {
  try {
    if (!state.piper) {
      state.piper = await import('./tts-piper.js')
    }
    return await state.piper.speak(text, { ...opts, accent: state.accent })
  } catch {
    return false
  }
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
