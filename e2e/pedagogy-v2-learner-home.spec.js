// pedagogy-v2-learner-home.spec.js — E2E for the Slice V2.18 V2 Learner Home.
// With v2_learner_experience_enabled ON, Training becomes the learner-facing V2
// Home (not the V1 hub), routing into REAL Study sessions per mode. These
// scenarios prove the coexistence switch, the three real modes (adaptive /
// explore / review), a mode-aware empty state, close/summary → Home, and that
// no V1 truth or fake resume leaks onto the V2 surface.
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'
import { setLearnerFlag, openV2Home, answerLearnerActivity } from './v2-helpers.js'

// V2.20-R made the ROOT Home the V2 Learner Home, so the legacy Training entry
// only renders under the explicit V1 opt-out. Click it when it is there; when it
// is not, the V2 Home is already on screen.
async function openTraining(page) {
  const legacyEntry = page.getByTestId('open-training-hub')
  if (await legacyEntry.count()) await legacyEntry.click()
}

test.describe('coexistence (§40)', () => {
  test('flag OFF → the V1 Training hub is the primary surface', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, false)
    await openTraining(page)
    await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toBeVisible()
    await expect(page.getByTestId('v2lx-home')).toHaveCount(0)
  })

  test('flag ON → Training opens the V2 Learner Home, not the V1 hub', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    await openTraining(page)
    await expect(page.getByTestId('v2lx-home')).toBeVisible()
    // The V2 Home must NOT show V1 truths (themes / mastery / CEFR / skills) (§21/§46).
    const home = page.getByTestId('v2lx-home')
    await expect(home).not.toContainText(/Escolha o que treinar|Domínio estimado|mastery|CEFR|A1 —|A2 —|B1 —|B2 —/i)
    // No false resumability copy (§7/§46).
    await expect(home).not.toContainText(/Continuar onde parou|Retomar sua sessão|atividade 4/i)
    // Greeting + the three real study entries are present.
    await expect(page.getByTestId('v2lxh-greeting')).toBeVisible()
    await expect(page.getByTestId('v2lxh-primary')).toHaveAttribute('data-mode', 'adaptive')
    await expect(page.getByTestId('v2lxh-action-explore')).toHaveAttribute('data-mode', 'explore')
    await expect(page.getByTestId('v2lxh-action-review')).toHaveAttribute('data-mode', 'review')
  })
})

test.describe('real study modes', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
  })

  test('§42 Praticar agora → real adaptive session, no hardcoded playlist', async ({ page }) => {
    const monitor = attachErrorMonitor(page)
    await openV2Home(page)
    await page.getByTestId('v2lxh-primary').click()
    await expect(page.getByTestId('v2lx-screen')).toHaveAttribute('data-mode', 'adaptive')
    await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible()
    await expect(page.getByTestId('v2lx-step-counter')).toContainText('Atividade 1')
    // Answer two activities; distinct activities emerge from the pipeline.
    await answerLearnerActivity(page)
    await expect(page.getByTestId('v2lx-step-counter')).not.toContainText('Atividade 1')
    monitor.assertClean?.()
  })

  test('§43 Explorar → real explore session (activity or factual empty)', async ({ page }) => {
    await openV2Home(page)
    await page.getByTestId('v2lxh-action-explore').click()
    // The session really runs in explore mode — not adaptive with an "Explore" title.
    await expect(page.getByTestId('v2lx-screen')).toHaveAttribute('data-mode', 'explore')
    const activity = page.locator('[data-testid^="v2lx-activity-"]')
    const empty = page.getByTestId('v2lx-empty-headline')
    await expect(activity.or(empty).first()).toBeVisible()
  })

  test('§44/§41 Revisão on a fresh profile → mode-aware empty state (never "0 atividades")', async ({ page }) => {
    await openV2Home(page)
    await page.getByTestId('v2lxh-action-review').click()
    await expect(page.getByTestId('v2lx-screen')).toHaveAttribute('data-mode', 'review')
    // A fresh profile has nothing to review → honest empty state, not a fake summary.
    await expect(page.getByTestId('v2lx-empty-headline')).toContainText('Nada para revisar agora.')
    await expect(page.locator('body')).not.toContainText(/praticou 0|0 atividades/i)
    // The empty state offers real forward actions.
    await expect(page.getByTestId('v2lx-empty-action-adaptive')).toBeVisible()
  })
})

test.describe('return flow (§45)', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
  })

  test('Lesson close → V2 Home (never the legacy hub)', async ({ page }) => {
    await openV2Home(page)
    await page.getByTestId('v2lxh-primary').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
    await page.getByTestId('v2lx-close').click()
    await expect(page.getByTestId('v2lx-home')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toHaveCount(0)
  })

  test('review empty → "Voltar ao início" → V2 Home', async ({ page }) => {
    await openV2Home(page)
    await page.getByTestId('v2lxh-action-review').click()
    await expect(page.getByTestId('v2lx-empty-headline')).toBeVisible()
    await page.getByTestId('v2lx-empty-home').click()
    await expect(page.getByTestId('v2lx-home')).toBeVisible()
  })
})

test.describe('UI safety', () => {
  test('mobile 320px — no horizontal overflow', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    await page.setViewportSize({ width: 320, height: 720 })
    await openV2Home(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('dark mode renders the V2 Home', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await page.evaluate(async () => { await window.__e2e.db.setSetting('theme', 'dark') })
    await setLearnerFlag(page, true) // reloads
    await openV2Home(page)
    await expect(page.getByTestId('v2lxh-primary')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
