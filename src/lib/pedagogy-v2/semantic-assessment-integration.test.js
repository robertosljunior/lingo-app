// semantic-assessment-integration.test.js — Slice V2.14 end-to-end through the
// REAL language-analysis public API (hashing fallback, no USE required). Proves
// the bridge makes semantic_context reachable for authored targets, keeps
// naturalness/target-form separate, leaves free production free, records the
// bridge provenance, and never changes the evidence schema (§34.13–25).

import { describe, it, expect } from 'vitest'
import { evaluateActivityResponseV2 } from './activity-assessment.js'
import { createProductionAssessmentServicesV2 } from './production-assessment-service.js'
import { analyzeProduction } from '../language-analysis/index.js'
import { buildActivityResponseV2, createSupportRuntime } from './activity-runtime-contracts.js'
import { buildLearnerEvidenceBatchFromInteractionV2 } from './assessment-to-evidence.js'
import { loadPedagogyV2Registry } from './registry.js'

const services = createProductionAssessmentServicesV2({ analyzeProduction })

function prodPlan(o = {}) {
  return {
    plan_version: 1, recipe: 'free_production', activity_kind: 'free_production',
    capability: 'free_production', modality: 'writing',
    activity_id: 'act:0', session_id: 'sess', exemplar_id: 'exemplar:t',
    construction_id: 'construction:t', sense_ids: ['sense:t'],
    primary_target: { target_type: 'construction', target_id: 'construction:t' },
    secondary_targets: [],
    text_en: 'The coffee is still hot.', text_pt: 'O café ainda está quente.',
    context: 'ctx',
    planned_evidence: [{ target: { target_type: 'construction', target_id: 'construction:t' }, attribution: 'direct', activity: { activity_kind: 'free_production', capability: 'free_production', modality: 'writing' } }],
    ...o,
  }
}
const resp = (plan, text) => buildActivityResponseV2({ plan, responseType: 'text', payload: { text }, supportRuntime: createSupportRuntime(plan), submittedAt: '2026-07-21T00:00:00.000Z' })
const evalOne = (plan, text) => evaluateActivityResponseV2({ activityPlan: plan, response: resp(plan, text), assessmentServices: services })

const EQ = { semantic_assessment: { strategy: 'equivalent_meaning', essential_words: ['coffee'] }, semantic_assessment_source: 'exemplar:t' }

describe('§34.14/16/§16-17 — semantic_context reachable, variation accepted', () => {
  it('A: off-topic response → semantic_context via structured meaning_mismatch', async () => {
    const a = await evalOne(prodPlan(EQ), 'I like bananas.')
    expect(a.outcome).toBe('incorrect')
    expect(a.diagnosis.primary_cause.category).toBe('semantic_context')
    expect(a.diagnosis.semantic_relation.status).toBe('not_aligned')
    expect(a.semantic_bridge.strategy).toBe('equivalent_meaning')
  })

  it('B: acceptable variation that keeps the essential word → NOT a meaning mismatch', async () => {
    const a = await evalOne(prodPlan(EQ), 'The coffee is still warm.')
    expect(a.diagnosis.primary_cause?.category).not.toBe('semantic_context')
    expect(a.outcome).not.toBe('incorrect')
  })
})

describe('§34.15/§18 — naturalness is never a semantic mismatch', () => {
  it('a variation keeping the essential word is not flagged as wrong meaning', async () => {
    const a = await evalOne(prodPlan(EQ), 'The coffee stays hot.')
    expect(a.diagnosis.causes.some((c) => c.category === 'semantic_context')).toBe(false)
    expect(a.diagnosis.causes.some((c) => c.category === 'grammar')).toBe(false)
  })
})

describe('§34.17/§20 — target form is independent from meaning', () => {
  it('correct meaning but missing the fixed construction element → aligned meaning + different target form', async () => {
    // Response keeps the essential word (coffee) but drops the fixed element "still".
    const plan = prodPlan({ ...EQ, construction_fixed_elements: ['still'] })
    const a = await evalOne(plan, 'The coffee is warm.')
    expect(a.diagnosis.semantic_relation.status === 'aligned' || a.diagnosis.semantic_relation.status === 'partially_aligned').toBe(true)
    expect(a.diagnosis.target_form_relation.status).toBe('different_form')
    // and it is NOT reclassified as semantic_context
    expect(a.diagnosis.causes.some((c) => c.category === 'semantic_context')).toBe(false)
  })
})

