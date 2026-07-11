// tts-piper.js — Piper neural TTS engine (opt-in, offline). Placeholder until
// the Piper integration lands; returning false makes tts.js fall back to the
// system engine transparently.

export async function speak() {
  return false
}

export function stop() {}
