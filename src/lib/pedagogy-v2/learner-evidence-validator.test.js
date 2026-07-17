import { describe, it, expect } from 'vitest'
import { validateLearnerEvidenceV2, validateLearnerEvidenceBatchV2 } from './learner-evidence-validator.js'
import { buildLearnerEvidenceV2, deriveSupportTier, deriveCapabilityKey, createPackTargetResolver, allCapabilityKeys } from './learner-evidence-contracts.js'
import stillPack from '../../content/pedagogy-v2/still.json'

const resolveTarget = createPackTargetResolver([stillPack])

let seq = 0
function ev(over = {}) {
  seq++
  return buildLearnerEvidenceV2({
    evidence_id: `evidence:test.${String(seq).padStart(4, '0')}`,
    profile_id: 'p1',
    interaction_id: `interaction:${seq}`,
    target: { target_type: 'sense', target_id: 'sense:still.continuity' },
    exemplar_id: 'exemplar:still.001',
    activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
    attribution: 'direct',
    outcome: 'correct',
    occurred_at: '2026-07-01T10:00:00.000Z',
    source: { source_type: 'test' },
    ...over,
  })
}

function expectError(event, code, opts = { resolveTarget }) {
  const r = validateLearnerEvidenceV2(event, opts)
  expect(r.valid).toBe(false)
  expect(r.errors.some((e) => e.startsWith(code)), `expected ${code}, got:\n${r.errors.join('\n')}`).toBe(true)
}

describe('learner evidence contract — valid events', () => {
  it('accepts a fully-specified valid event', () => {
    const r = validateLearnerEvidenceV2(ev(), { resolveTarget })
    expect(r.errors).toEqual([])
    expect(r.valid).toBe(true)
  })

  it('accepts construction, function and lexeme targets from the still pack', () => {
    for (const [target_type, target_id] of [
      ['construction', 'construction:still.subject_still_lexical_verb'],
      ['communicative_function', 'function:express_result_despite_obstacle'],
      ['lexeme_usage', 'lexeme:still'],
    ]) {
      const r = validateLearnerEvidenceV2(ev({ target: { target_type, target_id } }), { resolveTarget })
      expect(r.errors, `${target_type}`).toEqual([])
    }
  })

  it('accepts a pure exposure event (observed, exposure attribution)', () => {
    const r = validateLearnerEvidenceV2(ev({
      activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'listening' },
      attribution: 'exposure',
      outcome: 'observed',
    }), { resolveTarget })
    expect(r.errors).toEqual([])
  })
})

describe('learner evidence contract — target rules', () => {
  it('rejects a nonexistent target when a resolver is provided', () => {
    expectError(ev({ target: { target_type: 'sense', target_id: 'sense:still.ghost' } }), 'TARGET_UNRESOLVED')
  })

  it('rejects a prefix incompatible with the declared type', () => {
    expectError(ev({ target: { target_type: 'construction', target_id: 'sense:still.continuity' } }), 'TARGET_ID_PREFIX_MISMATCH')
  })

  it('rejects a V1 skill_id used as target', () => {
    expectError(ev({ target: { target_type: 'sense', target_id: 'gerund_after_been' } }), 'TARGET_V1_SKILL_FORBIDDEN')
    expectError(ev({ target: { target_type: 'construction', target_id: 'still_continuity' } }), 'TARGET_V1_SKILL_FORBIDDEN')
  })

  it('rejects an invalid target type', () => {
    expectError(ev({ target: { target_type: 'skill', target_id: 'sense:still.continuity' } }), 'TARGET_TYPE_INVALID')
  })
})

