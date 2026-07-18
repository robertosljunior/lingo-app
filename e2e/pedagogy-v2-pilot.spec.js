// pedagogy-v2-pilot.spec.js — pedagogy-V2 lab specs, updated for the
// multi-pack lab of Slice V2.5: the Hub card opens a pack SELECTION screen
// ("Laboratório V2"), and a session is scoped to the selected pack. The
// original V2.4 session guarantees (first exposure, listening contract,
// persistence, idempotency, V1 smoke) are preserved through the still pack.
// Isolated from the V1 suites; the semantic pipeline is never required.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, readStore, attachErrorMonitor,
  generateFromHome, readLessonWithQuestions, answerCurrentQuestion, GEN_SEED, PROFILE_A,
} from './helpers.js'
import {
  setPilotFlag, openHub, openLab, openPackSession, backToSelection,
  answerCurrentV2Activity, continueFromFeedback,
} from './v2-helpers.js'

async function openStillSession(page) {
  await openLab(page)
  await openPackSession(page, 'still')
}

test.describe('feature flag', () => {
  test('card absent when disabled, present when enabled, direct access guarded', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })

    await openHub(page)
    await expect(page.getByTestId('v2-pilot-card')).toHaveCount(0)

    await setPilotFlag(page, true)
    await openHub(page)
    await expect(page.getByTestId('v2-pilot-card')).toBeVisible()
    await expect(page.getByTestId('v2-pilot-card')).toContainText('Laboratório V2')
    await expect(page.getByTestId('v2-pilot-card')).toContainText('Aprofunde palavras fundamentais')

    // Guard: with the flag off again, the card disappears.
    await setPilotFlag(page, false)
    await openHub(page)
    await expect(page.getByTestId('v2-pilot-card')).toHaveCount(0)
  })

  test('settings screen exposes the experimental toggle (one flag for the whole lab)', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await page.getByRole('button', { name: /Ajustes|Config/ }).first().click()
    const toggle = page.getByTestId('toggle-pedagogy-v2-pilot')
    await expect(toggle).toBeVisible()
    await expect(page.getByTestId('experimental-settings')).toContainText('modelo pedagógico em desenvolvimento')
    await toggle.click()
    await expect(toggle).toHaveText('Ativado')
  })
})

test.describe('first still session', () => {
  test('exposure with full sentence → answer next activity → feedback → next reflects recorded state', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openStillSession(page)

    // 1st activity for a brand-new learner: exposure of the first exemplar,
    // full English sentence + translation.
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    await expect(page.getByTestId('v2-text-en')).toContainText('I still live here.')
    await expect(page.getByTestId('v2-text-pt')).toContainText('Eu ainda moro aqui.')
    await page.getByTestId('v2-continue').click()

    // Exposure records evidence and advances.
    await continueFromFeedback(page)
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    const evidence = await readStore(page, 'learner_evidence_v2')
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence.every((e) => e.profile_id === PROFILE_A)).toBe(true)

    // Answer the next activity and observe feedback.
    const { recipe } = await answerCurrentV2Activity(page)
    expect(recipe).not.toBe(null)
    await expect(page.getByTestId('v2-feedback')).toBeVisible()
    await page.getByTestId('v2-feedback-continue').click()

    // The next selection reflects the recorded state: evidence grew and the
    // session moved to a new activity id (sequence 2).
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    const evidence2 = await readStore(page, 'learner_evidence_v2')
    expect(evidence2.length).toBeGreaterThan(evidence.length)
    monitor.assertClean?.()
  })

  test('listening: English sentence hidden before the answer, audio actionable', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openStillSession(page)

    // Walk the session until a listening activity appears (deterministic
    // engine; the diversity weight surfaces the unused modality early).
    let found = false
    for (let step = 0; step < 10; step++) {
      const activity = page.locator('[data-testid^="v2-activity-"]')
      await expect(activity).toBeVisible()
      const testid = await activity.getAttribute('data-testid')
      if (testid === 'v2-activity-listening_recognition') { found = true; break }
      await answerCurrentV2Activity(page)
      const complete = await page.getByTestId('v2-session-complete').count()
      if (complete) break
      await continueFromFeedback(page)
    }
    expect(found, 'a listening activity should occur in the first session').toBe(true)

    // English sentence NOT shown before the answer; audio button available.
    await expect(page.getByTestId('v2-text-en')).toHaveCount(0)
    await expect(page.getByTestId('v2-audio-button')).toBeVisible()
    await page.getByTestId('v2-audio-button').click()

    // Answer → after feedback the sentence may appear (reference shown).
    await page.locator('[data-testid^="v2-option-"]').first().click()
    await page.getByTestId('v2-submit').click()
    await expect(page.getByTestId('v2-feedback')).toBeVisible()
    await expect(page.getByTestId('v2-feedback-reference')).toBeVisible()
  })
})

test.describe('persistence and idempotency', () => {
  test('a new session starts from the persisted evidence, not from scratch', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openStillSession(page)

    // Complete exposure + one assessed interaction.
    await page.getByTestId('v2-continue').click()
    await continueFromFeedback(page)
    await answerCurrentV2Activity(page)
    await continueFromFeedback(page)
    const before = await readStore(page, 'learner_evidence_v2')
    expect(before.length).toBeGreaterThan(0)

    // Leave the session (back returns to the lab selection) and start a NEW one.
    await backToSelection(page)
    await openPackSession(page, 'still')
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()

    // Not a brand-new learner anymore: the first activity of the new session
    // is NOT the exposure of the very first exemplar again.
    const testid = await page.locator('[data-testid^="v2-activity-"]').getAttribute('data-testid')
    const text = await page.getByTestId('v2-pilot-screen').textContent()
    const isFirstExposureAgain = testid === 'v2-activity-exposure' && text.includes('I still live here.')
    expect(isFirstExposureAgain).toBe(false)
    // Evidence from the previous session is still there.
    const after = await readStore(page, 'learner_evidence_v2')
    expect(after.length).toBeGreaterThanOrEqual(before.length)
  })

  test('double-click on submit does not duplicate evidence', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openStillSession(page)

    await expect(page.getByTestId('v2-continue')).toBeVisible()
    await page.getByTestId('v2-continue').dblclick()
    await expect(page.getByTestId('v2-feedback')).toBeVisible()
    const evidence = await readStore(page, 'learner_evidence_v2')
    const ids = evidence.map((e) => e.evidence_id)
    expect(new Set(ids).size).toBe(ids.length)
    // One exposure interaction only.
    const interactions = new Set(evidence.map((e) => e.interaction_id))
    expect(interactions.size).toBe(1)
    expect([...interactions][0]).toMatch(/:1$/) // attempt 1
  })
})

test.describe('V1 smoke', () => {
  test('V1 generated lesson still works with the pilot flag enabled', async ({ page, context }) => {
    await enableTestHooks(context, { seed: GEN_SEED })
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    const lessonId = await generateFromHome(page, { count: 10 })
    const { questions } = await readLessonWithQuestions(page, lessonId)
    expect(questions.length).toBeGreaterThan(0)
    await page.getByTestId('start-generated-lesson').click()
    await expect(page.getByTestId('question-type')).toBeVisible()
    await answerCurrentQuestion(page, questions[0])
    await expect(page.getByTestId('feedback-sheet')).toBeVisible()
  })
})
