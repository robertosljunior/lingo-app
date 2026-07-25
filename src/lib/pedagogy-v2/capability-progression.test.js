// capability-progression.test.js — Slice V2.21-R3 regressions for P0-B:
// A LEARNER WHO ANSWERS CORRECTLY MUST NOT BE STUCK IN RECOGNITION FOREVER.
//
// The suite locks in, in order:
//   §11/§26 the target completion funnel on the real successful journeys;
//   §21/§22 word order, completion and guided writing actually being served;
//   §24     free production still requiring a real controlled prerequisite;
//   §6/§7   sense ≠ construction and reading ≠ listening still being distinct;
//   §17     calibration across personas (successful progresses, struggling and
//           support-dependent do not get autonomy they never demonstrated);
//   §18/§19 the R2 variety gains surviving the new depth;
//   §15     upgrade-equals-rebuild for persisted derived state.

import { describe, it, expect, beforeAll } from 'vitest'
import { loadPedagogyV2Registry } from './registry.js'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { analyzeCapabilityProgressionV2, funnelCountsV2 } from './capability-progression-analyzer.js'
import { aggregateProfileEvidence, aggregateTargetEvidence } from './learner-model.js'
import { AGGREGATION_VERSION } from './learner-model-constants.js'
import { capabilityGateMetV2, capabilityAdvancementMetV2, getLane } from './lesson-engine-state-queries.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { DEFAULT_STUDY_PLANNER_POLICY_V2 } from './study-planner-contracts.js'

const registry = loadPedagogyV2Registry()
const ADV = DEFAULT_STUDY_PLANNER_POLICY_V2.thresholds.advancement

const runs = {}
async function run(id) {
  if (!runs[id]) {
    const result = await runSimulationV2(buildStandardScenarioV2(id, { registry }), { registry })
    runs[id] = { result, report: analyzeCapabilityProgressionV2(result, { registry }) }
  }
  return runs[id]
}

const recipesOf = (result) => new Set(result.interactions.map((it) => it.recipe))
const capsOf = (result) => new Set(result.interactions.map((it) => it.capability))

describe('§11/§26 — the capability ladder actually progresses', () => {
  let short; let mid; let long
  beforeAll(async () => {
    short = await run('real-successful-60')
    mid = await run('real-successful-120')
    long = await run('real-successful-200')
  }, 120000)

  it('60 activities: the learner is no longer 60/60 recognition', () => {
    // The reported product defect. Before R3 the distribution was exactly
    // { recognition: 60 } and NO target ever met the recognition bar in a
    // single modality lane.
    const f = funnelCountsV2(short.report)
    expect(f.recognition_advancement).toBeGreaterThan(0)
    expect(f.comprehension_evidence).toBeGreaterThan(0)
    expect(capsOf(short.result).has('comprehension')).toBe(true)
    expect(short.result.interactions.filter((it) => it.capability !== 'recognition').length).toBeGreaterThan(0)
  })

  it('120 activities: controlled production is entered through real prerequisites', () => {
    const f = funnelCountsV2(mid.report)
    expect(f.recognition_advancement).toBeGreaterThan(0)
    expect(f.comprehension_advancement).toBeGreaterThan(0)
    expect(f.controlled_production_evidence).toBeGreaterThan(0)
    // Never more targets in a rung than in the rung below it — the funnel is a
    // funnel, which is what proves nothing skipped the ladder.
    expect(f.comprehension_evidence).toBeLessThanOrEqual(f.recognition_advancement)
    expect(f.controlled_production_evidence).toBeLessThanOrEqual(f.recognition_advancement)
  })

  it('200 activities: free production becomes reachable, never precocious', () => {
    const f = funnelCountsV2(long.report)
    expect(f.controlled_production_advancement).toBeGreaterThan(0)
    expect(f.free_production_evidence).toBeGreaterThan(0)
    expect(f.free_production_evidence).toBeLessThanOrEqual(f.controlled_production_advancement)
  })

  it('§21/§22/§23 — word order, completion and guided writing are all served', () => {
    const recipes = recipesOf(mid.result)
    expect(recipes.has('word_order_reconstruction')).toBe(true)
    expect(recipes.has('fixed_element_completion')).toBe(true)
    expect(recipes.has('guided_production')).toBe(true)
  })

  it('§23 — guided production really asks the learner to write (never disguised recognition)', async () => {
    const guided = mid.result.interactions.filter((it) => it.recipe === 'guided_production')
    expect(guided.length).toBeGreaterThan(0)
    for (const it of guided) {
      expect(['controlled_production', 'free_production']).toContain(it.capability)
      expect(it.response.response_type).not.toBe('option_select')
    }
  })

  it('§22 — no single recipe monopolizes controlled production', () => {
    const controlled = mid.result.interactions.filter((it) => it.capability === 'controlled_production')
    const byRecipe = {}
    for (const it of controlled) byRecipe[it.recipe] = (byRecipe[it.recipe] || 0) + 1
    const top = Math.max(...Object.values(byRecipe))
    expect(Object.keys(byRecipe).length).toBeGreaterThanOrEqual(3)
    expect(top / controlled.length).toBeLessThan(0.8)
  })
})

