// simulation-determinism.test.js — §28. The whole harness is deterministic:
// no Date.now, no Math.random. Re-running the same scenario yields a byte-equal
// result; the clock is a pure function of the interaction index; only the seed
// (and the scenario) can change the outcome; and the metrics/analyzer over a
// fixed result are themselves deterministic.

import { describe, it, expect } from 'vitest'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { createSimulationScenarioV2 } from './simulation-contracts.js'
import { computePedagogicalMetricsV2 } from './pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
const scenario = (over) => createSimulationScenarioV2({ scenario_id: 'det', persona: 'new-learner', seed: 's', maximum_interactions: 40, ...over })

describe('§28.1 — the same scenario re-runs byte-identically', () => {
  it('two runs produce a deeply-equal SimulationResultV2', async () => {
    const a = await runSimulationV2(scenario(), { registry })
    const b = await runSimulationV2(scenario(), { registry })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('§28.2 — histories and evidence ids are stable across runs', () => {
  it('target/pack history and generated evidence ids repeat exactly', async () => {
    const a = await runSimulationV2(scenario(), { registry })
    const b = await runSimulationV2(scenario(), { registry })
    expect(a.target_history).toEqual(b.target_history)
    expect(a.pack_history).toEqual(b.pack_history)
    expect(a.evidence_generated.map((e) => e.evidence_id)).toEqual(b.evidence_generated.map((e) => e.evidence_id))
  })
})

describe('§28.3 — the simulated clock is a pure function of the index', () => {
  it('timestamps depend only on start_at + clock, never on wall time', async () => {
    const a = await runSimulationV2(scenario({ start_at: '2026-03-01T08:00:00.000Z' }), { registry })
    // First interaction is exactly at start_at; steps are the fixed interval.
    expect(a.interactions[0].timestamp).toBe('2026-03-01T08:00:00.000Z')
    const step = Date.parse(a.interactions[1].timestamp) - Date.parse(a.interactions[0].timestamp)
    expect(step).toBe(5 * 60 * 1000)
    // Re-running still lands on the very same instants.
    const b = await runSimulationV2(scenario({ start_at: '2026-03-01T08:00:00.000Z' }), { registry })
    expect(a.interactions.map((i) => i.timestamp)).toEqual(b.interactions.map((i) => i.timestamp))
  })
})

describe('§28.4 — only the seed (or scenario) changes the outcome', () => {
  it('a different seed changes the success draws / trajectory', async () => {
    const a = await runSimulationV2(scenario({ seed: 'seed-A' }), { registry })
    const b = await runSimulationV2(scenario({ seed: 'seed-B' }), { registry })
    const succA = a.interactions.map((i) => i.response.intended_success)
    const succB = b.interactions.map((i) => i.response.intended_success)
    expect(succA).not.toEqual(succB)
  })
})

describe('§28.5 — metrics and analyzer over a fixed result are deterministic', () => {
  it('recomputing metrics and findings yields identical output', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('struggling', { maximum_interactions: 50 }), { registry })
    expect(JSON.stringify(computePedagogicalMetricsV2(r, { registry }))).toBe(JSON.stringify(computePedagogicalMetricsV2(r, { registry })))
    expect(JSON.stringify(analyzeTrajectoryV2(r, { registry }))).toBe(JSON.stringify(analyzeTrajectoryV2(r, { registry })))
  })
})
