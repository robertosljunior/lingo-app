// PARTE 9 — isolamento integral entre perfis: listagem, acesso direto por ID,
// exportação, exclusão, restauração de sessão e planner.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  readStore, switchProfileViaUi, attachErrorMonitor, GEN_SEED, PROFILE_A, PROFILE_B,
} from './helpers.js'

test('profile B cannot list, open, export, delete or restore profile A private lesson', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  // A generates a private lesson and starts an adaptive session (persisted).
  const lessonId = await generateFromHome(page, { count: 30 })
  const { lesson } = await readLessonWithQuestions(page, lessonId)
  expect(lesson.owner_profile_id).toBe(PROFILE_A)
  const lessonTitle = 'Adaptive Workplace English'

  await page.getByText('Prática adaptativa', { exact: true }).first().click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  const sessionA = await page.evaluate(() => window.__e2e.db.getPersistedAdaptiveSession('profile-a'))
  expect(sessionA?.session?.profile_id).toBe(PROFILE_A)
  await page.getByRole('button', { name: 'Sair da aula' }).click()

  // Switch to B through the real UI.
  await switchProfileViaUi(page, 'Perfil B')

  // Listing: A's lesson does not appear for B (UI + public layer).
  await expect(page.getByText(lessonTitle)).toHaveCount(0)
  const listedForB = await page.evaluate(() => window.__e2e.db.getAllLessons('profile-b'))
  expect(listedForB.some((l) => l.lesson_id === lessonId)).toBe(false)

  // Session restoration: reload as B must not restore A's adaptive session.
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  await expect(page.getByTestId('question-type')).toHaveCount(0)
  await expect(page.getByText('Bem-vindo', { exact: false }).first()).toBeVisible()
  const sessionB = await page.evaluate(() => window.__e2e.db.getPersistedAdaptiveSession('profile-b'))
  expect(sessionB).toBeNull()

  // Explicit profile scope is refused by the public storage layer used by the UI.
  const scoped = await page.evaluate(async (lessonId) => {
    try { await window.__e2e.db.getLesson(lessonId, { profile_id: 'profile-b' }); return { ok: true } }
    catch (e) { return { ok: false, code: e?.code || null } }
  }, lessonId)
  expect(scoped).toEqual({ ok: false, code: 'LESSON_NOT_ACCESSIBLE' })
  // The Exercise screen never opened and no private content leaked to the DOM.
  await expect(page.getByTestId('question-type')).toHaveCount(0)
  await expect(page.getByText(lessonTitle)).toHaveCount(0)
  await testInfo.attach('profile-b-blocked', { body: await page.screenshot(), contentType: 'image/png' })

  // Export as B: blocked before any YAML can be produced.
  const exportAttempt = await page.evaluate(async (lessonId) => {
    try {
      const lesson = await window.__e2e.db.getLesson(lessonId, { profile_id: 'profile-b' })
      return { ok: true, yaml: lesson?.raw_content?.slice(0, 40) || null }
    } catch (e) {
      return { ok: false, code: e?.code || null, keys: Object.keys(e || {}) }
    }
  }, lessonId)
  expect(exportAttempt.ok).toBe(false)
  expect(exportAttempt.code).toBe('LESSON_NOT_ACCESSIBLE')
  expect(exportAttempt.yaml).toBeUndefined()


  // Planner as B: no question from A's private lesson is ever selected.
  const planB = await page.evaluate(() => window.__e2e.db.getAdaptivePracticePlan('profile-b', { requestedSize: 10 }))
  expect(planB.selected_questions.length).toBeGreaterThan(0)
  expect(planB.selected_questions.some((q) => q.lesson_id === lessonId)).toBe(false)

  // Back to A: the lesson is intact, opens, exports and can be deleted by its owner.
  await switchProfileViaUi(page, 'Perfil A')
  await expect(page.getByText(lessonTitle).first()).toBeVisible()
  const asOwner = await page.evaluate(async (lessonId) => {
    const lesson = await window.__e2e.db.getLesson(lessonId)
    return { title: lesson.title, questions: lesson.questions.length, hasYaml: !!lesson.raw_content }
  }, lessonId)
  expect(asOwner.questions).toBe(30)
  expect(asOwner.hasYaml).toBe(true)
  await testInfo.attach('profile-a-restored', { body: await page.screenshot(), contentType: 'image/png' })

  await page.evaluate((lessonId) => window.__e2e.db.deleteLesson(lessonId), lessonId)
  const gone = await readLessonWithQuestions(page, lessonId)
  expect(gone.lesson).toBeNull()
  expect(gone.questions).toHaveLength(0)

  monitor.assertClean()
})
