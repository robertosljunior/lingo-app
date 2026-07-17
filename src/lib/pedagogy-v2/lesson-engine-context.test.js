import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import stillPack from '../../content/pedagogy-v2/still.json'
import * as storage from '../storage.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { buildLessonEngineContextV2 } from './lesson-engine-context.js'
import { validateLessonEngineContextV2 } from './lesson-engine-validator.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const iso = (minute) => new Date(T0 + minute * 60000).toISOString()
const NOW = iso(2000)

let seq = 0
const ev = (over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:ctx.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1',
  interaction_id: `interaction:${seq}`,
  target: { target_type: 'sense', target_id: 'sense:still.continuity' },
  exemplar_id: 'exemplar:still.001',
  activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
  attribution: 'direct',
  outcome: 'correct',
  occurred_at: iso(seq),
  source: { source_type: 'test' },
  ...over,
})

async function counts() {
  const evidence = await storage.getLearnerEvidenceV2('p1')
  const states = await storage.getLearnerTargetStatesV2('p1')
  return { evidence: evidence.length, states: states.length }
}

describe('buildLessonEngineContextV2 — read-only integration', () => {
  const reset = async () => { await storage.__resetDbForTests(); await indexedDB.deleteDatabase('app-idiomas') }
  beforeEach(reset)
  afterEach(reset)

  it('requires an explicit now (the engine never reads the clock)', async () => {
    await expect(buildLessonEngineContextV2('p1', {})).rejects.toThrow('CONTEXT_NOW_REQUIRED')
  })

  it('builds a valid context from the approved storage APIs', async () => {
    await storage.recordLearnerEvidenceBatchV2([
      ev(),
      ev({ target: { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' } }),
    ])
    const context = await buildLessonEngineContextV2('p1', { now: NOW, packId: 'pedagogy_v2_still' })
    expect(validateLessonEngineContextV2(context).valid).toBe(true)
    expect(context.learner_states).toHaveLength(2)
    expect(context.recent_evidence).toHaveLength(2)
  })

  it('never writes: evidence and state counts are unchanged after building a context and selecting an activity', async () => {
    await storage.recordLearnerEvidenceBatchV2([ev(), ev(), ev({ outcome: 'incorrect' })])
    const before = await counts()
    const context = await buildLessonEngineContextV2('p1', { now: NOW })
    const decision = selectNextActivityV2({
      session: createLessonSessionV2({ session_id: 'sess1', profile_id: 'p1', now: NOW }),
      pack: stillPack,
      learnerStates: context.learner_states,
      recentEvidence: context.recent_evidence,
      policy: {},
    })
    expect(decision.status).toBe('activity')
    expect(await counts()).toEqual(before)
  })

  it('caps recent evidence at the requested limit, keeping the newest tail', async () => {
    await storage.recordLearnerEvidenceBatchV2([ev(), ev(), ev(), ev()])
    const context = await buildLessonEngineContextV2('p1', { now: NOW, recentEvidenceLimit: 2 })
    expect(context.recent_evidence).toHaveLength(2)
    const all = await storage.getLearnerEvidenceV2('p1')
    expect(context.recent_evidence.map((e) => e.evidence_id)).toEqual(all.slice(-2).map((e) => e.evidence_id))
  })
})
