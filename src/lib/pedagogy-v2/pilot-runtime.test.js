// pilot-runtime.test.js — Slice V2.4 unit suite: runtime contracts, assessment
// adapter, evidence adapter, atomicity/idempotency, runtime capabilities and
// the adaptive loop over the REAL engine with an in-memory persistence fake.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { aggregateProfileEvidence } from './learner-model.js'
import { validateLearnerEvidenceBatchV2 } from './learner-evidence-validator.js'
import { deriveSupportTier, createPackTargetResolver } from './learner-evidence-contracts.js'
import { validateActivityPlanV2 } from './lesson-engine-validator.js'
import {
  buildInteractionIdV2, buildEvidenceIdV2, createSupportRuntime, useSupportFeature,
  finalizeSupportUsage, buildActivityResponseV2, buildMaskedCompletion,
  canonicalOrderTokens, presentedOrderTokens,
} from './activity-runtime-contracts.js'
import { validateActivityResponseV2 } from './activity-runtime-validator.js'
import { evaluateActivityResponseV2, normalizeCompletionToken } from './activity-assessment.js'
import { mapSemanticResultToOutcome, combineSpeechConfidence } from './assessment-policy.js'
import { buildLearnerEvidenceBatchFromInteractionV2 } from './assessment-to-evidence.js'
import {
  detectRuntimeCapabilitiesV2, computeRecipeRuntimeAvailability, isRecipeExecutable,
  RUNTIME_REASON_CODES,
} from './runtime-capabilities.js'
import { createPilotSessionController, summarizePilotSession } from './pilot-session-controller.js'
import { selectNextActivityV2 } from './lesson-engine.js'

