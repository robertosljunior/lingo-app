import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import entities from '../../content/lexicon/entities.pilot.v1.json'
import places from '../../content/lexicon/places.v1.json'
import verbs from '../../content/lexicon/verbs.pilot.v1.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { validateLearnerEvidenceV2 } from './learner-evidence-validator.js'
import {
  SemanticNetworkError,
  auditSemanticNetworkPilot,
  composePropositionByStructure,
  composePropositionPlan,
  renderSemanticEntity,
  validateSemanticEntityLexicon,
  validateVerbArgumentLexicon,
} from './semantic-network-pilot.js'

function expectCode(fn, code) {
  try {
    fn()
    throw new Error(`EXPECTED_ERROR:${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(SemanticNetworkError)
    expect(error.code).toBe(code)
  }
}

describe('L2 vertical semantic-network pilot', () => {
  it('validates 12 semantic entities and 8 verbs without lexical target state or pattern_en', () => {
    expect(validateSemanticEntityLexicon(entities)).toEqual({ valid: true, errors: [], count: 12 })
    expect(validateVerbArgumentLexicon(verbs)).toEqual({
      valid: true,
      errors: [],
      verbs: 8,
      senses: 9,
      argument_frames: 11,
    })

    const serialized = JSON.stringify({ entities, verbs })
    expect(serialized).not.toContain('"target"')
    expect(serialized).not.toContain('"pattern_en"')
  })

  it('keeps lexical infrastructure pedagogically neutral by rejecting lexical-network IDs as learner-evidence targets', () => {
    const event = buildLearnerEvidenceV2({
      evidence_id: 'evidence:l2.lexical-neutrality',
      profile_id: 'p1',
      interaction_id: 'interaction:l2.lexical-neutrality',
      target: { target_type: 'sense', target_id: 'lex:sense.check.consult' },
      activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
      attribution: 'direct',
      outcome: 'correct',
      occurred_at: '2026-08-09T12:00:00.000Z',
      source: { source_type: 'test' },
    })
    const result = validateLearnerEvidenceV2(event)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.startsWith('TARGET_ID_PREFIX_MISMATCH'))).toBe(true)
  })

  it('keeps countability in the entity contract and makes PT-countable interference inexprimible', () => {
    const information = entities.units.find((unit) => unit.unit_id === 'lex:entity.information')
    expect(information.countability).toBe('mass')
    expect(renderSemanticEntity(information, { determiner: 'some' })).toMatchObject({
      en: 'some information',
      pt: 'alguma informação',
    })
    expectCode(() => renderSemanticEntity(information, { determiner: 'indefinite' }), 'ENTITY_COUNTABILITY_CONFLICT')
  })

  it('composes positive gold cases across entity and place registries', () => {
    const cases = [
      {
        verbId: 'lex:verb.check',
        senseId: 'lex:sense.check.consult',
        frameId: 'argframe:check.consult.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.schedule' } },
        en: 'I check the schedule.',
      },
      {
        verbId: 'lex:verb.check',
        senseId: 'lex:sense.check.consult',
        frameId: 'argframe:check.consult.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.price' } },
        en: 'I check the price.',
      },
      {
        verbId: 'lex:verb.show',
        senseId: 'lex:sense.show.present',
        frameId: 'argframe:show.present.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.photo_id' } },
        en: 'I show the photo ID.',
      },
      {
        verbId: 'lex:verb.show',
        senseId: 'lex:sense.show.present',
        frameId: 'argframe:show.present.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.receipt' } },
        en: 'I show the receipt.',
      },
      {
        verbId: 'lex:verb.find',
        senseId: 'lex:sense.find.locate',
        frameId: 'argframe:find.locate.entity',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.address' } },
        en: 'I find the address.',
      },
      {
        verbId: 'lex:verb.arrive',
        senseId: 'lex:sense.arrive.reach_destination',
        frameId: 'argframe:arrive.reach_destination.place',
        arguments: { destination: { source: 'places', unit_id: 'lex:place.airport' } },
        en: 'I arrive at the airport.',
      },
      {
        verbId: 'lex:verb.wait',
        senseId: 'lex:sense.wait.await',
        frameId: 'argframe:wait.await.for_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.train' } },
        en: 'I wait for the train.',
      },
      {
        verbId: 'lex:verb.pay',
        senseId: 'lex:sense.pay.payment',
        frameId: 'argframe:pay.payment.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.bill' } },
        en: 'I pay the bill.',
      },
      {
        verbId: 'lex:verb.pay',
        senseId: 'lex:sense.pay.payment',
        frameId: 'argframe:pay.payment.for_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.train_ticket' } },
        en: 'I pay for the train ticket.',
      },
      {
        verbId: 'lex:verb.take',
        senseId: 'lex:sense.take.consume_medicine',
        frameId: 'argframe:take.consume_medicine.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.medicine' } },
        en: 'I take the medicine.',
      },
      {
        verbId: 'lex:verb.take',
        senseId: 'lex:sense.take.transport',
        frameId: 'argframe:take.transport.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.train' } },
        en: 'I take the train.',
      },
      {
        verbId: 'lex:verb.use',
        senseId: 'lex:sense.use.instrument',
        frameId: 'argframe:use.instrument.direct_object',
        arguments: { object: { source: 'entities', unit_id: 'lex:entity.map' } },
        en: 'I use the map.',
      },
    ]

    for (const row of cases) {
      const plan = composePropositionPlan({ verbs, entities, places, ...row })
      expect(plan.plan_kind).toBe('typed_proposition')
      expect(plan.surface.en).toBe(row.en)
      expect(plan.predicate.lexeme_id).toBe(row.verbId)
      expect(plan.predicate.sense_id).toBe(row.senseId)
      expect(plan.predicate.argument_frame_id).toBe(row.frameId)
      expect(plan.negotiable_features).toEqual(expect.arrayContaining(['tense', 'polarity']))
    }
  })

  it('keeps verb sense distinct from argument frame for polysemy and multi-frame valency', () => {
    const take = verbs.units.find((verb) => verb.unit_id === 'lex:verb.take')
    expect(take.senses.map((sense) => sense.sense_id)).toEqual([
      'lex:sense.take.consume_medicine',
      'lex:sense.take.transport',
    ])

    const pay = verbs.units.find((verb) => verb.unit_id === 'lex:verb.pay')
    expect(pay.senses).toHaveLength(1)
    expect(pay.senses[0].argument_frames.map((frame) => frame.frame_id)).toEqual([
      'argframe:pay.payment.direct_object',
      'argframe:pay.payment.for_object',
    ])
  })

  it('rejects negative gold combinations with stable named reasons', () => {
    expectCode(() => composePropositionPlan({
      verbs, entities, places,
      verbId: 'lex:verb.check',
      senseId: 'lex:sense.check.consult',
      frameId: 'argframe:check.consult.direct_object',
      arguments: { object: { source: 'places', unit_id: 'lex:place.office' } },
    }), 'ARGUMENT_SOURCE_MISMATCH')

    expectCode(() => composePropositionPlan({
      verbs, entities, places,
      verbId: 'lex:verb.show',
      senseId: 'lex:sense.show.present',
      frameId: 'argframe:show.present.direct_object',
      arguments: { object: { source: 'places', unit_id: 'lex:place.office' } },
    }), 'ARGUMENT_SOURCE_MISMATCH')

    expectCode(() => composePropositionPlan({
      verbs, entities, places,
      verbId: 'lex:verb.take',
      senseId: 'lex:sense.take.transport',
      frameId: 'argframe:take.transport.direct_object',
      arguments: { object: { source: 'places', unit_id: 'lex:place.office' } },
    }), 'ARGUMENT_SOURCE_MISMATCH')
  })

  it('turns PT interference into explicit forbidden structures, not absence in a sample', () => {
    expectCode(() => composePropositionByStructure({
      verbs, entities, places,
      verbId: 'lex:verb.arrive',
      senseId: 'lex:sense.arrive.reach_destination',
      syntacticType: 'direct_object',
      argument: { source: 'places', unit_id: 'lex:place.airport' },
    }), 'CROSSLINGUAL_ERROR_PATTERN_FORBIDDEN')

    expectCode(() => composePropositionByStructure({
      verbs, entities, places,
      verbId: 'lex:verb.wait',
      senseId: 'lex:sense.wait.await',
      syntacticType: 'direct_object',
      argument: { source: 'entities', unit_id: 'lex:entity.train' },
    }), 'CROSSLINGUAL_ERROR_PATTERN_FORBIDDEN')
  })

  it('rejects construction-level realization requirements that conflict with a fixed proposition feature', () => {
    expectCode(() => composePropositionPlan({
      verbs, entities, places,
      verbId: 'lex:verb.arrive',
      senseId: 'lex:sense.arrive.reach_destination',
      frameId: 'argframe:arrive.reach_destination.place',
      arguments: { destination: { source: 'places', unit_id: 'lex:place.airport' } },
      fixedFeatures: { tense: 'simple_past' },
      requestedFeatures: { tense: 'simple_present' },
    }), 'PROPOSITION_FEATURE_CONFLICT')

    const compatible = composePropositionPlan({
      verbs, entities, places,
      verbId: 'lex:verb.arrive',
      senseId: 'lex:sense.arrive.reach_destination',
      frameId: 'argframe:arrive.reach_destination.place',
      arguments: { destination: { source: 'places', unit_id: 'lex:place.airport' } },
      requestedFeatures: { tense: 'simple_present' },
    })
    expect(compatible.resolved_features.tense).toBe('simple_present')
  })

  it('shows real multiplicative reuse and reports semantic exclusions separately from structural variety', () => {
    const audit = auditSemanticNetworkPilot({ verbs, entities, places })
    expect(audit).toMatchObject({
      raw_candidate_count: 198,
      licensed_candidate_count: 112,
      distinct_argument_frames: 11,
      distinct_syntax_families: 3,
      distinct_slot_signatures: 112,
    })
    expect(audit.semantic_exclusion_rate).toBeCloseTo(86 / 198, 8)
    expect(audit.exclusion_reasons.SEMANTIC_ROLE_MISMATCH).toBe(86)
    expect(audit.lexical_heads).toBeGreaterThan(50)
  })

  it('stays isolated from the lesson engine, licensed-realization materializer and builtin pedagogy catalogue', () => {
    const engine = readFileSync(new URL('./lesson-engine.js', import.meta.url), 'utf8')
    const licensed = readFileSync(new URL('./licensed-realizations.js', import.meta.url), 'utf8')
    const builtinIndex = readFileSync(new URL('../../content/pedagogy-v2/index.js', import.meta.url), 'utf8')

    for (const source of [engine, licensed, builtinIndex]) {
      expect(source).not.toContain('semantic-network-pilot')
      expect(source).not.toContain('entities.pilot.v1')
      expect(source).not.toContain('verbs.pilot.v1')
    }
  })
})
