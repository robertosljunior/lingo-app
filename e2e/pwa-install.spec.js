// PWA install prompt — deterministic behavior via the window.__LINGO_E2E__ hook.
// The controller is NEVER globally hidden; each test pins its install state and
// asserts the REAL controller logic (eligibility, dismiss persistence, prompt
// call, standalone, manual instructions, no interception of lesson actions).
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, setPwaInstallState, gotoApp, PROFILE_A } from './helpers.js'

const card = (page) => page.getByTestId('pwa-install-card')
const installBtn = (page) => page.getByRole('button', { name: 'Instalar', exact: true })
const dismissBtn = (page) => page.getByRole('button', { name: 'Agora não', exact: true })

async function boot(page, context, pwaInstall) {
  await enableTestHooks(context, { pwaInstall })
  await seedFixtures(page, { active: PROFILE_A })
}

test('eligible → install prompt is shown with an Install action', async ({ page, context }) => {
  await boot(page, context, { mode: 'eligible' })
  await expect(card(page)).toBeVisible()
  await expect(installBtn(page)).toBeVisible()
  await expect(dismissBtn(page)).toBeVisible()
})

test('disabled → install prompt is absent', async ({ page, context }) => {
  await boot(page, context, { mode: 'disabled' })
  // Give the 1.2s eligibility timer time to (not) fire.
  await page.waitForTimeout(1600)
  await expect(card(page)).toHaveCount(0)
})

test('standalone → install prompt is absent', async ({ page, context }) => {
  await boot(page, context, { mode: 'standalone' })
  await page.waitForTimeout(1600)
  await expect(card(page)).toHaveCount(0)
})

test('manual mode → shows manual add-to-home-screen instructions, no Install button', async ({ page, context }) => {
  await boot(page, context, { mode: 'manual_instructions' })
  await expect(card(page)).toBeVisible()
  await expect(page.getByTestId('pwa-manual-instructions')).toBeVisible()
  await expect(installBtn(page)).toHaveCount(0)
  await expect(dismissBtn(page)).toBeVisible()
})

test('dismissed → does not reappear on reload', async ({ page, context }) => {
  await boot(page, context, { mode: 'eligible' })
  await expect(card(page)).toBeVisible()
  await dismissBtn(page).click()
  await expect(card(page)).toHaveCount(0)
  // Reload with the same eligible mode: real dismiss-persistence keeps it hidden.
  await page.reload()
  await gotoApp(page)
  await page.waitForTimeout(1600)
  await expect(card(page)).toHaveCount(0)
})

test('accepted → native prompt is invoked exactly once and state becomes installed', async ({ page, context }) => {
  await boot(page, context, { mode: 'eligible', promptOutcome: 'accepted' })
  await expect(card(page)).toBeVisible()
  await installBtn(page).click()
  await expect(card(page)).toHaveCount(0)
  const calls = await page.evaluate(() => window.__LINGO_E2E__.pwaInstall._promptCalls)
  expect(calls).toBe(1)
  const status = await page.evaluate(() => JSON.parse(localStorage.getItem('pwa_install_state') || '{}').install_prompt_status)
  expect(status).toBe('installed')
  // After install, a reload never re-shows the prompt.
  await page.reload(); await gotoApp(page); await page.waitForTimeout(1600)
  await expect(card(page)).toHaveCount(0)
})

test('eligible → reload does not duplicate the modal', async ({ page, context }) => {
  await boot(page, context, { mode: 'eligible' })
  await expect(card(page)).toBeVisible()
  await page.reload(); await gotoApp(page)
  await expect(card(page)).toHaveCount(1)
})

test('disabled prompt never intercepts lesson actions', async ({ page, context }) => {
  await boot(page, context, { mode: 'disabled' })
  const LESSON = `lesson_id: e2e_pwa_lesson\nlevel: A1\nfocus: free_production\nq:\n  - id: 1\n    t: answer_question\n    pt: Peça uma sobremesa.\n    p: Escreva um pedido educado.\n    a: Could I have a dessert, please?\n    f: request\n`
  await page.getByText('Importar aula', { exact: true }).first().click()
  await page.locator('textarea.input').fill(LESSON)
  await page.getByRole('button', { name: 'Validar' }).click()
  await expect(page.getByText('Aula válida')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar e iniciar' }).click()
  await expect(page.getByTestId('question-type')).toBeVisible()
  // No install card overlaps the action bar; the answer button works.
  await expect(card(page)).toHaveCount(0)
  await page.locator('textarea.input').fill('Please give me a dessert.')
  await page.getByRole('button', { name: /Responder/ }).click()
  await expect(page.getByTestId('feedback-sheet')).toBeVisible({ timeout: 60000 })
})
