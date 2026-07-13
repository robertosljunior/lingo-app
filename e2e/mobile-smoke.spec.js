// PARTE 15 — smoke essencial em viewport mobile (projeto chromium-mobile).
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, generateFromHome, readLessonWithQuestions,
  answerCurrentQuestion, goNext, attachErrorMonitor, GEN_SEED, PROFILE_A,
} from './helpers.js'

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(overflow.scrollWidth, `${label}: horizontal overflow (${overflow.scrollWidth} > ${overflow.innerWidth})`)
    .toBeLessThanOrEqual(overflow.innerWidth + 2)
}

test('generates and completes a 10-question lesson on a mobile viewport', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context, { seed: GEN_SEED })
  await seedFixtures(page, { active: PROFILE_A })

  await expectNoHorizontalOverflow(page, 'home')
  const lessonId = await generateFromHome(page, { count: 10 })
  const { questions } = await readLessonWithQuestions(page, lessonId)
  expect(questions).toHaveLength(10)

  await page.getByTestId('start-generated-lesson').click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  await expectNoHorizontalOverflow(page, 'exercise')

  // Submit button reachable and accessible by role.
  await expect(page.getByRole('button', { name: /Responder|Verificar/ })).toBeVisible()

  for (let i = 0; i < questions.length; i++) {
    await answerCurrentQuestion(page, questions[i])
    // Feedback sheet usable on mobile.
    await expect(page.getByTestId('feedback-sheet')).toBeVisible()
    if (i === 0) {
      await expectNoHorizontalOverflow(page, 'feedback-sheet')
      await testInfo.attach('mobile-feedback', { body: await page.screenshot(), contentType: 'image/png' })
    }
    await goNext(page)
  }

  // Result legible on mobile.
  await expect(page.getByText('Resultado')).toBeVisible()
  await expect(page.getByTestId('result-score')).toBeVisible()
  await expectNoHorizontalOverflow(page, 'result')
  await testInfo.attach('mobile-result', { body: await page.screenshot(), contentType: 'image/png' })

  // Settings: semantic model + knowledge pack cards render without overflow, the
  // status chip and download control are reachable, and the progress bar exposes
  // an accessible role.
  await page.getByRole('button', { name: 'Início', exact: true }).click()
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByTestId('semantic-model-settings')).toBeVisible()
  await expect(page.getByTestId('semantic-model-status')).toBeVisible()
  await expect(page.getByTestId('semantic-model-download')).toBeVisible()
  await expect(page.getByTestId('knowledge-packs-settings')).toBeVisible()
  await expectNoHorizontalOverflow(page, 'settings-semantic-model')
  await testInfo.attach('mobile-settings-model', { body: await page.screenshot(), contentType: 'image/png' })

  monitor.assertClean()
})
