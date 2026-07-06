// speech.js — thin wrapper over the Web Speech API (TTS of the expected answer).
// Silently no-ops where unsupported.

export function speak(text, lang = 'en-US') {
  try {
    if (!('speechSynthesis' in window)) return false
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.95
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
