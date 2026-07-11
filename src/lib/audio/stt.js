// stt.js — speech-to-text entry point.
//
// Engine: Web Speech API SpeechRecognition (Chrome on Android uses Google's
// recognizer; audio may leave the device while on-device recognition rolls
// out). The API is flaky on Android — the mic can cut out after a pause and
// errors like 'no-speech'/'aborted' are common — so this wrapper never
// rejects mid-session: it resolves with whatever was heard so the UI can let
// the student try again.

export const sttSupported = typeof window !== 'undefined'
  && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

let active = null

// Listen for one utterance. Resolves with the transcript ('' when nothing was
// captured). onPartial receives the live transcript while the student speaks.
export function listen({ lang = 'en-US', onPartial = null, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { resolve(''); return }
    stopListening()

    const rec = new SR()
    active = rec
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 3

    let finalText = ''
    let lastPartial = ''
    let settled = false

    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (active === rec) active = null
      resolve((finalText || lastPartial || '').trim())
    }
    // Hard stop: never leave the mic hanging.
    const timer = setTimeout(() => { try { rec.stop() } catch { /* noop */ } settle() }, timeoutMs)

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      if (interim) lastPartial = interim
      onPartial?.((finalText + ' ' + interim).trim())
    }
    // Android often ends with 'no-speech'/'aborted' even mid-phrase — treat
    // every error as end-of-utterance and hand back what we have.
    rec.onerror = settle
    rec.onend = settle

    try { rec.start() } catch { settle() }
  })
}

// Ask the active session to finish (fires onend → the listen() promise resolves).
export function stopListening() {
  try { active?.stop() } catch { /* noop */ }
}

export function abortListening() {
  try { active?.abort() } catch { /* noop */ }
  active = null
}
