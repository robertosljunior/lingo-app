// catalog-scale.test.js — Slice V2.21-R3c §13.
//
// The permanent guard that the planner is a CATALOGUE-EXTENSIBLE system, not a
// three-pack system that happens to work. V2.22 (Collocation Foundation) and
// everything after it add packs; this test is what stops a pack addition from
// silently reopening the progression problem PR #52 left behind, where the same
// successful learner reached controlled production at 3 and 6 packs and fell
// back to a recognition-dominated run at 9.
//
// It deliberately asserts more than `controlled > 0` (§13):
//   - no recognition-only collapse, and the ladder actually advances;
//   - no target camping;
//   - no unbounded active-target count (§23: the active frontier must NOT grow
//     with the catalogue);
//   - no unbounded introduction ratio.
//
// The extra packs are synthetic clones built by the harness only — the product
// registry is untouched, and no synthetic pack is reachable by the app.

import { describe, it, expect } from 'vitest'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { buildSyntheticScaleRegistryV2, SYNTHETIC_SCALE_PACK_COUNTS } from './synthetic-scale-catalog.js'
import { CAPABILITY_LADDER } from './capability-entry.js'
import { mergeStudyPlannerPolicyV2 } from './study-planner-contracts.js'

const CONTROLLED = CAPABILITY_LADDER.indexOf('controlled_production')
const WORKING_SET_SIZE = mergeStudyPlannerPolicyV2({}).limits.working_set_size

async function runAt(packCount) {
  const registry = buildSyntheticScaleRegistryV2(packCount)
  const result = await runSimulationV2(buildStandardScenarioV2('real-successful-60'), { registry })

  const deepest = new Map()
  const capabilities = {}
  const targetCounts = new Map()
  const activeSeries = []
  let introductions = 0
  for (const it of result.interactions) {
    const target = it.target.target_id
    const depth = CAPABILITY_LADDER.indexOf(it.capability)
    if (depth > (deepest.get(target) ?? -1)) deepest.set(target, depth)
    capabilities[it.capability] = (capabilities[it.capability] || 0) + 1
    targetCounts.set(target, (targetCounts.get(target) || 0) + 1)
    if (it.study_focus.is_new_target) introductions += 1
    activeSeries.push([...deepest.values()].filter((d) => d < CONTROLLED).length)
  }
  const total = result.interactions.length
  return {
    packs: packCount,
    total,
    capabilities,
    exposed: targetCounts.size,
    introductions,
    introduction_ratio: introductions / total,
    top_target_share: Math.max(...targetCounts.values()) / total,
    active_max: Math.max(...activeSeries),
  }
}

describe('§11/§13 — the planner survives a growing catalogue', () => {
  const points = []

  it.each(SYNTHETIC_SCALE_PACK_COUNTS)('%i packs: the ladder does not collapse', async (packCount) => {
    const run = await runAt(packCount)
    points.push(run)

    // §11 — never back to { recognition: 60 }: comprehension AND controlled
    // production must both be reached by a learner who answers correctly,
    // whatever the catalogue size. The COUNTS may legitimately differ between
    // 3 and 12 packs; their presence may not.
    expect(Object.keys(run.capabilities).sort()).not.toEqual(['recognition'])
    expect(run.capabilities.comprehension || 0).toBeGreaterThan(0)
    expect(run.capabilities.controlled_production || 0).toBeGreaterThan(0)

    // §10/§13 — no target camping. The product catalogue holds the stated
    // bound; a synthetic catalogue is allowed to concentrate somewhat more
    // (fewer targets carry current work at once), but never to the point where
    // one target owns half the session.
    expect(run.top_target_share).toBeLessThan(packCount === 3 ? 0.35 : 0.45)

    // §13/§23 — the active frontier is BOUNDED, and bounded by the working set
    // rather than by the catalogue. This is the assertion that would have
    // caught the R3b defect: it grew 9 → 19 → 23 as packs were added.
    expect(run.active_max).toBeLessThanOrEqual(WORKING_SET_SIZE)

    // §13 — no unbounded introduction ratio: opening new targets must not take
    // over the session as the catalogue grows.
    expect(run.introduction_ratio).toBeLessThan(0.2)
  }, 120000)

  it('breadth does not grow with the catalogue (§23)', () => {
    expect(points.length).toBe(SYNTHETIC_SCALE_PACK_COUNTS.length)
    const base = points.find((p) => p.packs === 3)
    for (const p of points) {
      // Four times the catalogue must not mean more simultaneous knowledge.
      // R3b: 3 packs → 9 exposed, 12 packs → 23. The frontier, not the
      // registry, decides how much is open at once.
      expect(p.exposed).toBeLessThanOrEqual(base.exposed + 2)
      expect(p.introductions).toBeLessThanOrEqual(base.introductions + 2)
    }
  })
})

describe('§3 — the synthetic harness stays out of the product', () => {
  it('a 3-pack scale registry IS the real catalogue', async () => {
    const { loadPedagogyV2Registry } = await import('./registry.js')
    expect(buildSyntheticScaleRegistryV2(3).pack_ids).toEqual(loadPedagogyV2Registry().pack_ids)
  })

  it('synthetic packs are only ever created on request', async () => {
    const { BUILTIN_PEDAGOGY_V2_PACKS } = await import('../../content/pedagogy-v2/index.js')
    expect(BUILTIN_PEDAGOGY_V2_PACKS.every((p) => !/_sg\d+$/.test(p.manifest.pack_id))).toBe(true)
    expect(buildSyntheticScaleRegistryV2(12).pack_ids.filter((id) => /_sg\d+$/.test(id)).length).toBe(9)
  })
})
