// pedagogy-v2-22-interactive.spec.js — Slice V2.22-UX1 §36. The interactive
// exercises, driven through the REAL pipeline:
//
//   Study Planner → Focus Resolver → Lesson Engine → ActivityPlan → response
//     → Assessment → Evidence → Learner Model → next planning
//
// No forced plan on a learner-facing route. The only thing seeded is real,
// valid recognition Evidence through the public storage layer — exactly what the
// V2.20 visual matrix already does — so the Capability Entry policy can open the
// production recipes. The PLANNER still chooses every activity.

import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, waitForAdvance, seedV2Evidence, fillWordOrder, fillCompletion, wordOrderTargetTokens } from './v2-helpers.js'

// Since the V2.20-R production cutover the ROOT Home *is* the V2 learner home —
// there is no Training hub to open first, so these specs enter from the root.
async function openHome(page) {
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
}
async function startPractice(page) {
  await openHome(page)
  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-screen')).toBeVisible()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

// Seeds REAL recognition evidence for the `still` pack so Capability Entry can
// open controlled production. Nothing else is set up: the Planner still chooses
// every activity from this learner state.
async function seedAdvancedLearner(page) {
  const rec = (target_type, target_id) => [
    { target_type, target_id, modality: 'reading', n: 8 },
    { target_type, target_id, modality: 'listening', n: 8 },
  ]
  await seedV2Evidence(page, PROFILE_A, [
    ...rec('sense', 'sense:still.continuity'),
    ...rec('construction', 'construction:still.subject_still_lexical_verb'),
    ...rec('construction', 'construction:still.subject_be_still_complement'),
    // "but … still" — two FIXED ELEMENTS, so a genuine two-gap completion is
    // plannable. That shape is the whole point of the completion fix.
    ...rec('construction', 'construction:still.clause_but_subject_still_verb'),
  ])
  await page.reload()
}

async function boot(page, context) {
  // Runtime-aware Capability Entry (Slice V2.10) picks the first EXECUTABLE
  // modality for a new capability rung, and 'speaking' sorts before 'writing'.
  // A headless Chromium advertises SpeechRecognition but cannot actually hear
  // anything, so production would enter through a modality this harness can
  // never answer. Removing the API tells the runtime the truth about itself —
  // the same truth a desktop browser without speech input reports — and
  // production enters through writing instead. No plan is forced; the entry
  // modality is still the Engine's decision, taken from real capabilities.
  await context.addInitScript(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await seedAdvancedLearner(page)
  await page.setViewportSize({ width: 420, height: 900 })
}

const currentRecipe = (page) => page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')

/**
 * Tap the option the Engine actually authored as the target, read from the
 * E2E-only `window.__e2e.v2Activity` hook. This is what makes the production
 * recipes REACHABLE: recognition answered wrong keeps mastery under the
 * advancement threshold, so Capability Entry never opens controlled production
 * (the gap Slice V2.20 recorded and deferred). Nothing here forces a plan.
 */
async function answerRecognitionCorrectly(page) {
  const correct = await page.evaluate(() => window.__e2e?.v2Activity?.correct_option_id ?? null)
  const option = correct
    ? page.getByTestId(`v2lx-option-${correct}`)
    : page.locator('[data-testid^="v2lx-option-"]').first()
  await option.click()
}

// Answers whatever is on screen and advances. Used only to WALK to the recipe
// under test — the assertions live in the per-recipe blocks below.
async function passThrough(page) {
  const recipe = await currentRecipe(page)
  const before = await page.getByTestId('v2lx-step-counter').textContent()
  if (recipe === 'exposure') {
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
    return true
  }
  if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) {
    await answerRecognitionCorrectly(page)
  } else if (recipe === 'fixed_element_completion') {
    await fillCompletion(page)
    await page.getByTestId('v2lx-check').click()
  } else if (recipe === 'word_order_reconstruction') {
    await fillWordOrder(page)
    await page.getByTestId('v2lx-check').click()
  } else if (['guided_production', 'free_production'].includes(recipe)) {
    const input = page.getByTestId('v2lx-production-input')
    if (!(await input.count())) return false // speaking modality, no STT here
    await input.fill('I still live here.')
    await page.getByTestId('v2lx-check').click()
  } else {
    return false
  }
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
  return true
}

/**
 * Walk REAL sessions until one of `wanted` is presented. Restarts a session when
 * it completes. Returns the recipe reached, or null.
 */
async function reachRecipe(page, wanted, { sessions = 14, perSession = 18 } = {}) {
  const seen = []
  for (let s = 0; s < sessions; s++) {
    if (s > 0) await startPractice(page)
    for (let i = 0; i < perSession; i++) {
      if (await page.getByTestId('v2lx-summary').count()) break
      if (!(await page.locator('[data-testid^="v2lx-activity-"]').count())) break
      const recipe = await currentRecipe(page)
      seen.push(recipe)
      if (wanted.includes(recipe)) return recipe
      if (!(await passThrough(page))) break
    }
    // Back to the root Home, whichever end state the session landed in.
    for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
      const b = page.getByTestId(id)
      if (await b.count()) { await b.click(); break }
    }
  }
  // Reported so a failure says WHAT the planner served instead of just "null".
  console.log(`[reachRecipe] wanted ${wanted.join('|')}; the planner served: ${seen.join(', ') || '(nothing)'}`)
  return null
}

