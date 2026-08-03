// pedagogy-v2-lab.spec.js — multi-pack lab scenarios of Slice V2.5 (§27):
// pack selection (still + but with independent sessions/states), cross-pack
// persistence across a full reload, and the curricular relation between the
// but pack and the still-owned but...still construction, driven by a
// controlled evidence fixture through the public storage layer.
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, readStore, attachErrorMonitor, PROFILE_A } from './helpers.js'
import {
  setPilotFlag, openLab, openPackSession, backToSelection,
  answerCurrentV2Activity, continueFromFeedback, seedV2Evidence,
} from './v2-helpers.js'

test.describe('pack selection', () => {
  test('lab lists still and but; but session and still session are independent', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // 1–3: open the lab, confirm both packs are offered with factual info.
    await openLab(page)
    await expect(page.getByTestId('v2-pack-still')).toBeVisible()
    await expect(page.getByTestId('v2-pack-but')).toBeVisible()
    await expect(page.getByTestId('v2-pack-but')).toContainText('4 usos · 5 construções')
    await expect(page.getByTestId('v2-pack-still-progress')).toContainText('Ainda não praticado')

    // 4–5: start but → exposure of a but exemplar, then recognition.
    //
    // Which sentence is NOT pinned, for a second reason on top of the one in
    // step 8: this spec runs without a generation seed, and the engine rotates
    // exemplars, so the opening exposure genuinely differs between runs — two
    // consecutive runs of this very test opened on "She is young, but she is
    // very responsible." and "The house is small, but it is comfortable."
    // A hardcoded sentence here was a coin flip, not an assertion.
    await openPackSession(page, 'but')
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    await expect(page.getByTestId('v2-text-en')).toContainText(/\bbut\b/)
    await page.getByTestId('v2-continue').click()
    await continueFromFeedback(page)
    const { recipe } = await answerCurrentV2Activity(page, { fixedElement: 'but' })
    expect(['meaning_recognition', 'listening_recognition']).toContain(recipe)
    await continueFromFeedback(page)

    // 6–7: back to the selection, start still.
    await backToSelection(page)
    await expect(page.getByTestId('v2-pack-but-progress')).not.toContainText('Ainda não praticado')
    await openPackSession(page, 'still')

    // 8: states are independent — but progress never advances still: the
    // still session starts at ITS first exposure.
    //
    // The sentence is NOT hardcoded. This assertion used to require
    // "I still live here." (exemplar:still.001), and V2.21-R2b legitimately
    // moved it: that fix stopped promotion from reordering authored primary
    // targets, so still.002/003/005 report their CONSTRUCTION as primary again
    // and the planner opens the pack on a construction target. The claim here
    // is independence — a first exposure, on a still exemplar, not a resumed
    // session — and pinning one sentence made a deliberate pedagogy fix look
    // like a regression.
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    const stillFirst = await page.getByTestId('v2-text-en').innerText()
    expect(stillFirst, 'the still session must open on a still exemplar').toMatch(/\bstill\b/i)
    expect(stillFirst, 'the still session must not open on a but exemplar').not.toMatch(/\bbut\b/i)

    // Evidence recorded so far belongs to but targets only.
    const evidence = await readStore(page, 'learner_evidence_v2')
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence.every((e) => e.target.target_id.includes(':but.'))).toBe(true)
    monitor.assertClean?.()
  })

  test('feedback and summary copy use the active lexeme (but, not still)', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await openLab(page)
    await openPackSession(page, 'but')

    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    await page.getByTestId('v2-continue').click()
    await expect(page.getByTestId('v2-feedback')).toBeVisible()
    await expect(page.getByTestId('v2-feedback')).toContainText('uso de but')
    await expect(page.getByTestId('v2-feedback')).not.toContainText('uso de still')
  })
})

test.describe('cross-pack persistence', () => {
  test('activity in both packs survives a full close/reopen; neither restarts from scratch', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // 1: record still activity (first exposure). The sentence is CAPTURED, not
    // asserted — step 4 below only needs to know which exposure was seen so it
    // can prove the session does not come back to it. Hardcoding it made this
    // test red from V2.21-R2b onwards (see the note in "pack selection").
    await openLab(page)
    await openPackSession(page, 'still')
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    const stillFirst = await page.getByTestId('v2-text-en').innerText()
    expect(stillFirst).toMatch(/\bstill\b/i)
    await page.getByTestId('v2-continue').click()
    await continueFromFeedback(page)
    await backToSelection(page)

    // 2: record but activity (first exposure). Captured for the same reason.
    await openPackSession(page, 'but')
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    const butFirst = await page.getByTestId('v2-text-en').innerText()
    expect(butFirst).toMatch(/\bbut\b/i)
    await page.getByTestId('v2-continue').click()
    await continueFromFeedback(page)

    // 3: close and reopen the app.
    await page.reload()
    await expect(page.locator('.app-shell')).toBeVisible()
    await page.waitForFunction(() => window.__e2e && window.__e2e.db)

    // 4: neither pack is back to a brand-new state.
    const evidence = await readStore(page, 'learner_evidence_v2')
    expect(evidence.some((e) => e.target.target_id.includes(':still.'))).toBe(true)
    expect(evidence.some((e) => e.target.target_id.includes(':but.'))).toBe(true)

    await openLab(page)
    await expect(page.getByTestId('v2-pack-still-progress')).not.toContainText('Ainda não praticado')
    await expect(page.getByTestId('v2-pack-but-progress')).not.toContainText('Ainda não praticado')

    // The still session resumes past the seen exposure…
    await openPackSession(page, 'still')
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    let text = await page.getByTestId('v2-pilot-screen').textContent()
    let testid = await page.locator('[data-testid^="v2-activity-"]').getAttribute('data-testid')
    expect(testid === 'v2-activity-exposure' && text.includes(stillFirst)).toBe(false)
    await backToSelection(page)

    // …and so does the but session.
    await openPackSession(page, 'but')
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    text = await page.getByTestId('v2-pilot-screen').textContent()
    testid = await page.locator('[data-testid^="v2-activity-"]').getAttribute('data-testid')
    expect(testid === 'v2-activity-exposure' && text.includes(butFirst)).toBe(false)
  })
})

test.describe('curricular relation (controlled fixture)', () => {
  test('with but contrast consolidated and still prerequisites met, the still session reaches the related but...still construction', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)

    // Fixture: consolidate the basic but contrast (cross-pack state) AND the
    // still-side prerequisites of the related construction (continuity +
    // lexical-verb + be-complement recognition, both modalities).
    const rec = (target_type, target_id) => [
      { target_type, target_id, modality: 'reading' },
      { target_type, target_id, modality: 'listening' },
    ]
    await seedV2Evidence(page, PROFILE_A, [
      ...rec('sense', 'sense:but.contrast'),
      ...rec('construction', 'construction:but.clause_but_clause'),
      ...rec('sense', 'sense:still.continuity'),
      ...rec('construction', 'construction:still.subject_still_lexical_verb'),
      ...rec('construction', 'construction:still.subject_be_still_complement'),
    ])

    // Open still: the engine selects the exposure of the but...still exemplar —
    // the related construction is selectable because its other prerequisites
    // are met (deterministic engine, mirrors the unit-level scenario).
    await openLab(page)
    await openPackSession(page, 'still')
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    await expect(page.getByTestId('v2-text-en')).toContainText('It was difficult, but I still tried.')
  })
})
