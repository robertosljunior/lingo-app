import { describe, it, expect } from 'vitest'
import {
  getEvidenceWeight, aggregateTargetEvidence, aggregateProfileEvidence,
  compareTargetStates, canonicalizeEvidence,
} from './learner-model.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { getCapabilityLane, getRetention, getSupportFeatureSummary, listAssessedCapabilities } from './learner-model-query.js'

const CONT = { target_type: 'sense', target_id: 'sense:still.continuity' }
const C_LEX = { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' }
const C_BE = { target_type: 'construction', target_id: 'construction:still.subject_be_still_complement' }
const C_ALTHOUGH = { target_type: 'construction', target_id: 'construction:still.although_clause_subject_still_verb' }
const F_DESPITE = { target_type: 'communicative_function', target_id: 'function:express_result_despite_obstacle' }
const COUNTER = { target_type: 'sense', target_id: 'sense:still.counter_expectation' }

const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const LISTEN_REC = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }
const WRITE_CTRL = { activity_kind: 'controlled_completion', capability: 'controlled_production', modality: 'writing' }
const SPEAK_FREE = { activity_kind: 'free_production', capability: 'free_production', modality: 'speaking' }
const SPEAK_PRON = { activity_kind: 'pronunciation', capability: 'pronunciation', modality: 'speaking' }

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const minutes = (n) => new Date(T0 + n * 60000).toISOString()
const hours = (n) => new Date(T0 + n * 3600000).toISOString()

let seq = 0
function ev(over = {}) {
  seq++
  return buildLearnerEvidenceV2({
    evidence_id: `evidence:test.${String(seq).padStart(4, '0')}`,
    profile_id: 'p1',
    interaction_id: over.interaction_id || `interaction:${seq}`,
    target: CONT,
    exemplar_id: 'exemplar:still.001',
    activity: READ_REC,
    attribution: 'direct',
    outcome: 'correct',
    occurred_at: minutes(seq),
    source: { source_type: 'test' },
    ...over,
  })
}
const agg = (events, target = CONT, profile = 'p1') => aggregateTargetEvidence(events, { profile_id: profile, target })
const masteryOf = (events) => getCapabilityLane(agg(events), 'reading_recognition', 'overall').mastery_estimate

describe('evidence weight — required influence ordering', () => {
  it('correct direct unaided 1st attempt > word_bank > indirect+word_bank > answer_reveal > exposure', () => {
    const unaided = getEvidenceWeight(ev())
    const wordBank = getEvidenceWeight(ev({ support: { features: ['word_bank'], hint_count: 0, attempt_number: 1 } }))
    const indirectWordBank = getEvidenceWeight(ev({ attribution: 'indirect', support: { features: ['word_bank'], hint_count: 0, attempt_number: 1 } }))
    const revealed = getEvidenceWeight(ev({ support: { features: ['answer_reveal'], hint_count: 0, attempt_number: 1 } }))
    const exposure = getEvidenceWeight(ev({ attribution: 'exposure', outcome: 'observed' }))
    expect(unaided).toBeGreaterThan(wordBank)
    expect(wordBank).toBeGreaterThan(indirectWordBank)
    expect(indirectWordBank).toBeGreaterThan(revealed)
    expect(revealed).toBeGreaterThan(exposure)
    expect(exposure).toBe(0)
  })

  it('1st attempt > 2nd attempt > 3rd attempt', () => {
    const w = (attempt_number) => getEvidenceWeight(ev({ support: { features: [], hint_count: 0, attempt_number } }))
    expect(w(1)).toBeGreaterThan(w(2))
    expect(w(2)).toBeGreaterThan(w(3))
    expect(w(3)).toBe(w(4))
  })

  it('direct weighs more than indirect; low confidence reduces weight', () => {
    expect(getEvidenceWeight(ev())).toBeGreaterThan(getEvidenceWeight(ev({ attribution: 'indirect' })))
    expect(getEvidenceWeight(ev())).toBeGreaterThan(getEvidenceWeight(ev({ assessment_confidence: 0.5 })))
  })

  it('observed and not_assessed carry zero weight', () => {
    expect(getEvidenceWeight(ev({ outcome: 'observed' }))).toBe(0)
    expect(getEvidenceWeight(ev({ outcome: 'not_assessed' }))).toBe(0)
  })
})

