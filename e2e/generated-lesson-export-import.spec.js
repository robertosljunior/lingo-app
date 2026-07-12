// PARTE 12 — exportação YAML da aula gerada e reimportação pelo fluxo real.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import yaml from 'js-yaml'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  answerCurrentQuestion, switchProfileViaUi, attachErrorMonitor, readStore,
  GEN_SEED, PROFILE_A, SEVEN_TYPES,
} from './helpers.js'

test('exported YAML round-trips through the import flow without private metadata', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  const lessonId = await generateFromHome(page, { count: 30 })

  // Export through the real UI (browser download).
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-generated-yaml').click(),
  ])
  const file = await download.path()
  const text = fs.readFileSync(file, 'utf8')

  // Parse with a real YAML parser and validate the compact contract.
  const doc = yaml.load(text)
  expect(doc.lesson_id).toBe(lessonId)
  expect(doc.level).toBe('B1')
  expect(doc.q).toHaveLength(30)
  const types = new Set(doc.q.map((q) => q.t))
  for (const t of SEVEN_TYPES) expect(types.has(t), `type ${t} missing from YAML`).toBe(true)
  for (const q of doc.q) {
    expect(q.f, `q${q.id} missing f`).toBeTruthy()
    if (q.t !== 'build_sentence') expect(q.a, `q${q.id} missing a`).toBeTruthy()
    if (q.t === 'fill_blank') expect(Array.isArray(q.opt)).toBe(true)
    if (q.t === 'choose_best') expect(Array.isArray(q.opt)).toBe(true)
    if (q.t === 'build_sentence') expect(Array.isArray(q.words)).toBe(true)
    if (q.t === 'rewrite_natural') expect(q.original).toBeTruthy()
    if (q.t === 'listen_type' || q.t === 'speak_sentence') {
      expect(q.pt, `q${q.id} (${q.t}) missing pt`).toBeTruthy()
      expect(q.a, `q${q.id} (${q.t}) missing a`).toBeTruthy()
    }
  }
  // Round-trip security: no private/internal metadata in the compact YAML.
  for (const needle of ['profile_id', 'owner_profile_id', 'owner_scope_hash', 'generation_metadata', 'mastery', 'skill_events', 'answered_at']) {
    expect(text.includes(needle), `private metadata "${needle}" leaked into YAML`).toBe(false)
  }

  // Reimport through the real import flow.
  await page.getByText('Importar aula', { exact: true }).first().click()
  await page.locator('textarea.input').fill(text)
  await page.getByRole('button', { name: 'Validar' }).click()
  await expect(page.getByText('Aula válida')).toBeVisible()
  await expect(page.getByText('30 perguntas')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar e iniciar' }).click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  await testInfo.attach('imported-lesson-started', { body: await page.screenshot(), contentType: 'image/png' })

  // Slice 5 import contract: the private original is never overwritten. The
  // import lands under a new identity (import_<level>_<hash>) as a global
  // lesson pointing back at the source lesson id.
  const { lesson: original, questions: originalQuestions } = await readLessonWithQuestions(page, lessonId)
  expect(original).toBeTruthy()
  expect(original.owner_profile_id).toBe(PROFILE_A)
  expect(original.generated).toBe(true)
  expect(originalQuestions).toHaveLength(30)
  const importedLesson = (await readStore(page, 'lessons')).find((l) => l.source_lesson_id === lessonId)
  expect(importedLesson).toBeTruthy()
  expect(importedLesson.lesson_id).toMatch(/^import_b1_[0-9a-f]{8}$/)
  expect(importedLesson.owner_profile_id).toBeNull()
  expect(importedLesson.imported).toBe(true)
  const { questions } = await readLessonWithQuestions(page, importedLesson.lesson_id)
  expect(questions).toHaveLength(30)

  // Answer at least one question of the imported lesson.
  await answerCurrentQuestion(page, questions[0])
  await expect(page.getByTestId('feedback-sheet')).toHaveAttribute('data-verdict', 'correct')
  // Leaving the exercise returns to the Import screen (it is the previous
  // screen on the nav stack); close it to get back Home.
  await page.getByRole('button', { name: 'Sair da aula' }).click()
  await page.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByText('Gerar nova aula adaptativa')).toBeVisible()

  // Profile B sees only the imported global copy; the private original stays
  // out of reach.
  await switchProfileViaUi(page, 'Perfil B')
  await expect(page.getByText('Adaptive Workplace English').first()).toBeVisible()
  const accessibleToB = await page.evaluate(async (importId) => {
    const l = await window.__e2e.db.getLesson(importId, { profile_id: 'profile-b' })
    return { questions: l.questions.length }
  }, importedLesson.lesson_id)
  expect(accessibleToB.questions).toBe(30)
  const privateRefused = await page.evaluate(async (lessonId) => {
    try { await window.__e2e.db.getLesson(lessonId, { profile_id: 'profile-b' }); return 'leaked' }
    catch (e) { return e?.code || 'error' }
  }, lessonId)
  expect(privateRefused).toBe('LESSON_NOT_ACCESSIBLE')

  monitor.assertClean()
})
