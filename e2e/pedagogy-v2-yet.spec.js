// pedagogy-v2-yet.spec.js — Slice V2.11 (§43): the third functional lexeme
// `yet` served by the UNCHANGED generic UI/runtime. Pack selection lists the
// three packs and the yet session persists across a full reload; a controlled
// cross-pack fixture (but contrast + yet temporal ladder) makes the ADAPTIVE
// planner select the concessive yet intro; the same-lexeme/new-use fixture
// proves a session never restarts from the mandatory temporal beginning; and
// the V1 generated lesson keeps working with the pilot flag on.
import { test, expect } from '@playwright/test'
import {
  enableTestHooks, seedFixtures, readStore, attachErrorMonitor, PROFILE_A, GEN_SEED,
  generateFromHome, readLessonWithQuestions, answerCurrentQuestion,
} from './helpers.js'
import {
  setPilotFlag, openLab, openPackSession, backToSelection, openStudyMode,
  answerCurrentV2Activity, answerCurrentActivity, continueFromFeedback, seedV2Evidence,
} from './v2-helpers.js'

const rec = (target_type, target_id) => [
  { target_type, target_id, modality: 'reading' },
  { target_type, target_id, modality: 'listening' },
]

test.describe('yet pack selection and persistence', () => {
  test('lab lists still/but/yet; the yet session runs exposure + an assessed activity and survives exit/return + reload', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // 1: the lab offers the THREE packs with factual info (yet last by
    // catalog_order, never a percentage).
    await openLab(page)
    await expect(page.getByTestId('v2-pack-still')).toBeVisible()
    await expect(page.getByTestId('v2-pack-but')).toBeVisible()
    await expect(page.getByTestId('v2-pack-yet')).toBeVisible()
    await expect(page.getByTestId('v2-pack-yet')).toContainText('4 usos · 8 construções')
    await expect(page.getByTestId('v2-pack-yet-progress')).toContainText('Ainda não praticado')
    const labText = await page.getByTestId('v2-lab-screen').textContent()
    expect(labText.indexOf('still')).toBeLessThan(labText.indexOf('but'))
    expect(labText.indexOf('but')).toBeLessThan(labText.indexOf('yet'))
    expect(labText).not.toMatch(/\d+\s*%/)

    // 2: open yet → the first-contact exposure of the temporal core.
    await openPackSession(page, 'yet')
    await expect(page.getByTestId('v2-pilot-screen')).toHaveAttribute('data-pack-id', 'pedagogy_v2_yet')
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    await expect(page.getByTestId('v2-text-en')).toContainText("I'm not ready yet.")
    await page.getByTestId('v2-continue').click()
    // Feedback copy names the active lexeme, never a sibling pack's.
    await expect(page.getByTestId('v2-feedback')).toBeVisible()
    await expect(page.getByTestId('v2-feedback')).toContainText('uso de yet')
    await expect(page.getByTestId('v2-feedback')).not.toContainText('uso de still')
    await page.getByTestId('v2-feedback-continue').click()

    // 3: complete an ASSESSED activity (recognition of the exposed use).
    const { recipe } = await answerCurrentV2Activity(page, { fixedElement: 'yet' })
    expect(['meaning_recognition', 'listening_recognition']).toContain(recipe)
    await continueFromFeedback(page)

    // 4: exit → the selection reflects real progress; evidence targets yet only.
    await backToSelection(page)
    await expect(page.getByTestId('v2-pack-yet-progress')).not.toContainText('Ainda não praticado')
    const evidence = await readStore(page, 'learner_evidence_v2')
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence.every((e) => e.target.target_id.includes(':yet.'))).toBe(true)
    expect(evidence.some((e) => e.activity.capability === 'recognition' && e.attribution === 'direct')).toBe(true)

    // 5: full close/reopen → persistence: the yet session resumes PAST the
    // already-seen first exposure instead of restarting.
    await page.reload()
    await expect(page.locator('.app-shell')).toBeVisible()
    await page.waitForFunction(() => window.__e2e && window.__e2e.db)
    await openLab(page)
    await expect(page.getByTestId('v2-pack-yet-progress')).not.toContainText('Ainda não praticado')
    await openPackSession(page, 'yet')
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    const testid = await page.locator('[data-testid^="v2-activity-"]').getAttribute('data-testid')
    const text = await page.getByTestId('v2-pilot-screen').textContent()
    expect(testid === 'v2-activity-exposure' && text.includes("I'm not ready yet.")).toBe(false)
    monitor.assertClean?.()
  })
})

