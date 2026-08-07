// evaluator-hardening.test.js — P0 regressions from issue #72.
//
// These tests intentionally use an OVERLY PERMISSIVE semantic service. The
// assessment adapter must still refuse mastery when a learner did not realize
// the authored target form or when speech transcription flips the practiced
// sentence's polarity. This proves the hard gates cannot be bypassed by a
// broadly-positive semantic verdict.

import { describe, expect, it } from 'vitest'
import { evaluateActivityResponseV2 } from './activity-assessment.js'

const permissiveServices = {
  async analyzeSemantics(request) {
    return {
      verdict: 'valid',
      confidence: 0.95,
      detected_errors: [],
      corrected_version: null,
      // Deliberately unsafe support: a hard gate must suppress this instead of
      // allowing an invalid learner/ASR string to become “Forma mais natural”.
      natural_alternatives: [{ text: request.text, tone: 'natural' }],
    }
  },
}

function productionPlan({
  id = 'activity:hardening',
  recipe = 'guided_production',
  textEn,
  fixedElements,
  targetId,
  modality = 'writing',
} = {}) {
  return {
    plan_version: 1,
    activity_id: id,
    session_id: 'session:hardening',
    recipe,
    activity_kind: recipe,
    capability: recipe === 'guided_production' ? 'guided_production' : 'free_production',
    modality,
    text_en: textEn,
    text_pt: null,
    context: null,
    construction_fixed_elements: fixedElements,
    semantic_assessment: null,
    semantic_assessment_source: null,
    primary_target: { target_type: 'construction', target_id: targetId },
    secondary_targets: [],
    planned_evidence: [],
  }
}

function textResponse(text, interactionId = 'interaction:text') {
  return {
    response_version: 1,
    interaction_id: interactionId,
    response_type: 'text',
    payload: { text },
  }
}

function speechResponse(transcript, interactionId = 'interaction:speech') {
  return {
    response_version: 1,
    interaction_id: interactionId,
    response_type: 'speech_transcript',
    payload: { transcript, stt_confidence: 0.9 },
  }
}

async function assess(plan, response) {
  return evaluateActivityResponseV2({
    activityPlan: plan,
    response,
    assessmentServices: permissiveServices,
  })
}

describe('P0-A — production mastery requires the authored target form', () => {
  const apartment = productionPlan({
    id: 'activity:apartment-but',
    textEn: 'The house is small, but it is comfortable.',
    fixedElements: ['but'],
    targetId: 'construction:but.clause_but_clause',
  })

  const bakery = productionPlan({
    id: 'activity:bakery-but',
    textEn: 'The bread is cheap here, but the coffee is expensive.',
    fixedElements: ['but'],
    targetId: 'construction:but.clause_but_clause',
  })

  it('rejects the observed apartment answer “I eat egg” even if semantics says valid', async () => {
    const a = await assess(apartment, textResponse('I eat egg'))

    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('incorrect')
    expect(a.feedback.production_gate).toMatchObject({ code: 'TARGET_FORM_MISSING', kind: 'target_form' })
    expect(a.feedback.production_gate.missing_fixed_elements).toEqual(['but'])
    expect(a.feedback.natural_alternatives).toEqual([])
    expect(a.semantic_result.natural_alternatives).toEqual([])
    expect(a.diagnosis.target_form_relation.status).toBe('different_form')
  })

  it('rejects the observed bakery answer that never realizes contrast / but', async () => {
    const a = await assess(bakery, textResponse('The price of this milk not churn yet', 'interaction:bakery'))

    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('incorrect')
    expect(a.feedback.production_gate.code).toBe('TARGET_FORM_MISSING')
    expect(a.feedback.natural_alternatives).toEqual([])
    expect(a.diagnosis.target_form_relation.status).toBe('different_form')
  })

  it('keeps legitimate apartment variation — no model-answer string matching', async () => {
    const a = await assess(apartment, textResponse('My apartment is tiny, but I love it.', 'interaction:apartment-valid'))

    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('correct')
    expect(a.feedback.production_gate).toBeNull()
    expect(a.diagnosis.target_form_relation.status).toBe('matches')
  })

  it('keeps legitimate bakery variation with the target construction', async () => {
    const a = await assess(bakery, textResponse('The bread is cheap, but the cakes are expensive.', 'interaction:bakery-valid'))

    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('correct')
    expect(a.feedback.production_gate).toBeNull()
    expect(a.diagnosis.target_form_relation.status).toBe('matches')
  })
})

describe('P0-B — speech cannot flip the practiced polarity and still pass', () => {
  const bus = productionPlan({
    id: 'activity:bus-yet',
    textEn: "The bus isn't here yet.",
    fixedElements: ['yet'],
    targetId: 'construction:yet.subject_be_not_complement_yet',
    modality: 'speaking',
  })

  const dinner = productionPlan({
    id: 'activity:dinner-yet',
    textEn: "Dinner isn't ready yet, so let's wait.",
    fixedElements: ['yet'],
    targetId: 'construction:yet.subject_be_not_complement_yet',
    modality: 'speaking',
  })

  it('rejects “the buzz is into here yet” and never promotes it as a natural alternative', async () => {
    const a = await assess(bus, speechResponse('the buzz is into here yet'))

    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('incorrect')
    expect(a.feedback.production_gate).toMatchObject({ code: 'SPEECH_POLARITY_MISMATCH', kind: 'semantic_context' })
    expect(a.feedback.natural_alternatives).toEqual([])
    expect(a.semantic_result.natural_alternatives).toEqual([])
    expect(a.diagnosis.primary_cause.category).toBe('semantic_context')
    expect(a.diagnosis.semantic_relation.status).toBe('not_aligned')
  })

  it('rejects “dinner is inside so let’s wait” instead of awarding target mastery', async () => {
    const a = await assess(dinner, speechResponse("dinner is inside so let's wait", 'interaction:dinner'))

    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('incorrect')
    // “yet” is absent, so the target-form gate fires before the polarity gate.
    expect(a.feedback.production_gate).toMatchObject({ code: 'TARGET_FORM_MISSING', kind: 'target_form' })
    expect(a.feedback.natural_alternatives).toEqual([])
    expect(a.diagnosis.target_form_relation.status).toBe('different_form')
  })

  it('tolerates lexical ASR variation when the required negative-yet structure survives', async () => {
    const a = await assess(bus, speechResponse("the buzz isn't here yet", 'interaction:bus-lexical-variation'))

    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('correct')
    expect(a.feedback.production_gate).toBeNull()
    expect(a.diagnosis.target_form_relation.status).toBe('matches')
  })
})
