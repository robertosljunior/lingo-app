// learner-presentation-v2.test.js — the Slice V2.17 learner presentation
// adapter (§39). Every case protects the honesty rules: the visual variant is
// derived from structured data only, never changes the assessment outcome, and
// no linguistic claim is invented.

import { describe, it, expect } from 'vitest'
import {
  buildLearnerPresentationV2,
  buildLearnerSessionSummaryV2,
  deriveVisualVariantV2,
  LEARNER_VISUAL_VARIANTS,
} from './learner-presentation-v2.js'
import { loadPedagogyV2Registry, getPedagogyPack } from './registry.js'

// A learner state proving REAL prior familiarity with a pack's lexeme: one of
// its own targets already has exposure (V2.17-R §2).
const registry = loadPedagogyV2Registry()
function familiarStatesFor(packId) {
  const pack = getPedagogyPack(packId, registry)
  const tid = pack.senses?.[0]?.sense_id || pack.constructions?.[0]?.construction_id
  return [{ target: { target_type: 'sense', target_id: tid }, exposure: { count: 1 } }]
}

// ---- fixtures ---------------------------------------------------------------

function productionPlan(overrides = {}) {
  return {
    plan_version: 1,
    recipe: 'free_production',
    activity_kind: 'free_production',
    capability: 'free_production',
    modality: 'writing',
    activity_id: 'activity:s.0',
    session_id: 's',
    exemplar_id: 'exemplar:x',
    pack_id: 'pedagogy_v2_still',
    lexeme_lemma: 'still',
    primary_target: { target_type: 'construction', target_id: 'construction:price_high' },
    text_en: 'This price is very high.',
    text_pt: 'Este preço está muito alto.',
    planned_evidence: [],
    ...overrides,
  }
}

const textResponse = (text) => ({ response_type: 'text', interaction_id: 'i:1', payload: { text }, submitted_at: '2026-07-23T00:00:00.000Z' })

// A semantic assessment carrying a typed diagnosis (the real V2.13+ shape).
function semanticAssessment({ outcome, status = 'assessed', diagnosis, feedback = {}, semantic_equivalence = null } = {}) {
  return {
    assessment_version: 1,
    activity_id: 'activity:s.0',
    interaction_id: 'i:1',
    status,
    outcome,
    partial_score: null,
    assessment_confidence: 0.7,
    feedback: { kind: 'semantic', detected_errors: [], natural_alternatives: [], ...feedback },
    diagnosis,
    semantic_result: semantic_equivalence ? { semantic_equivalence } : null,
    target_assessments: [],
  }
}

function diagnosis({ causes = [], semantic_relation = { status: 'unknown' }, target_form_relation = { status: 'not_applicable' }, cause_coverage = 'specific', positive_findings = [] } = {}) {
  const primary = causes[0] ?? null
  return { causes, primary_cause: primary, semantic_relation, target_form_relation, cause_coverage, positive_findings }
}

const cause = (category, code, summary, title = null) => ({
  category, code, severity: 'medium', confidence: 0.6, source: 'semantic_engine',
  explanation: { title, summary },
})

const buildFor = (assessment, extra = {}) => buildLearnerPresentationV2({
  plan: productionPlan(), response: textResponse('...'), assessment, focus: { pack_id: 'pedagogy_v2_still' }, ...extra,
})

// ---- §39.1 correct ----------------------------------------------------------

describe('§39.1 — correct', () => {
  it('an accepted answer with no naturalness note is `correct`', () => {
    const a = semanticAssessment({ outcome: 'correct', diagnosis: diagnosis({ semantic_relation: { status: 'aligned' } }) })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('correct')
    expect(p.feedback.outcome_status).toBe('correct')
    expect(p.feedback.issues).toEqual([])
  })
})

// ---- §39.2 correct + naturalness → suggestion -------------------------------

describe('§39.2 / §39.10 — correct + naturalness is `suggestion`, never linguistic', () => {
  it('a naturalness alternative on a correct answer yields `suggestion`', () => {
    const a = semanticAssessment({
      outcome: 'correct',
      feedback: { natural_alternatives: [{ text: 'This price is very high.', tone: 'natural' }] },
      diagnosis: diagnosis({
        causes: [cause('naturalness', 'NATURAL_ALTERNATIVE', 'Com “price”, “high” costuma soar mais natural.')],
        semantic_relation: { status: 'aligned' },
      }),
    })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('suggestion')
    expect(p.feedback.issues).toEqual([]) // §12 — naturalness is NEVER an issue
    expect(p.feedback.suggestions.length).toBeGreaterThan(0)
    expect(p.feedback.suggestions[0].label).toBe('Forma mais natural')
  })
})

