// assessment-diagnosis.test.js — the typed AssessmentDiagnosisV2 contract and
// its honesty invariants (Slice V2.13 §22, §32). The adapter must classify only
// from structured evidence, always carry a source, never turn naturalness or a
// text mismatch into grammar, and prefer `unknown` to fabrication.

import { describe, it, expect } from 'vitest'
import {
  buildAssessmentDiagnosisV2, buildAssessmentCauseCoverageV2,
  DIAGNOSIS_CATEGORIES, DIAGNOSIS_SOURCES, DIAGNOSIS_VERSION,
} from './assessment-diagnosis.js'

const productionPlan = (o = {}) => ({
  recipe: 'guided_production', activity_kind: 'guided_production',
  capability: 'controlled_production', modality: 'writing',
  activity_id: 'a:0', session_id: 's', exemplar_id: 'ex:1',
  primary_target: { target_type: 'construction', target_id: 'construction:price_high' },
  text_en: 'This price is very high.', text_pt: 'Este preço está muito alto.',
  ...o,
})
const textResp = (text) => ({ response_type: 'text', payload: { text }, interaction_id: 'i' })

const semanticResult = (o = {}) => ({
  analysis_version: '1', verdict: 'valid', confidence: 0.75,
  detected_errors: [], natural_alternatives: [], ...o,
})

// ---- contract validity + invariants ----------------------------------------

function assertContract(d) {
  expect(d.diagnosis_version).toBe(DIAGNOSIS_VERSION)
  expect(Array.isArray(d.causes)).toBe(true)
  expect(['specific', 'partial', 'none']).toContain(d.cause_coverage)
  expect(d.target_form_relation).toHaveProperty('status')
  expect(d.semantic_relation).toHaveProperty('status')
  // §22 DIAGNOSIS_CAUSE_WITHOUT_SOURCE — every cause (and primary) has a source.
  const all = [...d.causes, ...(d.primary_cause ? [d.primary_cause] : [])]
  for (const c of all) {
    expect(DIAGNOSIS_CATEGORIES).toContain(c.category)
    expect(DIAGNOSIS_SOURCES).toContain(c.source)
    // §22 NATURALNESS_REPORTED_AS_GRAMMAR — never both.
    expect(c.category === 'naturalness' && c.severity === 'critical').toBe(false)
  }
}

describe('§32.1–2 — contract + every cause has a source', () => {
  it('valid production yields a contract-valid diagnosis with no fabricated cause', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('Its price is very expensive.'),
      semanticResult: semanticResult({ verdict: 'valid' }), assessmentOutcome: 'correct', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'valid', detected_errors: [] },
    })
    assertContract(d)
    expect(d.primary_cause).toBeNull()
    expect(d.causes.filter((c) => c.category !== 'naturalness')).toEqual([])
  })
})

describe('§32.3 — structured grammar', () => {
  it('an agreement error becomes a grammar cause with structured provenance', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('This price are very high.'),
      semanticResult: semanticResult({
        verdict: 'needs_revision',
        detected_errors: [{ error_id: 'agr.1', category: 'verb_form', subtype: 'subject_verb_agreement', severity: 'high', source: 'grammar', explanation_pt: { title: 'Concordância', summary: 'Use "is".' } }],
      }),
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'needs_revision' },
    })
    assertContract(d)
    expect(d.primary_cause.category).toBe('grammar')
    expect(d.primary_cause.source).toBe('structured_error')
    expect(d.primary_cause.origin).toBe('grammar')
    expect(d.cause_coverage).toBe('specific')
  })
})

describe('§32.4 — structured lexical choice', () => {
  it('a Harper WordChoice (vocabulary) error becomes lexical_choice, not grammar', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('This price is very tall.'),
      semanticResult: semanticResult({
        verdict: 'needs_revision',
        detected_errors: [{ error_id: 'wc.1', category: 'vocabulary', severity: 'low', source: 'grammar', message: 'word choice' }],
      }),
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'needs_revision' },
    })
    expect(d.primary_cause.category).toBe('lexical_choice')
  })
})

describe('§32.5/§18 — naturalness separated, never grammar', () => {
  it('a context_preference hint is naturalness and never appears as grammar', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('The price is very expensive.'),
      semanticResult: semanticResult({
        verdict: 'valid_with_suggestions',
        detected_errors: [{ error_id: 'n.1', category: 'naturalness', subtype: 'context_preference', severity: 'low', source: 'pack', explanation_pt: { title: 'Natural', summary: 'high soa melhor' } }],
        natural_alternatives: [{ text: 'The price is very high.', tone: 'natural' }],
      }),
      assessmentOutcome: 'correct', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'valid_with_suggestions' },
    })
    assertContract(d)
    expect(d.causes.some((c) => c.category === 'naturalness')).toBe(true)
    expect(d.causes.some((c) => c.category === 'grammar')).toBe(false)
  })
})