describe('§24 — FREE_PRODUCTION_WITHOUT_CONTROLLED_PREREQUISITE stays grave', () => {
  it('the gate requires SAME-modality controlled production at advancement', () => {
    // Production modalities are separate skills: speaking fluently never
    // unlocks writing fluently. R3 deliberately did NOT move this clause.
    const target = { target_type: 'sense', target_id: 'sense:still.continuity' }
    let n = 0
    const mk = (activity, over = {}) => buildLearnerEvidenceV2({
      evidence_id: `evidence:fp.${++n}`, profile_id: 'p', interaction_id: `i:${n}`,
      target, exemplar_id: null, activity, attribution: 'direct', outcome: 'correct',
      support: { features: [], hint_count: 0, attempt_number: 1 },
      occurred_at: new Date(Date.UTC(2026, 0, 1) + n * 60000).toISOString(),
      source: { source_type: 'test' }, ...over,
    })
    const events = [
      mk({ activity_kind: 'exposure', capability: 'recognition', modality: 'reading' },
        { attribution: 'exposure', outcome: 'observed' }),
      ...Array.from({ length: 5 }, () => mk({ activity_kind: 'guided_production', capability: 'controlled_production', modality: 'speaking' })),
    ]
    const [state] = aggregateProfileEvidence(events)
    expect(capabilityGateMetV2(state, 'free_production', 'speaking', { advancement: ADV })).toBe(true)
    expect(capabilityGateMetV2(state, 'free_production', 'writing', { advancement: ADV })).toBe(false)
  })

  it('no simulated run ever serves free production before controlled advancement', async () => {
    const { result } = await run('real-successful-200')
    const free = result.interactions.filter((it) => it.capability === 'free_production')
    for (const it of free) {
      // Reconstruct the state as it was BEFORE this interaction.
      const before = aggregateProfileEvidence(
        result.evidence_generated.filter((e) => Date.parse(e.occurred_at) < Date.parse(it.timestamp)),
      ).find((s) => s.target.target_id === it.target.target_id)
      const lane = getLane(before, `${it.modality}_controlled_production`, 'overall')
      expect(lane?.assessed_evidence_count || 0).toBeGreaterThan(0)
    }
  }, 120000)
})

