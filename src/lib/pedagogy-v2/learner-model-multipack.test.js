// learner-model-multipack.test.js — mandatory learner-model tests of Slice
// V2.5 (§24) plus the evidence-compatibility guarantees of §9: the learner
// model schema is UNCHANGED (no DB bump, no new stores) — only target
// resolution now goes through the multi-pack registry. States are keyed by
// global target id, so still and but never collapse, and evidence recorded
// before this slice keeps resolving and keeps driving the progression.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import * as storage from '../storage.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { compareTargetStates, aggregateProfileEvidence } from './learner-model.js'
import { loadPedagogyV2Registry, resolvePedagogyTarget } from './registry.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const STILL_CONT = { target_type: 'sense', target_id: 'sense:still.continuity' }
const STILL_LEX = { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' }
const BUT_CONTRAST = { target_type: 'sense', target_id: 'sense:but.contrast' }
const BUT_CLAUSE = { target_type: 'construction', target_id: 'construction:but.clause_but_clause' }
const BUT_STILL_C = { target_type: 'construction', target_id: 'construction:still.clause_but_subject_still_verb' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
let seq = 0
function ev(over = {}) {
  seq++
  return buildLearnerEvidenceV2({
    evidence_id: `evidence:mp.${String(seq).padStart(4, '0')}`,
    profile_id: 'p1',
    interaction_id: over.interaction_id || `interaction:mp${seq}`,
    target: STILL_CONT,
    exemplar_id: 'exemplar:still.001',
    activity: READ_REC,
    attribution: 'direct',
    outcome: 'correct',
    occurred_at: new Date(T0 + seq * 60000).toISOString(),
    source: { source_type: 'test' },
    ...over,
  })
}

async function reset() { await storage.__resetDbForTests(); await indexedDB.deleteDatabase('app-idiomas') }
beforeEach(reset)
afterEach(reset)

describe('§24.29–30 — but evidence records into its own state', () => {
  it('29: valid but evidence is accepted against the multi-pack registry', async () => {
    const r = await storage.recordLearnerEvidenceV2(ev({ target: BUT_CONTRAST, exemplar_id: 'exemplar:but.001' }))
    expect(r.recorded).toBe(true)
    const state = await storage.getLearnerTargetStateV2('p1', BUT_CONTRAST)
    expect(state.capabilities.reading_recognition.overall.assessed_evidence_count).toBe(1)
  })

  it('30: but and still keep fully separate states', async () => {
    await storage.recordLearnerEvidenceBatchV2([
      ev({ target: STILL_CONT }),
      ev({ target: BUT_CONTRAST, exemplar_id: 'exemplar:but.001', outcome: 'incorrect' }),
    ])
    const still = await storage.getLearnerTargetStateV2('p1', STILL_CONT)
    const but = await storage.getLearnerTargetStateV2('p1', BUT_CONTRAST)
    expect(still.key).not.toBe(but.key)
    expect(still.capabilities.reading_recognition.overall.weighted_success).toBeGreaterThan(0)
    expect(but.capabilities.reading_recognition.overall.weighted_success).toBe(0)
  })
})

describe('§24.31 + §9 — still state and evidence stay valid after the multi-pack merge', () => {
  it('still evidence recorded with the V2.4 IDs keeps resolving and its state is untouched by but activity', async () => {
    // 1) record still evidence using the CURRENT (pre-slice) ids.
    await storage.recordLearnerEvidenceBatchV2([ev({ target: STILL_CONT }), ev({ target: STILL_LEX })])
    const before = await storage.getLearnerTargetStateV2('p1', STILL_CONT)

    // 2) the new multi-pack registry resolves every persisted target.
    const registry = loadPedagogyV2Registry()
    for (const e of await storage.getLearnerEvidenceV2('p1')) {
      expect(resolvePedagogyTarget(e.target, registry), e.target.target_id).toBeTruthy()
    }

    // 3) but activity does not disturb the still state.
    await storage.recordLearnerEvidenceV2(ev({ target: BUT_CONTRAST, exemplar_id: 'exemplar:but.001' }))
    const after = await storage.getLearnerTargetStateV2('p1', STILL_CONT)
    expect(compareTargetStates(before, after).equal).toBe(true)
  })

  it('a NEW still session starts from the persisted states — the progression never restarts', async () => {
    // Established recognition for the first still sense+construction (both
    // modalities), exactly like a learner leaving Slice V2.4.
    const events = []
    for (const target of [STILL_CONT, STILL_LEX]) {
      for (const modality of ['reading', 'listening']) {
        for (let i = 0; i < 3; i++) {
          events.push(ev({ target, activity: { activity_kind: modality === 'reading' ? 'meaning_recognition' : 'listening_recognition', capability: 'recognition', modality } }))
        }
      }
    }
    await storage.recordLearnerEvidenceBatchV2(events)
    const states = await storage.getLearnerTargetStatesV2('p1')

    const registry = loadPedagogyV2Registry()
    const d = selectNextActivityV2({
      session: createLessonSessionV2({ session_id: 's-new', profile_id: 'p1', now: new Date(T0 + 9e6).toISOString() }),
      scope: { registry, pack_id: 'pedagogy_v2_still', lexeme_id: 'lexeme:still' },
      learnerStates: states, recentEvidence: [],
    })
    // NOT the first exposure again: the engine moves to the next construction.
    expect(d.status).toBe('activity')
    expect(d.plan.exemplar_id).toBe('exemplar:still.006')
    expect(d.plan.recipe).toBe('exposure')
  })
})

describe('§24.32–34 — batches and resolution across packs', () => {
  it('32: one atomic batch can hit targets of BOTH packs', async () => {
    const result = await storage.recordLearnerEvidenceBatchV2([
      ev({ target: STILL_LEX }),
      ev({ target: BUT_CLAUSE, exemplar_id: 'exemplar:but.001' }),
    ])
    expect(result.recorded).toHaveLength(2)
    expect(result.state_keys).toEqual([
      'p1:construction:construction:but.clause_but_clause',
      'p1:construction:construction:still.subject_still_lexical_verb',
    ])
  })

  it('32b: an invalid tail aborts the whole two-pack batch (nothing written)', async () => {
    await expect(storage.recordLearnerEvidenceBatchV2([
      ev({ target: STILL_LEX }),
      ev({ target: BUT_CLAUSE, outcome: 'almost' }),
    ])).rejects.toThrow(/LEARNER_EVIDENCE_INVALID/)
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
  })

  it('33: an external target (still construction referenced from a but session) resolves', async () => {
    const r = await storage.recordLearnerEvidenceV2(ev({ target: BUT_STILL_C, exemplar_id: 'exemplar:but.008' }))
    expect(r.recorded).toBe(true)
    const state = await storage.getLearnerTargetStateV2('p1', BUT_STILL_C)
    expect(state.target.target_id).toBe(BUT_STILL_C.target_id)
  })

  it('34: a target that exists in no pack is rejected', async () => {
    await expect(storage.recordLearnerEvidenceV2(ev({ target: { target_type: 'sense', target_id: 'sense:but.ghost' } })))
      .rejects.toThrow(/TARGET_UNRESOLVED/)
    await expect(storage.recordLearnerEvidenceV2(ev({ target: { target_type: 'lexeme_usage', target_id: 'lexeme:although' } })))
      .rejects.toThrow(/TARGET_UNRESOLVED/)
  })

  it('cross-pack relations never collapse distinct targets into one state', async () => {
    // but.contrast and still.counter_expectation are related through the
    // registry relations, but their states stay independent records.
    await storage.recordLearnerEvidenceBatchV2([
      ev({ target: BUT_CONTRAST, exemplar_id: 'exemplar:but.001' }),
      ev({ target: { target_type: 'sense', target_id: 'sense:still.counter_expectation' }, exemplar_id: 'exemplar:still.011' }),
    ])
    const states = await storage.getLearnerTargetStatesV2('p1')
    expect(states.map((s) => s.target.target_id).sort()).toEqual([
      'sense:but.contrast',
      'sense:still.counter_expectation',
    ])
  })
})

describe('§24.35–37 — rebuild, wipe and schema stability', () => {
  it('35: multi-pack rebuild equals the incremental states', async () => {
    const events = [
      ev({ target: STILL_CONT }),
      ev({ target: BUT_CONTRAST, exemplar_id: 'exemplar:but.001' }),
      ev({ target: BUT_CLAUSE, exemplar_id: 'exemplar:but.002', outcome: 'incorrect' }),
      ev({ target: BUT_STILL_C, exemplar_id: 'exemplar:but.008' }),
    ]
    for (const e of events) await storage.recordLearnerEvidenceV2(e)
    const incremental = await storage.getLearnerTargetStatesV2('p1')
    const rebuilt = await storage.rebuildLearnerTargetStatesV2('p1')
    expect(rebuilt.length).toBe(incremental.length)
    for (let i = 0; i < rebuilt.length; i++) {
      expect(compareTargetStates(incremental[i], rebuilt[i]).equal, rebuilt[i].key).toBe(true)
    }
    // Pure aggregation agrees too (storage vs. in-memory model).
    const pure = aggregateProfileEvidence(await storage.getLearnerEvidenceV2('p1'))
    expect(pure.map((s) => s.key)).toEqual(rebuilt.map((s) => s.key))
  })

  it('36: wipeAll clears evidence and states of both packs', async () => {
    await storage.recordLearnerEvidenceBatchV2([
      ev({ target: STILL_CONT }),
      ev({ target: BUT_CONTRAST, exemplar_id: 'exemplar:but.001' }),
    ])
    await storage.wipeAll()
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
    expect(await storage.getLearnerTargetStatesV2('p1')).toEqual([])
  })

  it('37: no DB bump, no new stores — the learner-model schema is untouched', async () => {
    expect(storage.DB_VERSION).toBe(5)
    await storage.recordLearnerEvidenceV2(ev()) // force open
    const names = await new Promise((res, rej) => {
      const r = indexedDB.open('app-idiomas')
      r.onsuccess = () => { res([...r.result.objectStoreNames].sort()); r.result.close() }
      r.onerror = () => rej(r.error)
    })
    expect(names).toContain('learner_evidence_v2')
    expect(names).toContain('learner_target_states_v2')
    // Exactly the v5 store set — nothing new was created for multi-pack.
    expect(names.filter((n) => n.includes('v2'))).toEqual(['learner_evidence_v2', 'learner_target_states_v2'])
  })
})
