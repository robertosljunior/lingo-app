// durable-submission-recovery.js — RX-1C write-ahead recovery for learner-facing
// V2 submissions.
//
// The final interaction writer remains authoritative and atomic with evidence.
// This module persists a small response receipt BEFORE asynchronous assessment.
// If the page disappears before assessment finishes, the next learner boot
// converts that receipt into a factual not_assessed interaction. The response is
// preserved, no evidence is invented, and Review Points never treats it as an
// error.

import { __dbForTests } from '../storage.js'
import {
  DURABLE_INTERACTION_V2_VERSION,
  DURABLE_STUDY_SESSION_V2_VERSION,
} from './durable-interaction-storage.js'

export const DURABLE_SUBMISSION_RECEIPT_V2_VERSION = 1

const SESSION_PREFIX = 'study_session_v2:'
const INTERACTION_PREFIX = 'learner_interaction_v2:'
const PENDING_PREFIX = 'pending_submission_v2:'

const clone = (value) => value == null ? value : structuredClone(value)
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0

const sessionKey = (id) => `${SESSION_PREFIX}${id}`
const interactionKey = (id) => `${INTERACTION_PREFIX}${id}`
const pendingKey = (id) => `${PENDING_PREFIX}${id}`

function validateStageInput({ profileId, studySession, plan, response }) {
  const errors = []
  if (!isNonEmptyString(profileId)) errors.push('profile_id:required')
  if (!isNonEmptyString(studySession?.study_session_id)) errors.push('study_session_id:required')
  if (!isNonEmptyString(plan?.activity_id)) errors.push('activity_id:required')
  if (!isNonEmptyString(plan?.session_id)) errors.push('lesson_session_id:required')
  if (!isNonEmptyString(response?.interaction_id)) errors.push('interaction_id:required')
  if (!isNonEmptyString(response?.submitted_at)) errors.push('submitted_at:required')
  return errors
}

function buildReceipt({ profileId, studySession, studyScope, recipePreference, focus, plan, response }) {
  return {
    durable_submission_receipt_version: DURABLE_SUBMISSION_RECEIPT_V2_VERSION,
    persistence_status: 'pending_assessment',
    interaction_id: response.interaction_id,
    study_session_id: studySession.study_session_id,
    lesson_session_id: plan.session_id,
    profile_id: profileId,
    occurred_at: response.submitted_at,
    collection_id: studyScope?.collection_id ?? null,
    collection_title_pt: studyScope?.title_pt ?? null,
    recipe_preference: recipePreference ?? null,
    focus: clone(focus ?? null),
    plan: clone(plan),
    response: clone(response),
  }
}

function buildActiveSession({ profileId, studySession, studyScope, recipePreference, plan, receipt, previous }) {
  const pending = new Set(previous?.pending_interaction_ids || [])
  pending.add(receipt.interaction_id)
  return {
    durable_study_session_version: DURABLE_STUDY_SESSION_V2_VERSION,
    study_session_id: studySession.study_session_id,
    profile_id: profileId,
    mode: studySession.mode,
    collection_id: studyScope?.collection_id ?? previous?.collection_id ?? null,
    collection_title_pt: studyScope?.title_pt ?? previous?.collection_title_pt ?? null,
    recipe_preference: recipePreference ?? previous?.recipe_preference ?? null,
    started_at: previous?.started_at ?? studySession.started_at ?? receipt.occurred_at,
    last_activity_at: receipt.occurred_at,
    ended_at: null,
    status: 'active',
    last_interaction_id: previous?.last_interaction_id ?? null,
    interaction_count: previous?.interaction_count ?? 0,
    pack_ids: [...new Set([...(previous?.pack_ids || []), ...(studySession.pack_history || []), plan.pack_id].filter(Boolean))].sort(),
    pending_interaction_ids: [...pending].sort(),
    updated_at: receipt.occurred_at,
  }
}

function sameResponseFacts(a, b) {
  return JSON.stringify(a?.response ?? null) === JSON.stringify(b?.response ?? null)
    && a?.study_session_id === b?.study_session_id
    && a?.profile_id === b?.profile_id
}

/**
 * Write-ahead receipt. Repeating the same response is idempotent; reusing its
 * deterministic interaction id for different facts is rejected.
 */
