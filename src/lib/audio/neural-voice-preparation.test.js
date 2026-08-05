import { beforeEach, describe, expect, it, vi } from 'vitest'

const piperMock = vi.hoisted(() => ({
  piperSupported: true,
  storedVoices: vi.fn(async () => []),
  downloadVoice: vi.fn(async (_voiceId, onProgress) => { onProgress?.(25); onProgress?.(100) }),
}))

vi.mock('./tts-piper.js', () => piperMock)
vi.mock('./tts.js', () => ({ PRIMARY_ENGLISH_PIPER_VOICE_ID: 'en_US-reza_ibrahim-medium' }))

function installBrowser({ online = true, e2e = null } = {}) {
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
  globalThis.window = {
    __LINGO_E2E__: e2e,
    dispatchEvent: vi.fn(),
  }
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail } }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: online } })
}

describe('automatic English neural voice preparation', () => {
  beforeEach(() => {
    piperMock.storedVoices.mockReset().mockResolvedValue([])
    piperMock.downloadVoice.mockReset().mockImplementation(async (_voiceId, onProgress) => { onProgress?.(25); onProgress?.(100) })
    installBrowser()
    vi.resetModules()
  })

  it('downloads Reza first and Cori second, publishing real progress', async () => {
    const prep = await import('./neural-voice-preparation.js')
    const states = []
    const result = await prep.preparePriorityEnglishVoices({ onState: (state) => states.push(state) })
    expect(piperMock.downloadVoice.mock.calls.map(([voiceId]) => voiceId)).toEqual([
      'en_US-reza_ibrahim-medium',
      'en_GB-cori-medium',
    ])
    expect(states.some((state) => state.current_voice_id === 'en_US-reza_ibrahim-medium' && state.status === 'downloading')).toBe(true)
    expect(states.some((state) => state.current_voice_id === 'en_GB-cori-medium' && state.primary_ready)).toBe(true)
    expect(result).toMatchObject({ status: 'ready', progress: 100, primary_ready: true })
  })

  it('waits offline without attempting a download', async () => {
    installBrowser({ online: false })
    vi.resetModules()
    const prep = await import('./neural-voice-preparation.js')
    const result = await prep.preparePriorityEnglishVoices()
    expect(result).toMatchObject({ status: 'waiting', error_code: 'OFFLINE' })
    expect(piperMock.downloadVoice).not.toHaveBeenCalled()
  })

  it('does no network work in ordinary E2E runs unless a voice state is requested', async () => {
    installBrowser({ e2e: {} })
    vi.resetModules()
    const prep = await import('./neural-voice-preparation.js')
    const result = await prep.preparePriorityEnglishVoices()
    expect(result.status).toBe('disabled')
    expect(piperMock.downloadVoice).not.toHaveBeenCalled()
  })

  it('reports a deterministic ready state for the RX-7 browser test hook', async () => {
    installBrowser({ e2e: { voicePreparation: { mode: 'ready' } } })
    vi.resetModules()
    const prep = await import('./neural-voice-preparation.js')
    const result = await prep.preparePriorityEnglishVoices()
    expect(result).toMatchObject({ status: 'ready', progress: 100, primary_ready: true })
    expect(result.ready_voice_ids).toEqual(['en_US-reza_ibrahim-medium', 'en_GB-cori-medium'])
  })
})
