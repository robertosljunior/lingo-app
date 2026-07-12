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

  // Produção mostra feedback pedagógico, sem atributos/códigos técnicos no DOM.
  const sheet = page.getByTestId('feedback-sheet')
  await expect(sheet).toContainText('have been')
  await expect(sheet).toContainText('worked')
  await expect(sheet).toContainText('working')
  await expect(sheet).toContainText('at')
  await expect(sheet).not.toContainText('missing_auxiliary')
  await expect(sheet).not.toContainText('rule_id')
  await expect(sheet).not.toContainText('confidence')
  await expect(sheet).not.toContainText('medium')
  await expect(page.locator('[data-error-subtype="missing_auxiliary"]')).toHaveCount(0)

  const comparison = page.getByTestId('feedback-comparison')
  await expect(comparison).toContainText(USER_ANSWER)
  await expect(comparison).toContainText("I've been working at this company for three years.")

  // Review keeps both errors visible (session flow).
  await page.getByTestId('feedback-sheet').getByRole('button', { name: /Próxima/ }).click()
  await expect(page.getByText('Resultado')).toBeVisible()
  await page.getByRole('button', { name: /Revisar 1 erro/ }).click()
  await expect(page.locator('.chip-error')).toContainText('verb_form')
  await expect(page.getByText('Depois de "have been", use o verbo com -ing.')).toBeVisible()
  await testInfo.attach('nlp-review', { body: await page.screenshot(), contentType: 'image/png' })

  // Persistência básica: uma resposta foi registrada no fluxo real antes da revisão.
  const answers = await readStore(page, 'answers')
  expect(answers.length).toBeGreaterThan(0)

  monitor.assertClean()
})
