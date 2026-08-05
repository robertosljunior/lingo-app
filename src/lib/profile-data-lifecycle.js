// RX-5 — complete, profile-scoped data lifecycle for the local-first app.
//
// A profile is not only the row in `profiles`: it owns V1 answers/rollups,
// V2 evidence/derived state, private generated lessons, durable journal rows,
// pending assessment receipts and profile-scoped preferences. This module keeps
// those facts together for export, collision-safe restore and atomic deletion.
// Global assets/preferences (content packs, language models, voices, theme and
// shared audio settings) are deliberately outside the profile boundary.

import { __dbForTests, DEFAULT_PROFILE, DB_VERSION } from './storage.js'

export const PROFILE_DATA_EXPORT_VERSION = 1

const TRANSACTION_STORES = [
  'profiles', 'lessons', 'questions', 'answers', 'mistakes', 'srs',
  'settings', 'skill_events', 'skill_profiles',
  'learner_evidence_v2', 'learner_target_states_v2',
]

const PROFILE_INDEXED_STORES = [
  ['mistakes', 'profile_id'],
  ['srs', 'profile_id'],
  ['skill_events', 'profile_id'],
  ['skill_profiles', 'profile_id'],
  ['learner_evidence_v2', 'profile_id'],
  ['learner_target_states_v2', 'profile_id'],
]

const PROFILE_SETTING_PREFIXES = [
  'study_session_v2:',
  'learner_interaction_v2:',
  'pending_submission_v2:',
]

const PROFILE_SETTING_KEYS = (profileId) => new Set([
  `adaptive_session:${profileId}`,
  `training_preferences:${profileId}`,
  `skill_profile_rebuild_version:${profileId}`,
])

const clone = (value) => value == null ? value : structuredClone(value)
const profileOf = (row) => row?.profile_id || DEFAULT_PROFILE

function primaryKey(storeName, row) {
  const fields = {
    profiles: 'profile_id', lessons: 'lesson_id', questions: 'key', answers: 'key',
    mistakes: 'key', srs: 'key', settings: 'key', skill_events: 'key',
    skill_profiles: 'key', learner_evidence_v2: 'evidence_id',
    learner_target_states_v2: 'key',
  }
  return row?.[fields[storeName]]
}

function settingBelongsToProfile(row, profileId) {
  const key = String(row?.key || '')
  if (PROFILE_SETTING_KEYS(profileId).has(key)) return true
  return PROFILE_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix))
    && row?.value?.profile_id === profileId
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

