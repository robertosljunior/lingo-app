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

describe('§27 — adaptive journeys reach every pack (interleaving is real)', () => {
  // Slice V2.11: three packs — every persona\'s journey covers ALL of them,
  // with the planner discovering `yet` purely through the registry.
  for (const id of STANDARD_SCENARIO_IDS) {
    it(`${id}: the pack history covers all authored packs`, () => {
      const r = results.get(id)
      const packs = new Set(r.pack_history)
      expect(packs.size).toBe(registry.pack_ids.length)
      for (const p of registry.pack_ids) expect(packs.has(p)).toBe(true)
    })
  }
})

describe('§27 (Slice V2.8) — the recognition independence loop is broken', () => {
  // V2.7 pinned the systemic finding: recognition/comprehension independence
  // focuses served as supported activities, trapping every persona in
  // recognition. V2.8 fixed the structural mismatch (training-affordances +
  // engine invariant). These goldens now pin the CORRECTED behavior: no
  // independence focus ever produces a supported activity, and journeys
  // progress up the capability ladder past recognition.
  // With the three-pack curriculum (Slice V2.11) the short-horizon personas
  // (weak-listener 80, forgetful 60) legitimately spend their whole window on
  // recognition BREADTH across more targets — persona-coherent, not the V2.7
  // loop (which is pinned by the grave/tier assertions below for everyone).
  const DEPTH_PERSONAS = new Set(['new-learner', 'support-dependent', 'fast-learner', 'struggling', 'cross-pack'])
  for (const id of STANDARD_SCENARIO_IDS) {
    it(`${id}: no INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY, and no recognition loop`, () => {
      const r = results.get(id)
      const { findings, trajectory } = analyzeTrajectoryV2(r, { registry })
      // The V2.8 grave code is never produced by a real run (the runner would
      // have halted; the analyzer confirms none is present).
      expect(findings.some((f) => f.code === 'INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY')).toBe(false)
      expect(trajectory.grave_findings).toBe(0)
      // Every real independence focus was served UNAIDED (tier none).
      for (const it of r.interactions) {
        if (it.study_focus?.focus_type === 'independence') expect(it.support_tier).toBe('none')
      }
      // The 100-interaction personas still climb past recognition.
      if (DEPTH_PERSONAS.has(id)) {
        const caps = new Set(r.interactions.map((it) => it.capability))
        expect(caps.size).toBeGreaterThan(1)
      }
    })
  }
})
