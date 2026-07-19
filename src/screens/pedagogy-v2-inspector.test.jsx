// pedagogy-v2-inspector.test.jsx — §31. UI of the read-only Pedagogy V2
// Inspector (dev/diagnostics only) plus its entry point in the lab. Rendered
// with the repo's static-server rendering; interactive behavior (loading real
// state, exporting) is covered end-to-end by e2e/pedagogy-v2-inspector.spec.js.
// These tests assert the GATING, the privacy-safe export contract and that the
// inspector never renders a global-mastery claim.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { inspectorEnabled } from './PedagogyV2Inspector.jsx'
import { buildObservabilityExportV2 } from '../lib/pedagogy-v2/learner-inspector.js'

const noop = () => {}

function mockStore({ diagnostics = false, pilot = true, params = {} } = {}) {
  vi.doMock('../store.jsx', () => ({
    SCREENS: { HOME: 'home', TRAINING: 'training', PEDAGOGY_V2_PILOT: 'pedagogy_v2_pilot', PEDAGOGY_V2_INSPECTOR: 'pedagogy_v2_inspector' },
    useApp: () => ({
      settings: { pedagogy_v2_pilot_enabled: pilot, pedagogy_v2_diagnostics_enabled: diagnostics },
      activeProfile: 'p1', params,
      db: { getLearnerTargetStatesV2: async () => [], getLearnerEvidenceV2: async () => [] },
      setTab: noop, back: noop, navigate: noop, showToast: noop,
    }),
  }))
}
async function renderInspector() {
  const { default: Screen } = await import('./PedagogyV2Inspector.jsx')
  return renderToStaticMarkup(<Screen />)
}
async function renderLab() {
  const { default: Screen } = await import('./PedagogyV2Lab.jsx')
  return renderToStaticMarkup(<Screen />)
}

afterEach(() => {
  vi.doUnmock('../store.jsx')
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('§31.1 — inspectorEnabled gating', () => {
  it('is enabled in development builds regardless of the flag', () => {
    vi.stubEnv('DEV', true)
    expect(inspectorEnabled({ pedagogy_v2_diagnostics_enabled: false })).toBe(true)
  })
  it('is enabled outside dev when the diagnostics flag is on', () => {
    vi.stubEnv('DEV', false)
    expect(inspectorEnabled({ pedagogy_v2_diagnostics_enabled: true })).toBe(true)
  })
  it('is disabled outside dev with the flag off', () => {
    vi.stubEnv('DEV', false)
    expect(inspectorEnabled({ pedagogy_v2_diagnostics_enabled: false })).toBe(false)
  })
})

describe('§31.2 — the inspector is hidden when disabled', () => {
  it('renders only the unavailable notice, never the inspector screen', async () => {
    vi.stubEnv('DEV', false)
    mockStore({ diagnostics: false })
    const html = await renderInspector()
    expect(html).toContain('v2-inspector-unavailable')
    expect(html).not.toContain('v2-inspector-screen')
  })
})

describe('§31.3 — the inspector renders its diagnostic shell when enabled', () => {
  it('shows the screen, the diagnóstico eyebrow, the title and a back affordance', async () => {
    vi.stubEnv('DEV', true)
    mockStore({ diagnostics: true })
    const html = await renderInspector()
    expect(html).toContain('v2-inspector-screen')
    expect(html).toContain('diagnóstico')
    expect(html).toContain('Pedagogy V2 Inspector')
    expect(html).toContain('aria-label="Voltar"')
    // Before the async state load, a loading placeholder is shown.
    expect(html).toContain('v2-inspector-loading')
  })

  it('never renders a global-mastery claim about the word', async () => {
    vi.stubEnv('DEV', true)
    mockStore({ diagnostics: true })
    const html = await renderInspector()
    expect(html).not.toMatch(/domínio|nível|aprendida|conclu[ií]d|%/i)
  })
})

describe('§31.4 — the lab exposes the inspector only under diagnostics', () => {
  it('shows the inspector entry when diagnostics is enabled', async () => {
    vi.stubEnv('DEV', false)
    mockStore({ diagnostics: true, params: {} })
    const html = await renderLab()
    expect(html).toContain('v2-open-inspector')
    expect(html).toContain('Inspector (diagnóstico)')
  })

  it('hides the inspector entry when diagnostics is disabled and not in dev', async () => {
    vi.stubEnv('DEV', false)
    mockStore({ diagnostics: false, params: {} })
    const html = await renderLab()
    expect(html).not.toContain('v2-open-inspector')
  })
})

describe('§31.5 — the export the inspector emits is privacy-safe', () => {
  it('omits profile_id by default and exposes no learner free-text field', () => {
    // Mirrors PedagogyV2Inspector.doExport (includeProfileId: false).
    const out = buildObservabilityExportV2({
      metrics: null, trajectory: { targets: 3, review_queue: 1 }, findings: [], telemetry: null,
      policyVersions: { study_planner_policy: 1, observability_policy: 1 }, registryVersion: 1,
      includeProfileId: false,
    })
    expect(out).not.toHaveProperty('profile_id')
    const json = JSON.stringify(out)
    expect(json).not.toMatch(/transcript|answer_text|response_text/)
  })
})

describe('§31.6 — the inspector source carries no global-mastery vocabulary', () => {
  it('the component never claims a single mastery number for a word', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'PedagogyV2Inspector.jsx'), 'utf8')
    // It reads per-lane mastery_estimate (allowed) but must not invent a global one.
    expect(/global_mastery|lexeme_mastery|overall_mastery\b/.test(src)).toBe(false)
  })
})