describe('learner evidence contract — activity rules', () => {
  it('rejects incompatible capability/modality pairs', () => {
    expectError(ev({ activity: { activity_kind: 'pronunciation', capability: 'pronunciation', modality: 'reading' } }), 'CAPABILITY_MODALITY_INCOMPATIBLE')
    expectError(ev({ activity: { activity_kind: 'free_production', capability: 'free_production', modality: 'listening' } }), 'CAPABILITY_MODALITY_INCOMPATIBLE')
  })

  it('rejects an activity kind assessing a capability it cannot assess', () => {
    expectError(ev({ activity: { activity_kind: 'free_production', capability: 'recognition', modality: 'reading' } }), 'ACTIVITY_CAPABILITY_INCOMPATIBLE')
    expectError(ev({ activity: { activity_kind: 'meaning_recognition', capability: 'free_production', modality: 'writing' } }), 'ACTIVITY_CAPABILITY_INCOMPATIBLE')
  })

  it('rejects unknown activity kinds, capabilities and modalities', () => {
    expectError(ev({ activity: { activity_kind: 'quiz', capability: 'recognition', modality: 'reading' } }), 'ACTIVITY_KIND_INVALID')
    expectError(ev({ activity: { activity_kind: 'meaning_recognition', capability: 'memory', modality: 'reading' } }), 'CAPABILITY_INVALID')
    expectError(ev({ activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'braille' } }), 'MODALITY_INVALID')
  })
})

describe('learner evidence contract — outcome and confidence rules', () => {
  it('rejects partial without partial_score', () => {
    expectError(ev({ outcome: 'partial', partial_score: null }), 'PARTIAL_SCORE_REQUIRED')
  })

  it('rejects partial_score outside 0..1', () => {
    expectError(ev({ outcome: 'partial', partial_score: 1.5 }), 'PARTIAL_SCORE_REQUIRED')
    expectError(ev({ outcome: 'correct', partial_score: -0.2 }), 'PARTIAL_SCORE_OUT_OF_RANGE')
  })

  it('rejects assessment_confidence outside 0..1', () => {
    expectError(ev({ assessment_confidence: 1.2 }), 'ASSESSMENT_CONFIDENCE_OUT_OF_RANGE')
    expectError(ev({ assessment_confidence: -0.1 }), 'ASSESSMENT_CONFIDENCE_OUT_OF_RANGE')
  })

  it('rejects assessed outcomes on exposure attribution', () => {
    expectError(ev({ attribution: 'exposure', outcome: 'correct' }), 'EXPOSURE_CANNOT_BE_ASSESSED')
  })

  it('rejects exposure activities with non-exposure attribution', () => {
    expectError(ev({
      activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' },
      attribution: 'direct', outcome: 'observed',
    }), 'EXPOSURE_ACTIVITY_REQUIRES_EXPOSURE_ATTRIBUTION')
  })

  it('rejects unknown outcomes and attributions', () => {
    expectError(ev({ outcome: 'almost' }), 'OUTCOME_INVALID')
    expectError(ev({ attribution: 'inferred' }), 'ATTRIBUTION_INVALID')
  })
})

describe('learner evidence contract — support, source and time rules', () => {
  it('rejects invalid attempt numbers', () => {
    expectError(ev({ support: { features: [], hint_count: 0, attempt_number: 0 } }), 'ATTEMPT_NUMBER_INVALID')
    expectError(ev({ support: { features: [], hint_count: 0, attempt_number: 1.5 } }), 'ATTEMPT_NUMBER_INVALID')
  })

  it('rejects unknown support features and negative hint counts', () => {
    expectError(ev({ support: { features: ['calculator'], hint_count: 0, attempt_number: 1 } }), 'SUPPORT_FEATURE_INVALID')
    expectError(ev({ support: { features: [], hint_count: -1, attempt_number: 1 } }), 'HINT_COUNT_INVALID')
  })

  it('rejects invalid timestamps', () => {
    expectError(ev({ occurred_at: 'yesterday' }), 'OCCURRED_AT_INVALID')
    expectError(ev({ occurred_at: null }), 'OCCURRED_AT_INVALID')
  })

  it('rejects missing required fields', () => {
    expectError(ev({ evidence_id: 'not-prefixed' }), 'EVIDENCE_ID_INVALID')
    expectError(ev({ profile_id: null }), 'PROFILE_ID_REQUIRED')
    expectError(ev({ interaction_id: null }), 'INTERACTION_ID_REQUIRED')
    expectError({ ...ev(), target: null }, 'TARGET_REQUIRED')
    expectError({ ...ev(), activity: null }, 'ACTIVITY_REQUIRED')
    expectError({ ...ev(), support: null }, 'SUPPORT_REQUIRED')
    expectError(ev({ source: { source_type: 'crawler' } }), 'SOURCE_TYPE_INVALID')
    expectError(ev({ schema_version: 2 }), 'SCHEMA_VERSION_INVALID')
    expectError(ev({ exemplar_id: 'still.001' }), 'EXEMPLAR_ID_INVALID')
  })

  it('validates batches: any invalid event fails the whole batch, duplicates flagged', () => {
    const good = ev()
    const bad = ev({ outcome: 'almost' })
    const r = validateLearnerEvidenceBatchV2([good, bad], { resolveTarget })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.startsWith('events[1]:OUTCOME_INVALID'))).toBe(true)
    const dup = validateLearnerEvidenceBatchV2([good, { ...ev(), evidence_id: good.evidence_id }], { resolveTarget })
    expect(dup.errors.some((e) => e.includes('DUPLICATE_EVIDENCE_ID_IN_BATCH'))).toBe(true)
  })
})

