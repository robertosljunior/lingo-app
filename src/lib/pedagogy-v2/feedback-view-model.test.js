// feedback-view-model.test.js — the honesty guarantees of the Slice V2.12
// feedback adapter (§7, §8, §9, §17, §19, §32–36). Every assertion protects
// the single rule that the adapter presents ONLY what the assessor reported and
// never invents a linguistic cause.

import { describe, it, expect } from 'vitest'
import {
  buildV2FeedbackViewModel,
  assessmentProvenanceV2,
  responseTextV2,
} from './feedback-view-model.js'

// ---- fixtures ---------------------------------------------------------------

function productionPlan(overrides = {}) {
  return {
    plan_version: 1,
    recipe: 'guided_production',
    activity_kind: 'guided_production',
    capability: 'controlled_production',
    modality: 'writing',
    activity_id: 'activity:s.0',
    session_id: 's',
    exemplar_id: 'exemplar:x',
    primary_target: { target_type: 'construction', target_id: 'construction:price_high' },
    text_en: 'This price is very high.',
    text_pt: 'Este preço está muito alto.',
    planned_evidence: [
      { target: { target_type: 'construction', target_id: 'construction:price_high' }, attribution: 'direct', activity: { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing' } },
    ],
    ...overrides,
  }
}

function textResponse(text) {
  return { response_type: 'text', interaction_id: 'interaction:s:activity:s.0:1', payload: { text }, submitted_at: '2026-07-21T00:00:00.000Z' }
}

const semanticAssessment = (feedback, { outcome = 'partial', status = 'assessed', confidence = 0.7, partial = 0.75 } = {}) => ({
  assessment_version: 1,
  activity_id: 'activity:s.0',
  interaction_id: 'interaction:s:activity:s.0:1',
  status,
  outcome,
  partial_score: partial,
  assessment_confidence: confidence,
  feedback: { kind: 'semantic', ...feedback },
  target_assessments: [],
})

// ---- §7 / §32 — textual mismatch alone never becomes a grammar error -------

describe('§7/§32 — a textual mismatch is not a linguistic error', () => {
  it('a valid response that merely differs from the reference produces NO issues', () => {
    // "Its price is very expensive." vs reference "This price is very high." —
    // assessor found nothing wrong. The adapter must not invent "Erro: to be".
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan(),
      response: textResponse('Its price is very expensive.'),
      assessment: semanticAssessment({ verdict: 'valid', detected_errors: [], natural_alternatives: [] }, { outcome: 'correct', partial: null }),
    })
    expect(vm.status).toBe('correct')
    expect(vm.issues).toEqual([])
    // The reference form is still shown for comparison, but as target_form.
    expect(vm.target_form).toEqual({ text_en: 'This price is very high.', text_pt: 'Este preço está muito alto.' })
  })

  it('a naturalness-only suggestion never appears as an issue (§8/§35)', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan(),
      response: textResponse('The price is very expensive.'),
      assessment: semanticAssessment({
        verdict: 'valid_with_suggestions',
        detected_errors: [{ error_id: 'nat.1', category: 'naturalness', subtype: 'context_preference', severity: 'low', explanation_pt: { title: 'Forma mais natural', summary: '“high” soa mais natural que “expensive” para preço.' } }],
        natural_alternatives: [{ text: 'The price is very high.', tone: 'natural' }],
      }, { outcome: 'correct', partial: null }),
    })
    expect(vm.issues).toEqual([])
    expect(vm.suggestions.length).toBeGreaterThan(0)
    expect(vm.suggestions.some((s) => /natural/i.test(s.text) || /high/.test(s.text))).toBe(true)
  })
})

// ---- §8/§33 — an issue appears ONLY with a matching detected error ----------

