// semantic-assessment-bridge.test.js — the Slice V2.14 bridge contract and its
// hard rules (§34): strategy from authored metadata only, free fallback, no
// invented intent, no heuristic essential words, valid shapes, and the shared
// service forwarding every field without loss (§28).

import { describe, it, expect, vi } from 'vitest'
import {
  buildSemanticAssessmentRequestV2, validateSemanticAssessmentMetadataV2,
  requestToAnalyzeParamsV2, SEMANTIC_STRATEGIES, KNOWN_SEMANTIC_INTENTS,
  SEMANTIC_ASSESSMENT_BRIDGE_VERSION,
} from './semantic-assessment-bridge.js'
import { createProductionAssessmentServicesV2 } from './production-assessment-service.js'

const plan = (o = {}) => ({
  recipe: 'guided_production', activity_id: 'a', session_id: 's', exemplar_id: 'exemplar:x',
  construction_id: 'construction:y', text_en: 'The coffee is still hot.', text_pt: 'O café ainda está quente.',
  context: 'ctx', primary_target: { target_type: 'construction', target_id: 'construction:y' }, ...o,
})

// ---- §34.1 contract + §34.2 free fallback ----------------------------------

describe('§34.1–2 — contract & free fallback', () => {
  it('a plan without metadata → free request (backward compatible)', () => {
    const r = buildSemanticAssessmentRequestV2({ plan: plan(), text: 'hello' })
    expect(r.bridge_version).toBe(SEMANTIC_ASSESSMENT_BRIDGE_VERSION)
    expect(r.strategy).toBe('free')
    expect(r.assessment_mode).toBe('free')
    expect(r.equivalent_target).toBeNull()
    expect(r.requested_intent).toBeNull()
    expect(r.fallback_reason).toBe('NO_AUTHORED_SEMANTIC_TARGET')
  })

  it('a non-production recipe → free request', () => {
    const r = buildSemanticAssessmentRequestV2({ plan: plan({ recipe: 'meaning_recognition', semantic_assessment: { strategy: 'equivalent_meaning', essential_words: ['coffee'] } }), text: 'x' })
    expect(r.strategy).toBe('free')
    expect(r.fallback_reason).toBe('NON_PRODUCTION_RECIPE')
  })

  it('§4 — context is preserved but is not an engine verdict input', () => {
    const r = buildSemanticAssessmentRequestV2({ plan: plan(), text: 'x' })
    expect(r.context).toEqual({ situation: 'ctx', text_pt: 'O café ainda está quente.' })
    // requestToAnalyzeParamsV2 never forwards context to the engine.
    expect(requestToAnalyzeParamsV2(r)).not.toHaveProperty('context')
  })
})

// ---- §34.4 equivalent + §34.7-8 shapes -------------------------------------

describe('§34.4/7/8 — equivalent_meaning', () => {
  it('builds an equivalent request with the authored target text + essential words', () => {
    const r = buildSemanticAssessmentRequestV2({ plan: plan({ semantic_assessment: { strategy: 'equivalent_meaning', essential_words: ['coffee'] }, semantic_assessment_source: 'exemplar:x' }), text: 'The coffee is warm.' })
    expect(r.strategy).toBe('equivalent_meaning')
    expect(r.assessment_mode).toBe('equivalent')
    expect(r.equivalent_target).toEqual({ text: 'The coffee is still hot.', essential_words: ['coffee'] })
    expect(r.provenance.source).toBe('exemplar:x')
  })

  it('§34.9 — essential words are authored; missing/empty → free fallback (never generated)', () => {
    const r = buildSemanticAssessmentRequestV2({ plan: plan({ semantic_assessment: { strategy: 'equivalent_meaning', essential_words: [] } }), text: 'x' })
    expect(r.strategy).toBe('free')
    expect(r.fallback_reason).toBe('INVALID_SEMANTIC_METADATA')
  })

  it('§25 — essential word not present in the reference text is rejected', () => {
    const v = validateSemanticAssessmentMetadataV2({ strategy: 'equivalent_meaning', essential_words: ['banana'] }, { referenceText: 'The coffee is still hot.' })
    expect(v.valid).toBe(false)
    expect(v.errors).toContain('SEMANTIC_TARGET_REFERENCES_NON_AUTHORED_TEXT')
  })
})

// ---- §34.3 guided + §34.5-6 invalids ---------------------------------------