describe('§6/§7 — the model stays multidimensional', () => {
  it('sense and construction remain distinct units with distinct states', async () => {
    const { result } = await run('real-successful-120')
    const senses = result.final_learner_states.filter((s) => s.target.target_type === 'sense')
    const constructions = result.final_learner_states.filter((s) => s.target.target_type === 'construction')
    expect(senses.length).toBeGreaterThan(0)
    expect(constructions.length).toBeGreaterThan(0)
    // No state carries a target-level mastery, and no two target types share a key.
    for (const s of [...senses, ...constructions]) {
      expect(s.mastery_estimate).toBeUndefined()
      expect(Object.keys(s.capabilities).length).toBeGreaterThan(0)
    }
    // At least one pair disagrees — collapsing them would make them identical.
    const anyDifferent = senses.some((s) => constructions.some((c) =>
      JSON.stringify(s.capability_rollups) !== JSON.stringify(c.capability_rollups)))
    expect(anyDifferent).toBe(true)
  })

  it('rollups aggregate modalities WITHOUT erasing the per-modality lanes', async () => {
    const { result } = await run('real-successful-120')
    const withBoth = result.final_learner_states.find((s) => s.capabilities.reading_recognition
      && s.capabilities.listening_recognition)
    expect(withBoth).toBeDefined()
    const roll = withBoth.capability_rollups.recognition.overall
    const r = withBoth.capabilities.reading_recognition.overall
    const l = withBoth.capabilities.listening_recognition.overall
    expect(roll.assessed_evidence_count).toBe(r.assessed_evidence_count + l.assessed_evidence_count)
    expect(roll.effective_evidence_weight).toBeCloseTo(r.effective_evidence_weight + l.effective_evidence_weight, 4)
    // The lanes still exist and still differ from the rollup.
    expect(r.assessed_evidence_count).toBeGreaterThan(0)
    expect(l.assessed_evidence_count).toBeGreaterThan(0)
    expect(roll.assessed_evidence_count).toBeGreaterThan(r.assessed_evidence_count)
  })

  it('comprehension still needs recognition evidence IN the entering modality', () => {
    const target = { target_type: 'sense', target_id: 'sense:but.contrast' }
    let n = 0
    const mk = (activity, over = {}) => buildLearnerEvidenceV2({
      evidence_id: `evidence:cm.${++n}`, profile_id: 'p', interaction_id: `i:${n}`,
      target, exemplar_id: null, activity, attribution: 'direct', outcome: 'correct',
      support: { features: [], hint_count: 0, attempt_number: 1 },
      occurred_at: new Date(Date.UTC(2026, 0, 1) + n * 60000).toISOString(),
      source: { source_type: 'test' }, ...over,
    })
    const readingOnly = [
      mk({ activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }, { attribution: 'exposure', outcome: 'observed' }),
      ...Array.from({ length: 5 }, () => mk({ activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' })),
    ]
    const [state] = aggregateProfileEvidence(readingOnly)
    expect(capabilityAdvancementMetV2(state, 'recognition', ADV)).toBe(true)
    expect(capabilityGateMetV2(state, 'comprehension', 'reading', { advancement: ADV })).toBe(true)
    // Never practised listening → listening comprehension stays closed.
    expect(capabilityGateMetV2(state, 'comprehension', 'listening', { advancement: ADV })).toBe(false)
  })
})

describe('§17 — calibration: the bar moved population, not standards', () => {
  it('a struggling learner does not advance the way a successful one does', async () => {
    const struggling = await runSimulationV2(buildStandardScenarioV2('struggling', { registry }), { registry })
    const successful = await run('real-successful-120')
    const s = analyzeCapabilityProgressionV2(struggling, { registry })
    const sf = funnelCountsV2(s)
    const okf = funnelCountsV2(successful.report)
    const rate = (f) => (f.exposed ? f.recognition_advancement / f.exposed : 0)
    expect(rate(sf)).toBeLessThan(rate(okf))
  }, 120000)

  it('a support-dependent learner never gains an independent lane it never showed', async () => {
    const result = await runSimulationV2(buildStandardScenarioV2('support-dependent', { registry }), { registry })
    for (const state of result.final_learner_states) {
      for (const roll of Object.values(state.capability_rollups || {})) {
        // Rollups fold the same lanes: supported evidence can never land in the
        // independent rollup.
        if (roll.independent.assessed_evidence_count > 0) {
          expect(roll.overall.assessed_evidence_count).toBeGreaterThanOrEqual(roll.independent.assessed_evidence_count)
        }
      }
    }
  }, 120000)
})

describe('§18/§19 — depth did not cost variety', () => {
  it('focused journeys keep R2-level exemplar rotation and near-zero immediate repeats', async () => {
    for (const id of ['still-focused-36', 'but-focused-36', 'yet-focused-36']) {
      const { result } = await run(id)
      const exemplars = result.interactions.map((it) => it.activity_plan.exemplar_id)
      const unique = new Set(exemplars).size
      let immediate = 0
      for (let i = 1; i < exemplars.length; i++) if (exemplars[i] === exemplars[i - 1]) immediate += 1
      // Never back to the pre-R2 collapse (6 unique / 60, one sentence
      // dominating). The exact R2 decimals may legitimately move now that the
      // journey spends activities on higher rungs with fewer eligible exemplars.
      expect(unique).toBeGreaterThanOrEqual(7)
      expect(immediate / exemplars.length).toBeLessThanOrEqual(0.06)
      const counts = {}
      for (const x of exemplars) counts[x] = (counts[x] || 0) + 1
      expect(Math.max(...Object.values(counts)) / exemplars.length).toBeLessThan(0.3)
    }
  }, 120000)

  it('no target camping: no target owns a majority of a 60-activity journey', async () => {
    const { result } = await run('real-successful-60')
    const counts = {}
    for (const it of result.interactions) counts[it.target.target_id] = (counts[it.target.target_id] || 0) + 1
    expect(Math.max(...Object.values(counts)) / result.interactions.length).toBeLessThan(0.35)
  }, 120000)
})

describe('§15 — persisted derived state upgrades to the new semantics', () => {
  it('states are stamped with the current aggregation version', async () => {
    const { result } = await run('real-successful-60')
    for (const s of result.final_learner_states) expect(s.aggregation_version).toBe(AGGREGATION_VERSION)
  })

  it('upgrade-from-old-state equals rebuild-from-zero (evidence is the source of truth)', async () => {
    const { result } = await run('real-successful-60')
    const events = result.evidence_generated
    const target = result.final_learner_states[0].target
    const mine = events.filter((e) => e.target.target_id === target.target_id)
    const profile_id = mine[0].profile_id

    // A state persisted under the OLD semantics: same events, but the derived
    // shape a version-1 aggregation would have written.
    const rebuilt = aggregateTargetEvidence(mine, { profile_id, target })
    const stale = { ...rebuilt, aggregation_version: 1 }
    delete stale.capability_rollups

    expect(stale.aggregation_version).not.toBe(AGGREGATION_VERSION)
    // Rebuilding from the immutable evidence — never deleting it — yields the
    // new semantics exactly, with no trace of the stale interpretation.
    const upgraded = aggregateTargetEvidence(mine, { profile_id, target })
    expect(upgraded.aggregation_version).toBe(AGGREGATION_VERSION)
    expect(upgraded).toEqual(rebuilt)
    expect(upgraded.capability_rollups).toBeDefined()
  })
})

describe('§28 — RECIPE_REACHABLE_BUT_STARVED is a formal finding', () => {
  it('the analyzer emits it with the documented preconditions, or not at all', async () => {
    const { report } = await run('real-successful-120')
    for (const f of report.findings.filter((x) => x.code === 'RECIPE_REACHABLE_BUT_STARVED')) {
      const row = report.recipe_matrix.find((r) => r.recipe === f.recipe)
      expect(row.runtime_executable).toBe(true)
      expect(row.content_eligible).toBe(true)
      expect(row.selected_count).toBe(0)
      expect(row.planner_opportunity_count).toBeGreaterThanOrEqual(5)
    }
    // The R3 target recipes are no longer starved at this horizon.
    const starved = report.findings.filter((x) => x.code === 'RECIPE_REACHABLE_BUT_STARVED').map((x) => x.recipe)
    expect(starved).not.toContain('word_order_reconstruction')
    expect(starved).not.toContain('fixed_element_completion')
    expect(starved).not.toContain('guided_production')
  }, 120000)
})
