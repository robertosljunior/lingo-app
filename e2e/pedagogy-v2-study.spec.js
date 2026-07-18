// pedagogy-v2-study.spec.js — Study Planner V2 (Slice V2.6) E2E: the adaptive /
// review / explore study modes, the review queue diagnostic, cross-pack
// progression from a controlled fixture, persistence across a reload and the
// preserved V1 smoke. Focused pack sessions (still/but) stay covered by
// pedagogy-v2-lab.spec.js.
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, readStore, attachErrorMonitor, PROFILE_A } from './helpers.js'
import {
  setPilotFlag, openLab, openStudyMode, answerCurrentActivity, continueFromFeedback, seedV2Evidence,
} from './v2-helpers.js'

const rec = (target_type, target_id) => [
  { target_type, target_id, modality: 'reading' },
  { target_type, target_id, modality: 'listening' },
]

test.describe('study modes visible', () => {
  test('the lab offers Sessão adaptativa, Revisão and Explorar plus focused packs', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openLab(page)
    await expect(page.getByTestId('v2-mode-adaptive')).toBeVisible()
    await expect(page.getByTestId('v2-mode-review')).toBeVisible()
    await expect(page.getByTestId('v2-mode-explore')).toBeVisible()
    await expect(page.getByTestId('v2-pack-still')).toBeVisible()
    await expect(page.getByTestId('v2-pack-but')).toBeVisible()
    // Factual only — never a percentage or CEFR level on the home.
    const body = await page.getByTestId('v2-lab-screen').textContent()
    expect(body).not.toMatch(/\d+\s*%/)
  })
})

test.describe('adaptive session', () => {
  test('runs activities and re-evaluates focus each interaction', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openLab(page)
    await openStudyMode(page, 'adaptive')

    // Complete several activities; the study screen keeps presenting new plans,
    // which only happens if the planner re-evaluates after each interaction.
    let activities = 0
    for (let step = 0; step < 4; step++) {
      const recipe = await answerCurrentActivity(page)
      expect(recipe).toBeTruthy()
      activities++
      const complete = await page.getByTestId('v2-session-complete').count()
      if (complete) break
      await continueFromFeedback(page)
      await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    }
    expect(activities).toBeGreaterThanOrEqual(2)

    const evidence = await readStore(page, 'learner_evidence_v2')
    expect(evidence.length).toBeGreaterThan(0)
    monitor.assertClean?.()
  })

  test('a controlled fixture provokes a pack switch with a visible transition', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // Overdue reviews in BOTH packs (single old retrieval each — recognition
    // needs the construction seen too, so seed sense + its construction). In
    // review mode the planner cycles the overdue targets; the recency penalty
    // forces it to alternate packs, so a transition banner is bound to appear.
    await page.evaluate(async () => {
      const DAY = 24 * 60 * 60 * 1000
      const rows = [
        ['sense', 'sense:still.continuity', 9],
        ['construction', 'construction:still.subject_still_lexical_verb', 9],
        ['sense', 'sense:but.contrast', 8],
        ['construction', 'construction:but.clause_but_clause', 8],
      ]
      const events = rows.map(([target_type, target_id, days]) => ({
        schema_version: 1, learner_model_version: 1,
        evidence_id: `evidence:e2e.overdue.${target_id}`,
        profile_id: 'profile-a', interaction_id: `interaction:e2e.overdue.${target_id}`,
        session_id: 'seed', target: { target_type, target_id },
        exemplar_id: null,
        activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
        attribution: 'direct', outcome: 'correct', partial_score: null, assessment_confidence: 1,
        support: { features: [], hint_count: 0, attempt_number: 1 }, source: { source_type: 'test' },
        occurred_at: new Date(Date.now() - days * DAY).toISOString(),
      }))
      await window.__e2e.db.recordLearnerEvidenceBatchV2(events)
    })

    await openLab(page)
    await openStudyMode(page, 'review')

    // Over the review session a transition banner appears (pack alternation).
    // Wait for each activity to render before checking the banner so the
    // post-advance React re-render has settled (no first-frame race).
    let sawTransition = false
    for (let step = 0; step < 12; step++) {
      if (await page.getByTestId('v2-session-complete').count()) break
      const activity = page.locator('[data-testid^="v2-activity-"]')
      await expect(activity).toBeVisible()
      if (await page.getByTestId('v2-pack-transition').count()) { sawTransition = true; break }
      await answerCurrentActivity(page)
      if (await page.getByTestId('v2-session-complete').count()) break
      await continueFromFeedback(page)
    }
    expect(sawTransition).toBe(true)
    await expect(page.getByTestId('v2-pack-transition')).toContainText(/but|still/)
  })
})