describe('§34.13 — a target without metadata stays free', () => {
  it('no metadata → strategy free, engine never fails on low similarity', async () => {
    const a = await evalOne(prodPlan(), 'I like bananas.')
    expect(a.semantic_bridge.strategy).toBe('free')
    // free production accepts legitimate variation — off-topic is NOT a hard fail
    // absent a real grammar error (documented free-mode behavior).
    expect(a.diagnosis.primary_cause?.category).not.toBe('semantic_context')
  })
})

describe('§34.18 — diagnosis provenance includes the bridge', () => {
  it('carries strategy, mode and source', async () => {
    const a = await evalOne(prodPlan(EQ), 'The coffee is still hot.')
    expect(a.diagnosis.semantic_bridge).toMatchObject({ strategy: 'equivalent_meaning', assessment_mode: 'equivalent' })
    expect(a.diagnosis.semantic_bridge.provenance.source).toBe('exemplar:t')
  })
})

describe('§34.19-20 — raw in-memory only; evidence schema unchanged', () => {
  it('the evidence batch never carries diagnosis / bridge / raw semantic', async () => {
    const plan = prodPlan(EQ)
    const response = resp(plan, 'I like bananas.')
    const a = await evaluateActivityResponseV2({ activityPlan: plan, response, assessmentServices: services })
    // in-memory diagnostics exist on the assessment
    expect(a.semantic_result).toBeTruthy()
    expect(a.semantic_bridge).toBeTruthy()
    // but the evidence events are outcome-driven and carry none of it
    const events = buildLearnerEvidenceBatchFromInteractionV2({ activityPlan: plan, response, assessment: a, profileId: 'p', sessionId: 'sess' })
    for (const e of events) {
      expect(e).not.toHaveProperty('diagnosis')
      expect(e).not.toHaveProperty('semantic_result')
      expect(e).not.toHaveProperty('semantic_bridge')
      expect(e).not.toHaveProperty('semantic_assessment')
    }
    // no learner response text leaks into evidence
    expect(JSON.stringify(events)).not.toContain('bananas')
  })
})

describe('§34.23-25 — still / but / yet authored examples', () => {
  const registry = loadPedagogyV2Registry()
  const findEx = (packId, exId) => registry.packs.find((p) => p.manifest.pack_id === packId).exemplars.find((e) => e.exemplar_id === exId)
  const planFromExemplar = (e) => prodPlan({
    text_en: e.text_en, text_pt: e.text_pt, exemplar_id: e.exemplar_id,
    semantic_assessment: e.semantic_assessment, semantic_assessment_source: `exemplar:${e.exemplar_id}`,
  })

  it('23: still.007 authored target → off-topic is semantic_context', async () => {
    const a = await evalOne(planFromExemplar(findEx('pedagogy_v2_still', 'exemplar:still.007')), 'I like bananas.')
    expect(a.diagnosis.primary_cause.category).toBe('semantic_context')
  })
  it('24: but.012 authored target → off-topic is semantic_context', async () => {
    const a = await evalOne(planFromExemplar(findEx('pedagogy_v2_but', 'exemplar:but.012')), 'I like bananas.')
    expect(a.diagnosis.primary_cause.category).toBe('semantic_context')
  })
  it('25: yet.014 authored target → off-topic is semantic_context', async () => {
    const a = await evalOne(planFromExemplar(findEx('pedagogy_v2_yet', 'exemplar:yet.014')), 'I like bananas.')
    expect(a.diagnosis.primary_cause.category).toBe('semantic_context')
  })

  it('each authored exemplar keeps its essential word within its own reference text', () => {
    for (const [pack, ex] of [['pedagogy_v2_still', 'exemplar:still.007'], ['pedagogy_v2_but', 'exemplar:but.012'], ['pedagogy_v2_yet', 'exemplar:yet.014']]) {
      const e = findEx(pack, ex)
      expect(e.semantic_assessment.strategy).toBe('equivalent_meaning')
      for (const w of e.semantic_assessment.essential_words) {
        expect(new RegExp(`(?:^|[^a-z0-9])${w}(?:$|[^a-z0-9])`, 'i').test(e.text_en)).toBe(true)
      }
    }
  })
})