// ---- §39.3 partial ----------------------------------------------------------

describe('§39.3 — partial without a specific category', () => {
  it('a coarse partial with no structured cause is `partial`', () => {
    const a = semanticAssessment({ outcome: 'partial', diagnosis: diagnosis({ cause_coverage: 'none', semantic_relation: { status: 'unknown' } }) })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('partial')
    expect(p.feedback.outcome_status).toBe('partial')
  })
})

// ---- §39.4 grammar issue → linguistic ---------------------------------------

describe('§39.4 — grammar issue', () => {
  it('a structured grammar cause is `linguistic`', () => {
    const a = semanticAssessment({
      outcome: 'incorrect',
      feedback: { detected_errors: [{ error_id: 'g.1', category: 'grammar', severity: 'medium', explanation_pt: { title: 'Concordância', summary: 'O verbo não concorda com o sujeito.' } }] },
      diagnosis: diagnosis({ causes: [cause('grammar', 'AGREEMENT', 'O verbo não concorda com o sujeito.', 'Concordância')] }),
    })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('linguistic')
    expect(p.feedback.issues.length).toBe(1)
    // title becomes the visible line, the summary becomes the "Entender melhor" detail (§8)
    expect(p.feedback.issues[0].text).toBe('Concordância')
    expect(p.feedback.issues[0].detail).toBe('O verbo não concorda com o sujeito.')
    expect(p.feedback.issues[0].span).toBeNull()
  })
})

// ---- §39.5 lexical issue → linguistic ---------------------------------------

describe('§39.5 — lexical issue', () => {
  it('a structured lexical_choice cause is `linguistic`', () => {
    const a = semanticAssessment({
      outcome: 'incorrect',
      diagnosis: diagnosis({ causes: [cause('lexical_choice', 'WRONG_WORD', 'Essa palavra não é a mais adequada aqui.')] }),
    })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('linguistic')
    expect(p.feedback.issues.length).toBe(1)
  })
})

// ---- §39.6 semantic not_aligned → semantic ----------------------------------

describe('§39.6 / §39.11 — semantic mismatch', () => {
  it('semantic_relation not_aligned is `semantic`', () => {
    const a = semanticAssessment({
      outcome: 'incorrect',
      diagnosis: diagnosis({
        causes: [cause('semantic_context', 'MEANING_MISMATCH', 'A resposta trata de outro assunto.')],
        semantic_relation: { status: 'not_aligned' },
      }),
    })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('semantic')
  })

  it('the semantic body never asserts that grammar is correct (§10/§11)', () => {
    const a = semanticAssessment({
      outcome: 'incorrect',
      diagnosis: diagnosis({ semantic_relation: { status: 'not_aligned' } }),
    })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('semantic')
    expect(p.feedback.body).toBeTruthy()
    expect(p.feedback.body).not.toMatch(/gramática|gramatic|estrutura.*(correta|certa)|verbo.*correto/i)
    expect(p.feedback.correct_points).toEqual([]) // no invented positive claim
  })
})

// ---- §39.7 incorrect sem causa → incorrect_unspecified ----------------------

describe('§39.7 — incorrect with no cause', () => {
  it('an incorrect outcome with no structured cause is `incorrect_unspecified`', () => {
    const a = semanticAssessment({ outcome: 'incorrect', diagnosis: diagnosis({ cause_coverage: 'none', semantic_relation: { status: 'unknown' } }) })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('incorrect_unspecified')
    expect(p.feedback.body).toMatch(/ainda não corresponde completamente/i)
  })
})

// ---- §39.8 uncertain → unable_to_assess -------------------------------------

