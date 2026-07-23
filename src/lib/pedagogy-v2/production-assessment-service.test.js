// production-assessment-service.test.js — Slice V2.14 §29/§34.10–12/§34.21:
// every V2 surface uses the ONE shared production-assessment service, no screen
// keeps a field-dropping wrapper, and coverage can be measured per strategy.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createProductionAssessmentServicesV2 } from './production-assessment-service.js'
import { buildSemanticAssessmentRequestV2 } from './semantic-assessment-bridge.js'
import { buildAssessmentStrategyCoverageV2 } from './assessment-diagnosis.js'

const screensDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'screens')

describe('§29 — no V2 screen keeps a field-dropping semantic wrapper', () => {
  it('PedagogyV2Lab and PedagogyV2Playground never destructure only { text, assessmentMode }', () => {
    for (const f of ['PedagogyV2Lab.jsx', 'PedagogyV2Playground.jsx']) {
      const src = readFileSync(join(screensDir, f), 'utf8')
      expect(/async \(\{ text, assessmentMode \}\)/.test(src), `${f} still has a drop-wrapper`).toBe(false)
      expect(src.includes('createProductionAssessmentServicesV2'), `${f} must use the shared service`).toBe(true)
    }
  })
})

describe('§34.10 — the shared service forwards the full request', () => {
  it('forwards text/mode/requestedIntent/equivalentTarget', async () => {
    const spy = vi.fn(async () => ({ verdict: 'valid', confidence: 1, detected_errors: [] }))
    const svc = createProductionAssessmentServicesV2({ analyzeProduction: spy })
    const req = buildSemanticAssessmentRequestV2({
      plan: { recipe: 'guided_production', text_en: 'The coffee is still hot.', semantic_assessment: { strategy: 'equivalent_meaning', essential_words: ['coffee'] } },
      text: 'The coffee is warm.',
    })
    await svc.analyzeSemantics(req)
    expect(spy.mock.calls[0][0]).toEqual({
      text: 'The coffee is warm.', assessmentMode: 'equivalent',
      requestedIntent: null, equivalentTarget: { text: 'The coffee is still hot.', essential_words: ['coffee'] },
    })
  })
})

describe('§34.21 — cause coverage by strategy', () => {
  it('separates free and equivalent_meaning; never compares them as equals', () => {
    const rec = (strategy, coverage, category) => ({ diagnosis: { applicability: 'assessed', cause_coverage: coverage, primary_cause: category ? { category } : null, semantic_bridge: { strategy } } })
    const cov = buildAssessmentStrategyCoverageV2([
      rec('free', 'none', 'unknown'),
      rec('free', 'specific', 'grammar'),
      rec('equivalent_meaning', 'specific', 'semantic_context'),
      rec('equivalent_meaning', 'none', 'unknown'),
    ])
    expect(cov.assessment_strategy_distribution).toEqual({ free: 2, guided_intent: 0, equivalent_meaning: 2 })
    expect(cov.semantic_target_coverage).toEqual({ activities_with_authored_target: 2, activities_without_authored_target: 2 })
    expect(cov.cause_coverage_by_strategy.equivalent_meaning.semantic_context_specific).toBe(1)
    expect(cov.cause_coverage_by_strategy.free.unknown).toBe(1)
  })
})