describe('support tier derivation (centralized, pure)', () => {
  it('derives the documented tiers', () => {
    expect(deriveSupportTier({ features: [], hint_count: 0 })).toBe('none')
    expect(deriveSupportTier({ features: ['audio_replay'], hint_count: 0 })).toBe('low')
    expect(deriveSupportTier({ features: ['translation'], hint_count: 0 })).toBe('medium')
    expect(deriveSupportTier({ features: ['image'], hint_count: 0 })).toBe('medium')
    expect(deriveSupportTier({ features: ['word_bank'], hint_count: 0 })).toBe('high')
    expect(deriveSupportTier({ features: ['multiple_choice'], hint_count: 0 })).toBe('high')
    expect(deriveSupportTier({ features: ['model_sentence'], hint_count: 0 })).toBe('high')
    expect(deriveSupportTier({ features: ['answer_reveal'], hint_count: 0 })).toBe('answer_revealed')
  })

  it('hints escalate: one hint = medium, two or more = high', () => {
    expect(deriveSupportTier({ features: [], hint_count: 1 })).toBe('medium')
    expect(deriveSupportTier({ features: [], hint_count: 2 })).toBe('high')
  })

  it('the strongest signal wins; answer_reveal dominates everything', () => {
    expect(deriveSupportTier({ features: ['audio_replay', 'word_bank'], hint_count: 0 })).toBe('high')
    expect(deriveSupportTier({ features: ['word_bank', 'answer_reveal'], hint_count: 0 })).toBe('answer_revealed')
  })
})

describe('capability key derivation', () => {
  it('derives modality_capability keys for compatible pairs', () => {
    expect(deriveCapabilityKey({ capability: 'recognition', modality: 'reading' })).toBe('reading_recognition')
    expect(deriveCapabilityKey({ capability: 'recognition', modality: 'listening' })).toBe('listening_recognition')
    expect(deriveCapabilityKey({ capability: 'controlled_production', modality: 'writing' })).toBe('writing_controlled_production')
    expect(deriveCapabilityKey({ capability: 'free_production', modality: 'speaking' })).toBe('speaking_free_production')
    expect(deriveCapabilityKey({ capability: 'pronunciation', modality: 'speaking' })).toBe('speaking_pronunciation')
  })

  it('returns null for incompatible pairs', () => {
    expect(deriveCapabilityKey({ capability: 'pronunciation', modality: 'reading' })).toBeNull()
    expect(deriveCapabilityKey({ capability: 'free_production', modality: 'listening' })).toBeNull()
    expect(deriveCapabilityKey({ capability: 'recognition', modality: 'writing' })).toBeNull()
  })

  it('enumerates all trackable keys from the compatibility matrix', () => {
    const keys = allCapabilityKeys()
    expect(keys).toContain('reading_recognition')
    expect(keys).toContain('speaking_pronunciation')
    expect(keys).not.toContain('reading_pronunciation')
    expect(keys).not.toContain('listening_free_production')
  })
})