describe('capability separation — no cross-talk', () => {
  it('reading recognition does not update listening recognition (and vice versa)', () => {
    const state = agg([ev({ activity: READ_REC })])
    expect(getCapabilityLane(state, 'reading_recognition', 'overall').assessed_evidence_count).toBe(1)
    expect(getCapabilityLane(state, 'listening_recognition')).toBeNull()
    const state2 = agg([ev({ activity: LISTEN_REC })])
    expect(getCapabilityLane(state2, 'listening_recognition', 'overall').assessed_evidence_count).toBe(1)
    expect(getCapabilityLane(state2, 'reading_recognition')).toBeNull()
  })

  it('recognition does not update production; controlled does not update free', () => {
    const state = agg([ev({ activity: READ_REC }), ev({ activity: WRITE_CTRL })])
    expect(getCapabilityLane(state, 'reading_recognition', 'overall').assessed_evidence_count).toBe(1)
    expect(getCapabilityLane(state, 'writing_controlled_production', 'overall').assessed_evidence_count).toBe(1)
    expect(getCapabilityLane(state, 'writing_free_production')).toBeNull()
    expect(getCapabilityLane(state, 'speaking_free_production')).toBeNull()
  })

  it('writing does not update speaking; pronunciation only updates speaking_pronunciation', () => {
    const state = agg([ev({ activity: WRITE_CTRL }), ev({ activity: SPEAK_PRON })])
    expect(getCapabilityLane(state, 'speaking_controlled_production')).toBeNull()
    expect(listAssessedCapabilities(state)).toEqual(['speaking_pronunciation', 'writing_controlled_production'])
  })
})

describe('support — independent vs supported lanes', () => {
  it('unaided correct feeds overall + independent; translation feeds overall + supported', () => {
    const state = agg([
      ev({ support: { features: [], hint_count: 0, attempt_number: 1 } }),
      ev({ support: { features: ['translation'], hint_count: 0, attempt_number: 1 } }),
    ])
    const cap = state.capabilities.reading_recognition
    expect(cap.overall.assessed_evidence_count).toBe(2)
    expect(cap.independent.assessed_evidence_count).toBe(1)
    expect(cap.supported.assessed_evidence_count).toBe(1)
  })

  it('unaided correct moves mastery more than translation or word_bank', () => {
    const unaided = masteryOf([ev()])
    const translated = masteryOf([ev({ support: { features: ['translation'], hint_count: 0, attempt_number: 1 } })])
    const banked = masteryOf([ev({ support: { features: ['word_bank'], hint_count: 0, attempt_number: 1 } })])
    expect(unaided).toBeGreaterThan(translated)
    expect(translated).toBeGreaterThan(banked)
  })

  it('answer_reveal never updates the independent lane', () => {
    const state = agg([ev({ support: { features: ['answer_reveal'], hint_count: 0, attempt_number: 1 } })])
    const cap = state.capabilities.reading_recognition
    expect(cap.independent.assessed_evidence_count).toBe(0)
    expect(cap.independent.mastery_estimate).toBeNull()
    expect(cap.supported.assessed_evidence_count).toBe(1)
    expect(cap.overall.effective_evidence_weight).toBeCloseTo(0.15, 4)
  })

  it('first attempt moves mastery more than second, and second more than third', () => {
    const m = (attempt_number) => masteryOf([ev({ support: { features: [], hint_count: 0, attempt_number } })])
    expect(m(1)).toBeGreaterThan(m(2))
    expect(m(2)).toBeGreaterThan(m(3))
  })

  it('support feature summary tracks per-feature usage sparsely', () => {
    const state = agg([
      ev({ support: { features: ['translation'], hint_count: 0, attempt_number: 1 } }),
      ev({ outcome: 'incorrect', support: { features: ['translation'], hint_count: 0, attempt_number: 1 } }),
      ev({ support: { features: ['word_bank'], hint_count: 0, attempt_number: 1 } }),
    ])
    const translation = getSupportFeatureSummary(state, 'translation')
    expect(translation.evidence_count).toBe(2)
    expect(translation.success_estimate).toBeCloseTo((1 + 1) / (2 + 2), 4)
    expect(translation.last_used_at).toBeTruthy()
    expect(getSupportFeatureSummary(state, 'word_bank').evidence_count).toBe(1)
    expect(getSupportFeatureSummary(state, 'hint')).toBeNull()
  })
})

