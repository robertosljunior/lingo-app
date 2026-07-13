import { describe, it, expect, beforeEach, vi } from 'vitest'

// tts.js reads `speechSupported` at module load, so we install a fake Web Speech
// environment on the global before importing it. Each test resets the recorded
// utterances and the E2E event log.

function makeVoice(name, lang, localService = true) { return { voiceURI: name, name, lang, localService } }

const spoken = []
let voices = []

class FakeUtterance {
  constructor(text) { this.text = text; this.voice = null; this.lang = ''; this.rate = 1 }
}

function installWindow(voiceList) {
  voices = voiceList
  spoken.length = 0
  const win = {
    speechSynthesis: {
      getVoices: () => voices,
      speak: (u) => spoken.push(u),
      cancel: () => {},
      addEventListener: () => {},
    },
    SpeechSynthesisUtterance: FakeUtterance,
    __LINGO_E2E__: { ttsEvents: [] },
    dispatchEvent: () => {},
    CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o) } },
  }
  globalThis.window = win
  globalThis.SpeechSynthesisUtterance = FakeUtterance
  return win
}

describe('tts language-aware system voice', () => {
  let tts
  beforeEach(async () => {
    installWindow([
      makeVoice('Google US English', 'en-US'),
      makeVoice('Google UK English', 'en-GB'),
      makeVoice('Google português do Brasil', 'pt-BR'),
    ])
    vi.resetModules()
    tts = await import('./tts.js')
  })

  it('resolves a pt-BR device voice for a Portuguese request', () => {
    const v = tts.resolveDeviceVoiceForLanguage('pt-BR')
    expect(v?.lang).toBe('pt-BR')
  })

  it('never selects an English voice for a Portuguese explanation', async () => {
    const res = await tts.speak('Sua frase está correta.', { language: 'pt-BR', role: 'explanation_pt', voiceId: 'pt_BR-fabiola-medium' })
    expect(res.ok).toBe(true)
    // the utterance actually spoken is the pt-BR voice, not English
    expect(spoken.at(-1).voice.lang).toBe('pt-BR')
    const ev = window.__LINGO_E2E__.ttsEvents.at(-1)
    expect(ev.role).toBe('explanation_pt')
    expect(ev.language).toBe('pt-BR')
    expect(ev.effective_voice_id.toLowerCase()).not.toContain('english')
    expect(String(ev.effective_voice_id)).not.toMatch(/en-/i)
  })

  it('reports unavailable (not English) when no pt-BR voice exists', async () => {
    installWindow([makeVoice('Google US English', 'en-US')])
    vi.resetModules()
    tts = await import('./tts.js')
    const res = await tts.speak('Explicação em português.', { language: 'pt-BR', role: 'explanation_pt' })
    expect(res.ok).toBe(false)
    // nothing was spoken with an English voice
    expect(spoken.length).toBe(0)
    const ev = window.__LINGO_E2E__.ttsEvents.at(-1)
    expect(ev.effective_voice_id).toBe('')
    expect(ev.fallback_reason).toBe('NO_VOICE_FOR_LANGUAGE')
    // the failing E2E assertion for the slice: explanation_pt must never be en
    expect(ev.language).not.toBe('en')
  })

  it('still uses an English voice for English roles', async () => {
    const res = await tts.speak('Your sentence is correct.', { language: 'en', role: 'correct_answer_en' })
    expect(res.ok).toBe(true)
    expect(spoken.at(-1).voice.lang).toMatch(/^en/)
  })
})
