// pedagogical-metrics.test.js — §25. The twelve pedagogical metrics measure
// PROPERTIES of a trajectory (isolation, load, support dependency, modality
// balance, transfer, retention, lexical depth …) — never a single global
// mastery number. Real-run metrics are cross-checked against crafted result
// stubs so each metric is exercised in isolation.

import { describe, it, expect, beforeAll } from 'vitest'
import { computePedagogicalMetricsV2, availableModalitiesFor } from './pedagogical-metrics.js'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
let real

beforeAll(async () => {
  real = await runSimulationV2(buildStandardScenarioV2('new-learner', { maximum_interactions: 60 }), { registry })
})

// A minimal interaction stub carrying just the fields the metrics read.
// The primary key the metrics build is `${target_type}:${target_id}`, matching
// how the runner records direct/assessed targets.
function ix(over = {}) {
  const target = over.target ?? { target_type: 'sense', target_id: 'sense:still.continuity' }
  const key = `${target.target_type}:${target.target_id}`
  return {
    assessment: { status: 'assessed', outcome: 'correct', partial_score: null },
    target,
    direct_targets: [key],
    assessed_targets: [key],
    new_item_refs: [],
    capability: 'recognition',
    modality: 'reading',
    support_tier: 'high',
    activity_plan: { construction_id: null },
    pack_before: 'pedagogy_v2_still',
    pack_after: 'pedagogy_v2_still',
    pack_switch: null,
    ...over,
  }
}
function mkResult({ interactions = [], states = [], focuses = [], caps = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true } } = {}) {
  return {
    interactions,
    final_learner_states: states,
    study_focus_history: focuses,
    pack_history: interactions.map((i) => i.pack_after),
    scenario: { runtime_capabilities: caps },
  }
}

