// focused-practice.spec.js — originally Slice V2.21-R2 §25, rewritten for Slice
// V2.22-UX2 §22.
//
// V2.21-R2 put an "Escolher prática" section on the V2 Home with one card per
// authored pack (Still / But / Yet) and this spec guarded it. UX2 deletes that
// model outright: a learner never decides which function word to study, so the
// pack cards are gone and the Home navigates by CONTEXT instead.
//
// The packs still organise the curriculum and `focused` mode still exists — but
// as a DIAGNOSTIC entry with no learner-facing route (§22), so it can no longer
// be reached by clicking. Its resolution is covered by the unit tests in
// `src/lib/pedagogy-v2/learner-mode-routing.test.js`; what remains testable HERE
// is the product decision itself, which is what this spec now asserts.

import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor } from './helpers.js'
import { setLearnerFlag } from './v2-helpers.js'

const PACKS = [
  { pack_id: 'pedagogy_v2_still', label: 'Still' },
  { pack_id: 'pedagogy_v2_but', label: 'But' },
  { pack_id: 'pedagogy_v2_yet', label: 'Yet' },
]

async function openV2Home(page, context) {
  await enableTestHooks(context)
  await seedFixtures(page)
  await setLearnerFlag(page, true)
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
}

test('the V2 Home no longer offers packs as a learner-facing choice (§22)', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await openV2Home(page, context)

  // The V2.21-R2 section and its per-pack cards are gone.
  await expect(page.getByTestId('v2lxh-categories')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Escolher prática' })).toHaveCount(0)
  for (const p of PACKS) {
    await expect(page.getByTestId(`v2lxh-category-${p.pack_id}`)).toHaveCount(0)
  }

  // No lemma survives anywhere on the Home, in copy or in markup.
  const body = await page.locator('body').innerText()
  for (const p of PACKS) {
    expect(new RegExp(`(^|\\s)${p.label}(\\s|$)`).test(body), `"${p.label}" is still learner-facing`).toBe(false)
  }
  expect(await page.content()).not.toMatch(/data-pack=|pedagogy_v2_/)

  monitor.assertClean()
})

test('the Home navigates by context, and each context is a real session (§22/§28)', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await openV2Home(page, context)

  const contexts = page.locator('[data-testid^="v2lxh-collection-open-"]')
  expect(await contexts.count()).toBeGreaterThanOrEqual(4)

  await contexts.first().click()
  const lesson = page.getByTestId('v2lx-screen')
  await expect(lesson).toBeVisible({ timeout: 30_000 })
  await expect(lesson).toHaveAttribute('data-experience', 'v2')
  // A context rides on the real adaptive mode — it is not a new study mode (§6).
  await expect(lesson).toHaveAttribute('data-mode', 'adaptive')
  await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible({ timeout: 30_000 })
  // Still the V2 product, still no mascot.
  await expect(page.getByTestId('open-training-hub')).toHaveCount(0)
  await expect(page.getByRole('img', { name: 'Bob, o mascote' })).toHaveCount(0)

  monitor.assertClean()
})
