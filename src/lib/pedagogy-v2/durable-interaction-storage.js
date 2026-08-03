// durable-interaction-storage.js — RX-1 durable journal for learner-facing V2
// interactions. The learner model evidence remains immutable and authoritative
// for pedagogical state; this journal persists the interaction facts that
// evidence alone cannot reconstruct (learner response, assessment/diagnosis,
// selected context and recipe preference).
//
// RX-1A deliberately uses one row per record in the existing `settings` object
// store, so the recovery can ship without a physical DB migration. Keys are
// namespaced and never collide with ordinary settings. A later indexed-store
// migration can copy these records losslessly because the record contract is
// versioned here.

import { __dbForTests } from '../storage.js'
import { validateLearnerEvidenceBatchV2 } from './learner-evidence-validator.js'
import { aggregateTargetEvidence } from './learner-model.js'
import { learnerTargetStateKey } from './learner-evidence-contracts.js'
import { createRegistryTargetResolver } from './registry.js'

export const DURABLE_INTERACTION_V2_VERSION = 1
export const DURABLE_STUDY_SESSION_V2_VERSION = 1

const SESSION_PREFIX = 'study_session_v2:'
const INTERACTION_PREFIX = 'learner_interaction_v2:'

const clone = (value) => value == null ? value : structuredClone(value)
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0

function sessionKey(id) { return `${SESSION_PREFIX}${id}` }
function interactionKey(id) { return `${INTERACTION_PREFIX}${id}` }

function validateInput({ profileId, studySession, plan, response, assessment, events }) {
  const errors = []
  if (!isNonEmptyString(profileId)) errors.push('profile_id:required')
  if (!isNonEmptyString(studySession?.study_session_id)) errors.push('study_session_id:required')
  if (!isNonEmptyString(plan?.activity_id)) errors.push('activity_id:required')
  if (!isNonEmptyString(response?.interaction_id)) errors.push('interaction_id:required')
  if (!isNonEmptyString(plan?.session_id)) errors.push('lesson_session_id:required')
  if (!Array.isArray(events)) errors.push('events:array_required')
  if (assessment == null || typeof assessment !== 'object') errors.push('assessment:required')
  return errors
}

function compactPlan(plan) {
  return {
    activity_plan_version: plan.activity_plan_version ?? null,
    activity_id: plan.activity_id,
    lesson_session_id: plan.session_id,
    pack_id: plan.pack_id ?? null,
    exemplar_id: plan.exemplar_id ?? null,
    recipe: plan.recipe ?? null,
    activity_kind: plan.activity_kind ?? null,
    capability: plan.capability ?? null,
    modality: plan.modality ?? null,
    construction_id: plan.construction_id ?? null,
    sense_ids: [...(plan.sense_ids || [])],
    primary_target: clone(plan.primary_target ?? null),
    text_en: plan.text_en ?? null,
    text_pt: plan.text_pt ?? null,
  }
}

function compactFocus(focus) {
  if (!focus) return null
  return {
    study_focus_version: focus.study_focus_version ?? null,
    focus_type: focus.focus_type ?? null,
    pack_id: focus.pack_id ?? null,
    lexeme_id: focus.lexeme_id ?? null,
    target: clone(focus.target ?? null),
    capability: focus.capability ?? null,
    modality: focus.modality ?? null,
    reason_codes: [...(focus.reason_codes || [])],
    is_new_target: !!focus.is_new_target,
  }
}

function buildSessionRecord({ profileId, studySession, studyScope, recipePreference, occurredAt, interactionId, plan }) {
  return {
    durable_study_session_version: DURABLE_STUDY_SESSION_V2_VERSION,
    study_session_id: studySession.study_session_id,
    profile_id: profileId,
    mode: studySession.mode,
    collection_id: studyScope?.collection_id ?? null,
    collection_title_pt: studyScope?.title_pt ?? null,
    recipe_preference: recipePreference ?? null,
    started_at: studySession.started_at ?? occurredAt,
    last_activity_at: occurredAt,
    ended_at: null,
    status: 'active',
    last_interaction_id: interactionId,
    interaction_count: null,
    pack_ids: [...new Set([...(studySession.pack_history || []), plan.pack_id].filter(Boolean))].sort(),
    updated_at: occurredAt,
  }
}

function buildInteractionRecord({ profileId, studySession, studyScope, recipePreference, focus, plan, response, assessment, events, occurredAt }) {
  return {
    durable_interaction_version: DURABLE_INTERACTION_V2_VERSION,
    interaction_id: response.interaction_id,
    study_session_id: studySession.study_session_id,
    lesson_session_id: plan.session_id,
    profile_id: profileId,
    occurred_at: occurredAt,
    collection_id: studyScope?.collection_id ?? null,
    collection_title_pt: studyScope?.title_pt ?? null,
    recipe_preference: recipePreference ?? null,
    focus: compactFocus(focus),
    plan: compactPlan(plan),
    response: clone(response),
    assessment: clone(assessment),
    evidence_ids: events.map((event) => event.evidence_id).sort(),
  }
}

