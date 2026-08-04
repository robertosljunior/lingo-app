import { test, expect } from '@playwright/test'
import { attachErrorMonitor, enableTestHooks, gotoApp, readStore } from './helpers.js'
import { waitForAdvance } from './v2-helpers.js'

const currentRecipe = (page) => page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')

async function finishFreshV2Onboarding(page, name) {
  await expect(page.getByTestId('v2lx-onboarding')).toBeVisible()
  await page.getByTestId('v2lxo-continue').click()
  await page.getByTestId('v2lxo-name-input').fill(name)
  await page.getByTestId('v2lxo-start').click()
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
}

async function reachRecognition(page) {
  for (let guard = 0; guard < 8; guard++) {
    const recipe = await currentRecipe(page)
    if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) return
    if (recipe !== 'exposure') throw new Error(`Unexpected recipe before first assessed recognition: ${recipe}`)
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  throw new Error('Fresh learner did not reach an assessed recognition activity')
}

async function chooseWrongAuthoredOption(page) {
  const correctId = await page.evaluate(() => window.__e2e?.v2Activity?.correct_option_id ?? null)
  expect(correctId).toBeTruthy()
  const ids = await page.locator('[data-testid^="v2lx-option-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid')))
  const wrongId = ids.find((id) => id !== `v2lx-option-${correctId}`)
  expect(wrongId).toBeTruthy()
  await page.getByTestId(wrongId).click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
}

async function openTab(page, name, surfaceTestId) {
  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  await nav.getByRole('button', { name }).click()
  const surface = page.getByTestId(surfaceTestId)
  await expect(surface).toBeVisible()
  await expect(surface).toHaveAttribute('data-experience', 'v2')
}

test('critical V2 journey survives reload, profile switching and offline boot with no duplicate evidence', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await gotoApp(page)
  await finishFreshV2Onboarding(page, 'Rob')

  const initialSettings = await readStore(page, 'settings')
  const originalProfileId = initialSettings.find((row) => row.key === 'active_profile')?.value
  expect(originalProfileId).toBeTruthy()

  // Real Planner → Engine → renderer → Assessment → durable journal/evidence.
  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  await reachRecognition(page)
  await chooseWrongAuthoredOption(page)
  await page.getByTestId('v2lx-close').click()
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  const evidenceBeforeReload = (await readStore(page, 'learner_evidence_v2'))
    .filter((row) => row.profile_id === originalProfileId)
  expect(evidenceBeforeReload.length).toBeGreaterThan(0)

  // A real reload must preserve the session, diagnosis and review point.
  await page.reload()
  await page.waitForFunction(() => window.__e2e?.db)
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })

  await openTab(page, 'Histórico', 'v2-history')
  const session = page.getByTestId('v2-history-session')
  await expect(session).toHaveCount(1)
  await expect(session).toHaveAttribute('data-source', 'durable_journal')
  await expect(session).toHaveAttribute('data-status', 'abandoned')

  await openTab(page, 'Erros', 'v2-review-points')
  const point = page.getByTestId('v2-review-point')
  await expect(point).toHaveCount(1)
  await expect(point).toHaveAttribute('data-source', 'durable_journal')

  // Every learner-visible destination stays in the same product.
  await openTab(page, 'Ajustes', 'v2-settings')
  await page.locator('#v2-new-profile').fill('Segundo perfil')
  await page.getByRole('button', { name: 'Criar perfil' }).click()

  const profiles = await readStore(page, 'profiles')
  const second = profiles.find((row) => row.profile_id !== originalProfileId && row.name === 'Segundo perfil')
  expect(second?.profile_id).toBeTruthy()
  await expect(page.getByTestId(`v2-profile-${second.profile_id}`)).toHaveAttribute('aria-pressed', 'true')

  // The new profile has no access to the first profile's history or review.
  await openTab(page, 'Histórico', 'v2-history')
  await expect(page.getByTestId('v2-history-empty')).toBeVisible()
  await openTab(page, 'Erros', 'v2-review-points')
  await expect(page.getByTestId('v2-review-empty')).toBeVisible()
  expect((await readStore(page, 'learner_evidence_v2')).filter((row) => row.profile_id === second.profile_id)).toHaveLength(0)

  // Return to the original profile through the learner-facing Settings surface.
  await openTab(page, 'Ajustes', 'v2-settings')
  await page.getByTestId(`v2-profile-${originalProfileId}`).click()
  await expect(page.getByTestId(`v2-profile-${originalProfileId}`)).toHaveAttribute('aria-pressed', 'true')
  await openTab(page, 'Histórico', 'v2-history')
  await expect(page.getByTestId('v2-history-session')).toHaveCount(1)
  await openTab(page, 'Erros', 'v2-review-points')
  await expect(page.getByTestId('v2-review-point')).toHaveCount(1)
  await openTab(page, 'Início', 'v2lx-home')

  // The same factual state boots from the real service worker while offline.
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready
    return !!registration.active && !!navigator.serviceWorker.controller
  }, null, { timeout: 60_000 })
  await context.setOffline(true)
  await page.reload()
  await page.waitForFunction(() => window.__e2e?.db, null, { timeout: 60_000 })
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveAttribute('data-experience', 'v2')

  await context.setOffline(false)
  const evidenceAfterJourney = (await readStore(page, 'learner_evidence_v2'))
    .filter((row) => row.profile_id === originalProfileId)
  expect(evidenceAfterJourney.map((row) => row.evidence_id).sort())
    .toEqual(evidenceBeforeReload.map((row) => row.evidence_id).sort())

  monitor.assertClean()
})
