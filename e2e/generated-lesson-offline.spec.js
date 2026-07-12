// PARTE 14 — PWA offline contra o build de produção (service worker real).
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  answerCurrentQuestion, goNext, readStore, attachErrorMonitor, GEN_SEED, PROFILE_A,
} from './helpers.js'

test('app shell, generated lesson, answers and voice fallbacks all work offline', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  // Wait for the service worker to be active and controlling the page.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready
    return !!reg.active && !!navigator.serviceWorker.controller
  }, null, { timeout: 60_000 })

  // Online: generate a 10-question lesson, answer one question, go Home.
  const lessonId = await generateFromHome(page, { count: 10 })
  const { questions } = await readLessonWithQuestions(page, lessonId)
  expect(questions).toHaveLength(10)
  await page.getByTestId('start-generated-lesson').click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  await answerCurrentQuestion(page, questions[0])
  await goNext(page)
  await page.getByRole('button', { name: 'Sair da aula' }).click()
  await expect(page.getByText('Gerar nova aula adaptativa')).toBeVisible()

  // Go offline and RELOAD — the shell must come from the service worker.
  await context.setOffline(true)
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db, null, { timeout: 60_000 })
  await expect(page.getByText('Gerar nova aula adaptativa')).toBeVisible()
  // Profile still active, generated lesson still listed.
  await expect(page.getByText('Perfil A').first()).toBeVisible()
  await expect(page.getByText('Adaptive Workplace English').first()).toBeVisible()
  await testInfo.attach('offline-home', { body: await page.screenshot(), contentType: 'image/png' })

  // Open the lesson fully offline and answer every question, including the
  // audio (listen_type) and speech (speak_sentence) ones via their fallbacks.
  const answersBefore = (await readStore(page, 'answers')).length
  await page.getByText('Adaptive Workplace English').first().click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  for (let i = 0; i < questions.length; i++) {
    await answerCurrentQuestion(page, questions[i])
    await expect(page.getByTestId('feedback-sheet')).toHaveAttribute('data-verdict', 'correct')
    await goNext(page)
  }
  await expect(page.getByText('Resultado')).toBeVisible()
  await testInfo.attach('offline-result', { body: await page.screenshot(), contentType: 'image/png' })

  // Answers persisted locally while offline.
  const answersOffline = (await readStore(page, 'answers')).length
  expect(answersOffline).toBe(answersBefore + questions.length)

  // Reload still offline: everything is still there.
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db, null, { timeout: 60_000 })
  await expect(page.getByText('Adaptive Workplace English').first()).toBeVisible()
  expect((await readStore(page, 'answers')).length).toBe(answersOffline)
  const persisted = await readLessonWithQuestions(page, lessonId)
  expect(persisted.questions).toHaveLength(10)

  // Back online: local data remains.
  await context.setOffline(false)
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  await expect(page.getByText('Adaptive Workplace English').first()).toBeVisible()
  expect((await readStore(page, 'answers')).length).toBe(answersOffline)

  monitor.assertClean()
})
