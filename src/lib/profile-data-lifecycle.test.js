import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import * as storage from './storage.js'
import {
  deleteProfileData,
  exportProfileData,
  importProfileData,
  previewProfileDataDeletion,
} from './profile-data-lifecycle.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

async function reset() {
  await storage.__resetDbForTests()
  await indexedDB.deleteDatabase('app-idiomas')
}

beforeEach(reset)
afterEach(reset)

async function seed() {
  const db = await storage.__dbForTests()
  await db.put('profiles', { profile_id: 'p1', name: 'Ana', created_at: 1 })
  await db.put('profiles', { profile_id: 'p2', name: 'Bia', created_at: 2 })
  await db.put('settings', { key: 'active_profile', value: 'p1' })
  await db.put('settings', { key: 'theme', value: 'dark' })
  await db.put('settings', { key: 'content_pack_seed_marker', value: { version: 1 } })
  await db.put('settings', { key: 'adaptive_session:p1', value: { profile_id: 'p1' } })
  await db.put('settings', { key: 'training_preferences:p1', value: { preferred_theme: 'workplace' } })
  await db.put('settings', { key: 'skill_profile_rebuild_version:p1', value: '1' })
  await db.put('settings', { key: 'study_session_v2:s1', value: { study_session_id: 's1', profile_id: 'p1', status: 'complete' } })
  await db.put('settings', { key: 'learner_interaction_v2:i1', value: { interaction_id: 'i1', study_session_id: 's1', profile_id: 'p1' } })
  await db.put('settings', { key: 'pending_submission_v2:i2', value: { interaction_id: 'i2', study_session_id: 's1', profile_id: 'p1' } })
  await db.put('settings', { key: 'study_session_v2:s2', value: { study_session_id: 's2', profile_id: 'p2', status: 'complete' } })

  await db.put('lessons', { lesson_id: 'lesson-p1', title: 'Private', owner_profile_id: 'p1', created_at: 1 })
  await db.put('questions', { key: 'lesson-p1:1', lesson_id: 'lesson-p1', id: 1, owner_profile_id: 'p1' })
  await db.put('lessons', { lesson_id: 'shared', title: 'Shared', owner_profile_id: null, created_at: 1 })
  await db.put('questions', { key: 'shared:1', lesson_id: 'shared', id: 1, owner_profile_id: null })

  await db.put('answers', { key: 11, profile_id: 'p1', lesson_id: 'lesson-p1', question_id: 1, session_id: 'v1-p1' })
  await db.put('answers', { key: 12, profile_id: 'p2', lesson_id: 'shared', question_id: 1, session_id: 'v1-p2' })
  await db.put('mistakes', { key: 'p1:grammar', profile_id: 'p1', mistake_type: 'grammar', count: 1 })
  await db.put('mistakes', { key: 'p2:grammar', profile_id: 'p2', mistake_type: 'grammar', count: 1 })
  await db.put('srs', { key: 'p1:lesson-p1:1', profile_id: 'p1', lesson_id: 'lesson-p1', question_id: 1 })
  await db.put('skill_events', { key: 'p1:11:skill', profile_id: 'p1', answer_id: 11, skill_id: 'skill' })
  await db.put('skill_profiles', { key: 'p1:skill', profile_id: 'p1', skill_id: 'skill' })
  await db.put('learner_evidence_v2', {
    evidence_id: 'e1', profile_id: 'p1', interaction_id: 'i1', session_id: 'ls1', exemplar_id: 'ex1',
    target: { target_type: 'sense', target_id: 'sense:still.continuity' }, occurred_at: '2026-08-04T10:00:00.000Z',
  })
  await db.put('learner_target_states_v2', {
    key: 'p1:sense:sense:still.continuity', profile_id: 'p1',
    target: { target_type: 'sense', target_id: 'sense:still.continuity' },
  })
  return db
}

async function profileRows(db, profileId) {
  const settings = (await db.getAll('settings')).filter((row) => row?.value?.profile_id === profileId
    || String(row.key).endsWith(`:${profileId}`))
  return {
    profile: await db.get('profiles', profileId),
    answers: (await db.getAll('answers')).filter((row) => row.profile_id === profileId),
    mistakes: await db.getAllFromIndex('mistakes', 'profile_id', profileId),
    srs: await db.getAllFromIndex('srs', 'profile_id', profileId),
    skill_events: await db.getAllFromIndex('skill_events', 'profile_id', profileId),
    skill_profiles: await db.getAllFromIndex('skill_profiles', 'profile_id', profileId),
    evidence: await db.getAllFromIndex('learner_evidence_v2', 'profile_id', profileId),
    states: await db.getAllFromIndex('learner_target_states_v2', 'profile_id', profileId),
    settings,
  }
}