function stableHash(value) {
  const source = JSON.stringify(stableValue(value))
  let hash = 2166136261
  for (const char of source) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

async function indexedRows(tx, storeName, indexName, profileId) {
  return tx.objectStore(storeName).index(indexName).getAll(profileId)
}

async function collectProfileDataTx(tx, profileId) {
  const profile = await tx.objectStore('profiles').get(profileId)
  if (!profile) throw new Error(`PROFILE_NOT_FOUND:${profileId}`)

  const lessons = (await tx.objectStore('lessons').getAll())
    .filter((row) => row.owner_profile_id === profileId)
  const lessonIds = new Set(lessons.map((row) => row.lesson_id))
  const questions = (await tx.objectStore('questions').getAll())
    .filter((row) => row.owner_profile_id === profileId || lessonIds.has(row.lesson_id))
  const answers = (await tx.objectStore('answers').getAll())
    .filter((row) => profileOf(row) === profileId)
  const settings = (await tx.objectStore('settings').getAll())
    .filter((row) => settingBelongsToProfile(row, profileId))

  const stores = { lessons, questions, answers, settings }
  for (const [storeName, indexName] of PROFILE_INDEXED_STORES) {
    stores[storeName] = await indexedRows(tx, storeName, indexName, profileId)
  }
  return { profile, stores }
}

function countData(data) {
  return Object.fromEntries(Object.entries(data.stores).map(([name, rows]) => [name, rows.length]))
}

export async function previewProfileDataDeletion(profileId) {
  if (!profileId) throw new Error('PROFILE_ID_REQUIRED')
  const database = await __dbForTests()
  const tx = database.transaction(TRANSACTION_STORES, 'readonly')
  const data = await collectProfileDataTx(tx, profileId)
  const profiles = await tx.objectStore('profiles').getAll()
  const activeProfile = (await tx.objectStore('settings').get('active_profile'))?.value || DEFAULT_PROFILE
  await tx.done
  return {
    profile: clone(data.profile),
    counts: countData(data),
    is_active: activeProfile === profileId,
    can_delete: profiles.length > 1,
    global_assets_affected: false,
  }
}

export async function exportProfileData(profileId, { exportedAt = new Date().toISOString() } = {}) {
  if (!profileId) throw new Error('PROFILE_ID_REQUIRED')
  const database = await __dbForTests()
  const tx = database.transaction(TRANSACTION_STORES, 'readonly')
  const data = await collectProfileDataTx(tx, profileId)
  await tx.done

  const payload = {
    profile_data_export_version: PROFILE_DATA_EXPORT_VERSION,
    app_db_version: DB_VERSION,
    exported_at: exportedAt,
    profile: clone(data.profile),
    stores: Object.fromEntries(Object.entries(data.stores).map(([name, rows]) => [name, clone(rows)])),
    scope: {
      profile_scoped_records_only: true,
      global_settings_included: false,
      downloaded_models_included: false,
      downloaded_voices_included: false,
      content_packs_included: false,
    },
  }
  return { ...payload, checksum: stableHash(payload) }
}

function assertBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new Error('PROFILE_IMPORT_INVALID:object_required')
  if (bundle.profile_data_export_version !== PROFILE_DATA_EXPORT_VERSION) {
    throw new Error(`PROFILE_IMPORT_VERSION_UNSUPPORTED:${bundle.profile_data_export_version}`)
  }
  if (!bundle.profile?.profile_id) throw new Error('PROFILE_IMPORT_INVALID:profile_id_required')
  if (!bundle.stores || typeof bundle.stores !== 'object') throw new Error('PROFILE_IMPORT_INVALID:stores_required')
  const expected = stableHash(Object.fromEntries(Object.entries(bundle).filter(([key]) => key !== 'checksum')))
  if (!bundle.checksum || bundle.checksum !== expected) throw new Error('PROFILE_IMPORT_CHECKSUM_MISMATCH')

  const profileId = bundle.profile.profile_id
  const requiredArrays = [
    'lessons', 'questions', 'answers', 'settings', 'mistakes', 'srs',
    'skill_events', 'skill_profiles', 'learner_evidence_v2', 'learner_target_states_v2',
  ]
  for (const name of requiredArrays) {
    if (!Array.isArray(bundle.stores[name])) throw new Error(`PROFILE_IMPORT_INVALID:${name}_array_required`)
  }
  for (const row of bundle.stores.lessons) {
    if (row.owner_profile_id !== profileId) throw new Error('PROFILE_IMPORT_OWNER_MISMATCH:lessons')
  }
  for (const row of bundle.stores.questions) {
    if (row.owner_profile_id !== profileId) throw new Error('PROFILE_IMPORT_OWNER_MISMATCH:questions')
  }
  for (const row of bundle.stores.answers) {
    if (profileOf(row) !== profileId) throw new Error('PROFILE_IMPORT_OWNER_MISMATCH:answers')
  }
  for (const name of ['mistakes', 'srs', 'skill_events', 'skill_profiles', 'learner_evidence_v2', 'learner_target_states_v2']) {
    for (const row of bundle.stores[name]) {
      if (row.profile_id !== profileId) throw new Error(`PROFILE_IMPORT_OWNER_MISMATCH:${name}`)
    }
  }
  for (const row of bundle.stores.settings) {
    if (!settingBelongsToProfile(row, profileId)) throw new Error('PROFILE_IMPORT_OWNER_MISMATCH:settings')
  }
  return profileId
}

