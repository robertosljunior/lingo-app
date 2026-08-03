import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import * as storage from '../storage.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import {
  recordDurableLearnerInteractionV2,
  finalizeDurableStudySessionV2,
  getDurableStudySessionsV2,
  getDurableLearnerInteractionsV2,
} from './durable-interaction-storage.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const TARGET = { target_type: 'sense', target_id: 'sense:still.continuity' }
const AT = '2026-08-03T18:00:00.000Z'

async function reset() {
  await storage.__resetDbForTests()
  await indexedDB.deleteDatabase('app-idiomas')
}

beforeEach(reset)
afterEach(reset)

function input(overrides = {}) {
  const interactionId = overrides.interactionId || 'interaction:v2lesson-still:activity-1:1'
  const event = buildLearnerEvidenceV2({
    evidence_id: `evidence:${interactionId}:sense:sense:still.continuity`,
    profile_id: overrides.profileId || 'p1',
    interaction_id: interactionId,
    session_id: 'v2lesson-still',
    target: TARGET,
    exemplar_id: 'exemplar:still.001',
    activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
    attribution: 'direct',
    outcome: overrides.outcome || 'correct',
    occurred_at: AT,
    source: { source_type: 'v2_activity' },
  })
  return {
    profileId: overrides.profileId || 'p1',
    studySession: {
      study_session_version: 1,
      study_session_id: overrides.studySessionId || 'v2study-1',
      profile_id: overrides.profileId || 'p1',
      mode: 'adaptive',
      started_at: '2026-08-03T17:59:00.000Z',
      now: AT,
      focus_history: [],
      pack_history: ['pedagogy_v2_still'],
      new_target_budget: { maximum: 4, used: 1 },
      pack_switches: 0,
    },
    studyScope: {
      collection_id: 'collection:daily_conversations',
      title_pt: 'Conversas do dia a dia',
    },
    recipePreference: 'meaning_recognition',
    focus: {
      study_focus_version: 1,
      focus_type: 'deepen',
      pack_id: 'pedagogy_v2_still',
      target: TARGET,
      capability: 'recognition',
      modality: 'reading',
      reason_codes: ['CAPABILITY_GAP'],
      is_new_target: false,
    },
    plan: {
      activity_plan_version: 4,
      activity_id: 'activity-1',
      session_id: 'v2lesson-still',
      pack_id: 'pedagogy_v2_still',
      exemplar_id: 'exemplar:still.001',
      recipe: 'meaning_recognition',
      activity_kind: 'meaning_recognition',
      capability: 'recognition',
      modality: 'reading',
      construction_id: 'construction:still.subject_still_lexical_verb',
      sense_ids: ['sense:still.continuity'],
      primary_target: TARGET,
      text_en: 'I still live here.',
      text_pt: 'Eu ainda moro aqui.',
    },
    response: {
      response_version: 1,
      response_type: 'single_choice',
      activity_id: 'activity-1',
      session_id: 'v2lesson-still',
      interaction_id: interactionId,
      attempt_number: 1,
      submitted_at: AT,
      payload: { option_id: 'option:correct' },
      support_usage: {
        baseline_features: [], used_features: [], hint_count: 0,
        attempt_number: 1, audio_replay_count: 0, answer_revealed: false,
      },
      runtime_capabilities: null,
    },
    assessment: {
      assessment_version: 1,
      status: 'assessed',
      outcome: overrides.outcome || 'correct',
      partial_score: null,
      diagnosis: null,
    },
    events: [event],
  }
}

describe('RX-1 durable interaction journal', () => {
  it('atomically stores response, assessment, context, session and learner evidence', async () => {
    const result = await recordDurableLearnerInteractionV2(input())
    expect(result.recorded).toBe(true)

    const sessions = await getDurableStudySessionsV2('p1')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      study_session_id: 'v2study-1',
      collection_id: 'collection:daily_conversations',
      recipe_preference: 'meaning_recognition',
      interaction_count: 1,
      status: 'active',
    })

    const interactions = await getDurableLearnerInteractionsV2('p1')
    expect(interactions).toHaveLength(1)
    expect(interactions[0].response.payload).toEqual({ option_id: 'option:correct' })
    expect(interactions[0].assessment.outcome).toBe('correct')
    expect(interactions[0].plan.text_en).toBe('I still live here.')

    expect(await storage.getLearnerEvidenceV2('p1')).toHaveLength(1)
    expect(await storage.getLearnerTargetStateV2('p1', TARGET)).toBeTruthy()
  })

  it('is idempotent for the same interaction and does not inflate session counts', async () => {
    const same = input()
    expect((await recordDurableLearnerInteractionV2(same)).recorded).toBe(true)
    expect((await recordDurableLearnerInteractionV2(same)).recorded).toBe(false)
    expect((await getDurableStudySessionsV2('p1'))[0].interaction_count).toBe(1)
    expect(await storage.getLearnerEvidenceV2('p1')).toHaveLength(1)
  })

  it('rejects a reused interaction id with different facts', async () => {
    await recordDurableLearnerInteractionV2(input())
    const changed = input()
    changed.response.payload = { option_id: 'option:different' }
    await expect(recordDurableLearnerInteractionV2(changed)).rejects.toThrow(/DURABLE_INTERACTION_ID_COLLISION/)
    expect((await getDurableStudySessionsV2('p1'))[0].interaction_count).toBe(1)
  })

  it('writes nothing when evidence validation fails', async () => {
    const invalid = input({ outcome: 'partial' })
    // Partial evidence requires partial_score; deliberately leave it null.
    await expect(recordDurableLearnerInteractionV2(invalid)).rejects.toThrow(/LEARNER_EVIDENCE_INVALID/)
    expect(await getDurableStudySessionsV2('p1')).toEqual([])
    expect(await getDurableLearnerInteractionsV2('p1')).toEqual([])
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
  })

  it('isolates profiles and finalizes only the matching session owner', async () => {
    await recordDurableLearnerInteractionV2(input())
    await recordDurableLearnerInteractionV2(input({
      profileId: 'p2', studySessionId: 'v2study-2', interactionId: 'interaction:v2lesson-still:activity-2:1',
    }))
    expect(await getDurableLearnerInteractionsV2('p1')).toHaveLength(1)
    expect(await getDurableLearnerInteractionsV2('p2')).toHaveLength(1)

    await expect(finalizeDurableStudySessionV2('v2study-1', { profileId: 'p2', endedAt: AT }))
      .rejects.toThrow(/PROFILE_MISMATCH/)
    await finalizeDurableStudySessionV2('v2study-1', { profileId: 'p1', endedAt: AT })
    expect((await getDurableStudySessionsV2('p1'))[0]).toMatchObject({ status: 'complete', ended_at: AT })
  })
})
