import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  appendLearnerEvidenceV2, appendLearnerEvidenceBatchV2, getLearnerEvidenceV2,
  getLearnerStatesV2, getLearnerStatesForTargetV2, rebuildLearnerStatesV2,
  __resetLearnerV2StoreForTests,
} from './learner-store.js'
import { buildLearnerEvidenceV2 } from './learner-model.js'

const ev = (seq, overrides = {}) => buildLearnerEvidenceV2({
  profile_id: 'p1', session_id: 's1', seq,
  pack_id: 'pedagogy_v2_still', exemplar_id: 'exemplar:still.001',
  target_id: 'sense:still.continuity', target_type: 'sense',
  capability: 'recognition', modality: 'reading', support_lane: 'supported',
  outcome: 'correct', created_at: 1_000 + seq,
  ...overrides,
})

describe('learner-store (learner_evidence_v2 + learner_target_states_v2)', () => {
  beforeEach(async () => {
    await __resetLearnerV2StoreForTests()
  })

  it('appends valid evidence and derives states incrementally', async () => {
    expect((await appendLearnerEvidenceV2(ev(1))).ok).toBe(true)
    expect((await appendLearnerEvidenceV2(ev(2, { outcome: 'partial' }))).ok).toBe(true)
    const states = await getLearnerStatesV2('p1')
    expect(states).toHaveLength(1)
    expect(states[0].attempts).toBe(2)
    expect(states[0].successes).toBe(1.5)
  })

  it('evidence is immutable: an existing evidence_id can never be rewritten', async () => {
    await appendLearnerEvidenceV2(ev(1))
    const again = await appendLearnerEvidenceV2(ev(1, { outcome: 'incorrect' }))
    expect(again.ok).toBe(false)
    expect(again.errors[0]).toContain('EVIDENCE_IMMUTABLE')
    const rows = await getLearnerEvidenceV2('p1')
    expect(rows).toHaveLength(1)
    expect(rows[0].outcome).toBe('correct')
  })

  it('validates every append against the pedagogy-v2 registry', async () => {
    const bad = await appendLearnerEvidenceV2(ev(1, { target_id: 'sense:still.ghost' }))
    expect(bad.ok).toBe(false)
    expect(bad.errors.some((e) => e.startsWith('EVIDENCE_TARGET_UNRESOLVED'))).toBe(true)
    expect(await getLearnerEvidenceV2('p1')).toHaveLength(0)
  })

  it('states are fully reconstructible from the event log', async () => {
    await appendLearnerEvidenceBatchV2([
      ev(1), ev(2, { outcome: 'incorrect' }),
      ev(3, { target_id: 'construction:still.subject_still_lexical_verb', target_type: 'construction' }),
      ev(4, { modality: 'listening' }),
    ])
    const incremental = await getLearnerStatesV2('p1')
    const rebuilt = await rebuildLearnerStatesV2('p1')
    expect(rebuilt).toEqual(incremental)
    expect(rebuilt.length).toBe(3)
  })

  it('scopes reads by profile and target', async () => {
    await appendLearnerEvidenceV2(ev(1))
    await appendLearnerEvidenceV2(ev(2, { profile_id: 'p2', session_id: 's9' }))
    expect(await getLearnerEvidenceV2('p1')).toHaveLength(1)
    expect((await getLearnerStatesForTargetV2('p1', 'sense:still.continuity'))).toHaveLength(1)
    expect((await getLearnerStatesForTargetV2('p1', 'sense:still.counter_expectation'))).toHaveLength(0)
  })
})
