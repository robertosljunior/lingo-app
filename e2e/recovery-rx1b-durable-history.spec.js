import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, waitForAdvance } from './v2-helpers.js'

const currentRecipe = (page) => page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')

async function reachRecognition(page) {
  for (let i = 0; i < 8; i++) {
    const recipe = await currentRecipe(page)
    if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) return recipe
    if (recipe !== 'exposure') throw new Error(`Unexpected first-contact recipe before recognition: ${recipe}`)
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  throw new Error('Recognition was not reached from a fresh V2 learner')
}

async function chooseWrongAuthoredOption(page) {
  const correct = await page.evaluate(() => window.__e2e?.v2Activity?.correct_option_id ?? null)
  expect(correct).toBeTruthy()
  const testIds = await page.locator('[data-testid^="v2lx-option-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid')))
  const wrong = testIds.find((id) => id !== `v2lx-option-${correct}`)
  expect(wrong).toBeTruthy()
  await page.getByTestId(wrong).click()
}

test('a real V2 answer survives navigation and appears with durable diagnosis, not evidence-only backfill', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.reload()
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  await reachRecognition(page)
  await chooseWrongAuthoredOption(page)
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()

  // Explicit close now records a factual abandoned boundary. The assessed
  // interaction and the prior observed exposure must both remain visible.
  await page.getByTestId('v2lx-close').click()
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByTestId('v2-history')).toBeVisible()
  const session = page.getByTestId('v2-history-session')
  await expect(session).toHaveCount(1)
  await expect(session).toHaveAttribute('data-source', 'durable_journal')
  await expect(session).toHaveAttribute('data-status', 'abandoned')
  await expect(session).toContainText('Sessão encerrada antes do fim')
  await expect(session).toContainText('1 exposição')
  await expect(session).toContainText('1 resposta avaliada')
  await expect(session).not.toContainText('resposta preservada sem avaliação')
  await session.getByRole('button').click()
  await expect(page.getByText('Alternativa escolhida registrada.')).toBeVisible()
  await expect(page.getByTestId('v2-history-recovery-note')).toHaveCount(0)
  await expect(page.getByTestId('v2-history-limited')).toHaveCount(0)
  await expect(page.getByTestId('v2-history-diagnosis')).toBeVisible()

  await page.getByRole('button', { name: 'Erros' }).click()
  await expect(page.getByTestId('v2-review-points')).toBeVisible()
  const point = page.getByTestId('v2-review-point')
  await expect(point).toHaveCount(1)
  await expect(point).toHaveAttribute('data-source', 'durable_journal')
  await expect(page.getByTestId('v2-review-limited')).toHaveCount(0)
  await expect(page.getByTestId('v2-review-diagnosis')).toBeVisible()
})