describe('§32.6 — semantic context only with evidence', () => {
  it('classifies semantic_context when a meaning error exists', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('I like bananas.'),
      semanticResult: semanticResult({
        verdict: 'needs_revision',
        detected_errors: [{ error_id: 'meaning_mismatch', category: 'meaning', subtype: 'equivalent_meaning', severity: 'high', source: 'semantic_equivalence', explanation_pt: { title: 'Significado', summary: 'Outro sentido.' } }],
      }),
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'needs_revision' },
    })
    expect(d.primary_cause.category).toBe('semantic_context')
    expect(d.semantic_relation.status).toBe('not_aligned')
    expect(d.cause_coverage).toBe('specific')
  })

  it('§29 — does NOT invent semantic_context when the engine gives no structured cause', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('I like bananas.'),
      semanticResult: semanticResult({ verdict: 'needs_revision', detected_errors: [] }),
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'needs_revision' },
    })
    expect(d.primary_cause.category).toBe('unknown')
    expect(d.cause_coverage).toBe('none')
    expect(d.semantic_relation.status).toBe('unknown')
  })
})

describe('§32.7/§10 — target form is not grammar and needs structure', () => {
  it('free production without a verifiable fixed element leaves target_form unknown', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ recipe: 'free_production' }), response: textResp('Totally different sentence.'),
      semanticResult: semanticResult({ verdict: 'valid' }), assessmentOutcome: 'correct', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'valid' },
    })
    expect(d.target_form_relation.status).toBe('unknown')
  })

  it('a verifiable fixed element present → matches (structural, not string equality)', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ construction_fixed_elements: ['yet'] }), response: textResp('It is not ready yet.'),
      semanticResult: semanticResult({ verdict: 'valid' }), assessmentOutcome: 'correct', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'valid' },
    })
    expect(d.target_form_relation.status).toBe('matches')
    expect(d.target_form_relation.source).toBe('deterministic_comparison')
  })

  it('a verifiable fixed element absent → different_form, never a grammar cause', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ construction_fixed_elements: ['yet'] }), response: textResp('It is not ready.'),
      semanticResult: semanticResult({ verdict: 'valid' }), assessmentOutcome: 'correct', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'valid' },
    })
    expect(d.target_form_relation.status).toBe('different_form')
    expect(d.causes.some((c) => c.category === 'grammar')).toBe(false)
  })
})

describe('§32.8–10 — unknown is allowed; coarse outcomes → unknown', () => {
  it('coarse partial with no detected errors → unknown / none', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('This is high price.'),
      semanticResult: semanticResult({ verdict: 'needs_revision', detected_errors: [] }),
      assessmentOutcome: 'partial', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'needs_revision' },
    })
    expect(d.primary_cause.category).toBe('unknown')
    expect(d.cause_coverage).toBe('none')
  })

  it('coarse incorrect with no detected errors → unknown / none', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('xyz'),
      semanticResult: semanticResult({ verdict: 'needs_revision', detected_errors: [] }),
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'semantic', verdict: 'needs_revision' },
    })
    expect(d.primary_cause.category).toBe('unknown')
    expect(d.cause_coverage).toBe('none')
  })
})

describe('§32.11–13 — deterministic recipes', () => {
  it('choice incorrect → INCORRECT_OPTION_SELECTED, deterministic, not grammar', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ recipe: 'meaning_recognition' }),
      response: { response_type: 'single_choice', payload: { option_id: 'b' }, interaction_id: 'i' },
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'choice', chosen_option_id: 'b', correct_option_id: 'a' },
    })
    expect(d.primary_cause.code).toBe('INCORRECT_OPTION_SELECTED')
    expect(d.primary_cause.category).toBe('target_form')
    expect(d.primary_cause.source).toBe('deterministic_comparison')
    expect(d.primary_cause.category).not.toBe('grammar')
  })

  it('completion incorrect → FIXED_ELEMENT_MISMATCH + different_form', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ recipe: 'fixed_element_completion' }), response: textResp('wrong'),
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'completion', expected_tokens: ['yet'], given: ['wrong'] },
    })
    expect(d.primary_cause.code).toBe('FIXED_ELEMENT_MISMATCH')
    expect(d.target_form_relation.status).toBe('different_form')
  })

  it('word-order incorrect → TOKEN_SEQUENCE_MISMATCH', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ recipe: 'word_order_reconstruction' }),
      response: { response_type: 'token_sequence', payload: { tokens: ['b', 'a'] }, interaction_id: 'i' },
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed',
      feedback: { kind: 'word_order', expected_tokens: ['a', 'b'], given_tokens: ['b', 'a'] },
    })
    expect(d.primary_cause.code).toBe('TOKEN_SEQUENCE_MISMATCH')
  })
})