describe('§34.3/5/6 — guided_intent & invalids', () => {
  it('valid guided_intent (intent in the real vocabulary) builds a guided request', () => {
    const intent = KNOWN_SEMANTIC_INTENTS[0]
    const r = buildSemanticAssessmentRequestV2({ plan: plan({ semantic_assessment: { strategy: 'guided_intent', requested_intent: intent } }), text: 'x' })
    expect(r.strategy).toBe('guided_intent')
    expect(r.assessment_mode).toBe('guided')
    expect(r.requested_intent).toBe(intent)
  })

  it('§34.5 — an invalid strategy is rejected by the validator', () => {
    const v = validateSemanticAssessmentMetadataV2({ strategy: 'make_it_up' }, { referenceText: 'x' })
    expect(v.valid).toBe(false)
    expect(v.errors).toContain('INVALID_SEMANTIC_ASSESSMENT_STRATEGY')
  })

  it('§34.6 — an invented requested_intent is rejected / falls back to free', () => {
    const v = validateSemanticAssessmentMetadataV2({ strategy: 'guided_intent', requested_intent: 'totally_made_up' }, { referenceText: 'x' })
    expect(v.valid).toBe(false)
    expect(v.errors).toContain('INVALID_REQUESTED_INTENT')
    const r = buildSemanticAssessmentRequestV2({ plan: plan({ semantic_assessment: { strategy: 'guided_intent', requested_intent: 'totally_made_up' } }), text: 'x' })
    expect(r.strategy).toBe('free')
  })

  it('all strategies are enumerated', () => {
    expect(SEMANTIC_STRATEGIES).toEqual(['free', 'guided_intent', 'equivalent_meaning'])
  })
})

// ---- §28 — the shared service forwards EVERY field without loss -------------

describe('§28 — no field is dropped by the shared service', () => {
  it('requestedIntent + equivalentTarget reach analyzeProduction intact', async () => {
    const spy = vi.fn(async () => ({ verdict: 'valid', confidence: 1, detected_errors: [] }))
    const services = createProductionAssessmentServicesV2({ analyzeProduction: spy })
    const request = buildSemanticAssessmentRequestV2({
      plan: plan({ semantic_assessment: { strategy: 'equivalent_meaning', essential_words: ['coffee'] } }),
      text: 'The coffee is warm.',
    })
    await services.analyzeSemantics(request)
    expect(spy).toHaveBeenCalledTimes(1)
    const params = spy.mock.calls[0][0]
    expect(params.text).toBe('The coffee is warm.')
    expect(params.assessmentMode).toBe('equivalent')
    expect(params.equivalentTarget).toEqual({ text: 'The coffee is still hot.', essential_words: ['coffee'] })
    // guided example: requestedIntent must also survive
    const gspy = vi.fn(async () => ({ verdict: 'valid', confidence: 1, detected_errors: [] }))
    const gsvc = createProductionAssessmentServicesV2({ analyzeProduction: gspy })
    await gsvc.analyzeSemantics(buildSemanticAssessmentRequestV2({ plan: plan({ semantic_assessment: { strategy: 'guided_intent', requested_intent: KNOWN_SEMANTIC_INTENTS[0] } }), text: 'x' }))
    expect(gspy.mock.calls[0][0].requestedIntent).toBe(KNOWN_SEMANTIC_INTENTS[0])
  })

  it('the OLD drop-wrapper shape would have lost the fields (regression guard)', () => {
    // Simulate the V2.13 wrapper: it only forwarded { text, assessmentMode }.
    const request = buildSemanticAssessmentRequestV2({ plan: plan({ semantic_assessment: { strategy: 'equivalent_meaning', essential_words: ['coffee'] } }), text: 'x' })
    const oldWrapperParams = ({ text, assessment_mode }) => ({ text, assessmentMode: assessment_mode })
    const dropped = oldWrapperParams(request)
    expect(dropped.equivalentTarget).toBeUndefined() // proves the old path lost it
    // the new path keeps it
    expect(requestToAnalyzeParamsV2(request).equivalentTarget).not.toBeNull()
  })
})

// ---- §34.22 deterministic ---------------------------------------------------

describe('§34.22 — deterministic', () => {
  it('same input → identical request', () => {
    const args = { plan: plan({ semantic_assessment: { strategy: 'equivalent_meaning', essential_words: ['coffee'] } }), text: 'x' }
    expect(JSON.stringify(buildSemanticAssessmentRequestV2(args))).toBe(JSON.stringify(buildSemanticAssessmentRequestV2(args)))
  })
})