describe('§25.1 — target isolation rate', () => {
  it('counts activities where the primary target is directly assessed', () => {
    const r = mkResult({ interactions: [
      ix(), // isolated
      ix({ direct_targets: [], assessed_targets: [] }), // not isolated
    ] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.target_isolation_rate).toEqual({ numerator: 1, denominator: 2, rate: 0.5 })
  })
})

describe('§25.2 — new-item load', () => {
  it('aggregates per-activity new-item introductions', () => {
    const r = mkResult({ interactions: [ix({ new_item_refs: ['a', 'b'] }), ix(), ix({ new_item_refs: ['c'] })] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.new_item_load.total).toBe(3)
    expect(m.new_item_load.per_activity_max).toBe(2)
    expect(m.new_item_load.activities_introducing_new).toBe(2)
  })
})

describe('§25.3 — unaided production rate (controlled vs free)', () => {
  it('splits production by capability and counts the unaided share', () => {
    const r = mkResult({ interactions: [
      ix({ capability: 'controlled_production', support_tier: 'none' }),
      ix({ capability: 'controlled_production', support_tier: 'medium' }),
      ix({ capability: 'free_production', support_tier: 'none' }),
    ] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.unaided_production_rate.controlled).toEqual({ unaided: 1, total: 2, rate: 0.5 })
    expect(m.unaided_production_rate.free).toEqual({ unaided: 1, total: 1, rate: 1 })
  })
})

describe('§25.4 — support dependency per capability key', () => {
  it('sums supported vs independent assessed evidence from final states', () => {
    const states = [{
      target: { target_id: 'sense:still.continuity' },
      capabilities: { reading_recognition: {
        supported: { assessed_evidence_count: 4 },
        independent: { assessed_evidence_count: 1 },
      } },
    }]
    const m = computePedagogicalMetricsV2(mkResult({ states }), { registry })
    expect(m.support_dependency.reading_recognition).toEqual({ supported: 4, independent: 1 })
  })
})

describe('§25.5 — modality balance and unpracticed-but-available', () => {
  it('reports which technically-available modalities were never practiced', () => {
    const r = mkResult({ interactions: [ix({ modality: 'reading' }), ix({ modality: 'listening' })] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.modality_balance.counts.reading).toBe(1)
    expect(m.modality_balance.available).toContain('writing')
    expect(m.modality_balance.unpracticed_available).toContain('writing')
    expect(m.modality_balance.unpracticed_available).toContain('speaking')
  })

  it('availableModalitiesFor gates listening/writing/speaking on capabilities', () => {
    expect(availableModalitiesFor({})).toEqual(['reading'])
    expect(availableModalitiesFor({ audio_output: true })).toContain('listening')
    expect(availableModalitiesFor({ text_input: true, semantic_assessment: true })).toContain('writing')
    expect(availableModalitiesFor({ speech_input: true, semantic_assessment: true })).toContain('speaking')
  })
})

describe('§25.6 — capability depth', () => {
  it('counts interactions per capability', () => {
    const r = mkResult({ interactions: [ix({ capability: 'recognition' }), ix({ capability: 'recognition' }), ix({ capability: 'comprehension' })] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.capability_depth.recognition).toBe(2)
    expect(m.capability_depth.comprehension).toBe(1)
    expect(m.capability_depth.free_production).toBe(0)
  })
})

describe('§25.7 — review ratio', () => {
  it('divides review/remediate focuses by introduce/deepen focuses', () => {
    const focuses = [
      { focus_type: 'introduce', reason_codes: [] },
      { focus_type: 'deepen', reason_codes: [] },
      { focus_type: 'review', reason_codes: [] },
    ]
    const m = computePedagogicalMetricsV2(mkResult({ focuses }), { registry })
    expect(m.review_ratio.review_remediate).toBe(1)
    expect(m.review_ratio.introduce_deepen).toBe(2)
    expect(m.review_ratio.ratio).toBe(0.5)
  })
})

describe('§25.8 — repetition pressure', () => {
  it('measures the longest consecutive run of the same target', () => {
    const r = mkResult({ interactions: [
      ix({ target: { target_type: 'sense', target_id: 'sense:a' } }),
      ix({ target: { target_type: 'sense', target_id: 'sense:a' } }),
      ix({ target: { target_type: 'sense', target_id: 'sense:b' } }),
    ] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.repetition_pressure.same_target).toBe(2)
  })
})

describe('§25.9 — pack-switch rate and reasons', () => {
  it('counts switches and buckets them by reason code', () => {
    const r = mkResult({ interactions: [
      ix({ pack_before: 'pedagogy_v2_still', pack_after: 'pedagogy_v2_but', pack_switch: { code: 'INTERLEAVE' } }),
      ix({ pack_before: 'pedagogy_v2_but', pack_after: 'pedagogy_v2_but' }),
    ] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.pack_switch.count).toBe(1)
    expect(m.pack_switch.reasons.INTERLEAVE).toBe(1)
    expect(m.pack_switch.rate).toBe(0.5)
  })
})

describe('§25.10 — cross-pack transfer occurrences', () => {
  it('counts transfer reason codes across the focus history', () => {
    const focuses = [
      { focus_type: 'cross_pack_progression', reason_codes: ['CROSS_PACK_PREREQUISITE_MET'] },
      { focus_type: 'introduce', reason_codes: ['KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK'] },
    ]
    const m = computePedagogicalMetricsV2(mkResult({ focuses }), { registry })
    expect(m.cross_pack_transfer.CROSS_PACK_PREREQUISITE_MET).toBe(1)
    expect(m.cross_pack_transfer.KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK).toBe(1)
    expect(m.cross_pack_transfer.total).toBe(2)
  })
})

describe('§25.11 — delayed retention per capability key', () => {
  it('aggregates successful/failed delayed retrievals from state retention', () => {
    const states = [{
      target: { target_id: 'sense:still.continuity' },
      capabilities: {},
      retention: { reading_recognition: { successful_delayed_retrievals: 2, failed_delayed_retrievals: 1 } },
    }]
    const m = computePedagogicalMetricsV2(mkResult({ states }), { registry })
    expect(m.delayed_retention.reading_recognition).toEqual({ successful_delayed_retrievals: 2, failed_delayed_retrievals: 1 })
  })
})

describe('§25.13 — opportunity-aware coverage (Slice V2.8)', () => {
  it('separates domains that were eligible-and-chosen from eligible-and-ignored', () => {
    const r = mkResult({ interactions: [
      // reading recognition was eligible and chosen every step; writing was
      // eligible but never chosen.
      ix({ capability: 'recognition', modality: 'reading', eligible_domains: ['recognition_reading', 'controlled_production_writing'] }),
      ix({ capability: 'recognition', modality: 'reading', eligible_domains: ['recognition_reading', 'controlled_production_writing'] }),
    ] })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.opportunity_coverage.recognition_reading).toEqual({ eligible_opportunities: 2, selected_opportunities: 2, coverage_ratio: 1 })
    // Writing had opportunities but was never chosen → coverage 0.
    expect(m.opportunity_coverage.controlled_production_writing).toEqual({ eligible_opportunities: 2, selected_opportunities: 0, coverage_ratio: 0 })
  })
})

describe('§25.12 — lexical depth (facts only, never a global mastery %)', () => {
  it('reports per-lexeme fact counts for every pack in the registry', () => {
    const m = computePedagogicalMetricsV2(real, { registry })
    for (const pack of registry.packs) {
      const depth = m.lexical_depth[pack.manifest.primary_lexeme_id]
      expect(depth.pack_id).toBe(pack.manifest.pack_id)
      expect(typeof depth.senses_encountered).toBe('number')
      expect(typeof depth.constructions_encountered).toBe('number')
      expect(Array.isArray(depth.capability_keys_with_evidence)).toBe(true)
      // A fact bucket, never a percentage or a level.
      expect(depth).not.toHaveProperty('mastery')
      expect(depth).not.toHaveProperty('level')
    }
  })
})
