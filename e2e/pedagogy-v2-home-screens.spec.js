// pedagogy-v2-home-screens.spec.js — Slice V2.18 visual evidence (§47). Captures
// the V2 Learner Home and key entries into test-evidence/v2-18-screens/.
// Screenshots are complementary evidence, not a correctness gate.
import { test } from '@playwright/test'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, openV2Home } from './v2-helpers.js'

const DIR = 'test-evidence/v2-18-screens'

test('home 375 light', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.setViewportSize({ width: 375, height: 812 })
  await openV2Home(page)
  await page.screenshot({ path: `${DIR}/home-375-light.png` })
})

test('home 375 dark', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await page.evaluate(async () => { await window.__e2e.db.setSetting('theme', 'dark') })
  await setLearnerFlag(page, true)
  await page.setViewportSize({ width: 375, height: 812 })
  await openV2Home(page)
  await page.screenshot({ path: `${DIR}/home-375-dark.png` })
})

test('home 320', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.setViewportSize({ width: 320, height: 720 })
  await openV2Home(page)
  await page.screenshot({ path: `${DIR}/home-320.png` })
})

test('explore entry', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.setViewportSize({ width: 375, height: 812 })
  await openV2Home(page)
  await page.getByTestId('v2lxh-action-explore').click()
  await page.locator('[data-testid^="v2lx-activity-"], [data-testid="v2lx-empty-headline"]').first().waitFor()
  await page.screenshot({ path: `${DIR}/explore-entry.png` })
})

test('review empty', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.setViewportSize({ width: 375, height: 812 })
  await openV2Home(page)
  await page.getByTestId('v2lxh-action-review').click()
  await page.getByTestId('v2lx-empty-headline').waitFor()
  await page.screenshot({ path: `${DIR}/review-empty.png` })
})

test('summary return to home', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.setViewportSize({ width: 375, height: 812 })
  await openV2Home(page)
  await page.getByTestId('v2lxh-action-review').click()
  await page.getByTestId('v2lx-empty-home').click()
  await page.getByTestId('v2lx-home').waitFor()
  await page.screenshot({ path: `${DIR}/summary-return-home.png` })
})
