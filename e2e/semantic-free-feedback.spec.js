import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'

// Free-production questions (answer_question → free mode) route through the local
// semantic tutor pipeline: real Harper + structural NLP + knowledge packs. This
// spec asserts the two headline behaviors:
//   1. A valid free sentence is NOT failed and never shows the model answer.
//   2. A real agreement error yields a corrected version derived from the
//      learner's own sentence (still no model-answer comparison).
const LESSON = `lesson_id: e2e_semantic_free_001
level: A1
focus: free_production
q:
  - id: 1
    t: answer_question
    pt: Peça uma sobremesa em um restaurante.
    p: Escreva um pedido educado em inglês.
    a: Could I have a dessert, please?
    f: request
  - id: 2
    t: answer_question
    pt: Fale sobre a rotina dele.
    p: Escreva uma frase no presente simples.
    a: He goes to work every day.
    f: subject_verb_agreement
`

async function importLesson(page) {
  await page.getByText('Importar aula', { exact: true }).first().click()
  await page.locator('textarea.input').fill(LESSON)
  await page.getByRole('button', { name: 'Validar' }).click()
  await expect(page.getByText('Aula válida')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar e iniciar' }).click()
}

async function answer(page, text) {
  await page.locator('textarea.input').fill(text)
  await page.getByRole('button', { name: /Responder/ }).click()
  await expect(page.getByTestId('feedback-sheet')).toBeVisible({ timeout: 60000 })
}

test('free production: valid sentence is not failed and hides the model answer', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await importLesson(page)

  await answer(page, 'Please give me a dessert.')

  // The semantic feedback block is shown; the model-answer comparison is not.
  await expect(page.getByTestId('feedback-semantic')).toBeVisible()
  await expect(page.getByTestId('feedback-comparison')).toHaveCount(0)
  // A valid free sentence is not a total failure.
  await expect(page.getByTestId('feedback-sheet')).not.toHaveAttribute('data-verdict', 'incorrect')
  // Intent-preserving alternatives are offered; the hidden model answer is never
  // presented as "the correct form".
  await expect(page.getByTestId('feedback-alternatives')).toContainText('Could I have a dessert, please?')

  monitor.assertNoErrors?.()
})

test('free production: a real agreement error yields a corrected version, not a model answer', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await importLesson(page)

  // Skip to Q2 by answering Q1 first, then advancing.
  await answer(page, 'Please give me a dessert.')
  await page.getByRole('button', { name: /Próxima/ }).click()

  await answer(page, 'He go to work every day.')
  await expect(page.getByTestId('feedback-corrected')).toContainText('He goes to work every day.')
  await expect(page.getByTestId('feedback-comparison')).toHaveCount(0)
})
