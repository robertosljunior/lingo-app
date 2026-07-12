// PARTE 6 — execução dos sete tipos de exercício pela UI até o Result.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  answerCurrentQuestion, goNext, attachErrorMonitor, readStore,
  GEN_SEED, PROFILE_A, SEVEN_TYPES,
} from './helpers.js'

test('runs all seven exercise types through the UI and lands on a persisted Result', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  const lessonId = await generateFromHome(page, { count: 30 })
  const { questions } = await readLessonWithQuestions(page, lessonId)
  expect(questions).toHaveLength(30)

  await page.getByTestId('start-generated-lesson').click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  await testInfo.attach('exercise-open', { body: await page.screenshot(), contentType: 'image/png' })

  const seen = new Set()
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    await expect(page.getByText(`${i + 1}/30`)).toBeVisible()
    await answerCurrentQuestion(page, q)
    seen.add(q.type)
    await expect(page.getByTestId('feedback-sheet')).toHaveAttribute('data-verdict', 'correct')
    if (i === 0) await testInfo.attach('exercise-feedback', { body: await page.screenshot(), contentType: 'image/png' })
    await goNext(page)
  }
  for (const t of SEVEN_TYPES) expect(seen.has(t), `type ${t} never exercised`).toBe(true)

  // Result screen: score, question count, practiced skills.
  await expect(page.getByText('Resultado')).toBeVisible()
  await expect(page.getByTestId('result-score')).toContainText('100')
  await expect(page.getByText('acertos')).toBeVisible()
  await expect(page.getByText('habilidades da aula')).toBeVisible()
  await expect(page.getByText('demonstradas')).toBeVisible()
  await testInfo.attach('result', { body: await page.screenshot(), contentType: 'image/png' })

  // Completion persisted: 30 answers in the same session, skill events written.
  const answers = (await readStore(page, 'answers')).filter((a) => a.lesson_id === lessonId)
  expect(answers).toHaveLength(30)
  const sessionIds = new Set(answers.map((a) => a.session_id))
  expect(sessionIds.size).toBe(1)
  expect(answers.every((a) => a.profile_id === PROFILE_A)).toBe(true)
  expect(answers.every((a) => a.verdict === 'correct')).toBe(true)
  const events = (await readStore(page, 'skill_events')).filter((e) => e.profile_id === PROFILE_A)
  expect(events.length).toBeGreaterThan(0)

  // Reload: result/answers survive (History lists the finished session).
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  const answersAfter = (await readStore(page, 'answers')).filter((a) => a.lesson_id === lessonId)
  expect(answersAfter).toHaveLength(30)
  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByText('30 q')).toBeVisible()

  monitor.assertClean()
})
