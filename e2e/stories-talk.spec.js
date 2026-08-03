// SLICE UI (Bob) — Kids Stories + Talk-with-Bob. Stories are Kids-only and fully
// unlocked; Talk is available to everyone.
//
// V2.22-UX2-R §13.D: these are LEGACY (V1) features. "Kids" is an audience split
// the V2 product does not have — §0 forbids it from every V2 screen, and the
// bottom navigation no longer swaps Histórico for Histórias just because a
// stored profile says `kids`. So this suite pins the legacy product explicitly
// instead of inheriting whatever a fresh install resolves to. That is the point
// of the opt-out: V1 keeps working, exactly as it did, for whoever asks for it.
import { test, expect } from '@playwright/test'
import { enableTestHooks, gotoApp, attachErrorMonitor } from './helpers.js'
import { pinLegacyBeforeFirstRun } from './v2-helpers.js'

async function onboardLegacy(page, { mode, name, level }) {
  await gotoApp(page)
  await pinLegacyBeforeFirstRun(page)
  await page.getByTestId(`onboarding-mode-${mode}`).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByTestId('onboarding-name').fill(name)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByTestId(`onboarding-level-${level}`).click()
  await page.getByTestId('onboarding-finish').click()
  await expect(page.getByTestId('open-training-hub')).toBeVisible({ timeout: 20_000 })
}

async function onboardAsKids(page) {
  await onboardLegacy(page, { mode: 'kids', name: 'Lila', level: 'A1' })
}

test('kids can open and finish an illustrated story', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await onboardAsKids(page)

  // Stories tab exists in kids mode.
  await page.getByRole('button', { name: 'Histórias' }).click()
  await expect(page.getByRole('heading', { name: 'Histórias' })).toBeVisible()
  await page.getByTestId('story-brave_rabbit').click()

  // Walk every panel (all unlocked) to the end, then finish.
  for (let i = 0; i < 4; i++) {
    await expect(page.getByTestId('story-next')).toBeVisible()
    await page.getByTestId('story-next').click()
  }
  await expect(page.getByText('Fim! 🎉')).toBeVisible()
  await page.getByTestId('story-finish').click()
  await expect(page.getByRole('heading', { name: 'Histórias' })).toBeVisible()

  monitor.assertClean()
})

test('Talk-with-Bob renders the prompt, gloss and audio control', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await onboardAsKids(page)

  await page.getByRole('button', { name: 'Fale', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fale com o Bob' })).toBeVisible()
  await expect(page.getByText('Good morning! How are you today?')).toBeVisible()
  await expect(page.getByText('Bom dia! Como você está hoje?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ouvir a frase' })).toBeVisible()
  await expect(page.getByTestId('talk-heard')).toBeVisible()

  monitor.assertClean()
})

test('adult mode has no Stories tab', async ({ page, context }) => {
  await enableTestHooks(context)
  await onboardLegacy(page, { mode: 'adult', name: 'Rob', level: 'B1' })
  await expect(page.getByRole('button', { name: 'Histórias' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Fale', exact: true })).toBeVisible()
})
