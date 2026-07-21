// pedagogy-v2-playground.test.jsx — UI-level guarantees for the Slice V2.12
// Pedagogy V2 Playground shell (§25): the diagnostics gate, the three modes,
// the pipeline badge and the session/target/sandbox setup surfaces. Interactive
// flows (answering, assessment, sandbox re-evaluation, evidence isolation) are
// covered end to end by e2e/pedagogy-v2-playground.spec.js.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { playgroundEnabled } from './PedagogyV2Playground.jsx'

const noop = () => {}

function mockApp({ diagnostics = true } = {}) {
  vi.doMock('../store.jsx', () => ({
    SCREENS: { HOME: 'home', PEDAGOGY_V2_PILOT: 'pedagogy_v2_pilot', PEDAGOGY_V2_PLAYGROUND: 'pedagogy_v2_playground' },
    useApp: () => ({
      settings: { pedagogy_v2_diagnostics_enabled: diagnostics },
      activeProfile: 'p1',
      db: {
        getLearnerTargetStatesV2: async () => [],
        getLearnerEvidenceV2: async () => [],
        recordLearnerEvidenceBatchV2: async () => ({ recorded: [], skipped: [], state_keys: [] }),
      },
      setTab: noop, back: noop, navigate: noop, showToast: noop,
    }),
  }))
}

async function render(opts) {
  mockApp(opts)
  const { default: Screen } = await import('./PedagogyV2Playground.jsx')
  return renderToStaticMarkup(<Screen />)
}

afterEach(() => {
  vi.doUnmock('../store.jsx')
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('§1/§25.1–2 — diagnostics gate', () => {
  it('playgroundEnabled is on in dev regardless of the flag', () => {
    vi.stubEnv('DEV', true)
    expect(playgroundEnabled({ pedagogy_v2_diagnostics_enabled: false })).toBe(true)
  })
  it('playgroundEnabled is on outside dev when the flag is set', () => {
    vi.stubEnv('DEV', false)
    expect(playgroundEnabled({ pedagogy_v2_diagnostics_enabled: true })).toBe(true)
  })
  it('1: with diagnostics OFF and not in dev the Playground is unavailable', async () => {
    vi.stubEnv('DEV', false)
    const html = await render({ diagnostics: false })
    expect(html).toContain('v2pg-unavailable')
    expect(html).not.toContain('v2pg-screen')
  })
  it('2: with diagnostics ON the Playground is available', async () => {
    vi.stubEnv('DEV', false)
    const html = await render({ diagnostics: true })
    expect(html).toContain('v2pg-screen')
    expect(html).not.toContain('v2pg-unavailable')
  })
})

describe('§20 — pipeline badge & modes', () => {
  it('shows the "Pipeline: Pedagogy V2" badge', async () => {
    vi.stubEnv('DEV', true)
    const html = await render()
    expect(html).toContain('v2pg-pipeline-badge')
    expect(html).toContain('Pipeline: Pedagogy V2')
  })

  it('§3 — offers the three modes', async () => {
    vi.stubEnv('DEV', true)
    const html = await render()
    expect(html).toContain('v2pg-mode-session')
    expect(html).toContain('v2pg-mode-target')
    expect(html).toContain('v2pg-mode-sandbox')
    expect(html).toContain('Sessão V2')
    expect(html).toContain('Testar target')
    expect(html).toContain('Sandbox de avaliação')
  })
})

describe('§4 — Sessão V2 setup', () => {
  it('renders the study-mode and pack selectors (packs from the registry)', async () => {
    vi.stubEnv('DEV', true)
    const html = await render()
    expect(html).toContain('v2pg-session-mode')
    expect(html).toContain('v2pg-session-pack')
    expect(html).toContain('Iniciar sessão')
    // packs come from the registry, not hardcoded pack strings in the component
    expect(html).toMatch(/pedagogy_v2_(still|but|yet)/)
    expect(html).toContain('still')
    expect(html).toContain('but')
    expect(html).toContain('yet')
  })

  it('never claims a global mastery or a CEFR level', async () => {
    vi.stubEnv('DEV', true)
    const html = await render()
    expect(html).not.toMatch(/mastery global|global mastery|\bCEFR\b|\bA1\b|\bB2\b/i)
  })
})
