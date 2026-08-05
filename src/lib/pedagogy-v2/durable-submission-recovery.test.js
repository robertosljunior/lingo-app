import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import * as storage from '../storage.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import {
  recordDurableLearnerInteractionV2,
  getDurableStudySessionsV2,
  getDurableLearnerInteractionsV2,
} from './durable-interaction-storage.js'
import {
  stageDurableLearnerSubmissionV2,
  settleDurableLearnerSubmissionV2,
  reconcileInterruptedStudySessionsV2,
  closeDurableStudySessionV2,
  getPendingDurableSubmissionsV2,
} from './durable-submission-recovery.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const TARGET = { target_type: 'sense', target_id: 'sense:still.continuity' }
const AT = '2026-08-04T09:00:00.000Z'
const RECOVERED_AT = '2026-08-04T09:01:00.000Z'

async function reset() {
  await storage.__resetDbForTests()
  await indexedDB.deleteDatabase('app-idiomas')
}

beforeEach(reset)
afterEach(reset)

function base(overrides = {}) {
  const profileId = overrides.profileId || 'p1'
  const studySessionId = overrides.studySessionId || 'v2study-rx1c'
  const interactionId = overrides.interactionId || 'interaction:v2lesson-still:activity-rx1c:1'
  const plan = {
    activity_plan_version: 4,
    activity_id: 'activity-rx1c',
    session_id: 'v2lesson-still',
    pack_id: 'pedagogy_v2_still',
    exemplar_id: 'exemplar:still.001',
    recipe: 'guided_production',
    activity_kind: 'guided_production',
    capability: 'controlled_production',
    modality: 'writing',
    construction_id: 'construction:still.subject_still_lexical_verb',
    sense_ids: ['sense:still.continuity'],
    primary_target: TARGET,
    text_en: 'I still live here.',
    text_pt: 'Eu ainda moro aqui.',
  }
  const response = {
    response_version: 1,
    response_type: 'text',
    activity_id: plan.activity_id,
    session_id: plan.session_id,
    interaction_id: interactionId,
    attempt_number: 1,
    submitted_at: AT,
    payload: { text: 'I still live here.' },
    support_usage: {
      baseline_features: [], used_features: [], hint_count: 0,
      attempt_number: 1, audio_replay_count: 0, answer_revealed: false,
    },
    runtime_capabilities: null,
  }
  return {
    profileId,
    studySession: {
      study_session_version: 1,
      study_session_id: studySessionId,
      profile_id: profileId,
      mode: 'adaptive',
      started_at: '2026-08-04T08:59:00.000Z',
      now: AT,
      focus_history: [],
      pack_history: ['pedagogy_v2_still'],
      new_target_budget: { maximum: 4, used: 1 },
      pack_switches: 0,
    },
    studyScope: { collection_id: 'collection:daily', title_pt: 'Conversas do dia a dia' },
    recipePreference: 'guided_production',
    focus: {
      study_focus_version: 1,
      focus_type: 'deepen',
      pack_id: 'pedagogy_v2_still',
      target: TARGET,
      capability: 'controlled_production',
      modality: 'writing',
      reason_codes: ['CAPABILITY_GAP'],
      is_new_target: false,
    },
    plan,
    response,
  }
}

function finalInput(overrides = {}) {
  const staged = base(overrides)
  const event = buildLearnerEvidenceV2({
    evidence_id: `evidence:${staged.response.interaction_id}:sense:sense:still.continuity`,
    profile_id: staged.profileId,
    interaction_id: staged.response.interaction_id,
    session_id: staged.plan.session_id,
    target: TARGET,
    exemplar_id: staged.plan.exemplar_id,
    activity: { activity_kind: staged.plan.activity_kind, capability: staged.plan.capability, modality: staged.plan.modality },
    attribution: 'direct',
    outcome: 'correct',
    occurred_at: AT,
    source: { source_type: 'v2_activity' },
  })
  return {
    ...staged,
    assessment: {
      assessment_version: 1,
      status: 'assessed',
      outcome: 'correct',
      partial_score: null,
      diagnosis: null,
    },
    events: [event],
  }
}

