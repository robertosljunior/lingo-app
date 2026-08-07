import { describe, expect, it, vi } from 'vitest'
import { assessGuidedTaskRelevanceV2 } from './task-relevance-gate.js'
import { createProductionAssessmentServicesV2 } from './production-assessment-service.js'
import { evaluateActivityResponseV2 } from './activity-assessment.js'

const validSemantic = {
  verdict: 'valid',
  confidence: 0.95,
  detected_errors: [],
  corrected_version: null,
  natural_alternatives: [],
}

function plan({ id, textEn, fixed = ['but'], recipe = 'guided_production' }) {
  return {
    plan_version: 1,
    activity_id: id,
    session_id: 'session:task-relevance',
    recipe,
    activity_kind: recipe,
    capability: 'controlled_production',
    modality: 'writing',
    exemplar_id: `exemplar:${id}`,
    construction_id: 'construction:but.clause_but_clause',
    text_en: textEn,
    text_pt: null,
    context: null,
    construction_fixed_elements: fixed,
    semantic_assessment: null,
    semantic_assessment_source: null,
    primary_target: { target_type: 'construction', target_id: 'construction:but.clause_but_clause' },
    secondary_targets: [],
    planned_evidence: [],
  }
}

function response(text, id = 'interaction:task-relevance') {
  return {
    response_version: 1,
    interaction_id: id,
    response_type: 'text',
    payload: { text },
  }
}

async function assess(activityPlan, text, analyzeProduction = vi.fn(async () => validSemantic)) {
  return evaluateActivityResponseV2({
    activityPlan,
    response: response(text),
    assessmentServices: createProductionAssessmentServicesV2({ analyzeProduction }),
  })
}

describe('guided task relevance concept preflight', () => {
  it('recognizes paraphrase concepts instead of requiring model-answer tokens', () => {
    const r = assessGuidedTaskRelevanceV2({
      referenceText: 'The house is small, but it is comfortable.',
      responseText: 'My apartment is tiny, but I love it.',
    })
    expect(r.status).toBe('confirmed')
    expect(r.shared_concepts).toEqual(expect.arrayContaining(['house', 'small']))
  })

  it('does not find topical support in a structurally valid but unrelated answer', () => {
    const r = assessGuidedTaskRelevanceV2({
      referenceText: 'The house is small, but it is comfortable.',
      responseText: 'I eat eggs, but I drink milk.',
    })
    expect(r.status).toBe('unconfirmed')
    expect(r.shared_concepts).toEqual([])
  })
})

describe('#72 runtime contract — target form is necessary but not sufficient', () => {
  const apartment = plan({
    id: 'apartment',
    textEn: 'The house is small, but it is comfortable.',
  })
  const bakery = plan({
    id: 'bakery',
    textEn: 'The bread is cheap here, but the coffee is expensive.',
  })

  it('does not award mastery to “I eat eggs, but I drink milk” for the apartment task', async () => {
    const analyzer = vi.fn(async () => validSemantic)
    const a = await assess(apartment, 'I eat eggs, but I drink milk.', analyzer)

    expect(analyzer).not.toHaveBeenCalled()
    expect(a.status).toBe('unable_to_assess')
    expect(a.outcome).toBe('not_assessed')
    expect(a.target_assessments).toEqual([])
    expect(a.semantic_result.task_relevance.status).toBe('unconfirmed')
    expect(a.feedback.natural_alternatives).toEqual([])
  })

  it('keeps the legitimate apartment paraphrase eligible for normal semantic assessment', async () => {
    const analyzer = vi.fn(async () => validSemantic)
    const a = await assess(apartment, 'My apartment is tiny, but I love it.', analyzer)

    expect(analyzer).toHaveBeenCalledTimes(1)
    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('correct')
    expect(a.semantic_result.task_relevance.status).toBe('confirmed')
  })

  it('keeps the legitimate bakery variation eligible', async () => {
    const analyzer = vi.fn(async () => validSemantic)
    const a = await assess(bakery, 'The bread is cheap, but the cakes are expensive.', analyzer)

    expect(analyzer).toHaveBeenCalledTimes(1)
    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('correct')
    expect(a.semantic_result.task_relevance.status).toBe('confirmed')
  })

  it('does not apply guided relevance gating to true free production', async () => {
    const free = plan({
      id: 'free',
      textEn: 'The house is small, but it is comfortable.',
      recipe: 'free_production',
    })
    const analyzer = vi.fn(async () => validSemantic)
    const a = await assess(free, 'I eat eggs, but I drink milk.', analyzer)

    expect(analyzer).toHaveBeenCalledTimes(1)
    expect(a.status).toBe('assessed')
    expect(a.outcome).toBe('correct')
    expect(a.semantic_result.task_relevance).toBeUndefined()
  })
})
