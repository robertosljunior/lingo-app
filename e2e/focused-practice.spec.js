// focused-practice.spec.js — Slice V2.21-R2 §25. "Escolher prática" on the V2
// Home must reach REAL focused sessions of each authored pack, without DevTools,
// without a flag, and without ever falling back to the V1 product.
//
// The category chooses the PACK, never a sentence: the Planner and the Engine
// keep deciding target, recipe and exemplar inside it (§22), so this spec
// asserts the pack of the served activity — not a specific exemplar.
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

test('the V2 Home offers "Escolher prática" with the authored packs', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await openV2Home(page, context)

  const section = page.getByTestId('v2lxh-categories')
  await expect(section).toBeVisible()
  await expect(section.getByRole('heading', { name: 'Escolher prática' })).toBeVisible()

  for (const p of PACKS) {
    const card = page.getByTestId(`v2lxh-category-${p.pack_id}`)
    await expect(card).toBeVisible()
    await expect(card).toContainText(p.label)
    // Authored copy only — no technical id ever reaches the learner.
    await expect(card).not.toContainText('pedagogy_v2')
  }

  // §23 — no V1 truth and no CEFR/mastery came back with the new section.
  for (const forbidden of ['A1', 'A2', 'B1', 'B2', 'domínio', 'Escolha o que treinar']) {
    await expect(section.getByText(forbidden, { exact: false })).toHaveCount(0)
  }

  monitor.assertClean()
})

for (const p of PACKS) {
  test(`"${p.label}" starts a real focused session of ${p.pack_id}`, async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await openV2Home(page, context)

    await page.getByTestId(`v2lxh-category-${p.pack_id}`).click()

    // The V2 lesson screen — never the V1 product.
    const lesson = page.getByTestId('v2lx-screen')
    await expect(lesson).toBeVisible({ timeout: 30_000 })
    await expect(lesson).toHaveAttribute('data-experience', 'v2')
    await expect(page.getByTestId('open-training-hub')).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Bob, o mascote' })).toHaveCount(0)

    // The served activity really belongs to the chosen pack.
    await expect(lesson).toHaveAttribute('data-mode', 'focused')
    await expect(lesson).toHaveAttribute('data-pack', p.pack_id)
    await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible({ timeout: 30_000 })

    monitor.assertClean()
  })
}