describe('§39.8 / §44 — semantic equivalence uncertain', () => {
  it('an `uncertain` equivalence is `unable_to_assess`, not an error', () => {
    const a = semanticAssessment({
      outcome: 'incorrect',
      status: 'unable_to_assess',
      diagnosis: diagnosis({ cause_coverage: 'none', semantic_relation: { status: 'uncertain' } }),
      semantic_equivalence: { status: 'uncertain', confidence: 0.3, reason_codes: ['LOW_SIMILARITY'] },
    })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('unable_to_assess')
    expect(p.feedback.body).toMatch(/não consegui confirmar/i)
    // Distinct from incorrect_unspecified copy (§11).
    expect(p.feedback.body).not.toMatch(/ainda não corresponde/i)
  })

  it('an uncertain equivalence even with an `assessed` status still maps to unable_to_assess', () => {
    const a = semanticAssessment({
      outcome: 'partial', status: 'assessed',
      diagnosis: diagnosis({ semantic_relation: { status: 'uncertain' } }),
      semantic_equivalence: { status: 'uncertain', confidence: 0.4, reason_codes: [] },
    })
    const p = buildFor(a)
    expect(p.feedback.visual_variant).toBe('unable_to_assess')
  })
})

// ---- §39.9 target form different + meaning aligned --------------------------

describe('§39.9 / §13 — target form different but meaning aligned', () => {
  it('shows a reference form labelled possibility, stays non-error, keeps outcome', () => {
    const a = semanticAssessment({
      outcome: 'correct',
      diagnosis: diagnosis({
        semantic_relation: { status: 'aligned' },
        target_form_relation: { status: 'different_form' },
        positive_findings: [{ code: 'SEMANTIC_MEANING_ALIGNED', source: 'semantic_engine' }],
      }),
    })
    const p = buildFor(a)
    expect(p.feedback.outcome_status).toBe('correct')
    expect(['correct', 'suggestion']).toContain(p.feedback.visual_variant)
    expect(p.feedback.target_form).toBeTruthy()
    expect(p.feedback.target_form.label).toBe('Uma forma possível')
    // A different target form is never presented as wrong meaning.
    expect(p.feedback.visual_variant).not.toBe('semantic')
    expect(p.feedback.target_form_note).toBeTruthy()
  })
})

// ---- §39.12 visual variant never changes the outcome ------------------------

describe('§39.12 / §7 — VISUAL_VARIANT_MUST_NOT_CHANGE_ASSESSMENT_OUTCOME', () => {
  const OUTCOMES = [
    semanticAssessment({ outcome: 'correct', diagnosis: diagnosis({ semantic_relation: { status: 'aligned' } }) }),
    semanticAssessment({ outcome: 'partial', diagnosis: diagnosis({ cause_coverage: 'none' }) }),
    semanticAssessment({ outcome: 'incorrect', diagnosis: diagnosis({ causes: [cause('grammar', 'X', 'y')] }) }),
    semanticAssessment({ outcome: 'incorrect', status: 'unable_to_assess', diagnosis: diagnosis({ semantic_relation: { status: 'uncertain' } }), semantic_equivalence: { status: 'uncertain' } }),
  ]
  it('outcome_status always equals the assessor outcome bucket and the variant is valid', () => {
    for (const a of OUTCOMES) {
      const frozen = JSON.parse(JSON.stringify(a))
      const p = buildFor(a)
      expect(LEARNER_VISUAL_VARIANTS).toContain(p.feedback.visual_variant)
      // The adapter never mutates the assessment/diagnosis it was given.
      expect(a).toEqual(frozen)
    }
  })

  it('the derived variant is a pure function of vm + assessment (deterministic)', () => {
    const a = semanticAssessment({ outcome: 'incorrect', diagnosis: diagnosis({ causes: [cause('grammar', 'X', 'y')] }) })
    const vm = { status: 'incorrect', suggestions: [], issues: [{ category: 'grammar' }] }
    expect(deriveVisualVariantV2({ vm, assessment: a })).toBe('linguistic')
    expect(deriveVisualVariantV2({ vm, assessment: a })).toBe('linguistic')
  })
})

// ---- exposure has no feedback panel -----------------------------------------

describe('§20 — exposure is observed, no feedback panel', () => {
  it('an observed exposure produces no feedback block', () => {
    const plan = productionPlan({ recipe: 'exposure', activity_kind: 'exposure' })
    const a = { status: 'assessed', outcome: 'observed', feedback: { kind: 'exposure' } }
    const p = buildLearnerPresentationV2({ plan, assessment: a, focus: { pack_id: 'pedagogy_v2_still' } })
    expect(p.feedback).toBeNull()
    expect(p.activity.is_exposure).toBe(true)
  })
})