test('word order: build by tap, remove, re-place, check, feedback in place, continue (§36 A–G)', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  await startPractice(page)

  const reached = await reachRecipe(page, ['word_order_reconstruction'])
  expect(reached, 'the planner never served word_order_reconstruction').toBe('word_order_reconstruction')

  const bank = page.locator('[data-testid="v2lx-token-bank"] button')
  const total = await bank.count()
  expect(total).toBeGreaterThan(1)

  // A. the CTA is inert before anything is built
  await expect(page.getByTestId('v2lx-check')).toBeDisabled()

  // B. build the sentence by TAP — no drag anywhere
  await bank.first().click()
  await expect(page.locator('[data-testid^="v2lx-placed-"]')).toHaveCount(1)
  // the spent chip stays in the bank, faded and renamed
  await expect(page.locator('[data-testid="v2lx-token-bank"] button[data-used="true"]')).toHaveCount(1)
  const usedName = await page.locator('[data-testid="v2lx-token-bank"] button[data-used="true"]').getAttribute('aria-label')
  expect(usedName).toContain('já usada')

  // C. remove it again and put it back — reversible, no penalty
  await page.locator('[data-testid^="v2lx-placed-"]').first().click()
  await expect(page.locator('[data-testid^="v2lx-placed-"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="v2lx-token-bank"] button[data-used="true"]')).toHaveCount(0)

  // insertion gap: target position 1, then place a word there
  await page.getByTestId('v2lx-gap-0').click()
  await expect(page.getByTestId('v2lx-gap-0')).toHaveAttribute('data-active', 'true')
  const targetTotal = await fillWordOrder(page)
  await expect(page.locator('[data-testid^="v2lx-placed-"]')).toHaveCount(targetTotal)

  // D. only now is the CTA live
  await expect(page.getByTestId('v2lx-check')).toBeEnabled()
  const answerBefore = await page.getByTestId('v2lx-token-answer').innerText()
  await page.getByTestId('v2lx-check').click()

  // E. feedback appears on the SAME screen, with the answer still visible
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await expect(page.getByTestId('v2lx-activity-word-order')).toBeVisible()
  expect(await page.getByTestId('v2lx-token-answer').innerText()).toBe(answerBefore)
  // no per-token verdict is ever painted
  await expect(page.locator('[data-testid^="v2lx-placed-"][data-result]')).toHaveCount(0)

  // F/G. one CTA, now Continuar; the next activity slides in
  await expect(page.getByTestId('v2lx-check')).toHaveCount(0)
  const before = await page.getByTestId('v2lx-step-counter').textContent()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
  await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible()
})

test('completion: every gap is fillable and reversible; check → feedback (§36 H–J)', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  await startPractice(page)

  const reached = await reachRecipe(page, ['fixed_element_completion'])
  expect(reached, 'the planner never served fixed_element_completion').toBe('fixed_element_completion')

  const gaps = Number(await page.getByTestId('v2lx-activity-completion').getAttribute('data-gaps'))
  expect(gaps).toBeGreaterThan(0)
  console.log(`[completion] this plan has ${gaps} gap(s)`)
  // ONE slot per gap — the audited defect is gone.
  await expect(page.locator('[data-testid^="v2lx-slot-"]')).toHaveCount(gaps)
  // ...and no literal blank is left in the sentence for a gap that cannot be filled.
  expect(await page.getByTestId('v2lx-sentence').innerText()).not.toMatch(/_{3,}/)

  await expect(page.getByTestId('v2lx-check')).toBeDisabled()

  const bank = page.locator('[data-testid="v2lx-word-bank"] button')
  if (await bank.count()) {
    await bank.first().click()
    await expect(page.getByTestId('v2lx-slot-0')).toHaveAttribute('data-filled', 'true')
    // reversible: tapping the filled slot empties it and returns the chip
    await page.getByTestId('v2lx-slot-0').click()
    await expect(page.getByTestId('v2lx-slot-0')).not.toHaveAttribute('data-filled', 'true')
  }
  await fillCompletion(page)
  // The CTA only opens once EVERY gap holds something.
  await expect(page.getByTestId('v2lx-check')).toBeEnabled()

  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await expect(page.getByTestId('v2lx-activity-completion')).toBeVisible()

  const before = await page.getByTestId('v2lx-step-counter').textContent()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
})