test.describe('cross-pack: but contrast unlocks concessive yet', () => {
  test('with but contrast known and the yet temporal ladder consolidated, the concessive yet construction becomes reachable', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // Fixture: consolidated recognition of but contrast — the CROSS-PACK
    // prerequisite of the concessive exemplar (its prerequisites name
    // sense:but.contrast + construction:but.clause_but_clause) — plus the full
    // yet temporal ladder, so the next new yet use the engine can serve is the
    // concessive one. The concessive is only reachable BECAUSE the but-side
    // prerequisite is met: this is the but→yet cross-pack unlock (§16 Case B).
    await seedV2Evidence(page, PROFILE_A, [
      ...rec('sense', 'sense:but.contrast'),
      ...rec('construction', 'construction:but.clause_but_clause'),
      ...rec('sense', 'sense:yet.temporal_pending'),
      ...rec('construction', 'construction:yet.subject_be_not_complement_yet'),
      ...rec('construction', 'construction:yet.interrogative_clause_yet'),
      ...rec('construction', 'construction:yet.negative_perfect_yet'),
      ...rec('construction', 'construction:yet.have_yet_to_infinitive'),
    ])

    // The focused yet session (deterministic engine, no cross-pack tie-break)
    // reaches the concessive exemplar: every temporal use is consolidated and
    // the cross-pack but prerequisite is satisfied.
    await openLab(page)
    await openPackSession(page, 'yet')
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    await expect(page.getByTestId('v2-text-en')).toContainText('It was difficult, yet we continued.')

    // Completing the exposure records evidence on the concessive targets —
    // the new use enters through the SAME generic evidence pipeline.
    await page.getByTestId('v2-continue').click()
    await continueFromFeedback(page)
    const evidence = await readStore(page, 'learner_evidence_v2')
    expect(evidence.some((e) => e.target.target_id === 'sense:yet.concessive')).toBe(true)
  })

  test('adaptive mode discovers the yet pack and serves yet activities without any lexical special-case', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // A brand-new learner: the adaptive planner discovers the three packs from
    // the registry alone. Drive several activities and confirm yet is reached
    // through the generic pipeline (no if-lexeme-yet anywhere).
    await seedV2Evidence(page, PROFILE_A, [
      ...rec('sense', 'sense:yet.temporal_pending'),
      ...rec('construction', 'construction:yet.subject_be_not_complement_yet'),
    ])
    await openLab(page)
    await openStudyMode(page, 'adaptive')

    let sawYet = false
    for (let step = 0; step < 10; step++) {
      if (await page.getByTestId('v2-session-complete').count()) break
      const activity = page.locator('[data-testid^="v2-activity-"]')
      await expect(activity).toBeVisible()
      await answerCurrentActivity(page)
      if (await page.getByTestId('v2-session-complete').count()) break
      await continueFromFeedback(page)
    }
    const evidence = await readStore(page, 'learner_evidence_v2')
    sawYet = evidence.some((e) => e.target.target_id.includes(':yet.') && e.session_id !== 'session:e2e-fixture')
    expect(sawYet).toBe(true)
  })
})

test.describe('same lexeme, new use: no forced temporal restart', () => {
  test('with temporal yet practiced and concessive unseen, the focused session advances instead of restarting at the first temporal exposure', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // Fixture: the temporal core is already practiced (sense + its first two
    // constructions, both recognition modalities); every other use is unseen.
    await seedV2Evidence(page, PROFILE_A, [
      ...rec('sense', 'sense:yet.temporal_pending'),
      ...rec('construction', 'construction:yet.subject_be_not_complement_yet'),
      ...rec('construction', 'construction:yet.interrogative_clause_yet'),
    ])
    // Sanity: the fixture carries NO concessive evidence — knowing temporal
    // yet is not recorded as knowing the concessive use.
    const seeded = await readStore(page, 'learner_evidence_v2')
    expect(seeded.some((e) => e.target.target_id.includes('concessive'))).toBe(false)

    // The focused yet session does NOT go back to the mandatory temporal
    // beginning: it introduces the NEXT unseen construction of the ladder.
    await openLab(page)
    await openPackSession(page, 'yet')
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    const text = await page.getByTestId('v2-text-en').textContent()
    expect(text).not.toContain("I'm not ready yet.")
    expect(text).toContain("We haven't finished yet.")
  })
})

test.describe('V1 smoke', () => {
  test('the V1 generated lesson still works with three packs registered and the pilot flag on', async ({ page, context }) => {
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
