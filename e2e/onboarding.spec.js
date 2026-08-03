// onboarding.spec.js — the FIRST-RUN suites, V2.22-UX2-R §13.A and §13.D.
//
// What this file used to assert, and why that was the bug: it opened a fresh
// install and required "Pra quem é esse aprendizado?" — the legacy Kids/Adulto
// question — to be the first thing a new learner saw. It passed, because
// `App.jsx` rendered the legacy onboarding before it resolved which product the
// learner was in. So the suite was pinning the defect in place: the V2 cutover
// was complete everywhere except in the one screen that runs first.
//
// Now the two products own their own first run, and this file proves both:
//   A — a clean install runs the V2 first-run, with no V1 truth anywhere in it;
//   D — an explicit opt-out still runs the legacy one, unchanged.
import { test, expect } from '@playwright/test'
import { enableTestHooks, gotoApp, attachErrorMonitor, readStore } from './helpers.js'
import { completeV2FirstRun, pinLegacyBeforeFirstRun } from './v2-helpers.js'

// Everything the V2 product must never say — on ANY of its screens, first-run
// included (§0). Kept as one list so a regression names the exact leak.
const FORBIDDEN_IN_V2 = [
  /\bBob\b/,
  /\bKids\b/,
  /\bAdulto\b/,
  /mascote/i,
  /\bA1\b/,
  /\bA2\b/,
  /\bB1\b/,
  /\bB2\b/,
]

async function expectNoV1Truth(page) {
  for (const pattern of FORBIDDEN_IN_V2) {
    await expect(page.getByText(pattern), `V1 truth leaked into V2: ${pattern}`).toHaveCount(0)
  }
}

test.describe('A — the V2 first-run (§13.A)', () => {
  test('a clean install runs the V2 first-run and lands on the contextual Home', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await enableTestHooks(context)
    await gotoApp(page) // fresh IndexedDB — no seeded profile, first-run must show

    // The very first screen is V2's, not V1's (§3/§16).
    const onb = page.getByTestId('v2lx-onboarding')
    await expect(onb).toBeVisible()
    await expect(onb).toHaveAttribute('data-experience', 'v2')
    await expect(page.getByTestId('v2lxo-intro')).toBeVisible()

    // §4 — the questions the V2 product does not ask.
    await expectNoV1Truth(page)
    await expect(page.getByTestId('onboarding-mode-kids')).toHaveCount(0)
    await expect(page.getByTestId('onboarding-mode-adult')).toHaveCount(0)
    await expect(page.getByTestId('onboarding-level-A1')).toHaveCount(0)
    // …and no account, on either step.
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.locator('input[type="email"]')).toHaveCount(0)

    await page.getByTestId('v2lxo-continue').click()
    await expect(page.getByTestId('v2lxo-name')).toBeVisible()
    await expectNoV1Truth(page)
    await expect(page.locator('input[type="password"]')).toHaveCount(0)

    await page.getByTestId('v2lxo-name-input').fill('Rob')
    await page.getByTestId('v2lxo-start').click()

    // The profile really was created, and the contextual Home greets by name.
    const home = page.getByTestId('v2lx-home')
    await expect(home).toBeVisible({ timeout: 20_000 })
    await expect(home).toHaveAttribute('data-home-version', 'ux2')
    await expect(page.getByTestId('v2lxh-greeting')).toContainText('Rob')
    await expectNoV1Truth(page)

    // §4 — no CEFR value was written as a fact about this learner. The V1
    // generator still reads `level`, but it reads the SETTINGS DEFAULT; the V2
    // first-run never persisted a row for it.
    const settings = await readStore(page, 'settings')
    expect(settings.find((r) => r.key === 'level')).toBeUndefined()
    // The audience marker is the neutral compatibility value, never 'kids'.
    expect(settings.find((r) => r.key === 'profile_mode')?.value).toBe('v2')

    // Persisted: a reload does not repeat the first run (§13.A).
    await page.reload()
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByTestId('v2lx-onboarding')).toHaveCount(0)
    await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })

    monitor.assertClean()
  })

  test('the name is optional — starting without one still creates a profile', async ({ page, context }) => {
    await enableTestHooks(context)
    await gotoApp(page)
    await page.getByTestId('v2lxo-continue').click()
    // Straight to the CTA with an empty field: the form is a courtesy, not a gate.
    await page.getByTestId('v2lxo-start').click()
    await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('v2lxh-greeting')).toBeVisible()
  })
})

test.describe('D — the legacy first-run (§13.D)', () => {
  test('an explicit opt-out still runs the V1 onboarding, unchanged', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await enableTestHooks(context)
    await gotoApp(page)
    // Opt out BEFORE the first run, which is the only way to see V1 first (§3).
    await pinLegacyBeforeFirstRun(page)

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

    // …and lands in the LEGACY product, because that is what was asked for.
    await expect(page.getByTestId('open-training-hub')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('v2lx-home')).toHaveCount(0)

    // Persisted: a reload does not show onboarding again.
    await page.reload()
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByText('Pra quem é esse aprendizado?')).toHaveCount(0)

    monitor.assertClean()
  })

  test('Bob never leaks into V2 after a legacy profile switches products', async ({ page, context }) => {
    await enableTestHooks(context)
    await gotoApp(page)
    await pinLegacyBeforeFirstRun(page)
    // A full legacy first run: this profile carries profile_mode 'kids' and a
    // CEFR level in storage.
    await page.getByTestId('onboarding-mode-kids').click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByTestId('onboarding-name').fill('Lila')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByTestId('onboarding-level-A1').click()
    await page.getByTestId('onboarding-finish').click()
    await expect(page.getByTestId('open-training-hub')).toBeVisible({ timeout: 20_000 })

    // Now switch that same profile to V2. The stored kids/CEFR values must not
    // surface anywhere: §0 forbids them on every V2 screen, and the audience
    // split used to reach the bottom navigation through `profile_mode`.
    await page.evaluate(async () => { await window.__e2e.db.setSetting('v2_learner_experience_enabled', true) })
    await page.reload()
    await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
    await expectNoV1Truth(page)
    await expect(page.getByRole('button', { name: 'Histórias' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Histórico' })).toBeVisible()
  })
})
