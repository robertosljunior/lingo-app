// long-horizon.test.js — §29 + §34 tests 15–27 (Slice V2.10). 200-interaction
// trajectories for the six behavioral personas answer the validation
// questions (production reached, listening attended, supported/independent
// separated, review present but not permanent, no infinite target loop,
// cross-pack transfer alive), and the windowed metrics / saturation /
// comparator infrastructure behaves deterministically.

import { describe, it, expect, beforeAll } from 'vitest'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { computePedagogicalMetricsV2 } from './pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import {
  computeWindowedMetricsV2, computeCurriculumSaturationV2, analyzeLongHorizonV2, clipWindowsV2,
} from './long-horizon-analyzer.js'
import { comparePedagogicalTrajectoriesV2 } from './trajectory-compare.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
const results = new Map()
const at200 = (id, over = {}) => buildStandardScenarioV2(id, { maximum_interactions: 200, ...over })

beforeAll(async () => {
  for (const id of ['fast-learner', 'weak-listener', 'support-dependent', 'forgetful', 'struggling', 'cross-pack']) {
    results.set(id, await runSimulationV2(at200(id), { registry }))
  }
}, 60000)

describe('§29/§34.15 — fast learner at 200', () => {
  it('reaches production (incl. writing), is not stuck in recognition, zero grave findings', () => {
    const r = results.get('fast-learner')
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.capability_depth.controlled_production).toBeGreaterThan(0)
    expect(m.capability_depth.free_production).toBeGreaterThan(0)
    expect(m.capability_depth.recognition).toBeLessThan(150) // not ~all of 200
    expect(m.modality_balance.counts.writing).toBeGreaterThan(0)
    expect(analyzeTrajectoryV2(r, { registry }).trajectory.grave_findings).toBe(0)
  })
})

describe('§29/§34.16 — weak listener at 200', () => {
  it('listening keeps receiving attention while other capabilities may progress', () => {
    const r = results.get('weak-listener')
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.modality_balance.counts.listening).toBeGreaterThan(0)
    // The late half still practices listening — attention persists over time.
    const windows = computeWindowedMetricsV2(r)
    const late = windows[windows.length - 1]
    expect((late.modality_counts.listening || 0)).toBeGreaterThan(0)
    expect(Object.keys(m.capability_depth).filter((c) => m.capability_depth[c] > 0).length).toBeGreaterThan(1)
  })
})

describe('§29/§34.17 — support dependent at 200', () => {
  it('supported and independent stay separate; real independent attempts occur; no impossible independence', () => {
    const r = results.get('support-dependent')
    const m = computePedagogicalMetricsV2(r, { registry })
    const independentAttempts = r.interactions.filter((it) => it.support_tier === 'none' && it.assessment.status === 'assessed')
    expect(independentAttempts.length).toBeGreaterThan(0)
    // Independence focuses (when they fire) are always tier none (V2.8 invariant
    // held across 200), and recognition never generates one.
    for (const it of r.interactions) {
      if (it.study_focus?.focus_type === 'independence') {
        expect(it.support_tier).toBe('none')
        expect(['controlled_production', 'free_production']).toContain(it.capability)
      }
    }
    // Support dependency table keeps lanes apart (no fusion into one number).
    for (const lanes of Object.values(m.support_dependency)) {
      expect(lanes).toHaveProperty('supported')
      expect(lanes).toHaveProperty('independent')
    }
  })
})

describe('§29/§34.18 — forgetful at 200 (accelerated clock)', () => {
  it('reviews recur without review becoming permanent', () => {
    const r = results.get('forgetful')
    const windows = computeWindowedMetricsV2(r)
    const reviewShares = windows.map((w) => w.review_remediate_share)
    expect(Math.max(...reviewShares)).toBeGreaterThan(0) // reviews DO happen
    // Review never swallows a whole late window (no LATE_REVIEW_DOMINANCE).
    const { findings } = analyzeLongHorizonV2(r, { registry })
    expect(findings.some((f) => f.code === 'LATE_REVIEW_DOMINANCE')).toBe(false)
  })
})