describe('RX-1C durable submission recovery', () => {
  it('preserves a response interrupted before assessment without inventing evidence', async () => {
    await stageDurableLearnerSubmissionV2(base())
    expect(await getPendingDurableSubmissionsV2('p1')).toHaveLength(1)
    expect((await getDurableStudySessionsV2('p1'))[0]).toMatchObject({ status: 'active', interaction_count: 0 })

    const result = await reconcileInterruptedStudySessionsV2('p1', { interruptedAt: RECOVERED_AT })
    expect(result).toMatchObject({ recoveredInteractions: 1, clearedReceipts: 1, interrupted_sessions: 1 })
    expect(await getPendingDurableSubmissionsV2('p1')).toEqual([])

    const interactions = await getDurableLearnerInteractionsV2('p1')
    expect(interactions).toHaveLength(1)
    expect(interactions[0]).toMatchObject({
      recovery_status: 'interrupted_before_assessment',
      assessment: { status: 'not_assessed', outcome: 'not_assessed' },
      evidence_ids: [],
      response: { payload: { text: 'I still live here.' } },
    })
    expect(await storage.getLearnerEvidenceV2('p1')).toEqual([])
    expect((await getDurableStudySessionsV2('p1'))[0]).toMatchObject({
      status: 'interrupted', ended_at: RECOVERED_AT, interaction_count: 1,
    })
  })

  it('settles the receipt after the authoritative atomic interaction succeeds', async () => {
    const complete = finalInput()
    await stageDurableLearnerSubmissionV2(complete)
    await recordDurableLearnerInteractionV2(complete)
    await settleDurableLearnerSubmissionV2(complete.response.interaction_id, { profileId: 'p1' })

    expect(await getPendingDurableSubmissionsV2('p1')).toEqual([])
    expect(await getDurableLearnerInteractionsV2('p1')).toHaveLength(1)
    expect((await getDurableLearnerInteractionsV2('p1'))[0].assessment.outcome).toBe('correct')
    expect((await getDurableStudySessionsV2('p1'))[0].interaction_count).toBe(1)
    expect(await storage.getLearnerEvidenceV2('p1')).toHaveLength(1)
  })

  it('turns an explicit early exit into an abandoned session and preserves a pending answer', async () => {
    await stageDurableLearnerSubmissionV2(base())
    const result = await closeDurableStudySessionV2('v2study-rx1c', {
      profileId: 'p1', endedAt: RECOVERED_AT, status: 'abandoned',
    })
    expect(result).toMatchObject({ updated: true, recoveredInteractions: 1, status: 'abandoned' })
    expect((await getDurableStudySessionsV2('p1'))[0]).toMatchObject({
      status: 'abandoned', ended_at: RECOVERED_AT, interaction_count: 1,
    })
    expect((await getDurableLearnerInteractionsV2('p1'))[0].assessment.status).toBe('not_assessed')
  })

  it('is idempotent and profile-isolated', async () => {
    const p1 = base()
    expect((await stageDurableLearnerSubmissionV2(p1)).staged).toBe(true)
    expect((await stageDurableLearnerSubmissionV2(p1)).reason).toBe('already_staged')
    await stageDurableLearnerSubmissionV2(base({
      profileId: 'p2', studySessionId: 'v2study-p2', interactionId: 'interaction:v2lesson-still:activity-p2:1',
    }))

    await reconcileInterruptedStudySessionsV2('p1', { interruptedAt: RECOVERED_AT })
    expect(await getPendingDurableSubmissionsV2('p1')).toEqual([])
    expect(await getPendingDurableSubmissionsV2('p2')).toHaveLength(1)
    expect(await getDurableLearnerInteractionsV2('p1')).toHaveLength(1)
    expect(await getDurableLearnerInteractionsV2('p2')).toEqual([])
  })
})