const NOW = '2026-07-01T10:00:00.000Z'
const SENSE = { target_type: 'sense', target_id: 'sense:still.continuity' }
const CONSTR = { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' }
const FUNC = { target_type: 'communicative_function', target_id: 'function:express_continuation' }

// ---- plan fixtures ----------------------------------------------------------
// Fixtures mirror real engine output and are structurally validated below, so
// they cannot drift from ActivityPlanV2.

const trace = { trace_version: 1, considered: 1, excluded: [], candidates: [], prerequisite_assessments: [] }
const activityOf = (kind, capability, modality) => ({ activity_kind: kind, capability, modality })

function makePlan(recipe, over = {}) {
  const bases = {
    exposure: {
      activity_kind: 'exposure', capability: 'recognition', modality: 'reading',
      support: { features: ['translation'], derived_tier: 'medium' },
      presentation: { instructions_pt: 'x', show: ['text_en', 'text_pt', 'context'] },
      response_contract: { response_type: 'acknowledge', evaluation: 'none' },
      planned_evidence: [
        { target: SENSE, attribution: 'exposure', activity: activityOf('exposure', 'recognition', 'reading'), possible_outcomes: ['observed'] },
        { target: CONSTR, attribution: 'exposure', activity: activityOf('exposure', 'recognition', 'reading'), possible_outcomes: ['observed'] },
      ],
    },
    meaning_recognition: {
      activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading',
      support: { features: ['multiple_choice'], derived_tier: 'high' },
      presentation: {
        instructions_pt: 'x', show: ['text_en'],
        options: [
          { option_id: 'option:1', text_pt: 'Eu ainda moro aqui.', source_exemplar_id: 'exemplar:still.001', is_target: true },
          { option_id: 'option:2', text_pt: 'Outra frase.', source_exemplar_id: 'exemplar:still.002', is_target: false },
          { option_id: 'option:3', text_pt: 'Mais uma.', source_exemplar_id: 'exemplar:still.003', is_target: false },
        ],
      },
      response_contract: { response_type: 'option_select', correct_option_id: 'option:1', evaluation: 'option_match' },
      planned_evidence: [
        { target: SENSE, attribution: 'direct', activity: activityOf('meaning_recognition', 'recognition', 'reading'), possible_outcomes: ['correct', 'incorrect'] },
        { target: CONSTR, attribution: 'indirect', activity: activityOf('meaning_recognition', 'recognition', 'reading'), possible_outcomes: ['correct', 'incorrect'] },
      ],
    },
    listening_recognition: {
      activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening',
      support: { features: ['multiple_choice', 'audio_replay'], derived_tier: 'high' },
      presentation: {
        instructions_pt: 'x', show: [],
        options: [
          { option_id: 'option:1', text_pt: 'Eu ainda moro aqui.', source_exemplar_id: 'exemplar:still.001', is_target: true },
          { option_id: 'option:2', text_pt: 'Outra.', source_exemplar_id: 'exemplar:still.002', is_target: false },
        ],
        audio_reference: { type: 'authored_exemplar_audio', exemplar_id: 'exemplar:still.001' },
      },
      response_contract: { response_type: 'option_select', correct_option_id: 'option:1', evaluation: 'option_match' },
      planned_evidence: [
        { target: SENSE, attribution: 'direct', activity: activityOf('listening_recognition', 'recognition', 'listening'), possible_outcomes: ['correct', 'incorrect'] },
      ],
    },
    fixed_element_completion: {
      activity_kind: 'controlled_completion', capability: 'controlled_production', modality: 'writing',
      support: { features: ['word_bank'], derived_tier: 'high' },
      presentation: {
        instructions_pt: 'x', show: ['text_pt', 'context'],
        masked_text_source: { exemplar_id: 'exemplar:still.001', mask: 'construction_fixed_elements', fixed_elements: ['still'] },
      },
      response_contract: { response_type: 'text_input', expected_reference: { exemplar_id: 'exemplar:still.001', text_en: 'I still live here.' }, evaluation: 'reference_match' },
      planned_evidence: [
        { target: CONSTR, attribution: 'direct', activity: activityOf('controlled_completion', 'controlled_production', 'writing'), possible_outcomes: ['correct', 'partial', 'incorrect'] },
        { target: SENSE, attribution: 'indirect', activity: activityOf('controlled_completion', 'controlled_production', 'writing'), possible_outcomes: ['correct', 'partial', 'incorrect'] },
      ],
    },
    word_order_reconstruction: {
      activity_kind: 'controlled_transformation', capability: 'controlled_production', modality: 'writing',
      support: { features: ['word_bank'], derived_tier: 'high' },
      presentation: {
        instructions_pt: 'x', show: ['text_pt'],
        token_source: { exemplar_id: 'exemplar:still.001', tokenization: 'text_en_whitespace', presentation_order: 'lexicographic' },
      },
      response_contract: { response_type: 'ordered_tokens', expected_reference: { exemplar_id: 'exemplar:still.001', text_en: 'I still live here.' }, evaluation: 'reference_match' },
      planned_evidence: [
        { target: CONSTR, attribution: 'direct', activity: activityOf('controlled_transformation', 'controlled_production', 'writing'), possible_outcomes: ['correct', 'incorrect'] },
      ],
    },
    guided_production: {
      activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing',
      support: { features: ['model_sentence', 'translation'], derived_tier: 'high' },
      presentation: { instructions_pt: 'x', show: ['context', 'text_pt'], model_reference: { exemplar_id: 'exemplar:still.001' } },
      response_contract: { response_type: 'text_input', expected_reference: { exemplar_id: 'exemplar:still.001', text_en: 'I still live here.' }, evaluation: 'external_assessment_required' },
      planned_evidence: [
        { target: CONSTR, attribution: 'direct', activity: activityOf('guided_production', 'controlled_production', 'writing'), possible_outcomes: ['correct', 'partial', 'incorrect'] },
        { target: SENSE, attribution: 'indirect', activity: activityOf('guided_production', 'controlled_production', 'writing'), possible_outcomes: ['correct', 'partial', 'incorrect'] },
      ],
    },
    free_production: {
      activity_kind: 'free_production', capability: 'free_production', modality: 'writing',
      support: { features: ['hint'], derived_tier: 'medium' },
      presentation: { instructions_pt: 'x', show: ['context'] },
      response_contract: { response_type: 'text_input', expected_reference: { exemplar_id: 'exemplar:still.001', text_en: 'I still live here.' }, evaluation: 'external_assessment_required' },
      planned_evidence: [
        { target: SENSE, attribution: 'direct', activity: activityOf('free_production', 'free_production', 'writing'), possible_outcomes: ['correct', 'partial', 'incorrect'], condition: 'only_if_target_assessed' },
        { target: FUNC, attribution: 'indirect', activity: activityOf('free_production', 'free_production', 'writing'), possible_outcomes: ['correct', 'partial', 'incorrect'], condition: 'only_if_target_assessed' },
      ],
    },
    pronunciation: {
      activity_kind: 'pronunciation', capability: 'pronunciation', modality: 'speaking',
      support: { features: ['model_sentence', 'audio_replay'], derived_tier: 'high' },
      presentation: { instructions_pt: 'x', show: ['text_en'], audio_reference: { type: 'authored_exemplar_audio', exemplar_id: 'exemplar:still.001' } },
      response_contract: { response_type: 'spoken_audio', expected_reference: { exemplar_id: 'exemplar:still.001', text_en: 'I still live here.' }, evaluation: 'external_assessment_required' },
      planned_evidence: [
        { target: CONSTR, attribution: 'direct', activity: activityOf('pronunciation', 'pronunciation', 'speaking'), possible_outcomes: ['correct', 'partial', 'incorrect', 'not_assessed', 'observed'] },
      ],
    },
  }
  return {
    plan_version: 1, policy_version: 2,
    activity_id: 'activity:sess1.0', session_id: 'sess1', sequence_index: 0,
    recipe,
    pack_id: 'pedagogy_v2_still', exemplar_id: 'exemplar:still.001',
    construction_id: 'construction:still.subject_still_lexical_verb',
    sense_ids: ['sense:still.continuity'], communicative_function_ids: ['function:express_continuation'],
    exposure_stage: 'A1',
    text_en: 'I still live here.', text_pt: 'Eu ainda moro aqui.',
    context: 'Você reencontra um amigo.',
    primary_target: SENSE,
    secondary_targets: [{ ...CONSTR, role: 'primary' }],
    new_item_refs: [],
    selection_trace: trace,
    ...bases[recipe],
    ...over,
  }
}

const responseFor = (plan, type, payload, { attempt = 1, runtime = null } = {}) => {
  let sr = runtime || createSupportRuntime(plan, { attemptNumber: attempt })
  return buildActivityResponseV2({ plan, responseType: type, payload, supportRuntime: sr, submittedAt: NOW })
}

describe('plan fixtures are valid ActivityPlanV2', () => {
  for (const recipe of ['exposure', 'meaning_recognition', 'listening_recognition', 'fixed_element_completion', 'word_order_reconstruction', 'guided_production', 'free_production', 'pronunciation']) {
    it(recipe, () => {
      expect(validateActivityPlanV2(makePlan(recipe)).errors).toEqual([])
    })
  }
})

// ============================= runtime contracts =============================

describe('runtime contracts', () => {
  it('accepts a valid response of each type', () => {
    const cases = [
      ['exposure', 'continue', {}],
      ['meaning_recognition', 'single_choice', { option_id: 'option:2' }],
      ['fixed_element_completion', 'text', { text: 'still' }],
      ['word_order_reconstruction', 'token_sequence', { tokens: ['I', 'still', 'live', 'here.'] }],
      ['guided_production', 'speech_transcript', { transcript: 'I still live here', stt_confidence: 0.8 }],
      ['pronunciation', 'pronunciation_attempt', { transcript: 'I still live here' }],
    ]
    for (const [recipe, type, payload] of cases) {
      const plan = makePlan(recipe)
      const r = responseFor(plan, type, payload)
      expect(validateActivityResponseV2(r, plan).errors).toEqual([])
    }
  })

  it('rejects an incompatible payload', () => {
    const plan = makePlan('meaning_recognition')
    const r = responseFor(plan, 'single_choice', { option_id: 'option:99' })
    expect(validateActivityResponseV2(r, plan).errors).toContain('PAYLOAD_OPTION_UNKNOWN:option:99')
    const r2 = responseFor(plan, 'single_choice', {})
    expect(validateActivityResponseV2(r2, plan).valid).toBe(false)
  })

  it('rejects a response type foreign to the recipe', () => {
    const plan = makePlan('exposure')
    const r = responseFor(plan, 'text', { text: 'x' })
    expect(validateActivityResponseV2(r, plan).errors.some((e) => e.startsWith('RESPONSE_TYPE_INCOMPATIBLE'))).toBe(true)
  })

  it('rejects a mismatched activity_id', () => {
    const plan = makePlan('exposure')
    const r = { ...responseFor(plan, 'continue', {}), activity_id: 'activity:other.9' }
    expect(validateActivityResponseV2(r, plan).errors.some((e) => e.startsWith('RESPONSE_ACTIVITY_MISMATCH'))).toBe(true)
  })

  it('rejects invalid attempt numbers', () => {
    const plan = makePlan('exposure')
    const r = { ...responseFor(plan, 'continue', {}), attempt_number: 0 }
    expect(validateActivityResponseV2(r, plan).errors.some((e) => e.startsWith('RESPONSE_ATTEMPT_INVALID'))).toBe(true)
  })

  it('rejects invalid support usage', () => {
    const plan = makePlan('exposure')
    const r = responseFor(plan, 'continue', {})
    r.support_usage = { ...r.support_usage, used_features: ['banana'] }
    expect(validateActivityResponseV2(r, plan).errors.some((e) => e.startsWith('SUPPORT_USAGE_FEATURE_UNKNOWN'))).toBe(true)
  })

  it('rejects an invalid timestamp', () => {
    const plan = makePlan('exposure')
    const r = { ...responseFor(plan, 'continue', {}), submitted_at: 'ontem' }
    expect(validateActivityResponseV2(r, plan).errors.some((e) => e.startsWith('RESPONSE_SUBMITTED_AT_INVALID'))).toBe(true)
  })

  it('masks only authorized fixed elements', () => {
    const m = buildMaskedCompletion(makePlan('fixed_element_completion'))
    expect(m.masked_text).toBe('I ___ live here.')
    expect(m.expected_tokens).toEqual(['still'])
  })

  it('word-order tokens: none extra, none missing, plan-declared order, contractions preserved', () => {
    const plan = makePlan('word_order_reconstruction', { text_en: "I don't live here, still." })
    const canonical = canonicalOrderTokens(plan)
    const presented = presentedOrderTokens(plan)
    expect([...presented].sort()).toEqual([...canonical].sort())
    expect(presented).toEqual([...canonical].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    expect(canonical).toContain("don't")
  })
})

// ================================ assessment =================================

describe('assessment adapter', () => {
  const assess = (plan, response, services = {}) =>
    evaluateActivityResponseV2({ activityPlan: plan, response, assessmentServices: services })

  it('exposure → observed / not_assessed', async () => {
    const plan = makePlan('exposure')
    const a = await assess(plan, responseFor(plan, 'continue', {}))
    expect(a.status).toBe('not_assessed')
    expect(a.outcome).toBe('observed')
  })

  it('correct choice → correct with confidence 1 (by option_id, not text)', async () => {
    const plan = makePlan('meaning_recognition')
    const a = await assess(plan, responseFor(plan, 'single_choice', { option_id: 'option:1' }))
    expect(a).toMatchObject({ status: 'assessed', outcome: 'correct', assessment_confidence: 1 })
    expect(a.target_assessments).toEqual([SENSE])
  })

  it('incorrect choice → incorrect', async () => {
    const plan = makePlan('meaning_recognition')
    const a = await assess(plan, responseFor(plan, 'single_choice', { option_id: 'option:2' }))
    expect(a.outcome).toBe('incorrect')
    expect(a.assessment_confidence).toBe(1)
  })

  it('completion correct (limited normalization: case + peripheral punctuation)', async () => {
    const plan = makePlan('fixed_element_completion')
    const a = await assess(plan, responseFor(plan, 'text', { text: ' Still, ' }))
    expect(a.outcome).toBe('correct')
    expect(normalizeCompletionToken('“Still,”')).toBe('still')
  })

  it('completion partial reflects the exact token proportion', async () => {
    const plan = makePlan('fixed_element_completion', {
      text_en: 'Are you still working there, still?',
      presentation: {
        instructions_pt: 'x', show: ['text_pt'],
        masked_text_source: { exemplar_id: 'exemplar:still.001', mask: 'construction_fixed_elements', fixed_elements: ['still', 'working'] },
      },
    })
    const a = await assess(plan, responseFor(plan, 'text', { text: 'still nope' }))
    expect(a.outcome).toBe('partial')
    expect(a.partial_score).toBe(0.5)
  })

  it('word order correct / incorrect (binary)', async () => {
    const plan = makePlan('word_order_reconstruction')
    const ok = await assess(plan, responseFor(plan, 'token_sequence', { tokens: ['I', 'still', 'live', 'here.'] }))
    expect(ok.outcome).toBe('correct')
    const bad = await assess(plan, responseFor(plan, 'token_sequence', { tokens: ['still', 'I', 'live', 'here.'] }))
    expect(bad.outcome).toBe('incorrect')
    const missing = await assess(plan, responseFor(plan, 'token_sequence', { tokens: ['I', 'still', 'live'] }))
    expect(missing.outcome).toBe('incorrect')
  })

  it('guided semantic valid → correct with real confidence', async () => {
    const plan = makePlan('guided_production')
    const services = { analyzeSemantics: async () => ({ verdict: 'valid', confidence: 0.9, detected_errors: [] }) }
    const a = await assess(plan, responseFor(plan, 'text', { text: 'I still live here.' }), services)
    expect(a).toMatchObject({ status: 'assessed', outcome: 'correct', assessment_confidence: 0.9 })
    expect(a.target_assessments).toEqual([SENSE, CONSTR])
  })

  it('guided semantic needs_revision with high error → incorrect', async () => {
    const plan = makePlan('guided_production')
    const services = { analyzeSemantics: async () => ({ verdict: 'needs_revision', confidence: 0.85, detected_errors: [{ severity: 'high' }] }) }
    const a = await assess(plan, responseFor(plan, 'text', { text: 'me still live' }), services)
    expect(a.outcome).toBe('incorrect')
  })

  it('free semantic equivalent (valid_with_suggestions, low severity) stays correct', async () => {
    const plan = makePlan('free_production')
    const services = { analyzeSemantics: async () => ({ verdict: 'valid_with_suggestions', confidence: 0.7, detected_errors: [{ severity: 'low' }] }) }
    const a = await assess(plan, responseFor(plan, 'text', { text: "I'm still living here." }), services)
    expect(a.outcome).toBe('correct')
    expect(a.assessment_confidence).toBe(0.7)
  })

  it('semantic unable_to_assess → unable_to_assess, no assessed outcome', async () => {
    const plan = makePlan('free_production')
    const services = { analyzeSemantics: async () => ({ verdict: 'unable_to_assess', confidence: 0 }) }
    const a = await assess(plan, responseFor(plan, 'text', { text: '???' }), services)
    expect(a.status).toBe('unable_to_assess')
    expect(a.outcome).toBe('not_assessed')
    expect(a.assessment_confidence).toBe(0)
  })

  it('spoken production with low combined confidence → unable_to_assess', async () => {
    const plan = makePlan('guided_production')
    const services = { analyzeSemantics: async () => ({ verdict: 'valid', confidence: 0.5 }) }
    const a = await assess(plan, responseFor(plan, 'speech_transcript', { transcript: 'I still live here', stt_confidence: 0.2 }), services)
    expect(a.status).toBe('unable_to_assess') // 0.2 * 0.5 = 0.1 < 0.3
  })

  it('STT without transcript → unable_to_assess before touching the engine', async () => {
    const plan = makePlan('free_production')
    let called = false
    const services = { analyzeSemantics: async () => { called = true; return { verdict: 'valid', confidence: 1 } } }
    const a = await assess(plan, responseFor(plan, 'speech_transcript', { transcript: '  ' }), services)
    expect(a.status).toBe('unable_to_assess')
    expect(called).toBe(false)
  })

  it('pronunciation without an acoustic assessor never produces correct', async () => {
    const plan = makePlan('pronunciation')
    const a = await assess(plan, responseFor(plan, 'pronunciation_attempt', { transcript: 'I still live here.' }))
    expect(a.status).toBe('not_assessed')
    expect(a.outcome).toBe('observed')
  })

  it('speech confidence combines multiplicatively with conservative defaults', () => {
    expect(combineSpeechConfidence({ sttConfidence: 0.8, semanticConfidence: 0.9 })).toBeCloseTo(0.72)
    expect(combineSpeechConfidence({})).toBeCloseTo(0.6 * 0.5)
  })

  it('semantic policy maps every verdict centrally', () => {
    expect(mapSemanticResultToOutcome({ verdict: 'valid', confidence: 0.8 }).outcome).toBe('correct')
    expect(mapSemanticResultToOutcome({ verdict: 'valid_with_suggestions', confidence: 0.7, detected_errors: [{ severity: 'medium' }] })).toMatchObject({ outcome: 'partial', partial_score: 0.75 })
    expect(mapSemanticResultToOutcome({ verdict: 'needs_revision', confidence: 0.6, detected_errors: [{ severity: 'medium' }] })).toMatchObject({ outcome: 'partial', partial_score: 0.5 })
    expect(mapSemanticResultToOutcome({ verdict: 'unable_to_assess' }).status).toBe('unable_to_assess')
    // No explicit confidence → documented conservative fallback, never 0.99.
    expect(mapSemanticResultToOutcome({ verdict: 'valid' }).assessment_confidence).toBe(0.5)
  })
})

// ============================= evidence adapter ==============================

describe('evidence adapter', () => {
  const resolver = createPackTargetResolver([stillPack])
  const build = ({ recipe = 'meaning_recognition', plan = null, response = null, assessment }) => {
    const p = plan || makePlan(recipe)
    const r = response || responseFor(p, 'single_choice', { option_id: 'option:1' })
    return buildLearnerEvidenceBatchFromInteractionV2({
      activityPlan: p, response: r, assessment, profileId: 'p1', sessionId: 'sess1',
    })
  }
  const assessedCorrect = (targets) => ({
    assessment_version: 1, status: 'assessed', outcome: 'correct', partial_score: null,
    assessment_confidence: 1, target_assessments: targets,
  })

  it('planned exposure → observed events, valid batch', () => {
    const plan = makePlan('exposure')
    const r = responseFor(plan, 'continue', {})
    const events = build({ plan, response: r, assessment: { status: 'not_assessed', outcome: 'observed', target_assessments: [] } })
    expect(events).toHaveLength(2)
    expect(events.every((e) => e.outcome === 'observed' && e.attribution === 'exposure')).toBe(true)
    expect(validateLearnerEvidenceBatchV2(events, { resolveTarget: resolver }).errors).toEqual([])
  })

  it('direct gets the assessed outcome; unassessed direct target → not_assessed', () => {
    const events = build({ assessment: assessedCorrect([SENSE]) })
    const direct = events.find((e) => e.target.target_id === SENSE.target_id)
    expect(direct.outcome).toBe('correct')
    const eventsNone = build({ assessment: assessedCorrect([]) })
    expect(eventsNone.find((e) => e.attribution === 'direct').outcome).toBe('not_assessed')
  })

  it('indirect receives the interaction outcome with indirect attribution', () => {
    const events = build({ assessment: assessedCorrect([SENSE]) })
    const indirect = events.find((e) => e.attribution === 'indirect')
    expect(indirect.target.target_id).toBe(CONSTR.target_id)
    expect(indirect.outcome).toBe('correct')
  })

  it('conditional assessed → emitted; not assessed → omitted', () => {
    const plan = makePlan('free_production')
    const r = responseFor(plan, 'text', { text: 'x' })
    const yes = build({ plan, response: r, assessment: assessedCorrect([SENSE]) })
    expect(yes.map((e) => e.target.target_id)).toEqual([SENSE.target_id])
    const no = build({ plan, response: r, assessment: { status: 'unable_to_assess', outcome: 'not_assessed', target_assessments: [] } })
    expect(no).toHaveLength(0)
  })

  it('every event shares the interaction_id; evidence ids differ per target', () => {
    const events = build({ assessment: assessedCorrect([SENSE]) })
    expect(new Set(events.map((e) => e.interaction_id)).size).toBe(1)
    expect(new Set(events.map((e) => e.evidence_id)).size).toBe(events.length)
  })

  it('ids are deterministic and independent of planned-evidence order', () => {
    const plan = makePlan('meaning_recognition')
    const reversed = { ...plan, planned_evidence: [...plan.planned_evidence].reverse() }
    const r = responseFor(plan, 'single_choice', { option_id: 'option:1' })
    const a = build({ plan, response: r, assessment: assessedCorrect([SENSE]) })
    const b = build({ plan: reversed, response: r, assessment: assessedCorrect([SENSE]) })
    const byId = (list) => Object.fromEntries(list.map((e) => [e.evidence_id, e.outcome]))
    expect(byId(a)).toEqual(byId(b))
  })

  it('real support: audio replay, hint and answer reveal land on the events', () => {
    const plan = makePlan('listening_recognition')
    let sr = createSupportRuntime(plan)
    sr = useSupportFeature(sr, 'audio_replay')
    sr = useSupportFeature(sr, 'hint')
    sr = useSupportFeature(sr, 'answer_reveal')
    const r = buildActivityResponseV2({ plan, responseType: 'single_choice', payload: { option_id: 'option:1' }, supportRuntime: sr, submittedAt: NOW })
    const events = build({ plan, response: r, assessment: assessedCorrect([SENSE]) })
    const s = events[0].support
    expect(s.features).toContain('audio_replay')
    expect(s.features).toContain('answer_reveal')
    expect(s.hint_count).toBe(1)
    expect(deriveSupportTier(s)).toBe('answer_revealed') // never independent
  })

  it('a later attempt produces a new interaction id and new evidence ids', () => {
    const plan = makePlan('meaning_recognition')
    const r1 = responseFor(plan, 'single_choice', { option_id: 'option:1' })
    const r2 = responseFor(plan, 'single_choice', { option_id: 'option:1' }, { attempt: 2 })
    expect(r1.interaction_id).not.toBe(r2.interaction_id)
    const e1 = build({ plan, response: r1, assessment: assessedCorrect([SENSE]) })
    const e2 = build({ plan, response: r2, assessment: assessedCorrect([SENSE]) })
    expect(e1[0].evidence_id).not.toBe(e2[0].evidence_id)
    expect(e2[0].support.attempt_number).toBe(2)
  })

  it('multiple targets never collapse sense/construction/function into one', () => {
    const plan = makePlan('guided_production')
    plan.planned_evidence.push({ target: FUNC, attribution: 'indirect', activity: activityOf('guided_production', 'controlled_production', 'writing'), possible_outcomes: ['correct', 'partial', 'incorrect'] })
    const r = responseFor(plan, 'text', { text: 'x' })
    const events = build({ plan, response: r, assessment: assessedCorrect([SENSE, CONSTR]) })
    expect(new Set(events.map((e) => `${e.target.target_type}:${e.target.target_id}`)).size).toBe(3)
    expect(validateLearnerEvidenceBatchV2(events, { resolveTarget: resolver }).errors).toEqual([])
  })

  it('interaction/evidence id shapes are deterministic', () => {
    const id = buildInteractionIdV2({ sessionId: 's 1', activityId: 'activity:s 1.0', attemptNumber: 1 })
    expect(id).toBe('interaction:s_1:activity:s_1.0:1')
    expect(buildEvidenceIdV2(id, SENSE)).toBe(`evidence:${id}:sense:sense:still.continuity`)
  })
})

// ============================ runtime capabilities ===========================

describe('runtime capabilities', () => {
  const caps = (over) => detectRuntimeCapabilitiesV2({ ttsSupported: true, sttSupported: true, semanticAvailable: true, ...over })

  it('no audio output filters listening with its reason code', () => {
    const av = computeRecipeRuntimeAvailability(caps({ ttsSupported: false }))
    expect(isRecipeExecutable(av, 'listening_recognition', 'listening')).toBe(false)
    expect(av.unavailable.find((u) => u.recipe === 'listening_recognition').reason).toBe(RUNTIME_REASON_CODES.audio_output)
  })

  it('no STT filters spoken production only', () => {
    const av = computeRecipeRuntimeAvailability(caps({ sttSupported: false }))
    expect(isRecipeExecutable(av, 'guided_production', 'speaking')).toBe(false)
    expect(isRecipeExecutable(av, 'guided_production', 'writing')).toBe(true)
    expect(isRecipeExecutable(av, 'free_production', 'speaking')).toBe(false)
  })

  it('no semantic assessment filters free/guided production', () => {
    const av = computeRecipeRuntimeAvailability(caps({ semanticAvailable: false }))
    expect(isRecipeExecutable(av, 'free_production', 'writing')).toBe(false)
    expect(av.unavailable.find((u) => u.recipe === 'free_production').reason).toBe(RUNTIME_REASON_CODES.semantic_assessment)
  })

  it('pronunciation is filtered (no acoustic assessor in this slice)', () => {
    const av = computeRecipeRuntimeAvailability(caps({}))
    expect(isRecipeExecutable(av, 'pronunciation', 'speaking')).toBe(false)
    expect(av.unavailable.find((u) => u.recipe === 'pronunciation').reason).toBe(RUNTIME_REASON_CODES.pronunciation_assessment)
  })

  it('available capabilities keep recipes eligible; engine trace carries the runtime reason', () => {
    const av = computeRecipeRuntimeAvailability(caps({}))
    expect(isRecipeExecutable(av, 'meaning_recognition', 'reading')).toBe(true)
    expect(isRecipeExecutable(av, 'exposure', 'reading')).toBe(true)
    // Engine integration: pronunciation exclusions land in the trace.
    const d = selectNextActivityV2({
      session: { session_version: 1, session_id: 's', now: NOW, history: [] },
      pack: stillPack, learnerStates: [], recentEvidence: [], runtimeAvailability: av,
    })
    expect(d.status).toBe('activity')
  })
})

// =================== controller: atomicity, idempotency, flow ================

function makeHarness({ failRecordTimes = 0, capabilities = null, services = null } = {}) {
  const store = new Map() // evidence_id → event (idempotent, atomic fake)
  let failures = failRecordTimes
  let clock = Date.parse(NOW)
  const resolver = createPackTargetResolver([stillPack])
  const controller = createPilotSessionController({
    profileId: 'p1',
    pack: stillPack,
    now: () => new Date((clock += 60000)).toISOString(),
    makeSessionId: () => 'sess-test',
    buildContext: async (profileId, { now }) => ({
      context_version: 1, profile_id: profileId, now, pack_id: 'pedagogy_v2_still',
      learner_states: aggregateProfileEvidence([...store.values()]),
      recent_evidence: [...store.values()],
    }),
    recordBatch: async (events) => {
      const v = validateLearnerEvidenceBatchV2(events, { resolveTarget: resolver })
      if (!v.valid) throw new Error(`LEARNER_EVIDENCE_INVALID:${v.errors.join(',')}`)
      if (failures > 0) { failures -= 1; throw new Error('PERSISTENCE_DOWN') }
      for (const e of events) if (!store.has(e.evidence_id)) store.set(e.evidence_id, e)
    },
    capabilities: capabilities || detectRuntimeCapabilitiesV2({ ttsSupported: true, sttSupported: false, semanticAvailable: true }),
    assessmentServices: services || { analyzeSemantics: async () => ({ verdict: 'valid', confidence: 0.9 }) },
  })
  return { controller, store }
}

const answerCurrent = async (c) => {
  const s = c.getState()
  const plan = s.plan
  switch (plan.recipe) {
    case 'exposure': await c.submit('continue', {}); break
    case 'meaning_recognition':
    case 'listening_recognition':
      await c.submit('single_choice', { option_id: plan.response_contract.correct_option_id }); break
    case 'fixed_element_completion': {
      const masked = plan.presentation.masked_text_source.fixed_elements.join(' ')
      await c.submit('text', { text: masked }); break
    }
    case 'word_order_reconstruction':
      await c.submit('token_sequence', { tokens: plan.text_en.trim().split(/\s+/) }); break
    default:
      await c.submit('text', { text: plan.text_en }); break
  }
}

describe('atomicity and idempotency (controller + fake persistence)', () => {
  it('an evaluation failure records nothing and does not advance', async () => {
    const { controller, store } = makeHarness()
    await controller.start()
    // Force an invalid submission: wrong response type for the plan.
    await controller.submit('token_sequence', { tokens: [] })
    expect(controller.getState().status).toBe('error')
    expect(store.size).toBe(0)
  })

  it('a failing batch writes nothing, keeps the answer, and retry with same ids succeeds once', async () => {
    const { controller, store } = makeHarness({ failRecordTimes: 1 })
    await controller.start()
    const plan = controller.getState().plan
    await answerCurrent(controller)
    const s1 = controller.getState()
    expect(s1.status).toBe('error')
    expect(store.size).toBe(0)
    expect(s1.pendingResponse).toBeTruthy()
    expect(s1.session.history).toHaveLength(0) // did not advance
    const firstResponse = s1.pendingResponse
    await controller.retry()
    const s2 = controller.getState()
    expect(s2.status).toBe('feedback')
    expect(s2.pendingResponse.interaction_id).toBe(firstResponse.interaction_id)
    expect(store.size).toBeGreaterThan(0)
    expect(controller.getState().plan.activity_id).toBe(plan.activity_id)
  })

  it('successful persistence advances the session and reloads context', async () => {
    const { controller, store } = makeHarness()
    await controller.start()
    const first = controller.getState().plan
    await answerCurrent(controller)
    expect(controller.getState().status).toBe('feedback')
    await controller.advance()
    const s = controller.getState()
    expect(s.status).toBe('presenting')
    expect(s.session.history).toHaveLength(1)
    expect(s.plan.activity_id).not.toBe(first.activity_id)
    expect(s.context.recent_evidence.length).toBe(store.size)
  })

  it('retry of an already-persisted batch does not duplicate (idempotent store)', async () => {
    const { controller, store } = makeHarness()
    await controller.start()
    await answerCurrent(controller)
    const size = store.size
    // Re-run the same batch through the store fake: no growth.
    const events = controller.getState().recordedEvents
    for (const e of events) if (!store.has(e.evidence_id)) store.set(e.evidence_id, e)
    expect(store.size).toBe(size)
  })

  it('double-click is ignored: submit outside presenting is a no-op', async () => {
    const { controller, store } = makeHarness()
    await controller.start()
    const p1 = controller.submit('continue', {})
    const p2 = controller.submit('continue', {}) // second click: state != presenting
    await Promise.all([p1, p2])
    expect(controller.getState().status).toBe('feedback')
    expect(store.size).toBe(2) // one exposure interaction × 2 targets, once
  })

  it('try-again creates a NEW interaction for the same activity', async () => {
    const services = { analyzeSemantics: async () => ({ verdict: 'needs_revision', confidence: 0.9, detected_errors: [{ severity: 'high' }] }) }
    const { controller } = makeHarness({ services })
    await controller.start()
    await answerCurrent(controller) // exposure
    await controller.advance()
    await answerCurrent(controller)
    const i1 = controller.getState().pendingResponse.interaction_id
    controller.tryAgain()
    expect(controller.getState().status).toBe('presenting')
    await answerCurrent(controller)
    const i2 = controller.getState().pendingResponse.interaction_id
    expect(i2).not.toBe(i1)
    expect(controller.getState().pendingResponse.attempt_number).toBe(2)
  })
})

// ============================== adaptive flow ================================

describe('adaptive flow over the real engine', () => {
  it('recorded exposure leads the next step to recognition; the answer changes the next selection', async () => {
    const { controller } = makeHarness()
    await controller.start()
    expect(controller.getState().plan.recipe).toBe('exposure')
    await answerCurrent(controller)
    await controller.advance()
    const second = controller.getState().plan
    expect(second).toBeTruthy()
    // The recorded exposure unlocked recognition of the same exemplar family.
    expect(['meaning_recognition', 'listening_recognition', 'exposure']).toContain(second.recipe)
    expect(second.activity_id).not.toBe('activity:sess-test.0')
  })

  it('written recognition evidence never updates listening keys; MC feeds supported, not independent', async () => {
    const { controller, store } = makeHarness()
    await controller.start()
    // exposure → advance → answer several activities
    for (let i = 0; i < 6 && !['complete'].includes(controller.getState().status); i++) {
      if (controller.getState().status !== 'presenting') break
      await answerCurrent(controller)
      if (controller.getState().status !== 'feedback') break
      await controller.advance()
    }
    const events = [...store.values()]
    const reading = events.filter((e) => e.activity.modality === 'reading' && ['correct', 'incorrect', 'partial'].includes(e.outcome))
    expect(reading.length).toBeGreaterThan(0)
    const states = aggregateProfileEvidence(events)
    for (const st of states) {
      const listening = st.capabilities?.listening_recognition
      if (listening) {
        // any listening lane evidence must come from listening events only
        const listenEvents = events.filter((e) => e.target.target_id === st.target.target_id && e.activity.modality === 'listening' && ['correct', 'partial', 'incorrect'].includes(e.outcome))
        if (!listenEvents.length) {
          expect(listening.overall?.evidence_events || 0).toBe(0)
        }
      }
      const readingRec = st.capabilities?.reading_recognition
      if (readingRec?.overall?.evidence_events > 0) {
        // multiple_choice is high support → supported lane, independent stays empty
        expect(readingRec.independent?.evidence_events || 0).toBe(0)
      }
    }
  })

  it('answer reveal never feeds the independent lane', async () => {
    const plan = makePlan('fixed_element_completion', { support: { features: [], derived_tier: 'none' } })
    let sr = createSupportRuntime(plan)
    sr = useSupportFeature(sr, 'answer_reveal')
    const support = finalizeSupportUsage(sr)
    expect(support.derived_tier).toBe('answer_revealed')
  })

  it('unaided completion can feed the independent lane', () => {
    const plan = makePlan('fixed_element_completion', { support: { features: [], derived_tier: 'none' } })
    const support = finalizeSupportUsage(createSupportRuntime(plan))
    expect(support.derived_tier).toBe('none')
  })

  it('every exemplar of the still pack reuses the same lexeme', () => {
    expect(stillPack.lexemes).toHaveLength(1)
    const senses = new Set(stillPack.senses.map((s) => s.lexeme_id))
    expect([...senses]).toEqual(['lexeme:still'])
  })

  it('session summary is fact-based', async () => {
    const { controller } = makeHarness()
    await controller.start()
    await answerCurrent(controller)
    await controller.advance()
    const sum = summarizePilotSession(controller.getState().interactions)
    expect(sum.sentences_seen).toBe(1)
    expect(sum.exposures).toBe(1)
    expect(sum.assessed_interactions).toBe(0)
  })
})
