// SLICE UI (Bob) — first-run onboarding: no login, just Kids/Adult + name + level.
import { test, expect } from '@playwright/test'
import { enableTestHooks, gotoApp, attachErrorMonitor } from './helpers.js'

test('fresh install shows the Bob onboarding and completes into the app', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await gotoApp(page) // fresh IndexedDB — no seeded profile, onboarding must show

  // Step 1: audience
  await expect(page.getByText('Pra quem é esse aprendizado?')).toBeVisible()
  await page.getByTestId('onboarding-mode-adult').click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Step 2: name (no e-mail/senha anywhere)
  await expect(page.getByText('Como podemos te chamar?')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await page.getByTestId('onboarding-name').fill('Rob')
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Step 3: level → finish
  await expect(page.getByText('Prazer, Rob!')).toBeVisible()
  await page.getByTestId('onboarding-level-A2').click()
  await page.getByTestId('onboarding-finish').click()

  // Lands in the app (Home) and greets by name.
  await expect(page.getByRole('button', { name: /Abrir hub de treinamento/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Rob/ })).toBeVisible()

  // Persisted: a reload does not show onboarding again.
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await expect(page.getByText('Pra quem é esse aprendizado?')).toHaveCount(0)

  monitor.assertClean()
})
