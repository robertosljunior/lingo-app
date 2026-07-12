// PARTE 7 — feedback NLP real com erro principal + secundário visíveis.
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, readStore, PROFILE_A } from './helpers.js'

const FIXTURE_LESSON = `lesson_id: e2e_nlp_001
level: B1
focus: gerund_after_been
q:
  - id: 1
    t: translate_natural
    pt: Trabalho nesta empresa há três anos.
    p: Diga isso naturalmente em inglês.
    a: I've been working at this company for three years.
    f: gerund_after_been
`

const USER_ANSWER = "I've been worked in this company for three years."

test('shows verb_form/gerund_after_been as primary and in→at as secondary, never missing_auxiliary', async ({ page, context }, testInfo) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  // Import the known fixture lesson through the real import flow.
  await page.getByText('Importar aula', { exact: true }).first().click()
  await page.locator('textarea.input').fill(FIXTURE_LESSON)
  await page.getByRole('button', { name: 'Validar' }).click()
  await expect(page.getByText('Aula válida')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar e iniciar' }).click()
  await expect(page.getByTestId('question-type')).toHaveText('translate_natural')

  await page.locator('textarea.input').fill(USER_ANSWER)
  await page.getByRole('button', { name: /Responder/ }).click()
  await expect(page.getByTestId('feedback-sheet')).toBeVisible()

  // Primary error: verb_form / gerund_after_been with worked → working.
  const primary = page.getByTestId('error-primary')
  await expect(primary).toBeVisible()
  await expect(primary).toHaveAttribute('data-error-category', 'verb_form')
  await expect(primary).toHaveAttribute('data-error-subtype', 'gerund_after_been')
  await expect(primary).toContainText('worked')
  await expect(primary).toContainText('working')

  // Secondary error: preposition in → at.
  const secondary = page.getByTestId('error-secondary')
  await expect(secondary).toHaveCount(1)
  await expect(secondary).toHaveAttribute('data-error-category', 'preposition')
  await expect(secondary).toContainText('at')

  // No missing_auxiliary anywhere in the sheet.
  await expect(page.locator('[data-error-subtype="missing_auxiliary"]')).toHaveCount(0)
  await expect(page.getByTestId('feedback-sheet')).not.toContainText('missing_auxiliary')

  // Primary is rendered before the secondary.
  const order = await page.locator('[data-testid^="error-"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-testid')),
  )
  expect(order[0]).toBe('error-primary')
  expect(order.indexOf('error-secondary')).toBeGreaterThan(0)

  await testInfo.attach('nlp-feedback-multi-error', { body: await page.screenshot(), contentType: 'image/png' })

  // Review keeps both errors visible (session flow).
  await page.getByTestId('feedback-sheet').getByRole('button', { name: /Próxima/ }).click()
  await expect(page.getByText('Resultado')).toBeVisible()
  await page.getByRole('button', { name: /Revisar 1 erro/ }).click()
  await expect(page.locator('.chip-error')).toContainText('verb_form')
  await expect(page.getByText('Depois de "have been", use o verbo com -ing.')).toBeVisible()
  await testInfo.attach('nlp-review', { body: await page.screenshot(), contentType: 'image/png' })

  // Reload: the persisted answer still carries both errors, in order.
  await page.reload()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  const answers = (await readStore(page, 'answers')).filter((a) => a.lesson_id === 'e2e_nlp_001')
  expect(answers).toHaveLength(1)
  const errors = answers[0].evaluation.detected_errors
  expect(errors.length).toBe(2)
  expect(errors[0].category).toBe('verb_form')
  expect(errors[0].subtype).toBe('gerund_after_been')
  expect(errors[0].role).toBe('primary')
  expect(errors[0].actual).toBe('worked')
  expect(errors[0].expected).toBe('working')
  expect(errors[1].category).toBe('preposition')
  expect(errors[1].actual).toBe('in')
  expect(errors[1].expected).toBe('at')
  expect(errors.some((e) => e.subtype === 'missing_auxiliary')).toBe(false)

  monitor.assertClean()
})
