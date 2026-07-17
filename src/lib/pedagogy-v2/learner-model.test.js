import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import {
  CAPABILITY_MODALITIES_V2, learnerDomainKey, parseLearnerDomainKey,
} from './learner-contracts.js'
import {
  validateLearnerEvidenceV2, buildLearnerEvidenceV2, reduceLearnerStatesV2,
  capabilityStrength, isTargetKnown, isTargetSeen, retentionStatusV2,
} from './learner-model.js'

const ev = (seq, overrides = {}) => buildLearnerEvidenceV2({
  profile_id: 'p1', session_id: 's1', seq,
  pack_id: 'pedagogy_v2_still', exemplar_id: 'exemplar:still.001',
  target_id: 'sense:still.continuity', target_type: 'sense',
  capability: 'recognition', modality: 'reading', support_lane: 'supported',
  outcome: 'correct', created_at: 1_000 + seq,
  ...overrides,
})

describe('learner_evidence_v2 validation', () => {
  it('accepts a well-formed event, resolving targets against the pack', () => {
    const r = validateLearnerEvidenceV2(ev(1), { packs: [stillPack] })
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('rejects capability×modality combinations that make no sense', () => {
    const r = validateLearnerEvidenceV2(ev(1, { modality: 'writing' }))
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.startsWith('EVIDENCE_DOMAIN_INVALID'))).toBe(true)
  })

  it('rejects target ids without the typed V2 prefix (no silent V1 mixing)', () => {
    const r = validateLearnerEvidenceV2(ev(1, { target_id: 'simple_present' }))
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.startsWith('EVIDENCE_TARGET_ID_PREFIX_MISMATCH'))).toBe(true)
  })

  it('rejects targets and exemplars that do not exist in the registry packs', () => {
    expect(validateLearnerEvidenceV2(ev(1, { target_id: 'sense:still.ghost' }), { packs: [stillPack] })
      .errors.some((e) => e.startsWith('EVIDENCE_TARGET_UNRESOLVED'))).toBe(true)
    expect(validateLearnerEvidenceV2(ev(1, { exemplar_id: 'exemplar:still.999' }), { packs: [stillPack] })
      .errors.some((e) => e.startsWith('EVIDENCE_EXEMPLAR_UNRESOLVED'))).toBe(true)
  })

  it('rejects events without profile, session or valid timestamp', () => {
    const r = validateLearnerEvidenceV2({ ...ev(1), profile_id: null, session_id: null, created_at: -5 })
    expect(r.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('EVIDENCE_PROFILE_REQUIRED'),
      expect.stringContaining('EVIDENCE_SESSION_REQUIRED'),
      expect.stringContaining('EVIDENCE_CREATED_AT_INVALID'),
    ]))
  })
})

describe('learner_target_states_v2 reconstruction', () => {
  it('is a deterministic fold: insertion order never changes the result', () => {
    const events = [
      ev(1), ev(2, { outcome: 'incorrect' }), ev(3, { outcome: 'partial' }),
      ev(4, { modality: 'listening' }), ev(5, { support_lane: 'independent' }),
    ]
    const shuffled = [events[3], events[0], events[4], events[2], events[1]]
    expect(reduceLearnerStatesV2(shuffled)).toEqual(reduceLearnerStatesV2(events))
  })

  it('keeps every learning domain separate: modality, lane and capability never merge', () => {
    const states = reduceLearnerStatesV2([
      ev(1),                                                        // reading, supported
      ev(2, { modality: 'listening' }),                             // listening ≠ reading
      ev(3, { support_lane: 'independent' }),                       // independent ≠ supported
      ev(4, { capability: 'controlled_production', modality: 'writing' }),
      ev(5, { capability: 'free_production', modality: 'speaking' }),
    ])
    expect(states).toHaveLength(5)
    const keys = states.map((s) => s.state_key)
    expect(new Set(keys).size).toBe(5)
    expect(parseLearnerDomainKey(keys[0]).target_id).toBe('sense:still.continuity')
  })

  it('tracks attempts, half-credit for partial, streaks and EWMA strength', () => {
    const [s] = reduceLearnerStatesV2([
      ev(1, { outcome: 'correct' }),
      ev(2, { outcome: 'partial' }),
      ev(3, { outcome: 'incorrect' }),
      ev(4, { outcome: 'correct' }),
    ])
    expect(s.attempts).toBe(4)
    expect(s.successes).toBe(2.5)
    expect(s.streak).toBe(1) // reset by the incorrect, rebuilt by the last correct
    // EWMA (alpha .35) from 1 → .825 → .536 → .699
    expect(s.strength).toBeCloseTo(0.699, 3)
    expect(s.last_outcome).toBe('correct')
    expect(s.last_success_at).toBe(1_004)
  })

  it('never produces a global mastery: state rows carry no cross-capability aggregate', () => {
    const states = reduceLearnerStatesV2([ev(1), ev(2, { capability: 'free_production', modality: 'writing' })])
    for (const s of states) {
      expect(s).not.toHaveProperty('mastery')
      expect(s).not.toHaveProperty('global_strength')
    }
    // Reading strength says nothing about production strength.
    expect(capabilityStrength(states, 'sense:still.continuity', 'recognition').strength).toBe(1)
    expect(capabilityStrength(states, 'sense:still.continuity', 'controlled_production').strength).toBe(0)
  })

  it('answers known/seen questions per target across domains', () => {
    const states = reduceLearnerStatesV2([ev(1), ev(2)])
    expect(isTargetSeen(states, 'sense:still.continuity')).toBe(true)
    expect(isTargetSeen(states, 'sense:still.counter_expectation')).toBe(false)
    expect(isTargetKnown(states, 'sense:still.continuity', { min_strength: 0.55, min_attempts: 1 })).toBe(true)
    const weak = reduceLearnerStatesV2([ev(1, { outcome: 'incorrect' })])
    expect(isTargetKnown(weak, 'sense:still.continuity', { min_strength: 0.55, min_attempts: 1 })).toBe(false)
  })

  it('computes retention per capability interval', () => {
    const [s] = reduceLearnerStatesV2([ev(1, { created_at: 1_000 })])
    const r = retentionStatusV2(s, { now: 1_000 + 4 * 24 * 3600 * 1000, intervals: { recognition: 2 * 24 * 3600 * 1000 } })
    expect(r.overdue_ratio).toBe(2)
    const fresh = retentionStatusV2(s, { now: 1_000, intervals: { recognition: 2 * 24 * 3600 * 1000 } })
    expect(fresh.overdue_ratio).toBe(0)
  })
})

describe('learner domain keys', () => {
  it('round-trips through the canonical key', () => {
    const parts = { target_id: 'construction:still.discourse_still_clause', capability: 'recognition', modality: 'listening', support_lane: 'independent' }
    expect(parseLearnerDomainKey(learnerDomainKey(parts))).toEqual(parts)
  })

  it('declares valid modalities per capability', () => {
    expect(CAPABILITY_MODALITIES_V2.recognition).toEqual(['reading', 'listening'])
    expect(CAPABILITY_MODALITIES_V2.free_production).toEqual(['writing', 'speaking'])
  })
})
