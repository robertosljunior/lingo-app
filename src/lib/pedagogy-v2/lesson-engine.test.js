import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { buildLearnerEvidenceV2, reduceLearnerStatesV2 } from './learner-model.js'
import {
  selectNextActivityV2, createLessonSessionV2, appendActivityToSessionV2,
  DEFAULT_LESSON_ENGINE_POLICY_V2, ACTIVITY_KINDS_V2,
} from './lesson-engine.js'

const DAY = 24 * 3600 * 1000
const T0 = 1_000_000

// Evidence shorthand: n correct events per (target × capability × modality ×
// lane), timestamps advancing so retention math is exercised.
let seq = 0
const correctRun = (target_id, target_type, n, { capability = 'recognition', modality = 'reading', support_lane = 'supported', at = T0 } = {}) =>
  Array.from({ length: n }, (_, i) => buildLearnerEvidenceV2({
    profile_id: 'p1', session_id: 's0', seq: ++seq,
    pack_id: 'pedagogy_v2_still', exemplar_id: null,
    target_id, target_type, capability, modality, support_lane,
    outcome: 'correct', created_at: at + i,
  }))

// Recognition consolidated for a target — reading AND listening, supported and
// independent — enough to meet the default advancement threshold everywhere
// (strength ≥ .65, attempts ≥ 2).
const recognitionMastered = (target_id, target_type, at = T0) => [
  ...correctRun(target_id, target_type, 3, { at }),
  ...correctRun(target_id, target_type, 2, { support_lane: 'independent', at: at + 10 }),
  ...correctRun(target_id, target_type, 3, { modality: 'listening', at: at + 20 }),
  ...correctRun(target_id, target_type, 2, { modality: 'listening', support_lane: 'independent', at: at + 30 }),
]

// Every capability × modality × lane consolidated for a target.
const fullyMastered = (target_id, target_type, at = T0) => {
  const out = []
  const domains = [
    ['recognition', 'reading'], ['recognition', 'listening'],
    ['controlled_production', 'writing'], ['controlled_production', 'speaking'],
    ['free_production', 'writing'], ['free_production', 'speaking'],
  ]
  domains.forEach(([capability, modality], i) => {
    out.push(...correctRun(target_id, target_type, 2, { capability, modality, at: at + i * 10 }))
    out.push(...correctRun(target_id, target_type, 2, { capability, modality, support_lane: 'independent', at: at + i * 10 + 5 }))
  })
  return out
}

const CONTINUITY = ['sense:still.continuity', 'sense']
const LEXICAL = ['construction:still.subject_still_lexical_verb', 'construction']
const BE = ['construction:still.subject_be_still_complement', 'construction']
const COUNTER = ['sense:still.counter_expectation', 'sense']
const BUT = ['construction:still.clause_but_subject_still_verb', 'construction']

const select = ({ states = [], session, recentEvidence = [], policy = {} }) =>
  selectNextActivityV2({
    session: session || createLessonSessionV2({ session_id: 'sess1', now: T0 + DAY }),
    pack: stillPack,
    learnerStates: states,
    recentEvidence,
    policy,
  })

describe('selectNextActivityV2 — cold start', () => {
  it('a brand-new learner starts at the first authored exposure: exemplar 001, recognition/reading/supported', () => {
    const d = select({})
    expect(d.status).toBe('activity')
    expect(d.activity.exemplar_id).toBe('exemplar:still.001')
    expect(d.activity.text_en).toBe('I still live here.')
    expect(d.activity.capability).toBe('recognition')
    expect(d.activity.modality).toBe('reading')
    expect(d.activity.support_lane).toBe('supported')
    expect(d.activity.activity_kind).toBe('read_and_recognize')
    expect(d.activity.new_item_refs).toEqual([
      'sense:still.continuity',
      'construction:still.subject_still_lexical_verb',
    ])
    expect(d.budget.remaining).toBe(0)
    // Everything else is prerequisite-gated for an empty learner model.
    expect(d.excluded.every((x) => x.reason.startsWith('prerequisite_unmet'))).toBe(true)
  })

  it('is deterministic: identical inputs produce a deeply equal decision', () => {
    expect(select({})).toEqual(select({}))
  })

  it('only selects authored sentences — never generates text', () => {
    const d = select({})
    const authored = stillPack.exemplars.find((e) => e.exemplar_id === d.activity.exemplar_id)
    expect(d.activity.text_en).toBe(authored.text_en)
    expect(d.activity.text_pt).toBe(authored.text_pt)
  })
})

