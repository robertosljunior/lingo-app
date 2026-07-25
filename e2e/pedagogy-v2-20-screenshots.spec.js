// pedagogy-v2-20-screenshots.spec.js — Slice V2.20 §40/§41 visual regression
// matrix. This spec does not assert; it RENDERS the real app at 375px (plus a
// dark-mode and a 320px pass) and writes PNGs to test-evidence/v2-20-visual/ so
// the implementation can be compared against the attached Prototype by eye.
//
// It runs only when V2_SHOTS=1, so the normal suite is unaffected.
//
// Every frame comes from a REAL session: real plans, real Assessment, real
// feedback variants. Nothing is faked to fill the grid.
//
// KNOWN GAP (V2.20): the matrix is therefore incomplete. Which recipes appear is
// a planner decision, and the harness answers recognition by tapping the first
// option — often wrong — so the seeded learner never accumulates the correct
// evidence Capability Entry needs to open the production/controlled recipes.
// In practice this pass captures exposure, meaning/listening recognition and the
// correct/semantic feedback variants; completion, word order, guided/free
// production, context_recognition and the partial/linguistic/unable variants are
// NOT captured here. Their structure is covered by the unit tests in
// src/components/pedagogy-v2-learner/v2-polish-v2-20.test.jsx instead.
// Closing the gap needs a harness that can answer correctly (or a DEV-only
// forced-plan route) — deliberately not built in this slice.

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, openV2Home, openLearnerExperience, waitForAdvance, answerLearnerActivity, seedV2Evidence } from './v2-helpers.js'

const OUT = path.resolve('test-evidence/v2-20-visual')
const enabled = process.env.V2_SHOTS === '1'

test.skip(!enabled, 'set V2_SHOTS=1 to regenerate the visual matrix')
test.describe.configure({ mode: 'serial' })

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }) })

async function shot(page, name) {
  await page.waitForTimeout(350) // let entry animations settle
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
}

// Seeds REAL recognition evidence so the Capability Entry policy opens the
// production/controlled recipes. This does not force any plan — the planner
// still chooses; it just starts from a learner who has already demonstrated
// recognition, which is the only honest way to reach production recipes in a
// screenshot pass (§40).
async function seedAdvancedLearner(page) {
  const rec = (target_type, target_id) => [
    { target_type, target_id, modality: 'reading', n: 4 },
    { target_type, target_id, modality: 'listening', n: 4 },
  ]
  await seedV2Evidence(page, PROFILE_A, [
    ...rec('sense', 'sense:still.continuity'),
    ...rec('construction', 'construction:still.subject_still_lexical_verb'),
    ...rec('construction', 'construction:still.subject_be_still_complement'),
  ])
}

async function boot(page, context, { width = 375, height = 780, dark = false, advanced = false } = {}) {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  if (advanced) { await seedAdvancedLearner(page); await page.reload() }
  if (dark) {
    await page.evaluate(async () => { await window.__e2e.db.setSetting('theme', 'dark') })
    await page.reload()
  }
  await page.setViewportSize({ width, height })
}

test('visual matrix at 375px', async ({ page, context }) => {
  test.setTimeout(600_000)
  await boot(page, context, { advanced: true })

  await openV2Home(page)
  await shot(page, '01-home')

  // The recipes a session schedules are chosen by the planner, so one session
  // will not exhibit all of them. Run several consecutive REAL sessions until
  // the matrix is covered (or we run out of attempts) — never a forced plan.
  const seen = new Set()
  for (let session = 0; session < 6; session++) {
    await walkSession(page, seen)
    if (seen.size >= 8) break
    if (!(await page.getByTestId('v2lx-summary').count())) break
    await page.getByTestId('v2lx-finish').click()
    await expect(page.getByTestId('v2lx-home')).toBeVisible()
    await page.getByTestId('v2lxh-primary').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  }
  if (await page.getByTestId('v2lx-summary').count()) await shot(page, '19-session-summary')
})

async function walkSession(page, seen) {
  if (!(await page.getByTestId('v2lx-shell').count())) {
    await page.getByTestId('v2lxh-primary').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  }
  for (let i = 0; i < 16; i++) {
    if (await page.getByTestId('v2lx-summary').count()) break
    const activity = page.locator('[data-testid^="v2lx-activity-"]')
    if (!(await activity.count())) break
    const recipe = await activity.getAttribute('data-recipe')

    if (recipe && !seen.has(recipe)) {
      seen.add(recipe)
      await shot(page, `recipe-${recipe}-idle`)
      if (recipe && recipe.endsWith('recognition')) {
        // Selected-but-not-yet-evaluated is not a state this contract has
        // (tap = answer), so the "selected" frame of the matrix is the answered
        // one captured just below.
      }
    }

    const before = await page.getByTestId('v2lx-step-counter').textContent()
    if (recipe === 'exposure') {
      await page.getByTestId('v2lx-continue').click()
      await waitForAdvance(page, before)
      continue
    }
    if (recipe && recipe.endsWith('recognition')) {
      await page.locator('[data-testid^="v2lx-option-"]').first().click()
      await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
      await shot(page, `recipe-${recipe}-answered`)
      const variant = await page.getByTestId('v2lx-feedback').getAttribute('data-variant')
      await shot(page, `feedback-${variant}`)
      const disclose = page.getByTestId('v2lx-fb-disclose')
      if (await disclose.count()) {
        await shot(page, `feedback-${variant}-collapsed`)
        await disclose.click()
        await shot(page, `feedback-${variant}-expanded`)
      }
      await page.getByTestId('v2lx-continue').click()
      await waitForAdvance(page, before)
      continue
    }
    // Non-recognition recipes: fill in the answer, capture idle→answered and the
    // resulting feedback variant, then continue.
    if (recipe === 'fixed_element_completion' || recipe === 'word_order_reconstruction'
        || recipe === 'guided_production' || recipe === 'free_production') {
      if (recipe === 'fixed_element_completion') {
        const bank = page.locator('[data-testid="v2lx-word-bank"] button')
        if (await bank.count()) await bank.first().click()
        else await page.getByTestId('v2lx-completion-input').fill('still')
      } else if (recipe === 'word_order_reconstruction') {
        const total = await page.locator('[data-testid="v2lx-token-bank"] button').count()
        for (let t = 0; t < total; t++) await page.locator('[data-testid="v2lx-token-bank"] button').first().click()
      } else {
        const input = page.getByTestId('v2lx-production-input')
        if (!(await input.count())) break
        await input.fill('I still live here.')
      }
      await shot(page, `recipe-${recipe}-filled`)
      await page.getByTestId('v2lx-check').click()
      await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
      const variant = await page.getByTestId('v2lx-feedback').getAttribute('data-variant')
      await shot(page, `feedback-${variant}`)
      const disclose = page.getByTestId('v2lx-fb-disclose')
      if (await disclose.count()) {
        await shot(page, `feedback-${variant}-collapsed`)
        await disclose.click()
        await shot(page, `feedback-${variant}-expanded`)
      }
      await page.getByTestId('v2lx-continue').click()
      await waitForAdvance(page, before)
      continue
    }

    const answered = await answerLearnerActivity(page)
    if (!answered) break
  }
}

test('dark mode lesson', async ({ page, context }) => {
  await boot(page, context, { dark: true })
  await openLearnerExperience(page)
  await shot(page, '20-dark-lesson')
})

test('320px with a long sentence', async ({ page, context }) => {
  await boot(page, context, { width: 320, height: 720 })
  await openLearnerExperience(page)
  await shot(page, '21-320-long-sentence')
})