describe('§8/§33 — issues require a reported linguistic error', () => {
  it('a real agreement error surfaces as an issue with its category/severity', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan(),
      response: textResponse('This price are very high.'),
      assessment: semanticAssessment({
        verdict: 'needs_revision',
        detected_errors: [{ error_id: 'agr.1', category: 'verb_form', severity: 'high', explanation_pt: { title: 'Concordância verbal', summary: '“price” é singular: use “is”, não “are”.' } }],
        natural_alternatives: [],
      }, { outcome: 'incorrect', partial: null }),
    })
    expect(vm.status).toBe('incorrect')
    expect(vm.issues).toHaveLength(1)
    expect(vm.issues[0].category).toBe('verb_form')
    expect(vm.issues[0].severity).toBe('high')
    expect(vm.issues[0].text).toMatch(/is.*are|singular/i)
  })
})

// ---- §9/§34 — partial without a specific cause is stated honestly ----------

describe('§9/§34 — coarse outcome with no structured cause', () => {
  it('partial with no detected errors invents nothing and adds a diagnostics note', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan(),
      response: textResponse('This is high price.'),
      assessment: semanticAssessment({ verdict: 'needs_revision', detected_errors: [], natural_alternatives: [] }, { outcome: 'partial', partial: 0.5 }),
    })
    expect(vm.status).toBe('partial')
    expect(vm.issues).toEqual([])
    expect(vm.suggestions).toEqual([])
    expect(vm.headline).toMatch(/parcial/i)
    expect(vm.diagnostics.note).toMatch(/não forneceu uma causa/i)
  })

  it('incorrect from a semantic engine with no cause says so instead of inventing one', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan(),
      response: textResponse('I like bananas.'),
      assessment: semanticAssessment({ verdict: 'needs_revision', detected_errors: [], natural_alternatives: [] }, { outcome: 'incorrect', partial: null }),
    })
    expect(vm.issues).toEqual([])
    expect(vm.diagnostics.note).toMatch(/não forneceu uma causa/i)
  })
})

// ---- §36 — target form is separate from a linguistic error ------------------

describe('§36 — forma-alvo is separate from an error', () => {
  it('target_form is populated even when there are zero issues', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan(),
      response: textResponse('The price is too high.'),
      assessment: semanticAssessment({ verdict: 'valid', detected_errors: [], natural_alternatives: [] }, { outcome: 'correct', partial: null }),
    })
    expect(vm.target_form.text_en).toBe('This price is very high.')
    expect(vm.issues).toEqual([])
  })

  it('exposure has no target_form and no issues', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan({ recipe: 'exposure', activity_kind: 'exposure' }),
      response: { response_type: 'continue', payload: {}, interaction_id: 'i' },
      assessment: { status: 'not_assessed', outcome: 'observed', feedback: { kind: 'exposure' } },
    })
    expect(vm.status).toBe('not_assessed')
    expect(vm.target_form).toBeNull()
    expect(vm.issues).toEqual([])
    expect(vm.diagnostics.provenance.code).toBe('observed_exposure')
  })
})

// ---- deterministic recipes --------------------------------------------------

describe('deterministic recipes — exact comparison provenance', () => {
  it('a wrong choice is incorrect via exact option comparison, no invented cause', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan({ recipe: 'meaning_recognition', activity_kind: 'meaning_recognition', text_en: null }),
      response: { response_type: 'single_choice', payload: { option_id: 'opt:b' }, interaction_id: 'i' },
      assessment: { status: 'assessed', outcome: 'incorrect', assessment_confidence: 1, feedback: { kind: 'choice', chosen_option_id: 'opt:b', correct_option_id: 'opt:a' } },
    })
    expect(vm.status).toBe('incorrect')
    expect(vm.issues).toEqual([])
    // Deterministic mismatch needs no linguistic note.
    expect(vm.diagnostics.note).toBeNull()
    expect(vm.diagnostics.provenance.code).toBe('exact_option_comparison')
  })

  it('a completion partial credits the matched part without inventing a rule', () => {
    const vm = buildV2FeedbackViewModel({
      plan: productionPlan({ recipe: 'fixed_element_completion', activity_kind: 'controlled_completion' }),
      response: textResponse('still'),
      assessment: { status: 'assessed', outcome: 'partial', partial_score: 0.5, assessment_confidence: 1, feedback: { kind: 'completion', expected_tokens: ['a', 'b'], given: ['a', 'x'] } },
    })
    expect(vm.status).toBe('partial')
    expect(vm.correct_points.length).toBeGreaterThan(0)
    expect(vm.issues).toEqual([])
  })
})

