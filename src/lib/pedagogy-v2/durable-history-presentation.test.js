import { describe, expect, it } from 'vitest'
import {
  buildCombinedV2History,
  buildCombinedV2ReviewPoints,
} from './durable-history-presentation.js'

const registry = {
  packs: [{ exemplars: [
    { exemplar_id: 'exemplar:a', text_en: 'I am still here.', text_pt: 'Eu ainda estou aqui.' },
    { exemplar_id: 'exemplar:b', text_en: 'It is late, but I will go.', text_pt: 'Está tarde, mas eu vou.' },
  ] }],
}

function evidence(over = {}) {
  return {
    evidence_id: 'e1',
    profile_id: 'p1',
    session_id: 'lesson-old',
    interaction_id: 'i-old',
    exemplar_id: 'exemplar:b',
    target: { target_type: 'sense', target_id: 'sense:b' },
    activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
    attribution: 'direct',
    outcome: 'incorrect',
    occurred_at: '2026-08-02T10:00:00.000Z',
    ...over,
  }
}

function durable(over = {}) {
  return {
    durable_interaction_version: 1,
    interaction_id: 'i-new',
    study_session_id: 'study-new',
    lesson_session_id: 'lesson-new',
    profile_id: 'p1',
    occurred_at: '2026-08-03T10:00:00.000Z',
    collection_id: 'collection:work',
    collection_title_pt: 'Trabalho e estudos',
    plan: {
      exemplar_id: 'exemplar:a',
      text_en: 'I am still here.',
      text_pt: 'Eu ainda estou aqui.',
      activity_kind: 'guided_production',
      recipe: 'guided_production',
      capability: 'controlled_production',
      modality: 'writing',
    },
    response: {
      response_type: 'text',
      submitted_at: '2026-08-03T10:00:00.000Z',
      payload: { text: 'I am here still' },
    },
    assessment: {
      status: 'assessed',
      outcome: 'incorrect',
      diagnosis: {
        cause_coverage: 'specific',
        primary_cause: {
          category: 'naturalness',
          code: 'WORD_ORDER',
          explanation: { summary: 'A posição soa pouco natural neste contexto.' },
        },
      },
    },
    evidence_ids: ['e-new'],
    ...over,
  }
}

const session = {
  study_session_id: 'study-new',
  profile_id: 'p1',
  mode: 'adaptive',
  collection_id: 'collection:work',
  collection_title_pt: 'Trabalho e estudos',
  started_at: '2026-08-03T09:59:00.000Z',
  last_activity_at: '2026-08-03T10:00:00.000Z',
  ended_at: '2026-08-03T10:01:00.000Z',
  status: 'complete',
}

describe('RX-1B durable history presentation', () => {
  it('uses durable records as the primary history source and retains old evidence as limited backfill', () => {
    const history = buildCombinedV2History({ sessions: [session], interactions: [durable()], evidence: [evidence()] }, registry)
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({
      study_session_id: 'study-new',
      collection_title_pt: 'Trabalho e estudos',
      source: 'durable_journal',
      limited: false,
    })
    expect(history[0].interactions[0].response.text).toBe('I am here still')
    expect(history[0].interactions[0].diagnosis.summary).toMatch(/pouco natural/)
    expect(history[1]).toMatchObject({ source: 'evidence_backfill', limited: true })
  })

  it('does not duplicate evidence emitted by an interaction already present in the journal', () => {
    const duplicateEvidence = evidence({ interaction_id: 'i-new', session_id: 'lesson-new', exemplar_id: 'exemplar:a' })
    const history = buildCombinedV2History({ sessions: [session], interactions: [durable()], evidence: [duplicateEvidence] }, registry)
    expect(history).toHaveLength(1)
    expect(history[0].interaction_count).toBe(1)
  })

  it('shows persisted learner response and diagnosis in review points', () => {
    const points = buildCombinedV2ReviewPoints({ interactions: [durable()], evidence: [] }, registry)
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({
      latest_outcome: 'incorrect',
      collection_title_pt: 'Trabalho e estudos',
      limited: false,
    })
    expect(points[0].response.text).toBe('I am here still')
    expect(points[0].diagnosis.category).toBe('naturalness')
  })

  it('falls back to evidence-only review for pre-journal interactions', () => {
    const points = buildCombinedV2ReviewPoints({ interactions: [], evidence: [evidence()] }, registry)
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ source: 'evidence_backfill', limited: true })
    expect(points[0].response).toBeUndefined()
  })

  it('keeps a normal exposure observed and reserves not_assessed for an interrupted assessment', () => {
    const exposure = durable({
      interaction_id: 'i-exposure',
      occurred_at: '2026-08-03T09:59:30.000Z',
      plan: {
        exemplar_id: 'exemplar:a',
        text_en: 'I am still here.',
        text_pt: 'Eu ainda estou aqui.',
        activity_kind: 'exposure',
        recipe: 'exposure',
        capability: 'recognition',
        modality: 'reading',
      },
      response: {
        response_type: 'continue',
        submitted_at: '2026-08-03T09:59:30.000Z',
        payload: {},
      },
      assessment: { status: 'observed', outcome: 'observed', diagnosis: null },
      evidence_ids: ['e-exposure'],
    })
    const interrupted = durable({
      interaction_id: 'i-interrupted',
      recovery_status: 'interrupted_before_assessment',
      assessment: { status: 'not_assessed', outcome: 'not_assessed', diagnosis: null },
      evidence_ids: [],
    })

    const history = buildCombinedV2History({ sessions: [session], interactions: [exposure, interrupted], evidence: [] }, registry)
    expect(history).toHaveLength(1)
    expect(history[0].outcomes).toMatchObject({ observed: 1, not_assessed: 1 })
    expect(history[0].interactions.map((row) => row.outcome)).toEqual(['observed', 'not_assessed'])
    expect(buildCombinedV2ReviewPoints({ interactions: [exposure, interrupted], evidence: [] }, registry)).toEqual([])
  })
})
