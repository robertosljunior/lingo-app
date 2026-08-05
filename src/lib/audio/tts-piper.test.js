import { beforeEach, describe, expect, it, vi } from 'vitest'

const piperMock = vi.hoisted(() => ({
  stored: vi.fn(async () => ['en_US-reza_ibrahim-medium']),
  download: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  predict: vi.fn(async () => new Blob(['audio'], { type: 'audio/wav' })),
}))

vi.mock('@mintplex-labs/piper-tts-web', () => piperMock)

let lastAudio = null

class FakeAudio {
  constructor(src) {
    this.src = src
    this.playbackRate = 1
    this.onended = null
    this.onerror = null
    this.onabort = null
    this.paused = false
    lastAudio = this
  }
  play() { return Promise.resolve() }
  pause() { this.paused = true }
}

function installBrowser() {
  lastAudio = null
  const cache = { match: vi.fn(async () => null), put: vi.fn(async () => {}), keys: vi.fn(async () => []), delete: vi.fn(async () => true) }
  globalThis.window = { __LINGO_E2E__: { ttsEvents: [] } }
  globalThis.Worker = class {}
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { getDirectory: () => ({}) } } })
  globalThis.caches = { open: vi.fn(async () => cache) }
  globalThis.Audio = FakeAudio
  Object.defineProperty(globalThis.URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:voice') })
  Object.defineProperty(globalThis.URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
}

describe('Piper playback lifecycle', () => {
  beforeEach(() => {
    installBrowser()
    piperMock.stored.mockReset().mockResolvedValue(['en_US-reza_ibrahim-medium'])
    piperMock.predict.mockReset().mockResolvedValue(new Blob(['audio'], { type: 'audio/wav' }))
    vi.resetModules()
  })

  it('stays pending after audio.play and resolves only on onended', async () => {
    const piper = await import('./tts-piper.js')
    let settled = false
    const pending = piper.speak('I am still here.', { voiceId: 'en_US-reza_ibrahim-medium' })
      .then((result) => { settled = true; return result })
    await vi.waitFor(() => expect(lastAudio).toBeTruthy())
    await Promise.resolve()
    expect(settled).toBe(false)
    lastAudio.onended()
    const result = await pending
    expect(result).toMatchObject({ ok: true, engine: 'piper', playback_state: 'ended' })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice')
  })

  it('stop interrupts and settles the active playback without starting fallback', async () => {
    const piper = await import('./tts-piper.js')
    const pending = piper.speak('This is a longer sentence.', { voiceId: 'en_US-reza_ibrahim-medium' })
    await vi.waitFor(() => expect(lastAudio).toBeTruthy())
    expect(piper.stop()).toBe(true)
    const result = await pending
    expect(result).toMatchObject({ ok: false, code: 'TTS_INTERRUPTED', engine: 'piper' })
    expect(lastAudio.paused).toBe(true)
  })

  it('never downloads from a speaker action when the model is absent', async () => {
    piperMock.stored.mockResolvedValue([])
    const piper = await import('./tts-piper.js')
    const result = await piper.speak('Use the honest fallback.', { voiceId: 'en_US-reza_ibrahim-medium' })
    expect(result).toMatchObject({ ok: false, code: 'PIPER_MODEL_NOT_INSTALLED' })
    expect(piperMock.download).not.toHaveBeenCalled()
    expect(lastAudio).toBeNull()
  })
})