// ---- provenance + raw text --------------------------------------------------

describe('§11 — provenance is derived from real pipeline data', () => {
  it('spoken production is attributed to STT + semantic', () => {
    const prov = assessmentProvenanceV2(
      productionPlan({ recipe: 'free_production' }),
      { response_type: 'speech_transcript', payload: { transcript: 'hi' } },
      { feedback: { kind: 'speech', reason: 'low_confidence' }, status: 'unable_to_assess' },
    )
    expect(prov.code).toBe('speech_semantic')
  })

  it('responseTextV2 returns the raw payload untouched', () => {
    expect(responseTextV2(productionPlan(), textResponse('Raw ANSWER.'))).toBe('Raw ANSWER.')
    expect(responseTextV2({ recipe: 'word_order_reconstruction' }, { response_type: 'token_sequence', payload: { tokens: ['a', 'b'] } })).toBe('a b')
  })
})

// ---- §17 — raw vs presented traceability ------------------------------------

describe('§17/§19 — presented feedback is traceable to the raw assessment', () => {
  it('every issue/suggestion count is reflected in diagnostics and traces to reported items', () => {
    const assessment = semanticAssessment({
      verdict: 'needs_revision',
      detected_errors: [
        { error_id: 'g.1', category: 'grammar', severity: 'medium', explanation_pt: { title: 'Uso', summary: 'x' } },
        { error_id: 'n.1', category: 'naturalness', severity: 'low', explanation_pt: { title: 'Natural', summary: 'y' } },
      ],
      natural_alternatives: [{ text: 'Better form.' }],
    }, { outcome: 'incorrect', partial: null })
    const vm = buildV2FeedbackViewModel({ plan: productionPlan(), response: textResponse('bad'), assessment })
    expect(vm.diagnostics.reported_error_count).toBe(2)
    expect(vm.diagnostics.linguistic_issue_count).toBe(1)
    expect(vm.issues).toHaveLength(1)
    expect(vm.suggestions.length).toBe(2) // 1 naturalness note + 1 alternative
    // No V1 skill_id ever leaks into the view model.
    expect(JSON.stringify(vm)).not.toMatch(/skill_id|grammar_skill_v1/)
  })
})

// ---- §14/§32.21 — the view model CONSUMES the typed diagnosis ---------------

const diag = (fields) => ({ diagnosis_version: 1, primary_cause: null, causes: [], positive_findings: [], target_form_relation: { status: 'unknown' }, semantic_relation: { status: 'unknown' }, cause_coverage: 'none', ...fields })