/**
 * Restore an export without ever overwriting existing data. The complete
 * preflight and all writes share one transaction: one collision aborts the
 * whole restore, including the profile row.
 */
export async function importProfileData(bundle) {
  const profileId = assertBundle(bundle)
  const database = await __dbForTests()
  const tx = database.transaction(TRANSACTION_STORES, 'readwrite')

  try {
    if (await tx.objectStore('profiles').get(profileId)) {
      throw new Error(`PROFILE_IMPORT_COLLISION:profiles:${profileId}`)
    }

    for (const [storeName, rows] of Object.entries(bundle.stores)) {
      const store = tx.objectStore(storeName)
      for (const row of rows) {
        const key = primaryKey(storeName, row)
        if (key == null) throw new Error(`PROFILE_IMPORT_INVALID:${storeName}_key_required`)
        if (await store.get(key)) throw new Error(`PROFILE_IMPORT_COLLISION:${storeName}:${key}`)
      }
    }

    await tx.objectStore('profiles').put(clone(bundle.profile))
    for (const [storeName, rows] of Object.entries(bundle.stores)) {
      const store = tx.objectStore(storeName)
      for (const row of rows) await store.put(clone(row))
    }
    await tx.done
  } catch (error) {
    try { tx.abort() } catch { /* transaction may already be inactive */ }
    await tx.done.catch(() => {})
    throw error
  }

  return { imported: true, profile_id: profileId, counts: countData({ stores: bundle.stores }) }
}

/**
 * Hard-delete one profile and every record it owns in one transaction.
 * A private lesson referenced by another profile would become an orphan, so
 * that impossible state aborts rather than deleting around it.
 */
export async function deleteProfileData(profileId, { replacementProfileId = null } = {}) {
  if (!profileId) throw new Error('PROFILE_ID_REQUIRED')
  const database = await __dbForTests()
  const tx = database.transaction(TRANSACTION_STORES, 'readwrite')

  try {
    const profiles = await tx.objectStore('profiles').getAll()
    const target = profiles.find((row) => row.profile_id === profileId)
    if (!target) throw new Error(`PROFILE_NOT_FOUND:${profileId}`)
    if (profiles.length <= 1) throw new Error('PROFILE_DELETE_LAST_PROFILE_FORBIDDEN')

    const activeRow = await tx.objectStore('settings').get('active_profile')
    const activeProfile = activeRow?.value || DEFAULT_PROFILE
    if (activeProfile === profileId) {
      const replacement = profiles.find((row) => row.profile_id === replacementProfileId)
      if (!replacement || replacement.profile_id === profileId) {
        throw new Error('PROFILE_DELETE_REPLACEMENT_REQUIRED')
      }
    }

    const data = await collectProfileDataTx(tx, profileId)
    const ownedLessonIds = new Set(data.stores.lessons.map((row) => row.lesson_id))
    const foreignReferences = (await tx.objectStore('answers').getAll())
      .filter((row) => ownedLessonIds.has(row.lesson_id) && profileOf(row) !== profileId)
    if (foreignReferences.length) throw new Error('PROFILE_DELETE_CROSS_PROFILE_LESSON_REFERENCE')

    for (const [storeName, rows] of Object.entries(data.stores)) {
      const store = tx.objectStore(storeName)
      for (const row of rows) await store.delete(primaryKey(storeName, row))
    }
    await tx.objectStore('profiles').delete(profileId)
    if (activeProfile === profileId) {
      await tx.objectStore('settings').put({ key: 'active_profile', value: replacementProfileId })
    }
    await tx.done

    return {
      deleted: true,
      profile_id: profileId,
      replacement_profile_id: activeProfile === profileId ? replacementProfileId : null,
      counts: countData(data),
      global_assets_affected: false,
    }
  } catch (error) {
    try { tx.abort() } catch { /* transaction may already be inactive */ }
    await tx.done.catch(() => {})
    throw error
  }
}
