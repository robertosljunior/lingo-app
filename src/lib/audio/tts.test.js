import { describe, it, expect, beforeEach, vi } from 'vitest'

function makeVoice(name, lang, localService = true) { return { voiceURI: name, name, lang, localService } }

const spoken = []
let voices = []
let autoEnd = true

class FakeUtterance {
  constructor(text) {
    this.text = text
    this.voice = null
    this.lang = ''
    this.rate = 1
    this.onend = null
    this.onerror = null
  }
}

function installWindow(voiceList) {
  voices = voiceList
  spoken.length = 0
  autoEnd = true
  const win = {
    speechSynthesis: {
      getVoices: () => voices,
      speak: (utterance) => {
        spoken.push(utterance)
        if (autoEnd) queueMicrotask(() => utterance.onend?.())
      },
      cancel: () => {},
      addEventListener: () => {},
    },
    SpeechSynthesisUtterance: FakeUtterance,
    __LINGO_E2E__: { ttsEvents: [] },
    dispatchEvent: () => {},
    CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options) } },
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
    tts.configureTts({ tts_engine: 'system' })
  })

  it('resolves a pt-BR device voice for a Portuguese request', () => {
    const voice = tts.resolveDeviceVoiceForLanguage('pt-BR')
    expect(voice?.lang).toBe('pt-BR')
  })

  it('never selects an English voice for a Portuguese explanation', async () => {
    const result = await tts.speak('Sua frase está correta.', { language: 'pt-BR', role: 'explanation_pt', voiceId: 'pt_BR-fabiola-medium' })
    expect(result.ok).toBe(true)
    expect(spoken.at(-1).voice.lang).toBe('pt-BR')
    const event = window.__LINGO_E2E__.ttsEvents.at(-1)
    expect(event.role).toBe('explanation_pt')
    expect(event.language).toBe('pt-BR')
    expect(event.playback_state).toBe('ended')
    expect(event.effective_voice_id.toLowerCase()).not.toContain('english')
    expect(String(event.effective_voice_id)).not.toMatch(/en-/i)
  })

  it('reports unavailable instead of substituting English when no Portuguese voice exists', async () => {
    installWindow([makeVoice('Google US English', 'en-US')])
    vi.resetModules()
    tts = await import('./tts.js')
    tts.configureTts({ tts_engine: 'system' })
    const result = await tts.speak('Explicação em português.', { language: 'pt-BR', role: 'explanation_pt' })
    expect(result.ok).toBe(false)
    expect(spoken.length).toBe(0)
    const event = window.__LINGO_E2E__.ttsEvents.at(-1)
    expect(event.effective_voice_id).toBe('')
    expect(event.fallback_reason).toBe('NO_VOICE_FOR_LANGUAGE')
    expect(event.language).not.toBe('en')
  })

  it('still uses an English voice for English roles', async () => {
    const result = await tts.speak('Your sentence is correct.', { language: 'en', role: 'correct_answer_en' })
    expect(result.ok).toBe(true)
    expect(spoken.at(-1).voice.lang).toMatch(/^en/)
  })

  it('does not resolve when playback merely starts; it resolves after onend', async () => {
    autoEnd = false
    let settled = false
    const pending = tts.speak('Wait until I finish.', { language: 'en', role: 'exercise_en' })
      .then((result) => { settled = true; return result })
    await Promise.resolve()
    expect(spoken).toHaveLength(1)
    expect(settled).toBe(false)
    spoken[0].onend()
    const result = await pending
    expect(result).toMatchObject({ ok: true, engine: 'system', playback_state: 'ended' })
  })
})