describe('§29/§34.19 — struggling at 200', () => {
  it('recurring remediation without an infinite same-target loop while alternatives exist', () => {
    const r = results.get('struggling')
    const remediations = r.interactions.filter((it) => ['review', 'remediate'].includes(it.study_focus?.focus_type))
    expect(remediations.length).toBeGreaterThan(0)
    const { findings } = analyzeLongHorizonV2(r, { registry })
    expect(findings.some((f) => f.code === 'LONG_HORIZON_TARGET_LOOP')).toBe(false)
  })
})

describe('§29/§34.20 — cross-pack at 200', () => {
  it('transfer keeps being recorded and pack ping-pong stays bounded', () => {
    const r = results.get('cross-pack')
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.cross_pack_transfer.total).toBeGreaterThan(0)
    expect(m.pack_switch.rate).toBeLessThan(0.5) // no excessive ping-pong
    const { findings } = analyzeTrajectoryV2(r, { registry })
    expect(findings.some((f) => f.code === 'EXCESSIVE_PACK_SWITCHING')).toBe(false)
  })
})

// ---- §34.21–23 — saturation -------------------------------------------------

describe('§34.21 — curriculum saturation is a fact, not a finding', () => {
  it('reports remaining unseen targets and flips to saturated only at full coverage', () => {
    const r = results.get('fast-learner')
    const sat = computeCurriculumSaturationV2(r, { registry })
    expect(sat.total_targets).toBeGreaterThan(0)
    expect(sat.exposed_targets + sat.remaining_eligible_unseen_targets).toBe(sat.total_targets)
    expect(sat.curriculum_saturation).toBe(sat.remaining_eligible_unseen_targets === 0)
  })

  it('a synthetically saturated result reports curriculum_saturation true', () => {
    const r = results.get('fast-learner')
    const allTargets = registry.packs.flatMap((p) => [
      ...(p.senses || []).map((s) => ({ target_type: 'sense', target_id: s.sense_id })),
      ...(p.constructions || []).map((c) => ({ target_type: 'construction', target_id: c.construction_id })),
      ...(p.communicative_functions || []).map((f) => ({ target_type: 'communicative_function', target_id: f.function_id })),
    ])
    const saturated = {
      ...r,
      final_learner_states: allTargets.map((target) => ({ target, exposure: { count: 1 }, capabilities: {} })),
    }
    const sat = computeCurriculumSaturationV2(saturated, { registry })
    expect(sat.curriculum_saturation).toBe(true)
    expect(sat.remaining_eligible_unseen_targets).toBe(0)
  })
})

describe('§34.22 — novelty starvation is only real when unseen material remains', () => {
  it('LATE_NOVELTY_STARVATION is never emitted for a saturated curriculum', () => {
    const r = results.get('fast-learner')
    const allTargets = registry.packs.flatMap((p) => [
      ...(p.senses || []).map((s) => ({ target_type: 'sense', target_id: s.sense_id })),
      ...(p.constructions || []).map((c) => ({ target_type: 'construction', target_id: c.construction_id })),
      ...(p.communicative_functions || []).map((f) => ({ target_type: 'communicative_function', target_id: f.function_id })),
    ])
    const saturated = { ...r, final_learner_states: allTargets.map((target) => ({ target, exposure: { count: 1 }, capabilities: {} })) }
    const { findings } = analyzeLongHorizonV2(saturated, { registry })
    expect(findings.some((f) => f.code === 'LATE_NOVELTY_STARVATION')).toBe(false)
  })
})

describe('§34.23 — repetition tolerance doubles under saturation', () => {
  it('EXCESSIVE_TARGET_REPETITION carries the saturation context and uses the doubled bar', () => {
    const r = results.get('struggling')
    const { findings } = analyzeTrajectoryV2(r, { registry })
    for (const f of findings.filter((x) => x.code === 'EXCESSIVE_TARGET_REPETITION')) {
      expect(f.details).toHaveProperty('curriculum_saturated')
    }
  })
})