describe('attribution and outcome semantics', () => {
  it('direct evidence weighs more than indirect in aggregation', () => {
    const direct = masteryOf([ev()])
    const indirect = masteryOf([ev({ attribution: 'indirect' })])
    expect(direct).toBeGreaterThan(indirect)
  })

  it('exposure updates exposure counters but never mastery', () => {
    const state = agg([ev({ attribution: 'exposure', outcome: 'observed', activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' } })])
    expect(state.exposure.count).toBe(1)
    expect(state.exposure.exposure_only_count).toBe(1)
    expect(state.exposure.first_seen_at).toBeTruthy()
    expect(state.capabilities).toEqual({})
  })

  it('not_assessed and observed never behave like correct answers', () => {
    const state = agg([ev({ outcome: 'not_assessed' }), ev({ outcome: 'observed' })])
    expect(state.capabilities).toEqual({})
    expect(state.evidence_count).toBe(2)
  })

  it('indirect evidence never creates retention retrievals (not a direct assessment)', () => {
    const state = agg([ev({ attribution: 'indirect' })])
    expect(getRetention(state, 'reading_recognition')).toBeNull()
  })

  it('correct increases success, incorrect increases failure, partial lands between', () => {
    const correct = masteryOf([ev()])
    const partial = masteryOf([ev({ outcome: 'partial', partial_score: 0.5 })])
    const incorrect = masteryOf([ev({ outcome: 'incorrect' })])
    expect(correct).toBeGreaterThan(partial)
    expect(partial).toBeGreaterThan(incorrect)
    const failLane = getCapabilityLane(agg([ev({ outcome: 'incorrect' })]), 'reading_recognition', 'overall')
    expect(failLane.weighted_failure).toBeGreaterThan(0)
    expect(failLane.weighted_success).toBe(0)
  })

  it('one correct answer never yields 100% mastery nor "established" evidence', () => {
    const lane = getCapabilityLane(agg([ev()]), 'reading_recognition', 'overall')
    expect(lane.mastery_estimate).toBeLessThan(1)
    expect(lane.mastery_estimate).toBeCloseTo(2 / 3, 3)
    expect(lane.evidence_level).toBe('insufficient')
  })

  it('low confidence reduces influence on mastery', () => {
    expect(masteryOf([ev()])).toBeGreaterThan(masteryOf([ev({ assessment_confidence: 0.4 })]))
  })
})

describe('aggregated state shape', () => {
  it('has NO root-level mastery for the target', () => {
    const state = agg([ev(), ev({ activity: WRITE_CTRL })])
    expect(state).not.toHaveProperty('mastery')
    expect(state).not.toHaveProperty('mastery_estimate')
    for (const cap of Object.values(state.capabilities)) {
      expect(cap.overall.mastery_estimate).not.toBeNull()
    }
  })

  it('separates states per target and per profile', () => {
    const events = [
      ev({ target: C_LEX }), ev({ target: C_BE }),
      ev({ target: C_LEX, profile_id: 'p2' }),
    ]
    const states = aggregateProfileEvidence(events)
    expect(states.map((s) => s.key)).toEqual([
      'p1:construction:construction:still.subject_be_still_complement',
      'p1:construction:construction:still.subject_still_lexical_verb',
      'p2:construction:construction:still.subject_still_lexical_verb',
    ])
    expect(states[1].evidence_count).toBe(1)
  })

  it('evidence level requires accumulated effective weight, not a lucky answer', () => {
    const two = getCapabilityLane(agg([ev(), ev()]), 'reading_recognition', 'overall')
    expect(two.evidence_level).toBe('emerging') // weight 2.0
    const five = getCapabilityLane(agg([ev(), ev(), ev(), ev(), ev()]), 'reading_recognition', 'overall')
    expect(five.evidence_level).toBe('established') // weight 5.0
  })

  it('derives trend from recent events', () => {
    const improving = [
      ev({ outcome: 'incorrect' }), ev({ outcome: 'incorrect' }), ev({ outcome: 'incorrect' }),
      ev(), ev(), ev(),
    ]
    expect(getCapabilityLane(agg(improving), 'reading_recognition', 'overall').trend).toBe('improving')
    const declining = [
      ev(), ev(), ev(),
      ev({ outcome: 'incorrect' }), ev({ outcome: 'incorrect' }), ev({ outcome: 'incorrect' }),
    ]
    expect(getCapabilityLane(agg(declining), 'reading_recognition', 'overall').trend).toBe('declining')
    expect(getCapabilityLane(agg([ev(), ev()]), 'reading_recognition', 'overall').trend).toBe('insufficient')
  })

  it('tracks streaks chronologically', () => {
    const lane = getCapabilityLane(agg([ev(), ev(), ev({ outcome: 'incorrect' }), ev()]), 'reading_recognition', 'overall')
    expect(lane.best_streak).toBe(2)
    expect(lane.current_streak).toBe(1)
  })

  it('aggregation is independent of event order and idempotent over duplicates', () => {
    const events = [
      ev(), ev({ outcome: 'incorrect' }), ev({ activity: WRITE_CTRL }),
      ev({ support: { features: ['word_bank'], hint_count: 0, attempt_number: 2 } }),
      ev({ attribution: 'exposure', outcome: 'observed', activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'listening' } }),
      ev({ outcome: 'partial', partial_score: 0.5, assessment_confidence: 0.8 }),
    ]
    const shuffled = [events[3], events[5], events[0], events[4], events[2], events[1]]
    const withDupes = [...shuffled, events[0], events[2]]
    const a = agg(events)
    const b = agg(shuffled)
    const c = agg(withDupes)
    expect(compareTargetStates(a, b).equal).toBe(true)
    expect(compareTargetStates(a, c).equal).toBe(true)
    expect(canonicalizeEvidence(withDupes).length).toBe(6)
  })

  it('updated_at derives from the latest event, keeping the state a pure function of evidence', () => {
    const e1 = ev(); const e2 = ev()
    expect(agg([e1, e2]).updated_at).toBe(e2.occurred_at)
    expect(agg([e2, e1]).updated_at).toBe(e2.occurred_at)
  })
})

describe('retention per capability key', () => {
  const at = (h, over = {}) => ev({ occurred_at: hours(h), ...over })

  it('a single answer produces retrieval counters but no stability', () => {
    const r = getRetention(agg([at(0)]), 'reading_recognition')
    expect(r.assessed_retrievals).toBe(1)
    expect(r.successful_retrievals).toBe(1)
    expect(r.stability_estimate).toBeNull()
    expect(r.last_retrieval_interval).toBeNull()
  })

  it('a short-interval answer is not a delayed retrieval', () => {
    const r = getRetention(agg([at(0), at(1)]), 'reading_recognition')
    expect(r.assessed_retrievals).toBe(2)
    expect(r.delayed_retrievals).toBe(0)
    expect(r.stability_estimate).toBeNull()
    expect(r.last_retrieval_interval).toBe(3600000)
  })

  it('a correct retrieval after ≥24h counts as delayed and creates stability', () => {
    const r = getRetention(agg([at(0), at(48)]), 'reading_recognition')
    expect(r.delayed_retrievals).toBe(1)
    expect(r.successful_delayed_retrievals).toBe(1)
    expect(r.stability_estimate).toBeCloseTo(2, 4) // 48h = 2 days
  })

  it('stability grows with successful delayed retrievals and shrinks on delayed failure', () => {
    const grown = getRetention(agg([at(0), at(48), at(48 + 72)]), 'reading_recognition')
    // after 2d: 2.0; after +3d: max(2*1.2, (2+3)/2) = 2.5
    expect(grown.stability_estimate).toBeCloseTo(2.5, 4)
    const shrunk = getRetention(agg([at(0), at(48), at(48 + 72), at(48 + 72 + 48, { outcome: 'incorrect' })]), 'reading_recognition')
    expect(shrunk.stability_estimate).toBeCloseTo(1.25, 4) // 2.5 * 0.5
    expect(shrunk.failed_delayed_retrievals).toBe(1)
  })

  it('records last/previous retrieval and the maximum successful interval', () => {
    const r = getRetention(agg([at(0), at(48), at(48 + 72)]), 'reading_recognition')
    expect(r.previous_retrieval_at).toBe(hours(48))
    expect(r.last_retrieval_at).toBe(hours(48 + 72))
    expect(r.maximum_successful_interval).toBe(72 * 3600000)
  })

  it('reading retention never moves free-production retention', () => {
    const state = agg([at(0), at(48), at(72, { activity: SPEAK_FREE })])
    expect(getRetention(state, 'reading_recognition').assessed_retrievals).toBe(2)
    const speak = getRetention(state, 'speaking_free_production')
    expect(speak.assessed_retrievals).toBe(1)
    expect(speak.delayed_retrievals).toBe(0) // first retrieval of ITS OWN key
    expect(speak.stability_estimate).toBeNull()
  })

  it('answer_reveal events are not retrievals', () => {
    const r = getRetention(agg([at(0, { support: { features: ['answer_reveal'], hint_count: 0, attempt_number: 1 } })]), 'reading_recognition')
    expect(r).toBeNull()
  })
})

describe('still pack integration — targets stay independent', () => {
  it('the continuity sense tracks reading/listening/controlled-writing/free-speaking separately', () => {
    const state = agg([
      ev({ activity: READ_REC }),
      ev({ activity: LISTEN_REC, outcome: 'incorrect' }),
      ev({ activity: WRITE_CTRL, support: { features: ['word_bank'], hint_count: 0, attempt_number: 1 } }),
      ev({ activity: SPEAK_FREE, outcome: 'partial', partial_score: 0.5 }),
    ])
    expect(listAssessedCapabilities(state)).toEqual([
      'listening_recognition', 'reading_recognition', 'speaking_free_production', 'writing_controlled_production',
    ])
    for (const key of listAssessedCapabilities(state)) {
      expect(getCapabilityLane(state, key, 'overall').assessed_evidence_count, key).toBe(1)
    }
    // one modality did not leak into another: their masteries differ as authored
    expect(getCapabilityLane(state, 'reading_recognition', 'overall').mastery_estimate)
      .toBeGreaterThan(getCapabilityLane(state, 'listening_recognition', 'overall').mastery_estimate)
  })

  it('"I still live here" and "I am still tired" constructions are independent states sharing a sense', () => {
    const events = [
      ev({ target: C_LEX, exemplar_id: 'exemplar:still.001', activity: WRITE_CTRL }),
      ev({ target: C_LEX, exemplar_id: 'exemplar:still.002', activity: WRITE_CTRL }),
      ev({ target: C_BE, exemplar_id: 'exemplar:still.006', activity: WRITE_CTRL, outcome: 'incorrect' }),
      // the shared sense accrues its own (indirect) evidence stream
      ev({ target: CONT, attribution: 'indirect', activity: WRITE_CTRL }),
    ]
    const states = aggregateProfileEvidence(events)
    const lex = states.find((s) => s.target.target_id === C_LEX.target_id)
    const be = states.find((s) => s.target.target_id === C_BE.target_id)
    const sense = states.find((s) => s.target.target_id === CONT.target_id)
    expect(lex.capabilities.writing_controlled_production.overall.assessed_evidence_count).toBe(2)
    expect(be.capabilities.writing_controlled_production.overall.assessed_evidence_count).toBe(1)
    expect(lex.capabilities.writing_controlled_production.overall.mastery_estimate)
      .toBeGreaterThan(be.capabilities.writing_controlled_production.overall.mastery_estimate)
    expect(sense.evidence_count).toBe(1)
  })

  it('one concessive interaction emits direct construction + indirect sense + indirect function evidence, kept as three states', () => {
    const interaction_id = 'interaction:although-1'
    const shared = { interaction_id, exemplar_id: 'exemplar:still.015', activity: WRITE_CTRL, occurred_at: minutes(999) }
    const events = [
      ev({ ...shared, target: C_ALTHOUGH, attribution: 'direct' }),
      ev({ ...shared, target: COUNTER, attribution: 'indirect' }),
      ev({ ...shared, target: F_DESPITE, attribution: 'indirect' }),
    ]
    const states = aggregateProfileEvidence(events)
    expect(states).toHaveLength(3)
    const construction = states.find((s) => s.target.target_id === C_ALTHOUGH.target_id)
    const sense = states.find((s) => s.target.target_id === COUNTER.target_id)
    const fn = states.find((s) => s.target.target_id === F_DESPITE.target_id)
    const w = (s) => s.capabilities.writing_controlled_production.overall.effective_evidence_weight
    expect(w(construction)).toBeCloseTo(1, 4)
    expect(w(sense)).toBeCloseTo(0.5, 4)
    expect(w(fn)).toBeCloseTo(0.5, 4)
    // the three records share the interaction but never collapse into one
    expect(new Set(states.map((s) => s.key)).size).toBe(3)
  })
})
