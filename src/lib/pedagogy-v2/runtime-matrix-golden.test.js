// runtime-matrix-golden.test.js — §34 tests 11–14 + §30 runtime goldens
// (Slice V2.10). The seven personas run under the four runtime profiles with
// the same seeds; no runtime may ever produce an impossible focus (the runner
// halts on any invariant), and each profile's trajectory uses exactly the
// modalities that runtime can execute — writing becomes the production entry
// without a microphone, reading carries recognition without audio, and nothing
// is flagged as starved for a modality the runtime cannot run.

import { describe, it, expect, beforeAll } from 'vitest'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2, STANDARD_SCENARIO_IDS } from './simulation-scenarios.js'
import { computePedagogicalMetricsV2 } from './pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
const PROFILES = {
  full: { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false },
  'text-first': { text_input: true, audio_output: true, speech_input: false, semantic_assessment: true, pronunciation_assessment: false },
  'no-audio': { text_input: true, audio_output: false, speech_input: true, semantic_assessment: true, pronunciation_assessment: false },
  'text-only': { text_input: true, audio_output: false, speech_input: false, semantic_assessment: true, pronunciation_assessment: false },
}

describe('§34.11–14 — every persona runs clean under every runtime profile', () => {
  // The runner halts on ANY invariant (impossible focus, unavailable-domain
  // focus, silent entry starvation) — completing the run IS the assertion.
  for (const [profileName, caps] of Object.entries(PROFILES)) {
    it(`${profileName}: all 7 personas complete with zero grave findings and only executable modalities`, async () => {
      for (const id of STANDARD_SCENARIO_IDS) {
        const r = await runSimulationV2(buildStandardScenarioV2(id, { runtime_capabilities: caps, maximum_interactions: 60 }), { registry })
        const { trajectory } = analyzeTrajectoryV2(r, { registry })
        expect(trajectory.grave_findings).toBe(0)
        const modalities = new Set(r.interactions.map((it) => it.modality))
        if (!caps.speech_input) expect(modalities.has('speaking')).toBe(false)
        if (!caps.audio_output) expect(modalities.has('listening')).toBe(false)
      }
    }, 60000)
  }
})

describe('§30 — text-first fast learner (no microphone)', () => {
  let r
  beforeAll(async () => {
    r = await runSimulationV2(buildStandardScenarioV2('fast-learner', { runtime_capabilities: PROFILES['text-first'] }), { registry })
  })

  it('writing becomes the production ENTRY modality', () => {
    const production = r.interactions.filter((it) => ['controlled_production', 'free_production'].includes(it.capability))
    expect(production.length).toBeGreaterThan(0)
    expect(production.every((it) => it.modality === 'writing')).toBe(true)
  })

  it('no false starvation for the unavailable speaking modality', () => {
    const { findings } = analyzeTrajectoryV2(r, { registry })
    expect(findings.some((f) => f.code === 'MODALITY_STARVATION' && f.details.modality === 'speaking')).toBe(false)
  })

  it('the entry candidates carry the runtime-aware reason codes', () => {
    const entry = r.interactions.find((it) => (it.study_focus?.reason_codes || []).includes('PREFERRED_MODALITY_RUNTIME_UNAVAILABLE'))
    expect(entry).toBeTruthy()
    expect(entry.study_focus.reason_codes).toContain('RUNTIME_AWARE_CAPABILITY_ENTRY')
  })
})

describe('§30 — no-audio learner', () => {
  it('reading keeps working; unavailable listening is never flagged as starved', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('new-learner', { runtime_capabilities: PROFILES['no-audio'] }), { registry })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.modality_balance.counts.reading).toBeGreaterThan(0)
    expect(m.modality_balance.counts.listening).toBe(0)
    const { findings } = analyzeTrajectoryV2(r, { registry })
    expect(findings.some((f) => f.code === 'MODALITY_STARVATION' && f.details.modality === 'listening')).toBe(false)
  })
})

describe('§30 — full runtime keeps both production modalities reachable', () => {
  it('fast-learner practices both writing and speaking production', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('fast-learner', { runtime_capabilities: PROFILES.full }), { registry })
    const production = r.interactions.filter((it) => ['controlled_production', 'free_production'].includes(it.capability))
    const mods = new Set(production.map((it) => it.modality))
    expect(mods.has('writing')).toBe(true)
    expect(mods.has('speaking')).toBe(true)
  })
})

describe('§13 — the runtime profile matrix is recordable per persona × profile', () => {
  it('produces per-domain eligible/selected/evidence facts without any global mastery', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('struggling', { runtime_capabilities: PROFILES['text-only'], maximum_interactions: 80 }), { registry })
    const m = computePedagogicalMetricsV2(r, { registry })
    for (const [dom, o] of Object.entries(m.opportunity_coverage)) {
      expect(o.eligible_opportunities).toBeGreaterThanOrEqual(o.selected_opportunities)
      expect(dom.includes('speaking') || dom.includes('listening')).toBe(false) // text-only never offers them
    }
    expect(JSON.stringify(m)).not.toMatch(/global_mastery|overall_mastery/)
  })
})
