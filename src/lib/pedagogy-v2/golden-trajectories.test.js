// golden-trajectories.test.js — §27. Seven golden journeys (≥50 interactions
// each) through the REAL pedagogical pipeline. These assert TRUE, structurally
// guaranteed properties of the current V2 system — NOT aspirational deep-
// capability progression. They intentionally also PIN the documented systemic
// findings (support trap + modality starvation) so that when V2.8 changes the
// planner weights the goldens flip and force a conscious re-baseline. No weight
// is tuned here (see docs/pedagogy-v2-observability.md §22).

import { describe, it, expect, beforeAll } from 'vitest'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2, STANDARD_SCENARIO_IDS } from './simulation-scenarios.js'
import { computePedagogicalMetricsV2 } from './pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import { resolvePedagogyEntity, loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
const results = new Map()

beforeAll(async () => {
  for (const id of STANDARD_SCENARIO_IDS) {
    results.set(id, await runSimulationV2(buildStandardScenarioV2(id), { registry }))
  }
})

describe('§27 — the seven goldens run to completion with no invariant violation', () => {
  for (const id of STANDARD_SCENARIO_IDS) {
    it(`${id}: reaches ≥50 interactions, all targets resolve, no global mastery leaks`, () => {
      const r = results.get(id)
      expect(r.interactions.length).toBeGreaterThanOrEqual(50)
      expect(r.result_version).toBe(1)
      // Every final-state target id resolves in the registry and is a typed V2 id.
      for (const s of r.final_learner_states) {
        expect(s.target.target_id).toContain(':')
        expect(resolvePedagogyEntity(s.target.target_id, registry)).toBeTruthy()
        // No forbidden global-mastery field on any state.
        for (const k of ['mastery', 'global_mastery', 'overall_mastery', 'lexeme_mastery']) {
          expect(s).not.toHaveProperty(k)
        }
      }
      // The runner records the invariant set it checked, with no violations.
      expect(r.invariants.violations).toEqual([])
    })
  }
})

describe('§27 — structural guarantees hold for every golden', () => {
  for (const id of STANDARD_SCENARIO_IDS) {
    it(`${id}: new-item budget respected, isolation is a rate, zero grave findings`, () => {
      const r = results.get(id)
      const m = computePedagogicalMetricsV2(r, { registry })
      const { trajectory } = analyzeTrajectoryV2(r, { registry })
      // New-item budget: no activity introduces more than the engine's budget.
      expect(m.new_item_load.per_activity_max).toBeLessThanOrEqual(2)
      // Target isolation is a well-formed rate.
      expect(m.target_isolation_rate.rate).toBeGreaterThanOrEqual(0)
      expect(m.target_isolation_rate.rate).toBeLessThanOrEqual(1)
      // No GRAVE (invariant-violation) finding is ever produced by a real run.
      expect(trajectory.grave_findings).toBe(0)
    })
  }
})

describe('§27 — recognition before production (the engine never front-runs production)', () => {
  for (const id of STANDARD_SCENARIO_IDS) {
    it(`${id}: no free production of a target precedes its controlled production`, () => {
      const r = results.get(id)
      const { findings } = analyzeTrajectoryV2(r, { registry })
      expect(findings.filter((f) => f.code === 'PREMATURE_FREE_PRODUCTION')).toEqual([])
      // Recognition is exercised in every journey.
      expect(r.interactions.some((it) => it.capability === 'recognition')).toBe(true)
    })
  }
})

describe('§27 — adaptive journeys reach both packs (interleaving is real)', () => {
  for (const id of STANDARD_SCENARIO_IDS) {
    it(`${id}: the pack history covers both authored packs`, () => {
      const r = results.get(id)
      const packs = new Set(r.pack_history)
      expect(packs.size).toBe(2)
      for (const p of registry.pack_ids) expect(packs.has(p)).toBe(true)
    })
  }
})

describe('§27 — documented systemic finding is pinned (recognition support trap)', () => {
  // The merged V2.6 planner keeps generating independence focuses for
  // recognition/comprehension (which have no independent engine variant), so the
  // independent lane never builds and higher modalities go unpracticed. This is
  // a FINDING for V2.8, not a bug fixed here — pinning it makes any future
  // planner change deliberate. See docs/pedagogy-v2-observability.md §22.
  for (const id of STANDARD_SCENARIO_IDS) {
    it(`${id}: surfaces SUPPORT_TRAP and MODALITY_STARVATION warnings`, () => {
      const r = results.get(id)
      const { findings } = analyzeTrajectoryV2(r, { registry })
      const codes = new Set(findings.map((f) => f.code))
      expect(codes.has('SUPPORT_TRAP')).toBe(true)
      expect(codes.has('MODALITY_STARVATION')).toBe(true)
      // And none of them is severity error.
      expect(findings.filter((f) => ['SUPPORT_TRAP', 'MODALITY_STARVATION'].includes(f.code)).every((f) => f.severity === 'warning')).toBe(true)
    })
  }
})
