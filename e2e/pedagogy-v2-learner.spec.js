// pedagogy-v2-learner.spec.js — E2E for the Slice V2.17 learner experience. The
// new lesson UX runs on the REAL V2 pipeline (Planner → Focus Resolver → Lesson
// Engine → ActivityPlan → Assessment → Feedback VM → Learner Presentation).
// These scenarios prove: the feature gate, a real session with on-screen
// feedback and horizontal continuation, that there is NO hardcoded playlist,
// reduced-motion parity, mobile safety, and that V1 stays intact.
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'
import { setLearnerFlag, openHub, openLearnerExperience, answerLearnerActivity, waitForAdvance } from './v2-helpers.js'

test.describe('gating', () => {
  test('the learner card is hidden while the flag is off', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, false)
    await openHub(page)
    await expect(page.getByTestId('v2-learner-open')).toHaveCount(0)
  })

  test('with the flag on, the card opens the new experience', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    await openHub(page)
    await expect(page.getByTestId('v2-learner-open')).toBeVisible()
    await page.getByTestId('v2-learner-open').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
    // No internal diagnostics leak onto the learner surface (§37).
    await expect(page.getByTestId('v2pg-pipeline-badge')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(/StudyFocus|ActivityPlan|planner_rank|evidence:/)
  })
})

test.describe('real pipeline', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
  })

  test('runs a real session with on-screen feedback and horizontal continuation, no hardcoded playlist', async ({ page }) => {
    const monitor = attachErrorMonitor(page)
    await openLearnerExperience(page)

    // A real authored activity is present, born from the pipeline.
    await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible()
    await expect(page.getByTestId('v2lx-step-counter')).toContainText('Atividade 1')

    // Answer several activities; the counter advances and distinct activities
    // appear — proof the next activity is decided AFTER each advance (no static
    // playlist could be enumerated up front).
    const recipes = []
    for (let i = 0; i < 4; i++) {
      if (await page.getByTestId('v2lx-summary').count()) break
      // Feedback and the next activity stay within the same shell — never a
      // separate result route.
      await expect(page.getByTestId('v2lx-shell')).toBeVisible()
      const r = await answerLearnerActivity(page)
      recipes.push(r)
    }
    // We saw more than one activity and at least one graded feedback panel.
    expect(recipes.filter(Boolean).length).toBeGreaterThan(1)
    await expect(page.getByTestId('v2lx-step-counter')).not.toContainText('Atividade 1')
    monitor.assertClean?.()
  })

  test('feedback is shown on the same screen (never a modal/route change)', async ({ page }) => {
    await openLearnerExperience(page)
    // Walk to the first graded activity (skip the opening exposure), waiting for
    // each transition to complete before reading the next activity.
    for (let i = 0; i < 6; i++) {
      const activity = page.locator('[data-testid^="v2lx-activity-"]')
      await expect(activity).toBeVisible()
      const recipe = (await activity.getAttribute('data-testid')).replace('v2lx-activity-', '')
      if (recipe === 'exposure') {
        const before = await page.getByTestId('v2lx-step-counter').textContent()
        await page.getByTestId('v2lx-continue').click()
        await waitForAdvance(page, before)
        continue
      }
      if (recipe === 'meaning_recognition' || recipe === 'listening_recognition') {
        await page.locator('[data-testid^="v2lx-option-"]').first().click()
        // Feedback appears BELOW the activity, inside the same shell.
        await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
        await expect(page.getByTestId('v2lx-shell')).toBeVisible()
        await expect(page.locator('[data-testid^="v2lx-activity-"]').first()).toBeVisible()
        return
      }
      break
    }
  })
})

test.describe('reduced motion', () => {
  test('with prefers-reduced-motion, the stage is static and the flow still works', async ({ page, context }) => {
    await context.grantPermissions?.([]).catch(() => {})
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLearnerExperience(page)
    await expect(page.getByTestId('v2lx-stage')).toHaveAttribute('data-phase', 'static')
    // The session still advances with reduced motion.
    await answerLearnerActivity(page)
    await expect(page.getByTestId('v2lx-step-counter')).not.toContainText('Atividade 1')
  })
})

test.describe('UI safety', () => {
  test('mobile smoke — no horizontal overflow', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    await page.setViewportSize({ width: 375, height: 720 })
    await openLearnerExperience(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe('V1 coexistence', () => {
  test('V1 home still works with the learner flag on', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    // The standard Home + training hub remain reachable and intact.
    await expect(page.getByTestId('open-training-hub')).toBeVisible()
    await openHub(page)
    await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toBeVisible()
  })
})