describe('§32.14–16 — exposure / pronunciation / speech', () => {
  it('exposure → not applicable, no error cause', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ recipe: 'exposure' }), response: { response_type: 'continue', payload: {} },
      assessmentOutcome: 'observed', assessmentStatus: 'not_assessed', feedback: { kind: 'exposure' },
    })
    expect(d.primary_cause).toBeNull()
    expect(d.applicability).toBe('not_applicable')
  })

  it('pronunciation without acoustic assessor → assessment_unavailable, no invented error', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ recipe: 'pronunciation' }), response: { response_type: 'pronunciation_attempt', payload: {} },
      assessmentOutcome: 'observed', assessmentStatus: 'not_assessed', feedback: { kind: 'pronunciation', reason: 'no_acoustic_assessor' },
    })
    expect(d.primary_cause.category).toBe('unknown')
    expect(d.primary_cause.code).toBe('ASSESSMENT_UNAVAILABLE_NO_ACOUSTIC_ASSESSOR')
  })

  it('speech low confidence → unknown LOW_STT, never a linguistic cause on the learner', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan({ recipe: 'free_production' }),
      response: { response_type: 'speech_transcript', payload: { transcript: '' } },
      assessmentOutcome: 'not_assessed', assessmentStatus: 'unable_to_assess', feedback: { kind: 'speech', reason: 'low_confidence' },
    })
    expect(d.primary_cause.code).toBe('LOW_STT_OR_COMBINED_CONFIDENCE')
    expect(d.primary_cause.category).toBe('unknown')
  })
})

describe('§32.17–18 — text mismatch / naturalness never invent grammar', () => {
  it('a text different from the model with a valid verdict yields no grammar cause', () => {
    const d = buildAssessmentDiagnosisV2({
      activityPlan: productionPlan(), response: textResp('The price is too high.'),
      semanticResult: semanticResult({ verdict: 'valid', detected_errors: [] }),
      assessmentOutcome: 'correct', assessmentStatus: 'assessed', feedback: { kind: 'semantic', verdict: 'valid' },
    })
    expect(d.causes.some((c) => c.category === 'grammar')).toBe(false)
    expect(d.primary_cause).toBeNull()
  })
})

describe('§32.24 — cause coverage metrics', () => {
  it('aggregates specific / partial / unknown and a category distribution', () => {
    const mk = (coverage, category) => ({ isProductionAssessment: true, diagnosis: { cause_coverage: coverage, primary_cause: category ? { category } : null } })
    const cov = buildAssessmentCauseCoverageV2([
      mk('specific', 'grammar'),
      mk('specific', 'semantic_context'),
      mk('none', null),
      mk('partial', 'naturalness'),
      { isProductionAssessment: false, diagnosis: { cause_coverage: 'specific', primary_cause: { category: 'grammar' } } },
    ])
    expect(cov.assessed_production_count).toBe(4)
    expect(cov.specific_cause_count).toBe(2)
    expect(cov.partial_cause_count).toBe(1)
    expect(cov.unknown_cause_count).toBe(1)
    expect(cov.cause_coverage_rate).toBe(0.5)
    expect(cov.cause_distribution.grammar).toBe(2) // includes the non-production one
    expect(cov.cause_distribution.unknown).toBe(1)
  })
})

describe('§32.25 — deterministic output (pure)', () => {
  it('same input → identical diagnosis', () => {
    const args = {
      activityPlan: productionPlan(), response: textResp('This price are very high.'),
      semanticResult: semanticResult({ verdict: 'needs_revision', detected_errors: [{ error_id: 'a', category: 'verb_form', severity: 'high', source: 'grammar', explanation_pt: { title: 't', summary: 's' } }] }),
      assessmentOutcome: 'incorrect', assessmentStatus: 'assessed', feedback: { kind: 'semantic', verdict: 'needs_revision' },
    }
    expect(JSON.stringify(buildAssessmentDiagnosisV2(args))).toBe(JSON.stringify(buildAssessmentDiagnosisV2(args)))
  })
})