describe('selectNextActivityV2 — new-item budget', () => {
  it('with the session budget spent and no learner evidence yet, re-exposes the introduction instead of stalling', () => {
    let session = createLessonSessionV2({ session_id: 'sess1', now: T0 + DAY })
    const first = select({ session })
    session = appendActivityToSessionV2(session, first)
    // Budget is now 0 and 002–022 remain prerequisite-gated (no evidence was
    // recorded), so the engine falls back to repeating 001.
    const second = select({ session })
    expect(second.status).toBe('activity')
    expect(second.activity.exemplar_id).toBe('exemplar:still.001')
    expect(second.budget.remaining).toBe(0)
  })

  it('a zero budget blocks any exemplar that would introduce new items', () => {
    const d = select({ policy: { new_item_budget_per_session: 0 } })
    expect(d.status).toBe('no_eligible_activity')
    expect(d.excluded).toContainEqual({ exemplar_id: 'exemplar:still.001', reason: 'new_item_budget_exceeded' })
  })

  it('an exemplar introducing two new items does not fit a budget with one slot left', () => {
    // Learner already knows continuity + lexical construction; 011 (counter-
    // expectation + but-construction: 2 new items) must not fit budget 1,
    // while 006 (1 new item: the be-construction) must.
    const states = reduceLearnerStatesV2([
      ...recognitionMastered(...CONTINUITY),
      ...recognitionMastered(...LEXICAL),
    ])
    const d = select({ states, policy: { new_item_budget_per_session: 1 } })
    expect(d.excluded).toContainEqual({ exemplar_id: 'exemplar:still.011', reason: 'new_item_budget_exceeded' })
    expect(d.activity.exemplar_id).toBe('exemplar:still.006')
    expect(d.activity.new_item_refs).toEqual(['construction:still.subject_be_still_complement'])
  })
})

describe('selectNextActivityV2 — curricular progression of the still pilot', () => {
  it('after consolidating A1 continuity, the engine advances to the be-construction (same sense, new structure)', () => {
    const states = reduceLearnerStatesV2([
      ...recognitionMastered(...CONTINUITY),
      ...recognitionMastered(...LEXICAL),
    ])
    const d = select({ states })
    expect(d.activity.exemplar_id).toBe('exemplar:still.006')
    expect(d.activity.text_en).toBe('I am still tired.')
    // First contact with unseen content is always supported recognition.
    expect(d.activity.capability).toBe('recognition')
    expect(d.activity.support_lane).toBe('supported')
    expect(d.score_breakdown.novelty).toBe(1)
  })

  it('prerequisites gate the although- and discourse-constructions until their bases are known', () => {
    const states = reduceLearnerStatesV2([
      ...recognitionMastered(...CONTINUITY),
      ...recognitionMastered(...LEXICAL),
    ])
    const d = select({ states })
    const reasons = Object.fromEntries(d.excluded.map((x) => [x.exemplar_id, x.reason]))
    // 015 (although) and 019 (discourse marker) both build on the counter-
    // expectation sense, which this learner has never met; the discourse
    // consolidation exemplars are additionally gated on their own sense.
    expect(reasons['exemplar:still.015']).toBe('prerequisite_unmet:sense:still.counter_expectation')
    expect(reasons['exemplar:still.019']).toBe('prerequisite_unmet:sense:still.counter_expectation')
    expect(reasons['exemplar:still.020']).toBe('prerequisite_unmet:sense:still.discourse_reservation')
  })

  it('once but-construction and counter-expectation are known, the although-construction becomes reachable', () => {
    const states = reduceLearnerStatesV2([
      ...recognitionMastered(...CONTINUITY),
      ...recognitionMastered(...LEXICAL),
      ...recognitionMastered(...BE),
      ...recognitionMastered(...COUNTER),
      ...recognitionMastered(...BUT),
    ])
    const d = select({ states })
    expect(d.excluded.map((x) => x.exemplar_id)).not.toContain('exemplar:still.015')
    // The frontier is now A2-B1 and 015 introduces the although-construction.
    expect(d.activity.exemplar_id).toBe('exemplar:still.015')
    expect(d.activity.new_item_refs).toContain('construction:still.although_clause_subject_still_verb')
  })
})

describe('selectNextActivityV2 — capability ladder, lanes and modality', () => {
  it('advances from recognition toward controlled production, never straight to free production', () => {
    const states = reduceLearnerStatesV2([
      ...recognitionMastered(...CONTINUITY),
      ...recognitionMastered(...LEXICAL),
    ])
    // Forbid new items so the engine must deepen what is already known.
    const d = select({ states, policy: { new_item_budget_per_session: 0 } })
    expect(d.status).toBe('activity')
    expect(d.activity.capability).toBe('controlled_production')
    expect(d.activity.support_lane).toBe('supported')
    const capabilities = new Set([d.activity.capability, ...d.alternatives.map((a) => a.capability)])
    expect(capabilities.has('free_production')).toBe(false)
  })

  it('unlocks the independent lane per modality: supported listening success unlocks independent listening, not reading', () => {
    // Evidence exists ONLY in supported listening. With scoring reduced to the
    // independence component, the winner must be the sole legal independent
    // domain — listening — proving reading/independent stayed locked.
    const listeningOnly = reduceLearnerStatesV2([
      ...correctRun(...CONTINUITY, 3, { modality: 'listening' }),
      ...correctRun(...LEXICAL, 3, { modality: 'listening' }),
    ])
    const onlyIndependence = { need: 0, retention: 0, progression: 0, capability_gap: 0, independence: 1, novelty: 0, diversity: 0, remediation: 0 }
    const d = select({ states: listeningOnly, policy: { new_item_budget_per_session: 0, weights: onlyIndependence } })
    expect(d.activity.support_lane).toBe('independent')
    expect(d.activity.capability).toBe('recognition')
    expect(d.activity.modality).toBe('listening')
  })

  it('every emitted activity kind is a declared capability×modality pairing', () => {
    expect(Object.keys(ACTIVITY_KINDS_V2)).toHaveLength(6)
    const states = reduceLearnerStatesV2([...recognitionMastered(...CONTINUITY), ...recognitionMastered(...LEXICAL)])
    const d = select({ states, policy: { new_item_budget_per_session: 0 } })
    expect(ACTIVITY_KINDS_V2[`${d.activity.capability}|${d.activity.modality}`]).toBe(d.activity.activity_kind)
  })
})