export async function stageDurableLearnerSubmissionV2(input) {
  const errors = validateStageInput(input)
  if (errors.length) throw new Error(`DURABLE_SUBMISSION_INVALID:${errors.join(',')}`)

  const receipt = buildReceipt(input)
  const db = await __dbForTests()
  const tx = db.transaction('settings', 'readwrite')
  const settings = tx.objectStore('settings')

  const finalRow = await settings.get(interactionKey(receipt.interaction_id))
  if (finalRow?.value) {
    if (!sameResponseFacts(finalRow.value, receipt)) {
      tx.abort()
      await tx.done.catch(() => {})
      throw new Error(`DURABLE_INTERACTION_ID_COLLISION:${receipt.interaction_id}`)
    }
    await settings.delete(pendingKey(receipt.interaction_id))
    await tx.done
    return { staged: false, reason: 'already_finalized', interaction_id: receipt.interaction_id }
  }

  const existingPending = await settings.get(pendingKey(receipt.interaction_id))
  if (existingPending?.value) {
    if (JSON.stringify(existingPending.value) !== JSON.stringify(receipt)) {
      tx.abort()
      await tx.done.catch(() => {})
      throw new Error(`DURABLE_SUBMISSION_ID_COLLISION:${receipt.interaction_id}`)
    }
    await tx.done
    return { staged: false, reason: 'already_staged', interaction_id: receipt.interaction_id }
  }

  const previousRow = await settings.get(sessionKey(receipt.study_session_id))
  const previous = previousRow?.value ?? null
  if (previous && previous.profile_id !== input.profileId) {
    tx.abort()
    await tx.done.catch(() => {})
    throw new Error('DURABLE_STUDY_SESSION_PROFILE_MISMATCH')
  }
  if (previous && ['complete', 'abandoned', 'interrupted'].includes(previous.status)) {
    tx.abort()
    await tx.done.catch(() => {})
    throw new Error(`DURABLE_STUDY_SESSION_CLOSED:${receipt.study_session_id}`)
  }

  await settings.put({ key: pendingKey(receipt.interaction_id), value: receipt })
  await settings.put({
    key: sessionKey(receipt.study_session_id),
    value: buildActiveSession({ ...input, receipt, previous }),
  })
  await tx.done
  return { staged: true, interaction_id: receipt.interaction_id, study_session_id: receipt.study_session_id }
}

/** Remove the auxiliary receipt after the final atomic writer succeeds. */
export async function settleDurableLearnerSubmissionV2(interactionId, { profileId = null } = {}) {
  if (!isNonEmptyString(interactionId)) throw new Error('DURABLE_SUBMISSION_ID_REQUIRED')
  const db = await __dbForTests()
  const tx = db.transaction('settings', 'readwrite')
  const settings = tx.objectStore('settings')
  const row = await settings.get(pendingKey(interactionId))
  if (!row?.value) {
    await tx.done
    return { settled: false, reason: 'not_staged' }
  }
  const receipt = row.value
  if (profileId && receipt.profile_id !== profileId) {
    tx.abort()
    await tx.done.catch(() => {})
    throw new Error('DURABLE_SUBMISSION_PROFILE_MISMATCH')
  }
  await settings.delete(pendingKey(interactionId))
  const sessionRow = await settings.get(sessionKey(receipt.study_session_id))
  if (sessionRow?.value) {
    const pending = (sessionRow.value.pending_interaction_ids || []).filter((id) => id !== interactionId)
    await settings.put({
      key: sessionKey(receipt.study_session_id),
      value: { ...sessionRow.value, pending_interaction_ids: pending },
    })
  }
  await tx.done
  return { settled: true, interaction_id: interactionId }
}

function recoveredInteraction(receipt, recoveredAt) {
  return {
    durable_interaction_version: DURABLE_INTERACTION_V2_VERSION,
    interaction_id: receipt.interaction_id,
    study_session_id: receipt.study_session_id,
    lesson_session_id: receipt.lesson_session_id,
    profile_id: receipt.profile_id,
    occurred_at: receipt.occurred_at,
    collection_id: receipt.collection_id,
    collection_title_pt: receipt.collection_title_pt,
    recipe_preference: receipt.recipe_preference,
    focus: clone(receipt.focus),
    plan: clone(receipt.plan),
    response: clone(receipt.response),
    assessment: {
      assessment_version: 1,
      status: 'not_assessed',
      outcome: 'not_assessed',
      partial_score: null,
      diagnosis: null,
      recovery: {
        code: 'SUBMISSION_INTERRUPTED_BEFORE_ASSESSMENT',
        recovered_at: recoveredAt,
      },
    },
    evidence_ids: [],
    recovery_status: 'interrupted_before_assessment',
  }
}

