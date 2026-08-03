import { describe, expect, it } from 'vitest'
import {
  buildV2HistoryFromEvidence,
  buildV2InteractionSummaries,
  buildV2ReviewPointsFromEvidence,
} from './learner-activity-history.js'

const registry = {
  packs: [{
    exemplars: [
      { exemplar_id: 'exemplar:a', text_en: 'I am still here.', text_pt: 'Eu ainda estou aqui.' },
      { exemplar_id: 'exemplar:b', text_en: 'It is late, but I will go.', text_pt: 'Está tarde, mas eu vou.' },
    ],
  }],
}

function ev(over = {}) {
  return {
    evidence_id: 'e1',
    profile_id: 'p1',
    session_id: 's1',
    interaction_id: 'i1',
    exemplar_id: 'exemplar:a',
    target: { target_type: 'sense', target_id: 'sense:a' },
    activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
    attribution: 'direct',
    outcome: 'correct',
    occurred_at: '2026-08-03T10:00:00.000Z',
    ...over,
  }
}

describe('V2 evidence history recovery', () => {
  it('deduplicates one interaction that emitted evidence for several targets', () => {
    const rows = buildV2InteractionSummaries([
      ev(),
      ev({ evidence_id: 'e2', target: { target_type: 'construction', target_id: 'construction:a' }, attribution: 'indirect' }),
    ], registry)
    expect(rows).toHaveLength(1)
    expect(rows[0].evidence_count).toBe(2)
    expect(rows[0].target_count).toBe(2)
    expect(rows[0].exemplar.text_en).toBe('I am still here.')
  })

  it('groups interactions by the durable session_id already present in evidence', () => {
    const history = buildV2HistoryFromEvidence([
      ev(),
      ev({ evidence_id: 'e2', interaction_id: 'i2', exemplar_id: 'exemplar:b', occurred_at: '2026-08-03T10:02:00.000Z' }),
      ev({ evidence_id: 'e3', session_id: 's2', interaction_id: 'i3', occurred_at: '2026-08-04T10:00:00.000Z' }),
    ], registry)
    expect(history.map((row) => row.session_id)).toEqual(['s2', 's1'])
    expect(history[1].interaction_count).toBe(2)
    expect(history[1].source).toBe('evidence_backfill')
    expect(history[1].limited).toBe(true)
  })

  it('creates review points only from direct partial/incorrect assessments', () => {
    const points = buildV2ReviewPointsFromEvidence([
      ev({ outcome: 'incorrect' }),
      ev({ evidence_id: 'e2', interaction_id: 'i2', exemplar_id: 'exemplar:b', attribution: 'indirect', outcome: 'incorrect' }),
      ev({ evidence_id: 'e3', interaction_id: 'i3', exemplar_id: 'exemplar:b', attribution: 'direct', outcome: 'partial' }),
      ev({ evidence_id: 'e4', interaction_id: 'i4', outcome: 'correct' }),
    ], registry)
    expect(points).toHaveLength(2)
    expect(points.map((point) => point.exemplar.exemplar_id).sort()).toEqual(['exemplar:a', 'exemplar:b'])
    expect(points.find((point) => point.exemplar.exemplar_id === 'exemplar:b').latest_outcome).toBe('partial')
  })

  it('never invents learner response or diagnosis fields absent from evidence', () => {
    const [session] = buildV2HistoryFromEvidence([ev({ outcome: 'incorrect' })], registry)
    const [interaction] = session.interactions
    expect(interaction).not.toHaveProperty('user_response')
    expect(interaction).not.toHaveProperty('diagnosis')
    expect(interaction).not.toHaveProperty('collection_id')
  })
})