describe('selectNextActivityV2 — retention, remediation and diversity', () => {
  it('long-unpracticed capabilities come due again (retention per capability)', () => {
    const states = reduceLearnerStatesV2([
      ...fullyMastered(...CONTINUITY),
      ...fullyMastered(...LEXICAL),
    ])
    const session = createLessonSessionV2({ session_id: 'sess1', now: T0 + 30 * DAY })
    const d = select({ states, session, policy: { new_item_budget_per_session: 0 } })
    expect(d.status).toBe('activity')
    expect(d.score_breakdown.retention).toBeGreaterThan(0)
  })

  it('a recent error pulls the target back into the supported lane', () => {
    const states = reduceLearnerStatesV2([
      ...recognitionMastered(...CONTINUITY),
      ...recognitionMastered(...LEXICAL),
      ...recognitionMastered(...BE),
    ])
    const miss = buildLearnerEvidenceV2({
      profile_id: 'p1', session_id: 'sess1', seq: 999,
      pack_id: 'pedagogy_v2_still', exemplar_id: 'exemplar:still.006',
      target_id: BE[0], target_type: 'construction',
      capability: 'recognition', modality: 'reading', support_lane: 'independent',
      outcome: 'incorrect', created_at: T0 + DAY - 1,
    })
    const d = select({ states, recentEvidence: [miss], policy: { new_item_budget_per_session: 0 } })
    expect(d.activity.primary_target_ids).toContain(BE[0])
    expect(d.activity.support_lane).toBe('supported')
    expect(d.score_breakdown.remediation).toBe(1)
  })

  it('avoids repeating the same exemplar within the cooldown window', () => {
    const states = reduceLearnerStatesV2([
      ...recognitionMastered(...CONTINUITY),
      ...recognitionMastered(...LEXICAL),
    ])
    let session = createLessonSessionV2({ session_id: 'sess1', now: T0 + DAY })
    const first = select({ states, session, policy: { new_item_budget_per_session: 0 } })
    session = appendActivityToSessionV2(session, first)
    const second = select({ states, session, policy: { new_item_budget_per_session: 0 } })
    expect(second.activity.exemplar_id).not.toBe(first.activity.exemplar_id)
  })
})

describe('selectNextActivityV2 — session lifecycle', () => {
  it('reports session_complete once the activity cap is reached', () => {
    const session = {
      ...createLessonSessionV2({ session_id: 'sess1', now: T0 }),
      history: Array.from({ length: DEFAULT_LESSON_ENGINE_POLICY_V2.max_activities_per_session }, (_, i) => ({
        exemplar_id: `exemplar:still.00${(i % 5) + 1}`, construction_id: 'construction:still.subject_still_lexical_verb',
        capability: 'recognition', modality: 'reading', support_lane: 'supported', new_item_refs: [],
      })),
    }
    expect(select({ session }).status).toBe('session_complete')
  })

  it('appendActivityToSessionV2 is pure and tracks introduced new items', () => {
    const session = createLessonSessionV2({ session_id: 'sess1', now: T0 + DAY })
    const d = select({ session })
    const next = appendActivityToSessionV2(session, d)
    expect(session.history).toHaveLength(0)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].new_item_refs).toEqual(d.activity.new_item_refs)
  })

  it('enforces declared V1 bridge prerequisites when the caller provides the mastered list', () => {
    const session = { ...createLessonSessionV2({ session_id: 'sess1', now: T0 + DAY }), v1_mastered_skill_ids: [] }
    const d = selectNextActivityV2({ session, pack: stillPack, learnerStates: [], recentEvidence: [], policy: {} })
    // 001 requires the simple_present bridge → with an empty mastered list the
    // whole pack is gated and the engine says so instead of guessing.
    expect(d.status).toBe('no_eligible_activity')
    expect(d.excluded).toContainEqual({ exemplar_id: 'exemplar:still.001', reason: 'v1_prerequisite_unmet:simple_present' })
  })
})