describe('RX-5 profile data lifecycle', () => {
  it('previews the real deletion boundary without counting global assets', async () => {
    await seed()
    const preview = await previewProfileDataDeletion('p1')
    expect(preview).toMatchObject({
      profile: { profile_id: 'p1', name: 'Ana' },
      is_active: true,
      can_delete: true,
      global_assets_affected: false,
    })
    expect(preview.counts).toMatchObject({
      lessons: 1, questions: 1, answers: 1, mistakes: 1, srs: 1,
      skill_events: 1, skill_profiles: 1, learner_evidence_v2: 1,
      learner_target_states_v2: 1, settings: 6,
    })
  })

  it('atomically deletes every V1/V2 record of one profile and preserves the other profile plus global data', async () => {
    const db = await seed()
    const result = await deleteProfileData('p1', { replacementProfileId: 'p2' })
    expect(result).toMatchObject({ deleted: true, profile_id: 'p1', replacement_profile_id: 'p2', global_assets_affected: false })

    const deleted = await profileRows(db, 'p1')
    expect(deleted.profile).toBeUndefined()
    for (const [name, rows] of Object.entries(deleted)) {
      if (name !== 'profile') expect(rows, name).toEqual([])
    }
    expect(await db.get('lessons', 'lesson-p1')).toBeUndefined()
    expect(await db.get('questions', 'lesson-p1:1')).toBeUndefined()

    expect(await db.get('profiles', 'p2')).toMatchObject({ name: 'Bia' })
    expect(await db.get('answers', 12)).toMatchObject({ profile_id: 'p2' })
    expect(await db.get('settings', 'study_session_v2:s2')).toBeTruthy()
    expect((await db.get('settings', 'active_profile')).value).toBe('p2')
    expect((await db.get('settings', 'theme')).value).toBe('dark')
    expect((await db.get('settings', 'content_pack_seed_marker')).value).toEqual({ version: 1 })
    expect(await db.get('lessons', 'shared')).toBeTruthy()
  })

  it('refuses to delete the final profile and leaves the database byte-for-byte intact', async () => {
    const db = await storage.__dbForTests()
    await db.put('profiles', { profile_id: 'only', name: 'Only', created_at: 1 })
    await db.put('settings', { key: 'active_profile', value: 'only' })
    await db.put('answers', { key: 1, profile_id: 'only', lesson_id: 'shared', question_id: 1 })
    const before = {
      profiles: await db.getAll('profiles'), answers: await db.getAll('answers'), settings: await db.getAll('settings'),
    }
    await expect(deleteProfileData('only', { replacementProfileId: 'missing' }))
      .rejects.toThrow(/PROFILE_DELETE_LAST_PROFILE_FORBIDDEN/)
    expect(await db.getAll('profiles')).toEqual(before.profiles)
    expect(await db.getAll('answers')).toEqual(before.answers)
    expect(await db.getAll('settings')).toEqual(before.settings)
  })

  it('aborts rather than orphaning a foreign answer that references a private lesson', async () => {
    const db = await seed()
    await db.put('answers', { key: 99, profile_id: 'p2', lesson_id: 'lesson-p1', question_id: 1 })
    await expect(deleteProfileData('p1', { replacementProfileId: 'p2' }))
      .rejects.toThrow(/PROFILE_DELETE_CROSS_PROFILE_LESSON_REFERENCE/)
    expect(await db.get('profiles', 'p1')).toBeTruthy()
    expect(await db.get('lessons', 'lesson-p1')).toBeTruthy()
    expect(await db.get('learner_evidence_v2', 'e1')).toBeTruthy()
  })

  it('exports, deletes and restores the complete profile without overwriting another profile', async () => {
    const db = await seed()
    const bundle = await exportProfileData('p1', { exportedAt: '2026-08-04T12:00:00.000Z' })
    expect(bundle).toMatchObject({
      profile_data_export_version: 1,
      app_db_version: 5,
      exported_at: '2026-08-04T12:00:00.000Z',
      profile: { profile_id: 'p1', name: 'Ana' },
      scope: { profile_scoped_records_only: true, global_settings_included: false },
    })
    expect(bundle.checksum).toMatch(/^[0-9a-f]{8}$/)

    await deleteProfileData('p1', { replacementProfileId: 'p2' })
    const restored = await importProfileData(bundle)
    expect(restored).toMatchObject({ imported: true, profile_id: 'p1' })
    expect(await db.get('profiles', 'p1')).toMatchObject({ name: 'Ana' })
    expect(await db.get('answers', 11)).toMatchObject({ profile_id: 'p1' })
    expect(await db.get('learner_evidence_v2', 'e1')).toMatchObject({ profile_id: 'p1' })
    expect(await db.get('settings', 'pending_submission_v2:i2')).toBeTruthy()
    expect(await db.get('profiles', 'p2')).toMatchObject({ name: 'Bia' })
    expect(await db.get('answers', 12)).toMatchObject({ profile_id: 'p2' })
    expect((await db.get('settings', 'active_profile')).value).toBe('p2')
  })

  it('rejects checksum changes and all key collisions without partial restore', async () => {
    const db = await seed()
    const bundle = await exportProfileData('p1')
    const tampered = structuredClone(bundle)
    tampered.profile.name = 'Altered'
    await expect(importProfileData(tampered)).rejects.toThrow(/CHECKSUM_MISMATCH/)

    await expect(importProfileData(bundle)).rejects.toThrow(/PROFILE_IMPORT_COLLISION:profiles:p1/)
    expect((await db.getAll('profiles')).map((row) => row.profile_id).sort()).toEqual(['p1', 'p2'])
    expect((await db.getAll('answers')).map((row) => row.key).sort()).toEqual([11, 12])
  })
})
