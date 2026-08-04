import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, readStore, PROFILE_A } from './helpers.js'
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

test('a V2 response staged before assessment survives reload without becoming evidence or an error', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.reload()
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  await reachRecognition(page)

  // Production never sets this. It pauses the real learner flow immediately
  // after the write-ahead receipt and before controller assessment.
  await page.evaluate(() => { window.__e2e.v2PauseAfterSubmissionStage = true })
  await chooseWrongAuthoredOption(page)
  await page.waitForFunction(() => !!window.__e2e?.v2StagedInteractionId)
  const stagedInteractionId = await page.evaluate(() => window.__e2e.v2StagedInteractionId)
  expect(stagedInteractionId).toBeTruthy()

  // Simulate the tab/page disappearing before assessment finishes.
  await page.reload()
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByTestId('v2-history')).toBeVisible()
  const session = page.getByTestId('v2-history-session').first()
  await expect(session).toHaveAttribute('data-status', 'interrupted')
  await expect(session).toContainText('resposta preservada sem avaliação')
  await expect(session).toContainText('Sessão interrompida')
  await session.getByRole('button').click()
  await expect(page.getByTestId('v2-history-recovery-note')).toContainText('não alterou sua progressão')
  await expect(page.getByTestId('v2-history-interaction').filter({ has: page.getByTestId('v2-history-recovery-note') })).toHaveAttribute(
    'data-recovery-status', 'interrupted_before_assessment',
  )

  const evidence = await readStore(page, 'learner_evidence_v2')
  expect(evidence.some((event) => event.interaction_id === stagedInteractionId)).toBe(false)

  await page.getByRole('button', { name: 'Erros' }).click()
  await expect(page.getByTestId('v2-review-points')).toBeVisible()
  await expect(page.getByTestId('v2-review-point')).toHaveCount(0)
  await expect(page.getByTestId('v2-review-empty')).toBeVisible()
})