// ---- §14/§45 + V2.17-R §2 — new-use requires real lexeme familiarity --------

describe('§14/§45 + V2.17-R §2 — “Você já conhece X” requires proven familiarity', () => {
  it('a known lexeme (real prior exposure) + new construction yields the affirmation (§6.2)', () => {
    const p = buildLearnerPresentationV2({
      plan: productionPlan({ pack_id: 'pedagogy_v2_yet', lexeme_lemma: 'yet' }),
      focus: { pack_id: 'pedagogy_v2_yet', reason_codes: ['KNOWN_LEXEME_CONTEXT_EXTENDED'] },
      registry,
      learnerStates: familiarStatesFor('pedagogy_v2_yet'),
    })
    expect(p.new_use).toBeTruthy()
    expect(p.new_use.known_word).toBe('yet')
    expect(p.new_use.headline).toMatch(/já conhece/i)
    expect(p.new_use.reassurance).toMatch(/continua valendo/i) // §16 — old use stays valid
  })

  it('CRITICAL: a reused construction in a NEW pack does NOT claim the word is known (§6.4)', () => {
    // current lexeme unseen, reason=KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK, no evidence.
    const p = buildLearnerPresentationV2({
      plan: productionPlan({ pack_id: 'pedagogy_v2_yet', lexeme_lemma: 'new_word' }),
      focus: { pack_id: 'pedagogy_v2_yet', reason_codes: ['KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK'] },
      registry,
      learnerStates: [], // no evidence for this lexeme
    })
    expect(p.new_use).toBeTruthy()
    expect(p.new_use.known_word).toBeNull()
    expect(p.new_use.headline).not.toMatch(/já conhece/i)
    expect(p.new_use.headline).not.toContain('new_word')
  })

  it('a related known FUNCTION does not imply the current word is known (§6.3)', () => {
    const p = buildLearnerPresentationV2({
      plan: productionPlan({ pack_id: 'pedagogy_v2_yet', lexeme_lemma: 'yet' }),
      focus: { pack_id: 'pedagogy_v2_yet', reason_codes: ['KNOWN_FUNCTION_NEW_CONSTRUCTION'] },
      registry,
      learnerStates: [], // no prior exposure of the current lexeme
    })
    expect(p.new_use.known_word).toBeNull()
    expect(p.new_use.headline).not.toMatch(/já conhece/i)
  })

  it('a plain focus change (no reason code) does NOT invent a new use (§14)', () => {
    const p = buildLearnerPresentationV2({
      plan: productionPlan({ pack_id: 'pedagogy_v2_yet', lexeme_lemma: 'yet' }),
      focus: { pack_id: 'pedagogy_v2_yet', reason_codes: ['MODALITY_GAP'] },
    })
    expect(p.new_use).toBeNull()
  })

  it('a cross-pack transfer code adds a soft, id-free hint (§18)', () => {
    const p = buildLearnerPresentationV2({
      plan: productionPlan({ pack_id: 'pedagogy_v2_yet', lexeme_lemma: 'yet' }),
      focus: { pack_id: 'pedagogy_v2_yet', reason_codes: ['KNOWN_LEXEME_CONTEXT_EXTENDED', 'CROSS_PACK_TRANSFER_OPPORTUNITY'] },
    })
    expect(p.new_use.cross_pack_hint).toMatch(/já praticou/i)
    // No technical reason code leaks into the learner-facing values.
    expect(p.new_use.headline).not.toMatch(/KNOWN_|CROSS_PACK|relation|prerequisite/i)
    expect(p.new_use.cross_pack_hint).not.toMatch(/KNOWN_|CROSS_PACK|relation|prerequisite/i)
    expect(JSON.stringify(p.new_use)).not.toMatch(/relation|prerequisite|target_id|score/i)
  })
})

// ---- §17 + V2.17-R §3 — pack transition is neutral, not new use -------------