describe('§14/§32.21 — feedback VM prioritizes the diagnosis', () => {
  it('routes grammar/lexical/semantic causes to issues and naturalness to suggestions', () => {
    const assessment = {
      ...semanticAssessment({ verdict: 'needs_revision' }, { outcome: 'incorrect', partial: null }),
      diagnosis: diag({
        cause_coverage: 'specific',
        primary_cause: { category: 'grammar', code: 'AGR', source: 'structured_error', severity: 'high', explanation: { title: 'Concordância', summary: 'Use is.' } },
        causes: [
          { category: 'grammar', code: 'AGR', source: 'structured_error', severity: 'high', explanation: { title: 'Concordância', summary: 'Use is.' } },
          { category: 'naturalness', code: 'NAT', source: 'semantic_engine', severity: 'low', explanation: { summary: 'high soa melhor' } },
        ],
      }),
    }
    const vm = buildV2FeedbackViewModel({ plan: productionPlan(), response: textResponse('This price are high.'), assessment })
    expect(vm.issues).toHaveLength(1)
    expect(vm.issues[0].category).toBe('grammar')
    expect(vm.issues[0].source).toBe('structured_error')
    expect(vm.suggestions.some((s) => /soa melhor/.test(s.text))).toBe(true)
    expect(vm.diagnostics.diagnosis_present).toBe(true)
    expect(vm.diagnostics.cause_coverage).toBe('specific')
  })

  it('a target_form cause becomes a note, never an issue (§14)', () => {
    const assessment = {
      status: 'assessed', outcome: 'incorrect', assessment_confidence: 1,
      feedback: { kind: 'completion', expected_tokens: ['yet'], given: ['no'] },
      diagnosis: diag({
        cause_coverage: 'specific',
        primary_cause: { category: 'target_form', code: 'FIXED_ELEMENT_MISMATCH', source: 'deterministic_comparison', severity: null, explanation: { summary: 'Não corresponde à forma esperada.' } },
        causes: [{ category: 'target_form', code: 'FIXED_ELEMENT_MISMATCH', source: 'deterministic_comparison', severity: null, explanation: { summary: 'Não corresponde à forma esperada.' } }],
        target_form_relation: { status: 'different_form' },
      }),
    }
    const vm = buildV2FeedbackViewModel({ plan: productionPlan({ recipe: 'fixed_element_completion' }), response: textResponse('no'), assessment })
    expect(vm.issues).toEqual([])
    expect(vm.target_form_note).toBeTruthy()
  })

  it('§9/§34 — diagnosis cause_coverage none → honest note, no invented issue', () => {
    const assessment = {
      ...semanticAssessment({ verdict: 'needs_revision' }, { outcome: 'partial', partial: 0.5 }),
      diagnosis: diag({ cause_coverage: 'none', primary_cause: { category: 'unknown', code: 'X', source: 'semantic_engine' } }),
    }
    const vm = buildV2FeedbackViewModel({ plan: productionPlan(), response: textResponse('This is high price.'), assessment })
    expect(vm.issues).toEqual([])
    expect(vm.suggestions).toEqual([])
    expect(vm.diagnostics.note).toMatch(/não forneceu uma causa/i)
  })

  it('§22 — a naturalness diagnosis cause never lands in issues (invariant)', () => {
    const assessment = {
      ...semanticAssessment({ verdict: 'valid_with_suggestions' }, { outcome: 'correct', partial: null }),
      diagnosis: diag({
        cause_coverage: 'specific',
        causes: [{ category: 'naturalness', code: 'NAT', source: 'semantic_engine', severity: 'low', explanation: { summary: 'mais natural' } }],
      }),
    }
    const vm = buildV2FeedbackViewModel({ plan: productionPlan(), response: textResponse('The price is very expensive.'), assessment })
    expect(vm.issues.some((i) => i.category === 'grammar')).toBe(false)
    expect(vm.issues).toEqual([])
    expect(vm.suggestions.length).toBeGreaterThan(0)
  })
})

// ---- Slice V2.15 §22 — semantic-equivalence-aware learner copy --------------
describe('§22 — meaning-equivalence feedback copy', () => {
  const semAssess = (o) => ({ status: o.status, outcome: o.outcome, assessment_confidence: 0.4, feedback: { kind: 'semantic' }, diagnosis: o.diagnosis })
  it('uncertain equivalence → honest "could not confirm" copy, no invented error', () => {
    const a = semAssess({ status: 'unable_to_assess', outcome: 'not_assessed', diagnosis: diag({ semantic_relation: { status: 'uncertain' }, cause_coverage: 'none', primary_cause: { category: 'unknown', code: 'SEMANTIC_EQUIVALENCE_UNCERTAIN', source: 'semantic_equivalence' } }) })
    const vm = buildV2FeedbackViewModel({ plan: productionPlan(), response: textResponse('The plan is very good.'), assessment: a })
    expect(vm.issues).toEqual([])
    expect(vm.diagnostics.note).toMatch(/não consegui confirmar/i)
  })
  it('aligned meaning + different target form → reassuring target-form note', () => {
    const a = { status: 'assessed', outcome: 'correct', assessment_confidence: 0.85, feedback: { kind: 'semantic' },
      diagnosis: diag({ semantic_relation: { status: 'aligned' }, target_form_relation: { status: 'different_form' }, cause_coverage: 'specific' }) }
    const vm = buildV2FeedbackViewModel({ plan: productionPlan(), response: textResponse('The coffee remains warm.'), assessment: a })
    expect(vm.target_form_note).toMatch(/comunica a ideia/i)
    expect(vm.issues.some((i) => i.category === 'semantic_context')).toBe(false)
  })
})
