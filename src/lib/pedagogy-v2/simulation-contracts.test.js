// simulation-contracts.test.js — §23. The SimulationScenarioV2 contract:
// explicit seed / time / persona, sane bounds, deterministic serialization and
// the three pure simulated-clock strategies (never the wall clock).

import { describe, it, expect } from 'vitest'
import {
  SIMULATION_SCENARIO_VERSION, SIMULATION_RESULT_VERSION, CLOCK_STRATEGIES,
  createSimulationScenarioV2, validateSimulationScenarioV2, serializeScenarioV2, simulatedTimestamp,
} from './simulation-contracts.js'

const START = Date.UTC(2026, 0, 5, 9, 0, 0)

describe('§23.1 — createSimulationScenarioV2 fills reproducible defaults', () => {
  it('carries version, explicit seed, explicit time, a clock and default capabilities', () => {
    const s = createSimulationScenarioV2({ scenario_id: 'x', persona: 'new-learner' })
    expect(s.scenario_version).toBe(SIMULATION_SCENARIO_VERSION)
    expect(typeof s.seed).toBe('string')
    expect(Date.parse(s.start_at)).not.toBeNaN()
    expect(CLOCK_STRATEGIES).toContain(s.clock.strategy)
    expect(s.maximum_interactions).toBeGreaterThan(0)
    // Pronunciation assessment off by default (privacy/runtime).
    expect(s.runtime_capabilities.pronunciation_assessment).toBe(false)
    expect(SIMULATION_RESULT_VERSION).toBe(1)
  })
})

describe('§23.2 — a well-formed scenario validates', () => {
  it('accepts a complete adaptive scenario with a known persona', () => {
    const s = createSimulationScenarioV2({ scenario_id: 'ok', persona: 'new-learner' })
    expect(validateSimulationScenarioV2(s)).toEqual({ valid: true, errors: [] })
  })
})

describe('§23.3 — the validator enforces explicit seed / time / persona', () => {
  it('rejects a missing seed, bad time, unknown persona, bad mode and bad bounds', () => {
    const bad = createSimulationScenarioV2({
      scenario_id: 'bad', persona: 'nope', seed: null, start_at: 'not-a-date',
      mode: 'nonsense', maximum_interactions: 0, clock: { strategy: 'wall_clock' },
    })
    const { valid, errors } = validateSimulationScenarioV2(bad)
    expect(valid).toBe(false)
    expect(errors.some((e) => e.startsWith('SEED_REQUIRED'))).toBe(true)
    expect(errors.some((e) => e.startsWith('START_AT_INVALID'))).toBe(true)
    expect(errors.some((e) => e.startsWith('PERSONA_INVALID'))).toBe(true)
    expect(errors.some((e) => e.startsWith('MODE_INVALID'))).toBe(true)
    expect(errors.some((e) => e.startsWith('MAX_INTERACTIONS_INVALID'))).toBe(true)
    expect(errors.some((e) => e.startsWith('CLOCK_STRATEGY_INVALID'))).toBe(true)
  })

  it('focused mode requires an explicit focused pack', () => {
    const s = createSimulationScenarioV2({ scenario_id: 'f', persona: 'new-learner', mode: 'focused' })
    expect(validateSimulationScenarioV2(s).errors).toContain('FOCUSED_PACK_REQUIRED')
  })
})

describe('§23.4 — serialization is canonical and deterministic', () => {
  it('two structurally-equal scenarios serialize byte-identically regardless of key order', () => {
    const a = createSimulationScenarioV2({ scenario_id: 'z', persona: 'new-learner', seed: 's1' })
    const b = createSimulationScenarioV2({ seed: 's1', persona: 'new-learner', scenario_id: 'z' })
    expect(serializeScenarioV2(a)).toBe(serializeScenarioV2(b))
  })
})

describe('§23.5 — simulated clocks are pure functions of the interaction index', () => {
  it('constant_interval advances by a fixed step', () => {
    const clock = { strategy: 'constant_interval', interval_minutes: 5 }
    expect(simulatedTimestamp(START, clock, 0)).toBe(new Date(START).toISOString())
    expect(simulatedTimestamp(START, clock, 2)).toBe(new Date(START + 2 * 5 * 60000).toISOString())
    // Pure: recomputing the same index gives the same instant.
    expect(simulatedTimestamp(START, clock, 7)).toBe(simulatedTimestamp(START, clock, 7))
  })

  it('accelerated_days interpolates days piecewise-linearly and is monotonic', () => {
    const clock = { strategy: 'accelerated_days', checkpoints: [[0, 0], [10, 2], [30, 7]] }
    const t0 = Date.parse(simulatedTimestamp(START, clock, 0))
    const t10 = Date.parse(simulatedTimestamp(START, clock, 10))
    const t30 = Date.parse(simulatedTimestamp(START, clock, 30))
    expect(t0).toBe(START)
    expect(t10).toBe(START + 2 * 86400000)
    expect(t30).toBe(START + 7 * 86400000)
    // Interpolated midpoint sits strictly between its checkpoints.
    const t5 = Date.parse(simulatedTimestamp(START, clock, 5))
    expect(t5).toBeGreaterThan(t0)
    expect(t5).toBeLessThan(t10)
  })

  it('custom_schedule reads explicit offsets and clamps past the end', () => {
    const clock = { strategy: 'custom_schedule', offsets_ms: [0, 1000, 5000] }
    expect(simulatedTimestamp(START, clock, 1)).toBe(new Date(START + 1000).toISOString())
    // Past the last offset holds the final value (no wall clock).
    expect(simulatedTimestamp(START, clock, 9)).toBe(new Date(START + 5000).toISOString())
  })
})

describe('§23.6 — the harness never reaches the pedagogical cores', () => {
  it('simulation modules are not imported by planner / engine / learner-model / runtime', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const dir = dirname(fileURLToPath(import.meta.url))
    const cores = [
      'study-planner.js', 'study-planner-contracts.js', 'lesson-engine.js',
      'lesson-engine-contracts.js', 'learner-model.js',
      'study-session-controller.js', 'review-queue.js', 'assessment-to-evidence.js',
    ]
    const forbidden = /simulation-(contracts|runner|personas|response-model|scenarios)|pedagogical-metrics|trajectory-analyzer|learner-inspector|observability-contracts/
    for (const f of cores) {
      const src = readFileSync(join(dir, f), 'utf8')
      expect(forbidden.test(src), `${f} must not import the observability/simulation layer`).toBe(false)
    }
  })
})
