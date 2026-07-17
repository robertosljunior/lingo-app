import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import { openDB } from 'idb'
import * as storage from '../storage.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { compareTargetStates } from './learner-model.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const CONT = { target_type: 'sense', target_id: 'sense:still.continuity' }
const C_LEX = { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const WRITE_CTRL = { activity_kind: 'controlled_completion', capability: 'controlled_production', modality: 'writing' }

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
let seq = 0
function ev(over = {}) {
  seq++
  return buildLearnerEvidenceV2({
    evidence_id: `evidence:store.${String(seq).padStart(4, '0')}`,
    profile_id: 'p1',
    interaction_id: over.interaction_id || `interaction:${seq}`,
    target: CONT,
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

describe('IndexedDB v5 migration', () => {
  it('upgrades a v4 database to v5 preserving V1 stores and data', async () => {
    // Simulate a pre-existing v4 install with V1 data.
    const old = await openDB('app-idiomas', 4, {
      upgrade(d) {
        d.createObjectStore('settings', { keyPath: 'key' })
        d.createObjectStore('lessons', { keyPath: 'lesson_id' }).createIndex('created_at', 'created_at')
        const answers = d.createObjectStore('answers', { keyPath: 'key', autoIncrement: true })
        answers.createIndex('lesson_id', 'lesson_id')
        answers.createIndex('session_id', 'session_id')
        answers.createIndex('mistake_type', 'mistake_type')
      },
    })
    await old.put('settings', { key: 'level', value: 'B2' })
    await old.put('lessons', { lesson_id: 'legacy_1', title: 'Legacy', created_at: 1 })
    await old.add('answers', { lesson_id: 'legacy_1', question_id: 1, session_id: 's1', verdict: 'correct', answered_at: 1 })
    old.close()

    // Any storage call reopens at DB_VERSION 5, running the incremental upgrade.
    expect(storage.DB_VERSION).toBe(5)
    const settings = await storage.getSettings()
    expect(settings.level).toBe('B2')
    const lessons = await storage.getAllLessons(null)
    expect(lessons.map((l) => l.lesson_id)).toContain('legacy_1')
    expect((await storage.getAllAnswers()).length).toBe(1)

    // The V2 stores exist and are usable — and no V2 evidence was fabricated
    // from the legacy answers.
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
    await storage.recordLearnerEvidenceV2(ev())
    expect((await storage.getLearnerEvidenceV2('p1')).length).toBe(1)
  })

  it('wipeAll clears the V2 stores too', async () => {
    await storage.recordLearnerEvidenceV2(ev())
    expect((await storage.getLearnerTargetStatesV2('p1')).length).toBe(1)
    await storage.wipeAll()
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
    expect(await storage.getLearnerTargetStatesV2('p1')).toEqual([])
  })
})

describe('recording evidence', () => {
  it('is idempotent: re-recording the same evidence_id never duplicates influence', async () => {
    const event = ev()
    const first = await storage.recordLearnerEvidenceV2(event)
    expect(first.recorded).toBe(true)
    const before = await storage.getLearnerTargetStateV2('p1', CONT)
    const second = await storage.recordLearnerEvidenceV2(event)
    expect(second.recorded).toBe(false)
    const after = await storage.getLearnerTargetStateV2('p1', CONT)
    expect(compareTargetStates(before, after).equal).toBe(true)
    expect((await storage.getLearnerEvidenceV2('p1')).length).toBe(1)
    expect(after.capabilities.reading_recognition.overall.assessed_evidence_count).toBe(1)
  })

  it('rejects invalid events with nothing written', async () => {
    await expect(storage.recordLearnerEvidenceV2(ev({ outcome: 'almost' }))).rejects.toThrow(/LEARNER_EVIDENCE_INVALID/)
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
    expect(await storage.getLearnerTargetStateV2('p1', CONT)).toBeNull()
  })

  it('rejects targets that do not resolve against the builtin V2 registry', async () => {
    await expect(storage.recordLearnerEvidenceV2(ev({ target: { target_type: 'sense', target_id: 'sense:still.ghost' } })))
      .rejects.toThrow(/TARGET_UNRESOLVED/)
  })

  it('batch is all-or-nothing: one invalid event aborts the whole batch', async () => {
    const good = ev()
    const bad = ev({ support: { features: ['calculator'], hint_count: 0, attempt_number: 1 } })
    await expect(storage.recordLearnerEvidenceBatchV2([good, bad])).rejects.toThrow(/SUPPORT_FEATURE_INVALID/)
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
    expect(await storage.getLearnerTargetStatesV2('p1')).toEqual([])
  })

  it('regression: no per-event write loop — valid events BEFORE an invalid tail are never persisted', async () => {
    // A `for each event: await recordSingleEvent(event)` implementation would
    // persist good1/good2 (different targets, states written) before failing on
    // the invalid tail. The atomic batch must leave both stores untouched.
    const good1 = ev({ target: CONT })
    const good2 = ev({ target: C_LEX, activity: WRITE_CTRL })
    const badTail = ev({ outcome: 'partial' }) // partial without partial_score
    await expect(storage.recordLearnerEvidenceBatchV2([good1, good2, badTail])).rejects.toThrow(/PARTIAL_SCORE_REQUIRED/)
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
    expect(await storage.getLearnerTargetStatesV2('p1')).toEqual([])
    // And the same batch, fixed, records everything in one transaction.
    const ok = await storage.recordLearnerEvidenceBatchV2([good1, good2, { ...badTail, partial_score: 0.5 }])
    expect(ok.recorded).toHaveLength(3)
    expect((await storage.getLearnerTargetStatesV2('p1')).length).toBe(2)
  })

  it('a batch from one interaction can hit several targets atomically', async () => {
    const interaction_id = 'interaction:multi'
    const result = await storage.recordLearnerEvidenceBatchV2([
      ev({ interaction_id, target: C_LEX, activity: WRITE_CTRL, attribution: 'direct' }),
      ev({ interaction_id, target: CONT, activity: WRITE_CTRL, attribution: 'indirect' }),
    ])
    expect(result.recorded.length).toBe(2)
    expect(result.state_keys).toEqual([
      'p1:construction:construction:still.subject_still_lexical_verb',
      'p1:sense:sense:still.continuity',
    ])
    const byInteraction = await storage.getLearnerEvidenceV2('p1', { interactionId: interaction_id })
    expect(byInteraction.length).toBe(2)
    const senseState = await storage.getLearnerTargetStateV2('p1', CONT)
    expect(senseState.capabilities.writing_controlled_production.overall.effective_evidence_weight).toBeCloseTo(0.5, 4)
  })
})

describe('querying evidence and states', () => {
  it('filters by target, exemplar and time window', async () => {
    const early = ev({ target: C_LEX, activity: WRITE_CTRL })
    const late = ev({ target: CONT, exemplar_id: 'exemplar:still.006' })
    await storage.recordLearnerEvidenceBatchV2([early, late])
    expect((await storage.getLearnerEvidenceV2('p1', { targetId: C_LEX.target_id })).map((e) => e.evidence_id)).toEqual([early.evidence_id])
    expect((await storage.getLearnerEvidenceV2('p1', { targetType: 'sense' })).map((e) => e.evidence_id)).toEqual([late.evidence_id])
    expect((await storage.getLearnerEvidenceV2('p1', { exemplarId: 'exemplar:still.006' })).length).toBe(1)
    expect((await storage.getLearnerEvidenceV2('p1', { since: late.occurred_at })).map((e) => e.evidence_id)).toEqual([late.evidence_id])
    expect((await storage.getLearnerEvidenceV2('p1', { until: early.occurred_at })).map((e) => e.evidence_id)).toEqual([early.evidence_id])
  })

  it('isolates profiles completely', async () => {
    await storage.recordLearnerEvidenceBatchV2([
      ev({ profile_id: 'p1' }),
      ev({ profile_id: 'p2', outcome: 'incorrect' }),
    ])
    expect((await storage.getLearnerEvidenceV2('p1')).length).toBe(1)
    expect((await storage.getLearnerEvidenceV2('p2')).length).toBe(1)
    const s1 = await storage.getLearnerTargetStateV2('p1', CONT)
    const s2 = await storage.getLearnerTargetStateV2('p2', CONT)
    expect(s1.capabilities.reading_recognition.overall.weighted_success).toBeGreaterThan(0)
    expect(s2.capabilities.reading_recognition.overall.weighted_success).toBe(0)
    expect((await storage.getLearnerTargetStatesV2('p1')).map((s) => s.profile_id)).toEqual(['p1'])
  })

  it('lists states filtered by target type', async () => {
    await storage.recordLearnerEvidenceBatchV2([
      ev({ target: C_LEX, activity: WRITE_CTRL }),
      ev({ target: CONT }),
    ])
    expect((await storage.getLearnerTargetStatesV2('p1', { targetType: 'construction' })).map((s) => s.target.target_id))
      .toEqual([C_LEX.target_id])
  })
})

describe('rebuild equivalence', () => {
  it('incremental state equals full rebuild from events', async () => {
    const events = [
      ev(), ev({ outcome: 'incorrect' }),
      ev({ support: { features: ['word_bank'], hint_count: 0, attempt_number: 2 } }),
      ev({ attribution: 'exposure', outcome: 'observed', activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'listening' } }),
      ev({ target: C_LEX, activity: WRITE_CTRL }),
      ev({ outcome: 'partial', partial_score: 0.5, assessment_confidence: 0.8 }),
    ]
    for (const e of events) await storage.recordLearnerEvidenceV2(e) // incremental path
    const incrementalSense = await storage.getLearnerTargetStateV2('p1', CONT)
    const incrementalConstruction = await storage.getLearnerTargetStateV2('p1', C_LEX)

    const rebuiltSense = await storage.rebuildLearnerTargetStateV2('p1', CONT)
    expect(compareTargetStates(incrementalSense, rebuiltSense).equal).toBe(true)

    const rebuiltAll = await storage.rebuildLearnerTargetStatesV2('p1')
    expect(rebuiltAll.length).toBe(2)
    const rebuiltConstruction = rebuiltAll.find((s) => s.target.target_id === C_LEX.target_id)
    expect(compareTargetStates(incrementalConstruction, rebuiltConstruction).equal).toBe(true)
  })

  it('rebuilding a target with no evidence removes its stale state', async () => {
    await storage.recordLearnerEvidenceV2(ev())
    expect(await storage.getLearnerTargetStateV2('p1', CONT)).toBeTruthy()
    // simulate a stale state for a target whose evidence never existed
    expect(await storage.rebuildLearnerTargetStateV2('p1', C_LEX)).toBeNull()
    expect(await storage.getLearnerTargetStateV2('p1', C_LEX)).toBeNull()
  })
})