async function reconcilePendingInTransaction(settings, { profileId, studySessionId = null, recoveredAt }) {
  const rows = await settings.getAll()
  const pendingRows = rows
    .filter((row) => String(row.key).startsWith(PENDING_PREFIX))
    .map((row) => row.value)
    .filter((row) => row?.profile_id === profileId && (!studySessionId || row.study_session_id === studySessionId))

  const sessionCache = new Map()
  let recoveredInteractions = 0
  let clearedReceipts = 0

  for (const receipt of pendingRows) {
    const finalKey = interactionKey(receipt.interaction_id)
    const finalRow = await settings.get(finalKey)
    if (!finalRow?.value) {
      await settings.put({ key: finalKey, value: recoveredInteraction(receipt, recoveredAt) })
      recoveredInteractions += 1

      let session = sessionCache.get(receipt.study_session_id)
      if (!session) {
        const sessionRow = await settings.get(sessionKey(receipt.study_session_id))
        session = sessionRow?.value ?? null
      }
      if (session) {
        const pendingIds = (session.pending_interaction_ids || []).filter((id) => id !== receipt.interaction_id)
        session = {
          ...session,
          last_interaction_id: receipt.interaction_id,
          last_activity_at: receipt.occurred_at || session.last_activity_at,
          interaction_count: (session.interaction_count || 0) + 1,
          pending_interaction_ids: pendingIds,
          updated_at: recoveredAt,
        }
        sessionCache.set(receipt.study_session_id, session)
      }
    }
    await settings.delete(pendingKey(receipt.interaction_id))
    clearedReceipts += 1
  }

  for (const [id, session] of sessionCache.entries()) {
    await settings.put({ key: sessionKey(id), value: session })
  }

  return { recoveredInteractions, clearedReceipts }
}

/**
 * Called before a new learner controller starts. Any prior active session is a
 * previous runtime boundary and becomes interrupted. Pending responses are
 * preserved as not_assessed interactions first.
 */
export async function reconcileInterruptedStudySessionsV2(profileId, { interruptedAt = new Date().toISOString() } = {}) {
  if (!isNonEmptyString(profileId)) throw new Error('DURABLE_PROFILE_ID_REQUIRED')
  const db = await __dbForTests()
  const tx = db.transaction('settings', 'readwrite')
  const settings = tx.objectStore('settings')
  const recovered = await reconcilePendingInTransaction(settings, { profileId, recoveredAt: interruptedAt })
  const rows = await settings.getAll()
  let interruptedSessions = 0
  for (const row of rows) {
    if (!String(row.key).startsWith(SESSION_PREFIX)) continue
    const session = row.value
    if (session?.profile_id !== profileId || session.status !== 'active') continue
    await settings.put({
      key: row.key,
      value: {
        ...session,
        status: 'interrupted',
        ended_at: interruptedAt,
        pending_interaction_ids: [],
        updated_at: interruptedAt,
      },
    })
    interruptedSessions += 1
  }
  await tx.done
  return { ...recovered, interrupted_sessions: interruptedSessions }
}

/** Explicit learner exit. Pending responses are preserved before abandonment. */
export async function closeDurableStudySessionV2(studySessionId, {
  profileId,
  endedAt = new Date().toISOString(),
  status = 'abandoned',
} = {}) {
  if (!isNonEmptyString(studySessionId)) throw new Error('DURABLE_STUDY_SESSION_ID_REQUIRED')
  if (!isNonEmptyString(profileId)) throw new Error('DURABLE_PROFILE_ID_REQUIRED')
  if (!['abandoned', 'interrupted'].includes(status)) throw new Error(`DURABLE_STUDY_SESSION_CLOSE_STATUS_INVALID:${status}`)

  const db = await __dbForTests()
  const tx = db.transaction('settings', 'readwrite')
  const settings = tx.objectStore('settings')
  const recovered = await reconcilePendingInTransaction(settings, {
    profileId,
    studySessionId,
    recoveredAt: endedAt,
  })
  const row = await settings.get(sessionKey(studySessionId))
  if (!row?.value) {
    await tx.done
    return { updated: false, reason: 'not_recorded', ...recovered }
  }
  if (row.value.profile_id !== profileId) {
    tx.abort()
    await tx.done.catch(() => {})
    throw new Error('DURABLE_STUDY_SESSION_PROFILE_MISMATCH')
  }
  if (row.value.status === 'complete') {
    await tx.done
    return { updated: false, reason: 'already_complete', ...recovered }
  }
  await settings.put({
    key: sessionKey(studySessionId),
    value: {
      ...row.value,
      status,
      ended_at: endedAt,
      pending_interaction_ids: [],
      updated_at: endedAt,
    },
  })
  await tx.done
  return { updated: true, study_session_id: studySessionId, status, ...recovered }
}

export async function getPendingDurableSubmissionsV2(profileId) {
  const db = await __dbForTests()
  const rows = await db.getAll('settings')
  return rows
    .filter((row) => String(row.key).startsWith(PENDING_PREFIX))
    .map((row) => row.value)
    .filter((row) => row?.profile_id === profileId)
    .sort((a, b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')))
}
