// production-cutover.spec.js — V2.20-R §16. THE regression test of this fix.
//
// Every other E2E spec runs against the dogfood bundle (built with
// VITE_V2_DOGFOOD=1). That bundle can never prove the production cutover: it
// would pass even if production still resolved to V1. So this spec runs in its
// own Playwright project against a SEPARATE, PLAIN `vite build` — the exact
// bundle `npm run build` produces and GitHub Pages publishes (see
// playwright.config.js → the `production-build` webServer on port 4174).
//
// It touches NO flag, NO query parameter and NO IndexedDB key: it just opens the
// app the way a stranger with the public URL does, and requires the V2 product
// (§20).
import { test, expect } from '@playwright/test'
import { enableTestHooks, gotoApp, attachErrorMonitor, readStore } from './helpers.js'
import { completeV2FirstRun } from './v2-helpers.js'

// V1 truths that must not leak into the V2 experience (§10).
const V1_TRUTHS = [
  'Bora soltar o inglês hoje',
  'Escolha o que treinar',
  'Gerar nova aula adaptativa',
  'Prática adaptativa',
  'Temas, níveis A1–B2',
]

// V2.22-UX2-R §3. This used to drive the LEGACY onboarding — and it passed,
// against a plain production build, because the first-run branch in App.jsx ran
// before the experience was resolved. That is precisely the defect this slice
// fixes, so the helper now drives the V2 first-run and this spec is the proof:
// if the cutover regressed, `v2lx-onboarding` would not exist here.
async function onboard(page) {
  await gotoApp(page)
  await expect(page.getByTestId('v2lx-onboarding')).toBeVisible({ timeout: 20_000 })
  // The legacy first-run must not be reachable in a plain production build.
  await expect(page.getByTestId('onboarding-mode-kids')).toHaveCount(0)
  await expect(page.getByText('Pra quem é esse aprendizado?')).toHaveCount(0)
  await completeV2FirstRun(page, 'Rob')
}

async function expectV2Home(page) {
  const home = page.getByTestId('v2lx-home')
  await expect(home).toBeVisible({ timeout: 20_000 })
  await expect(home).toHaveAttribute('data-experience', 'v2')
  await expect(page.getByTestId('v2lxh-primary')).toBeVisible()
}

test('a PRODUCTION build with no flag opens the V2 Home — and no Bob', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)

  // Opening the app is the whole setup. No settings, no DevTools (§20).
  await onboard(page)
  await expectV2Home(page)

  // §19 — the mascot belongs to the legacy product.
  await expect(page.getByRole('img', { name: 'Bob, o mascote' })).toHaveCount(0)
  await expect(page.locator('.bob-float')).toHaveCount(0)
  await expect(page.getByText(/\bBob\b/)).toHaveCount(0)

  // §10 — not one V1 truth on the V2 Home.
  for (const truth of V1_TRUTHS) {
    await expect(page.getByText(truth, { exact: false })).toHaveCount(0)
  }
  await expect(page.getByTestId('open-training-hub')).toHaveCount(0)
  await expect(page.getByTestId('generation-card')).toHaveCount(0)

  // §13 — the DEV V1/V2 switch is not shipped to a public learner.
  await expect(page.getByTestId('v2lxh-devstrip')).toHaveCount(0)
  await expect(page.getByText('DEV · Experiência de aprendizagem')).toHaveCount(0)

  // The unset flag really is unset — V2 is the DEFAULT, not a stored choice.
  const rows = await readStore(page, 'settings')
  expect(rows.find((r) => r.key === 'v2_learner_experience_enabled')).toBeUndefined()

  // A reload keeps the learner in V2 (nothing here depends on session state).
  await page.reload()
  await expectV2Home(page)

  monitor.assertClean()
})

test('the production V2 Home reaches the V2 lesson and comes back to the V2 Home', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await onboard(page)
  await expectV2Home(page)

  // §2 — Praticar agora enters the real V2 lesson experience.
  await page.getByTestId('v2lxh-primary').click()
  const lesson = page.getByTestId('v2lx-screen')
  await expect(lesson).toBeVisible({ timeout: 20_000 })
  await expect(lesson).toHaveAttribute('data-experience', 'v2')
  await expect(page.getByRole('img', { name: 'Bob, o mascote' })).toHaveCount(0)

  // §9 — bottom-nav "Início" returns to the V2 Home, never to the V1 Home.
  await page.getByRole('button', { name: 'Início' }).click()
  await expectV2Home(page)

  monitor.assertClean()
})

test('the explicit legacy opt-out still reaches the V1 Home (§4 rollback)', async ({ page, context }) => {
  await enableTestHooks(context)
  await onboard(page)
  await expectV2Home(page)

  // The emergency escape hatch: an explicit `false` — and ONLY that — brings the
  // legacy product back, in a production bundle too.
  await page.evaluate(() => window.__e2e.db.setSetting('v2_learner_experience_enabled', false))
  await page.reload()
  await expect(page.getByTestId('open-training-hub')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Bora soltar o inglês hoje')).toBeVisible()
  await expect(page.getByTestId('v2lx-home')).toHaveCount(0)
  // Bob is alive in the legacy product — this fix did not delete him.
  await expect(page.getByRole('img', { name: 'Bob, o mascote' }).first()).toBeVisible()
})