test.describe('review mode', () => {
  test('with old evidence, review presents an already-seen target and introduces no new one', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // Seed an overdue review for a still use. Realistically, recognition of a
    // sense is only possible once its construction has been seen too, so seed
    // BOTH the sense and its lexical-verb construction (single old retrieval
    // each, 9 days ago → overdue with the 2-day default interval).
    await page.evaluate(async () => {
      const DAY = 24 * 60 * 60 * 1000
      const at = new Date(Date.now() - 9 * DAY).toISOString()
      const evt = (targetType, targetId) => ({
        schema_version: 1, learner_model_version: 1,
        evidence_id: `evidence:e2e.overdue.${targetId}`,
        profile_id: 'profile-a', interaction_id: `interaction:e2e.overdue.${targetId}`,
        session_id: 'seed', target: { target_type: targetType, target_id: targetId },
        exemplar_id: 'exemplar:still.001',
        activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
        attribution: 'direct', outcome: 'correct', partial_score: null, assessment_confidence: 1,
        support: { features: [], hint_count: 0, attempt_number: 1 }, source: { source_type: 'test' },
        occurred_at: at,
      })
      await window.__e2e.db.recordLearnerEvidenceBatchV2([
        evt('sense', 'sense:still.continuity'),
        evt('construction', 'construction:still.subject_still_lexical_verb'),
      ])
    })

    await openLab(page)
    await expect(page.getByTestId('v2-review-count')).toContainText('Revisões disponíveis:')
    await openStudyMode(page, 'review')

    // A review activity is presented (not the session-complete empty state).
    const activity = page.locator('[data-testid^="v2-activity-"]')
    await expect(activity).toBeVisible()
    // Review recovers an already-seen use: it never does a first-contact
    // exposure (exposure = introducing a brand-new use).
    const recipe = (await activity.getAttribute('data-testid')).replace('v2-activity-', '')
    expect(recipe).not.toBe('exposure')

    await answerCurrentActivity(page)
    // The recovered still.continuity target gained fresh evidence.
    const after = await readStore(page, 'learner_evidence_v2')
    expect(after.some((e) => e.target.target_id === 'sense:still.continuity')).toBe(true)
    // And review recorded NO exposure-attribution evidence (no new use introduced).
    expect(after.every((e) => e.attribution !== 'exposure')).toBe(true)
  })

  test('a brand-new learner sees the empty-review state', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openLab(page)
    await openStudyMode(page, 'review')
    await expect(page.getByTestId('v2-review-empty')).toBeVisible()
  })
})

test.describe('explore mode', () => {
  test('introduces a new eligible use', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openLab(page)
    await openStudyMode(page, 'explore')
    // First contact is an exposure of a new use.
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
  })
})

test.describe('cross-pack progression', () => {
  test('but contrast + still continuity known makes but...still reachable', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    await seedV2Evidence(page, PROFILE_A, [
      ...rec('sense', 'sense:but.contrast'),
      ...rec('construction', 'construction:but.clause_but_clause'),
      ...rec('sense', 'sense:still.continuity'),
      ...rec('construction', 'construction:still.subject_still_lexical_verb'),
      ...rec('construction', 'construction:still.subject_be_still_complement'),
    ])

    // Focused still session reaches the but...still exemplar (its prerequisites
    // — including the cross-pack but contrast — are met).
    await openLab(page)
    await page.getByTestId('v2-pack-still').click()
    await expect(page.getByTestId('v2-pilot-screen')).toBeVisible()
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    await expect(page.getByTestId('v2-text-en')).toContainText('It was difficult, but I still tried.')
  })
})

test.describe('persistence', () => {
  test('an adaptive session survives a reload and the planner keeps the prior evidence', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openLab(page)
    await openStudyMode(page, 'adaptive')

    await answerCurrentActivity(page)
    await continueFromFeedback(page)
    const before = await readStore(page, 'learner_evidence_v2')
    expect(before.length).toBeGreaterThan(0)

    await page.reload()
    await expect(page.locator('.app-shell')).toBeVisible()
    await page.waitForFunction(() => window.__e2e && window.__e2e.db)

    const after = await readStore(page, 'learner_evidence_v2')
    expect(after.length).toBeGreaterThanOrEqual(before.length)
  })
})
