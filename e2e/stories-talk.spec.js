// SLICE UI (Bob) — Kids Stories + Talk-with-Bob. Stories are Kids-only and fully
// unlocked; Talk is available to everyone.
import { test, expect } from '@playwright/test'
import { enableTestHooks, gotoApp, attachErrorMonitor } from './helpers.js'

async function onboardAsKids(page) {
  await gotoApp(page)
  await page.getByTestId('onboarding-mode-kids').click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByTestId('onboarding-name').fill('Lila')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByTestId('onboarding-level-A1').click()
  await page.getByTestId('onboarding-finish').click()
  await expect(page.getByRole('button', { name: /Abrir hub de treinamento/ })).toBeVisible({ timeout: 15_000 })
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
  await gotoApp(page)
  await page.getByTestId('onboarding-mode-adult').click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByTestId('onboarding-name').fill('Rob')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByTestId('onboarding-level-B1').click()
  await page.getByTestId('onboarding-finish').click()
  await expect(page.getByRole('button', { name: /Abrir hub de treinamento/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Histórias' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Fale', exact: true })).toBeVisible()
})