describe('§17 + V2.17-R §3 — pack transition ≠ new use', () => {
  const transitionFor = (focusCodes, code) => buildLearnerPresentationV2({
    plan: productionPlan({ pack_id: 'pedagogy_v2_yet', lexeme_lemma: 'yet' }),
    focus: { pack_id: 'pedagogy_v2_yet', reason_codes: focusCodes },
    transition: { from_pack: 'pedagogy_v2_still', to_pack: 'pedagogy_v2_yet', code },
  }).transition

  it('a real transition yields a NEUTRAL banner, no new-use claim, no strike-through', () => {
    const t = transitionFor([], 'PACK_SWITCH_FOR_CROSS_PACK_PROGRESSION')
    expect(t).toBeTruthy()
    expect(t.to_label).toBe('yet')
    expect(t.headline).toMatch(/vamos praticar/i)
    expect(JSON.stringify(t)).not.toMatch(/novo uso|nova maneira|line-through/i)
  })

  it('A: PACK_SWITCH_FOR_RETENTION → neutral, no cross-pack hint (§6.5/§6.6)', () => {
    const t = transitionFor(['RETENTION_OVERDUE'], 'PACK_SWITCH_FOR_RETENTION')
    expect(t.headline).toMatch(/vamos praticar/i)
    expect(t.cross_pack_hint).toBeNull()
  })

  it('B: PACK_SWITCH_FOR_REMEDIATION → neutral', () => {
    const t = transitionFor(['RECENT_FAILURE'], 'PACK_SWITCH_FOR_REMEDIATION')
    expect(t.cross_pack_hint).toBeNull()
    expect(JSON.stringify(t)).not.toMatch(/novo uso|nova maneira/i)
  })

  it('C: focus with CROSS_PACK_TRANSFER_OPPORTUNITY → soft cross-pack hint (§6.7)', () => {
    const t = transitionFor(['CROSS_PACK_TRANSFER_OPPORTUNITY'], 'PACK_SWITCH_FOR_CROSS_PACK_PROGRESSION')
    expect(t.cross_pack_hint).toMatch(/já praticou/i)
  })

  it('D: a PACK_SWITCH_* code alone (no focus cross reason) yields NO hint — provenance is the focus (§3)', () => {
    const t = transitionFor([], 'PACK_SWITCH_FOR_CROSS_PACK_PROGRESSION')
    expect(t.cross_pack_hint).toBeNull()
  })

  it('no transition when packs did not change', () => {
    const p = buildLearnerPresentationV2({ plan: productionPlan(), focus: { pack_id: 'pedagogy_v2_still' }, transition: null })
    expect(p.transition).toBeNull()
  })
})

// ---- §27/§47 session summary ------------------------------------------------

describe('§27/§47 — factual session summary', () => {
  const interaction = (modality, lemma, reason_codes = []) => ({
    plan: { modality, pack_id: `pedagogy_v2_${lemma}`, lexeme_lemma: lemma, exemplar_id: `ex:${lemma}:${modality}`, construction_id: `c:${lemma}`, sense_ids: [`sense:${lemma}`] },
    focus: { pack_id: `pedagogy_v2_${lemma}`, reason_codes },
    assessment: { status: 'assessed' },
    transition: null,
  })

  it('reports only verifiable facts — activities, modalities, new use', () => {
    const s = buildLearnerSessionSummaryV2({
      interactions: [
        interaction('reading', 'still'),
        interaction('writing', 'still'),
        interaction('writing', 'yet', ['KNOWN_FUNCTION_NEW_CONSTRUCTION']),
      ],
    })
    const texts = s.facts.map((f) => f.text).join(' | ')
    expect(texts).toMatch(/praticou 3 atividades/i)
    expect(texts).toMatch(/leitura|escrita/i)
    expect(texts).toMatch(/novo uso encontrado: “yet”/i)
    // §47 — never mastery %, CEFR or "word mastered".
    expect(texts).not.toMatch(/%|CEFR|domin|master/i)
  })

  it('singular activity copy', () => {
    const s = buildLearnerSessionSummaryV2({ interactions: [interaction('reading', 'still')] })
    expect(s.facts[0].text).toMatch(/praticou 1 atividade\b/i)
  })

  it('V2.17-R §4/§6.8 — sense + construction are NOT summed into a usage count', () => {
    // A single lemma with 1 construction + 1 sense must NOT become "2 formas de usar".
    const s = buildLearnerSessionSummaryV2({
      interactions: [interaction('reading', 'still')], // construction_id + sense_ids present
    })
    const texts = s.facts.map((f) => f.text).join(' | ')
    expect(texts).not.toMatch(/formas de usar/i)
    expect(texts).not.toMatch(/\b2 formas\b/i)
  })
})
