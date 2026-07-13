// SLICE 7.5 — real PT→EN translation in the live UI. The exercise shows a
// Portuguese source, never the English answer before submit, grades the English
// answer on submit, and advances to Result.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  answerCurrentQuestion, goNext, attachErrorMonitor, PROFILE_A,
} from './helpers.js'
import { questionLanguageIssues } from '../src/lib/generated-lesson-contracts.js'

test('translate_natural shows a Portuguese source, hides the English answer, and grades on submit', async ({ page, context }) => {
  test.setTimeout(120_000)
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  const lessonId = await generateFromHome(page, { count: 30 })
  const { questions } = await readLessonWithQuestions(page, lessonId)
  const tIdx = questions.findIndex((q) => q.type === 'translate_natural')
  expect(tIdx, 'a translate_natural question exists').toBeGreaterThanOrEqual(0)
  const tq = questions[tIdx]

  // Real Portuguese source of truth, not a guided fallback, no English echo.
  expect(tq.prompt_pt).toMatch(/[áàâãéêíóôõúçÁ-Úa-z]/)
  expect(tq.prompt_pt).not.toMatch(/^Escreva em inglês/) // not the guided fallback
  expect(String(tq.prompt || '')).toContain('Traduza para o inglês')
  expect(questionLanguageIssues(tq)).toEqual([])

  await page.getByTestId('start-generated-lesson').click()
  await expect(page.getByTestId('question-type')).toBeVisible()

  // Answer everything up to the translate question correctly.
  for (let i = 0; i < tIdx; i++) { await answerCurrentQuestion(page, questions[i]); await goNext(page) }

  await expect(page.getByTestId('question-type')).toHaveText('translate_natural')
  // The Portuguese source is on screen; the English answer is not.
  const visible = (await page.locator('.screen-body').innerText()).toLowerCase()
  const answer = String(tq.expected_answer).toLowerCase().replace(/[.?!]$/, '')
  expect(visible.includes(answer), 'English answer must be hidden before submit').toBe(false)

  // Submit the correct English answer → graded correct → advance.
  await answerCurrentQuestion(page, tq)
  await expect(page.getByTestId('feedback-sheet')).toHaveAttribute('data-verdict', 'correct')
  await goNext(page)
  await expect(page.getByText(`${tIdx + 2}/30`)).toBeVisible()

  // Finish the lesson to Result.
  for (let i = tIdx + 1; i < questions.length; i++) { await answerCurrentQuestion(page, questions[i]); await goNext(page) }
  await expect(page.getByText('Resultado')).toBeVisible({ timeout: 15_000 })
  monitor.assertClean()
})

test('accepted English contraction variant is graded correct', async ({ page, context }) => {
  test.setTimeout(120_000)
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  const lessonId = await generateFromHome(page, { count: 30 })
  const { questions } = await readLessonWithQuestions(page, lessonId)
  // A translate question whose answer has an accepted contraction variant.
  const tIdx = questions.findIndex((q) => q.type === 'translate_natural' && (q.accepted_answers || q.alt || []).length > 0)
  test.skip(tIdx < 0, 'no translate question with a contraction variant in this seed')
  const tq = questions[tIdx]
  const variant = (tq.accepted_answers || tq.alt)[0]

  await page.getByTestId('start-generated-lesson').click()
  for (let i = 0; i < tIdx; i++) { await answerCurrentQuestion(page, questions[i]); await goNext(page) }
  await expect(page.getByTestId('question-type')).toHaveText('translate_natural')
  await page.locator('textarea.input').fill(variant)
  await page.getByRole('button', { name: /Responder/ }).click()
  await expect(page.getByTestId('feedback-sheet')).toHaveAttribute('data-verdict', 'correct')
  monitor.assertClean()
})
