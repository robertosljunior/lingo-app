import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'

const LESSON = `lesson_id: e2e_scroll_visual_001
level: B1
focus: gerund_after_been
q:
  - id: 1
    t: translate_natural
    pt: Trabalho nesta empresa há três anos.
    p: Diga isso naturalmente em inglês.
    a: I've been working at this company for three years.
    f: gerund_after_been
  - id: 2
    t: translate_natural
    pt: Você já terminou o relatório?
    p: Diga isso naturalmente em inglês.
    a: Have you finished the report yet?
    f: word_order
`

async function importLesson(page) {
  await page.getByText('Importar aula', { exact: true }).first().click()
  await page.locator('textarea.input').fill(LESSON)
  await page.getByRole('button', { name: 'Validar' }).click()
  await expect(page.getByText('Aula válida')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar e iniciar' }).click()
}

async function answerWrong(page, text) {
  const ta = page.locator('textarea.input')
  await ta.fill(text)
  await expect(ta).toHaveValue(text)
  const submit = page.getByRole('button', { name: /Responder/ })
  // Wait for the controlled state to register (the button enables only when
  // `user` is non-empty) before clicking — avoids a rare fill→enable race.
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByTestId('feedback-sheet')).toBeVisible()
}

test('feedback opens at top, uses one scroll region, keeps sticky actions accessible and avoids duplicate comparison', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await importLesson(page)

  await answerWrong(page, "I've been worked in this company for three years.")
  const scroll = page.getByTestId('feedback-scroll')
  await expect.poll(() => scroll.evaluate((el) => Math.abs(el.scrollTop))).toBeLessThan(4)
  await expect(page.getByTestId('feedback-title')).toBeInViewport()
  await expect(page.getByTestId('feedback-explanation-card')).toBeInViewport()
  await expect(page.getByTestId('feedback-comparison')).toHaveCount(1)
  await expect(page.getByText(/^esperado$/i)).toHaveCount(0)
  await expect(page.getByText(/^você$/i)).toHaveCount(0)

  await scroll.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect(page.getByRole('button', { name: /Próxima/ })).toBeInViewport()
  await expect(page.getByRole('button', { name: /Tentar de novo/ })).toBeInViewport()
  await expect(page.getByRole('button', { name: /Tentar de novo/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /Próxima/ })).toBeEnabled()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
  expect(overflow).toBe(true)
  await testInfo.attach('feedback-desktop-after', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  await page.getByRole('button', { name: /Próxima/ }).click()
  await answerWrong(page, 'Report you have finished the yet')
  await expect.poll(() => scroll.evaluate((el) => Math.abs(el.scrollTop))).toBeLessThan(4)
  await expect(page.getByTestId('feedback-title')).toBeInViewport()
  await testInfo.attach('feedback-word-order-after', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  monitor.assertClean()
})

test('feedback mobile viewport has no horizontal overflow and visible correct answer contrast', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await importLesson(page)
  await answerWrong(page, "I've been worked in this company for three years.")

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true)
  await expect(page.getByTestId('feedback-title')).toBeInViewport()
  const contrastProbe = await page.locator('.feedback-answer.correct .feedback-answer-text').evaluate((el) => {
    const text = getComputedStyle(el).color
    const bg = getComputedStyle(el.closest('.feedback-answer')).backgroundColor
    return { text, bg, different: text !== bg }
  })
  expect(contrastProbe.different).toBe(true)
  await testInfo.attach('feedback-mobile-after', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})
