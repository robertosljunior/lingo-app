import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, readStore, PROFILE_A, PROFILE_B } from './helpers.js'
import { setLearnerFlag } from './v2-helpers.js'

async function openV2Settings(page, context) {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByTestId('v2-settings')).toBeVisible()
}

async function seedProfileOwnedFacts(page) {
  await page.evaluate(async ({ profileId }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('app-idiomas')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const put = (storeName, value) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).put(value)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    await put('lessons', { lesson_id: 'rx5-private', title: 'Private', owner_profile_id: profileId, created_at: 1 })
    await put('questions', { key: 'rx5-private:1', lesson_id: 'rx5-private', id: 1, owner_profile_id: profileId })
    await put('answers', { key: 501, profile_id: profileId, lesson_id: 'rx5-private', question_id: 1, session_id: 'rx5-v1' })
    await put('learner_evidence_v2', {
      evidence_id: 'rx5-evidence', profile_id: profileId, interaction_id: 'rx5-interaction',
      session_id: 'rx5-lesson-session', exemplar_id: 'exemplar:still.001',
      target: { target_type: 'sense', target_id: 'sense:still.continuity' },
      occurred_at: '2026-08-04T12:00:00.000Z',
    })
    await put('learner_target_states_v2', {
      key: `${profileId}:sense:sense:still.continuity`, profile_id: profileId,
      target: { target_type: 'sense', target_id: 'sense:still.continuity' },
    })
    await put('settings', {
      key: 'study_session_v2:rx5-session',
      value: { study_session_id: 'rx5-session', profile_id: profileId, status: 'complete' },
    })
    await put('settings', {
      key: 'learner_interaction_v2:rx5-interaction',
      value: { interaction_id: 'rx5-interaction', study_session_id: 'rx5-session', profile_id: profileId },
    })
    await put('settings', { key: 'theme', value: 'dark' })
    db.close()
  }, { profileId: PROFILE_A })
}

test('V2 Settings exports, hard-deletes and collision-safely restores one profile', async ({ page, context }) => {
  await openV2Settings(page, context)
  await seedProfileOwnedFacts(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('v2-export-profile').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^aprendaidioma-perfil-a-\d{4}-\d{2}-\d{2}\.json$/)
  const exportPath = await download.path()
  expect(exportPath).toBeTruthy()
  await expect(page.getByTestId('v2-data-message')).toContainText('Arquivo criado')

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('prompt')
    expect(dialog.message()).toContain('todos os seus registros')
    await dialog.accept('Perfil A')
  })
  await page.getByTestId('v2-delete-profile').click()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => window.__e2e?.db)
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  const profilesAfterDelete = await readStore(page, 'profiles')
  const profileIdsAfterDelete = profilesAfterDelete.map((row) => row.profile_id)
  expect(profileIdsAfterDelete).not.toContain(PROFILE_A)
  expect(profileIdsAfterDelete).toContain(PROFILE_B)
  expect((await readStore(page, 'answers')).some((row) => row.profile_id === PROFILE_A)).toBe(false)
  expect((await readStore(page, 'learner_evidence_v2')).some((row) => row.profile_id === PROFILE_A)).toBe(false)
  expect((await readStore(page, 'lessons')).some((row) => row.lesson_id === 'rx5-private')).toBe(false)
  const settingsAfterDelete = await readStore(page, 'settings')
  expect(settingsAfterDelete.find((row) => row.key === 'active_profile')?.value).toBe(PROFILE_B)
  expect(settingsAfterDelete.find((row) => row.key === 'theme')?.value).toBe('dark')
  expect(settingsAfterDelete.some((row) => row.value?.profile_id === PROFILE_A)).toBe(false)

  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Ajustes' }).click()
  await page.getByTestId('v2-import-profile-input').setInputFiles(exportPath)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => window.__e2e?.db)
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  const profilesAfterRestore = await readStore(page, 'profiles')
  const restoredIds = profilesAfterRestore.map((row) => row.profile_id)
  for (const existingId of profileIdsAfterDelete) expect(restoredIds).toContain(existingId)
  expect(restoredIds).toContain(PROFILE_A)
  expect(restoredIds).toContain(PROFILE_B)
  expect(restoredIds.filter((id) => id === PROFILE_A)).toHaveLength(1)
  expect(restoredIds.filter((id) => id === PROFILE_B)).toHaveLength(1)
  expect((await readStore(page, 'answers')).some((row) => row.key === 501 && row.profile_id === PROFILE_A)).toBe(true)
  expect((await readStore(page, 'learner_evidence_v2')).some((row) => row.evidence_id === 'rx5-evidence')).toBe(true)
  expect((await readStore(page, 'lessons')).some((row) => row.lesson_id === 'rx5-private')).toBe(true)
  expect((await readStore(page, 'settings')).find((row) => row.key === 'active_profile')?.value).toBe(PROFILE_A)

  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Ajustes' }).click()
  await page.getByTestId('v2-import-profile-input').setInputFiles(exportPath)
  await expect(page.getByTestId('v2-data-message')).toContainText('Nada foi alterado')
  await expect(page.getByTestId('v2-data-message')).toContainText('PROFILE_IMPORT_COLLISION')
  expect((await readStore(page, 'profiles')).filter((row) => row.profile_id === PROFILE_A)).toHaveLength(1)
})