async function evidenceForTargetTx(tx, profileId, target) {
  const rows = await tx.objectStore('learner_evidence_v2').index('profile_target').getAll([profileId, target.target_id])
  return rows.filter((event) => event.target?.target_type === target.target_type)
}

/**
 * Persist one learner interaction and its evidence in ONE IndexedDB
 * transaction. Invalid evidence or a conflicting interaction id writes
 * nothing. Replaying the same interaction is an idempotent no-op.
 */
export async function recordDurableLearnerInteractionV2(input, opts = {}) {
  const errors = validateInput(input)
  if (errors.length) throw new Error(`DURABLE_INTERACTION_INVALID:${errors.join(',')}`)

  const resolveTarget = opts.targetResolver ?? createRegistryTargetResolver()
  const evidenceValidation = validateLearnerEvidenceBatchV2(input.events, { resolveTarget })
  if (!evidenceValidation.valid) {
    throw new Error(`LEARNER_EVIDENCE_INVALID:${evidenceValidation.errors.join(',')}`)
  }

  const occurredAt = input.response.submitted_at || input.events[0]?.occurred_at || new Date().toISOString()
  const interaction = buildInteractionRecord({ ...input, occurredAt })
  const session = buildSessionRecord({ ...input, occurredAt, interactionId: interaction.interaction_id })
  const db = await __dbForTests()
  const tx = db.transaction(['settings', 'learner_evidence_v2', 'learner_target_states_v2'], 'readwrite')
  const settings = tx.objectStore('settings')
  const evidenceStore = tx.objectStore('learner_evidence_v2')
  const stateStore = tx.objectStore('learner_target_states_v2')

  const existingRow = await settings.get(interactionKey(interaction.interaction_id))
  if (existingRow) {
    const existing = existingRow.value
    if (JSON.stringify(existing) !== JSON.stringify(interaction)) {
      tx.abort()
      throw new Error(`DURABLE_INTERACTION_ID_COLLISION:${interaction.interaction_id}`)
    }
    await tx.done.catch(() => {})
    return { recorded: false, interaction_id: interaction.interaction_id, evidence_recorded: [], evidence_skipped: interaction.evidence_ids }
  }

  const recorded = []
  const skipped = []
  const affected = new Map()
  for (const event of input.events) {
    const existingEvidence = await evidenceStore.get(event.evidence_id)
    if (existingEvidence) skipped.push(event.evidence_id)
    else { await evidenceStore.put(event); recorded.push(event.evidence_id) }
    affected.set(learnerTargetStateKey(event.profile_id, event.target), {
      profile_id: event.profile_id,
      target: clone(event.target),
    })
  }

  for (const { profile_id, target } of affected.values()) {
    const rows = await evidenceForTargetTx(tx, profile_id, target)
    await stateStore.put(aggregateTargetEvidence(rows, { profile_id, target }))
  }

  const previousSessionRow = await settings.get(sessionKey(session.study_session_id))
  const previousSession = previousSessionRow?.value ?? null
  const nextSession = {
    ...session,
    started_at: previousSession?.started_at ?? session.started_at,
    interaction_count: (previousSession?.interaction_count ?? 0) + 1,
    pack_ids: [...new Set([...(previousSession?.pack_ids || []), ...session.pack_ids])].sort(),
  }

  await settings.put({ key: interactionKey(interaction.interaction_id), value: interaction })
  await settings.put({ key: sessionKey(session.study_session_id), value: nextSession })
  await tx.done

  return {
    recorded: true,
    interaction_id: interaction.interaction_id,
    study_session_id: session.study_session_id,
    evidence_recorded: recorded,
    evidence_skipped: skipped,
  }
}

export async function finalizeDurableStudySessionV2(studySessionId, { profileId, endedAt = new Date().toISOString(), status = 'complete' } = {}) {
  if (!isNonEmptyString(studySessionId)) throw new Error('DURABLE_STUDY_SESSION_ID_REQUIRED')
  const db = await __dbForTests()
  const key = sessionKey(studySessionId)
  const row = await db.get('settings', key)
  if (!row?.value) return { updated: false, reason: 'not_recorded' }
  if (profileId && row.value.profile_id !== profileId) throw new Error('DURABLE_STUDY_SESSION_PROFILE_MISMATCH')
  await db.put('settings', {
    key,
    value: { ...row.value, status, ended_at: endedAt, updated_at: endedAt },
  })
  return { updated: true, study_session_id: studySessionId }
}

async function readNamespaced(prefix) {
  const db = await __dbForTests()
  const rows = await db.getAll('settings')
  return rows.filter((row) => String(row.key).startsWith(prefix)).map((row) => row.value)
}

export async function getDurableStudySessionsV2(profileId) {
  return (await readNamespaced(SESSION_PREFIX))
    .filter((row) => row.profile_id === profileId)
    .sort((a, b) => String(b.last_activity_at || '').localeCompare(String(a.last_activity_at || '')))
}

export async function getDurableLearnerInteractionsV2(profileId, { studySessionId = null } = {}) {
  return (await readNamespaced(INTERACTION_PREFIX))
    .filter((row) => row.profile_id === profileId && (!studySessionId || row.study_session_id === studySessionId))
    .sort((a, b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')))
}