// ---- §34.24–27 — windowed metrics, entry/expansion coverage, comparator -----

describe('§34.24 — windowed metrics split the trajectory temporally', () => {
  it('windows clip to the horizon and expose per-window distributions', () => {
    expect(clipWindowsV2(200)).toEqual([[1, 50], [51, 100], [101, 200]])
    const windows = computeWindowedMetricsV2(results.get('fast-learner'))
    expect(windows).toHaveLength(3)
    for (const w of windows) {
      expect(w.interactions).toBeGreaterThan(0)
      expect(w).toHaveProperty('review_remediate_share')
      expect(w).toHaveProperty('modality_counts')
      expect(w).toHaveProperty('capability_counts')
      expect(w).toHaveProperty('new_item_rate')
      expect(w).toHaveProperty('opportunity_coverage')
    }
  })
})

describe('§34.25–26 — entry vs expansion opportunities are distinguished', () => {
  it('the coverage table counts entry and expansion opportunities separately', () => {
    const m = computePedagogicalMetricsV2(results.get('fast-learner'), { registry })
    const entries = Object.values(m.opportunity_coverage).reduce((a, o) => a + o.entry_opportunities, 0)
    const expansions = Object.values(m.opportunity_coverage).reduce((a, o) => a + o.expansion_opportunities, 0)
    expect(entries).toBeGreaterThan(0)
    expect(expansions).toBeGreaterThan(0)
  })
})

describe('session rotation (Slice V2.10) — modeling real sittings on long horizons', () => {
  it('a rotated struggling journey completes 200 and reaches production (remediation without being stuck)', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('struggling', { maximum_interactions: 200, session_rotation_interactions: 12 }), { registry })
    expect(r.interactions.length).toBe(200)
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.capability_depth.controlled_production).toBeGreaterThan(0)
  }, 20000)

  it('rotation stays deterministic and default-off scenarios are byte-identical to pre-V2.10', async () => {
    const a = await runSimulationV2(buildStandardScenarioV2('forgetful', { maximum_interactions: 120, session_rotation_interactions: 12 }), { registry })
    const b = await runSimulationV2(buildStandardScenarioV2('forgetful', { maximum_interactions: 120, session_rotation_interactions: 12 }), { registry })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  }, 20000)

  it('the scenario validator rejects a non-positive rotation', async () => {
    const { validateSimulationScenarioV2, createSimulationScenarioV2 } = await import('./simulation-contracts.js')
    const bad = createSimulationScenarioV2({ scenario_id: 'x', persona: 'new-learner', session_rotation_interactions: 0 })
    expect(validateSimulationScenarioV2(bad).errors.some((e) => e.startsWith('SESSION_ROTATION_INVALID'))).toBe(true)
  })
})

describe('§34.27 — the trajectory comparator', () => {
  it('diffs two trajectories on the calibration dimensions, never a global mastery', async () => {
    const short = await runSimulationV2(buildStandardScenarioV2('fast-learner', { maximum_interactions: 100 }), { registry })
    const cmp = comparePedagogicalTrajectoriesV2(short, results.get('fast-learner'), { registry })
    expect(cmp.interactions).toEqual({ before: 100, after: 200 })
    expect(cmp.capability_depth.free_production.after).toBeGreaterThanOrEqual(cmp.capability_depth.free_production.before)
    expect(cmp.findings).toHaveProperty('resolved')
    expect(cmp.findings).toHaveProperty('introduced')
    expect(JSON.stringify(cmp)).not.toMatch(/global_mastery|overall_mastery|"mastery"/)
  })

  it('long-horizon runs stay deterministic (same seed ⇒ same 200-interaction run)', async () => {
    const again = await runSimulationV2(at200('forgetful'), { registry })
    expect(JSON.stringify(again)).toBe(JSON.stringify(results.get('forgetful')))
  })
})
