// red-followup.spec.js — the three PRE-EXISTING red tests, re-stated.
//
// The V2.22-UX2-R full run surfaced four failures. One
// (`pedagogy-v2-22-interactive.spec.js:264`) was a four-worker load flake and
// passes in isolation. The other three reproduce identically on unmodified
// `main`, verified in a clean worktree, and they are all the same kind of
// defect: a test that pinned an INCIDENTAL detail instead of the claim it was
// written to make, then went red when the product legitimately moved.
//
//   1. `production-cutover.spec.js` clicked a bottom-nav "Início" on the V2
//      LESSON screen. `V2LessonShell` has never rendered a bottom navigation —
//      it is a focused, full screen by design, exactly as the mockup shows it —
//      so the click waited out its 180s timeout. The §9 claim is about WHERE
//      leaving the lesson lands you, not about which chrome takes you there.
//
//   2/3. `pedagogy-v2-lab.spec.js` required the still pack's first exposure to
//      be "I still live here." (exemplar:still.001). V2.21-R2b — "promotion
//      must not reorder authored primary targets" — restored the authored
//      target order on still.002/003/005, so those exemplars report their
//      CONSTRUCTION as the primary target again and the planner opens the pack
//      on a construction target. The pack now legitimately opens on a different
//      sentence. That spec has not been touched since V2.5, so a deliberate
//      pedagogy fix has been reading as a regression ever since.
//
// This file asserts what those three tests MEANT, independently of the fixed
// specs, so the intent stays covered even if the originals drift again. It is
// deliberately small: it is a follow-up on known red, not a second suite.
import { test, expect } from '@playwright/test'
import { enableTestHooks, gotoApp, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'
import { completeV2FirstRun, setPilotFlag, openLab, openPackSession, backToSelection, continueFromFeedback } from './v2-helpers.js'

// ---------------------------------------------------------------------------
// 1 — leaving the V2 lesson lands on the V2 Home (production-cutover.spec.js:82)
// ---------------------------------------------------------------------------

test('the V2 lesson is a focused screen, and leaving it lands on the V2 Home', async ({ page, context }) => {
  test.setTimeout(300_000)
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await gotoApp(page)
  await completeV2FirstRun(page, 'Rob')

  const home = page.getByTestId('v2lx-home')
  await expect(home).toBeVisible({ timeout: 20_000 })
  // The HOME has the navigation…
  await expect(page.getByRole('button', { name: 'Início' })).toBeVisible()

  await page.getByTestId('v2lxh-primary').click()
  const lesson = page.getByTestId('v2lx-screen')
  await expect(lesson).toBeVisible({ timeout: 30_000 })
  await expect(lesson).toHaveAttribute('data-experience', 'v2')

  // …and the LESSON deliberately does not. This is the assertion the old test
  // had backwards: it is not an omission to be fixed, it is the design.
  await expect(page.getByRole('button', { name: 'Início' })).toHaveCount(0)
  await expect(page.locator('.bottom-nav')).toHaveCount(0)

  // The real affordance returns to the V2 Home — never to the V1 one.
  await page.getByTestId('v2lx-close').click()
  await expect(home).toBeVisible({ timeout: 20_000 })
  await expect(home).toHaveAttribute('data-home-version', 'ux2')
  await expect(page.getByTestId('open-training-hub')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Início' })).toBeVisible()

  monitor.assertClean()
})

// ---------------------------------------------------------------------------
// 2/3 — lab pack independence and resume (pedagogy-v2-lab.spec.js:14 and :70)
// ---------------------------------------------------------------------------

/** The lexeme a lab exposure belongs to, read from the sentence itself. */
const lexemeOf = (text) => (/\bbut\b/i.test(text) ? 'but' : /\bstill\b/i.test(text) ? 'still' : null)

test('each lab pack opens on its OWN first exposure, whatever sentence that is', async ({ page, context }) => {
  test.setTimeout(300_000)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setPilotFlag(page, true)
  await openLab(page)

  // Run `but` first, so any leakage would push `still` past its own opening.
  await openPackSession(page, 'but')
  await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
  const butFirst = await page.getByTestId('v2-text-en').innerText()
  expect(lexemeOf(butFirst), `the but pack opened on: ${butFirst}`).toBe('but')
  await page.getByTestId('v2-continue').click()
  await continueFromFeedback(page)
  await backToSelection(page)

  // `still` must still be at ITS first exposure — an exposure, on a still
  // exemplar. WHICH still sentence is the planner's call and moved in
  // V2.21-R2b; that it is a still exposure at all is the claim.
  await openPackSession(page, 'still')
  await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
  const stillFirst = await page.getByTestId('v2-text-en').innerText()
  expect(lexemeOf(stillFirst), `the still pack opened on: ${stillFirst}`).toBe('still')
  expect(stillFirst).not.toBe(butFirst)
})

test('neither lab pack restarts from scratch after a full close and reopen', async ({ page, context }) => {
  test.setTimeout(300_000)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setPilotFlag(page, true)
  await openLab(page)

  // Record one activity in each pack, capturing the exposure each opened on.
  const seen = {}
  for (const pack of ['still', 'but']) {
    await openPackSession(page, pack)
    await expect(page.getByTestId('v2-activity-exposure')).toBeVisible()
    seen[pack] = await page.getByTestId('v2-text-en').innerText()
    expect(lexemeOf(seen[pack]), `the ${pack} pack opened on: ${seen[pack]}`).toBe(pack)
    await page.getByTestId('v2-continue').click()
    await continueFromFeedback(page)
    await backToSelection(page)
  }

  // A full reload — the state must come back from storage, not from memory.
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
  await openLab(page)

  // Neither pack is back at the exposure it already showed.
  for (const pack of ['still', 'but']) {
    await openPackSession(page, pack)
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    const testid = await page.locator('[data-testid^="v2-activity-"]').getAttribute('data-testid')
    const text = await page.getByTestId('v2-pilot-screen').textContent()
    expect(
      testid === 'v2-activity-exposure' && text.includes(seen[pack]),
      `the ${pack} session restarted from its first exposure: ${seen[pack]}`,
    ).toBe(false)
    await backToSelection(page)
  }
})