test('guided writing: the answer survives the feedback (§36 K–M)', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  await startPractice(page)

  const reached = await reachRecipe(page, ['guided_production', 'free_production'])
  expect(reached, 'the planner never served a written production recipe').toBeTruthy()

  const input = page.getByTestId('v2lx-production-input')
  test.skip(!(await input.count()), 'production planned in the speaking modality; no STT in this runtime')

  await expect(page.getByTestId('v2lx-check')).toBeDisabled()
  await input.fill('I still live here.')
  await expect(page.getByTestId('v2lx-word-count')).toContainText('4 palavras')
  await expect(page.getByTestId('v2lx-check')).toBeEnabled()

  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()

  // §17 — the learner's own text is still there, unchanged, and was NOT quietly
  // replaced by the authored reference.
  await expect(input).toHaveValue('I still live here.')
  await expect(input).toBeDisabled()
  await expect(page.getByTestId('v2lx-write-area')).toHaveAttribute('data-answered', 'true')
})

test('double submit and double advance stay impossible (§34)', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  await startPractice(page)

  const reached = await reachRecipe(page, ['word_order_reconstruction', 'fixed_element_completion'])
  expect(reached).toBeTruthy()
  if (reached === 'word_order_reconstruction') await fillWordOrder(page)
  else await fillCompletion(page)

  const check = page.getByTestId('v2lx-check')
  await expect(check).toBeEnabled()
  const counterBefore = await page.getByTestId('v2lx-step-counter').textContent()
  // Two taps as fast as the harness can manage: exactly ONE evaluation.
  await check.click()
  await check.click({ force: true, timeout: 2000 }).catch(() => {})
  await expect(page.getByTestId('v2lx-feedback')).toHaveCount(1)

  // Same for Continuar: a second tap during the slide must not advance twice.
  const cont = page.getByTestId('v2lx-continue')
  await cont.click()
  await cont.click({ force: true, timeout: 2000 }).catch(() => {})
  await waitForAdvance(page, counterBefore)
  const after = await page.getByTestId('v2lx-step-counter').textContent()
  expect(Number(after.replace(/\D/g, '')) - Number(counterBefore.replace(/\D/g, ''))).toBe(1)
})

test('keyboard alone can build and submit a word order (§10)', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  await startPractice(page)

  const reached = await reachRecipe(page, ['word_order_reconstruction'])
  expect(reached).toBe('word_order_reconstruction')

  const bank = page.locator('[data-testid="v2lx-token-bank"] button')
  const targetTokens = await wordOrderTargetTokens(page)
  const bankTexts = await bank.allTextContents()
  const firstTargetIndex = bankTexts.findIndex((text) => text.trim() === targetTokens[0])
  expect(firstTargetIndex, 'first target token exists in the bank').toBeGreaterThanOrEqual(0)
  const firstTarget = bank.nth(firstTargetIndex)

  // Enter on a focused TRUE bank chip places it; Enter on a placed chip removes it.
  await firstTarget.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid^="v2lx-placed-"]')).toHaveCount(1)
  await page.locator('[data-testid^="v2lx-placed-"]').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-testid^="v2lx-placed-"]')).toHaveCount(0)

  // Space works too, and focus is never thrown to <body> by the move.
  await firstTarget.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-testid^="v2lx-placed-"]')).toHaveCount(1)
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON')

  // Add only the remaining TRUE tokens. Distractors stay available by design.
  for (const token of targetTokens.slice(1)) {
    const free = page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])')
    const texts = await free.allTextContents()
    const at = texts.findIndex((text) => text.trim() === token)
    expect(at, `target token ${token} remains available`).toBeGreaterThanOrEqual(0)
    await free.nth(at).click()
  }
  await expect(page.locator('[data-testid^="v2lx-placed-"]')).toHaveCount(targetTokens.length)
  const order = await page.locator('[data-testid^="v2lx-placed-"]').allInnerTexts()
  const second = page.locator('[data-testid^="v2lx-placed-"]').nth(1)
  await second.focus()
  await page.keyboard.press('ArrowLeft')
  const moved = await page.locator('[data-testid^="v2lx-placed-"]').allInnerTexts()
  expect(moved[0]).toBe(order[1])
  expect(moved[1]).toBe(order[0])
  expect([...moved].sort()).toEqual([...order].sort()) // nothing lost or duplicated

  await expect(page.getByTestId('v2lx-check')).toBeEnabled()
})
