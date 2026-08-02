// pedagogy-v2-22-screenshots.spec.js — Slice V2.22-UX1 §35 visual regression
// matrix. It does not assert; it RENDERS the REAL app driven by the REAL
// pipeline and writes PNGs to test-evidence/v2-22-ux1-production/ so the
// implementation can be compared frame by frame with the V2.22-UX0 handoff.
//
// Runs only when V2_SHOTS=1, so the normal suite is unaffected.
//
// Every frame comes from a real session: real plans from the Planner, real
// Assessment, real feedback variants. Nothing is reconstructed statically and no
// plan is forced. Two things are set up, both legitimate:
//   • real recognition Evidence is seeded through the public storage layer, so
//     Capability Entry opens the production recipes (as the V2.20 matrix does);
//   • speech input is removed from the runtime so production enters through
//     WRITING — a headless browser cannot answer a speaking activity, and the
//     runtime-aware entry policy is doing exactly its job when it picks the
//     modality this runtime can execute.
//
// This closes the gap the V2.20 matrix recorded: completion, word order and
// guided production are captured here for the first time.

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, waitForAdvance, seedV2Evidence, fillWordOrder, fillCompletion } from './v2-helpers.js'

const OUT = path.resolve('test-evidence/v2-22-ux1-production')
const enabled = process.env.V2_SHOTS === '1'

test.skip(!enabled, 'set V2_SHOTS=1 to regenerate the visual matrix')
test.describe.configure({ mode: 'serial' })
test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }) })

const shot = async (page, name) => {
  await page.waitForTimeout(320) // let entry animation settle
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
}

async function boot(page, context, { width = 390, height = 844, dark = false, reduced = false } = {}) {
  await context.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })
  await enableTestHooks(context)
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  const rec = (target_type, target_id) => [
    { target_type, target_id, modality: 'reading', n: 8 },
    { target_type, target_id, modality: 'listening', n: 8 },
  ]
  await seedV2Evidence(page, PROFILE_A, [
    ...rec('sense', 'sense:still.continuity'),
    ...rec('construction', 'construction:still.subject_still_lexical_verb'),
    ...rec('construction', 'construction:still.subject_be_still_complement'),
    // Two FIXED ELEMENTS ("but … still") — the construction family that makes a
    // real two-gap completion plannable. This is the case the pre-V2.22 renderer
    // could not represent, so the matrix has to be able to photograph it.
    ...rec('construction', 'construction:still.clause_but_subject_still_verb'),
  ])
  if (dark) await page.evaluate(async () => { await window.__e2e.db.setSetting('theme', 'dark') })
  await page.reload()
  await page.setViewportSize({ width, height })
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
}

const recipeNow = (page) => page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
const activity = (page) => page.evaluate(() => window.__e2e?.v2Activity ?? null)

async function answerAndAdvance(page) {
  const recipe = await recipeNow(page)
  const before = await page.getByTestId('v2lx-step-counter').textContent()
  if (recipe === 'exposure') {
    await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); return true
  }
  if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) {
    const a = await activity(page)
    const opt = a?.correct_option_id
      ? page.getByTestId(`v2lx-option-${a.correct_option_id}`)
      : page.locator('[data-testid^="v2lx-option-"]').first()
    await opt.click()
  } else if (recipe === 'fixed_element_completion') {
    await fillCompletion(page); await page.getByTestId('v2lx-check').click()
  } else if (recipe === 'word_order_reconstruction') {
    await buildWordOrderCorrectly(page); await page.getByTestId('v2lx-check').click()
  } else if (['guided_production', 'free_production'].includes(recipe)) {
    const input = page.getByTestId('v2lx-production-input')
    if (!(await input.count())) return false
    const a = await activity(page)
    await input.fill(a?.text_en || 'I still live here.')
    await page.getByTestId('v2lx-check').click()
  } else return false
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
  return true
}

/** Tap the bank chips in the order that reconstructs the authored sentence. */
async function buildWordOrderCorrectly(page) {
  const a = await activity(page)
  const target = String(a?.text_en || '').trim().split(/\s+/)
  if (!target.length) { await fillWordOrder(page); return }
  for (const word of target) {
    const chip = page.locator(`[data-testid="v2lx-token-bank"] button:not([data-used])`, { hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })
    if (await chip.count()) await chip.first().click()
    else await page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])').first().click()
  }
}

/** Walk real sessions until `wanted` is presented (or give up). */
async function reach(page, wanted, { sessions = 14, perSession = 18 } = {}) {
  for (let s = 0; s < sessions; s++) {
    if (s > 0) {
      await expect(page.getByTestId('v2lx-home')).toBeVisible()
      await page.getByTestId('v2lxh-primary').click()
      await expect(page.getByTestId('v2lx-shell')).toBeVisible()
    }
    for (let i = 0; i < perSession; i++) {
      if (await page.getByTestId('v2lx-summary').count()) break
      if (!(await page.locator('[data-testid^="v2lx-activity-"]').count())) break
      if (wanted.includes(await recipeNow(page))) return true
      if (!(await answerAndAdvance(page))) break
    }
    for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
      const b = page.getByTestId(id)
      if (await b.count()) { await b.click(); break }
    }
  }
  return false
}

// ---- 01–05 word order -------------------------------------------------------

test('01–05 word order, light, 390px', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  expect(await reach(page, ['word_order_reconstruction'])).toBe(true)

  await shot(page, '01-word-order-empty')

  // partial: two words on the rail
  await page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])').first().click()
  await page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])').first().click()
  await shot(page, '02-word-order-partial')

  // complete, in the authored order → a `correct` outcome on purpose
  await page.getByTestId('v2lx-restart').click()
  await buildWordOrderCorrectly(page)
  await shot(page, '03-word-order-complete')
  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await shot(page, '04-word-order-feedback-correct')

  // …and a NON-correct outcome from a real wrong sequence on the next one.
  const before = await page.getByTestId('v2lx-step-counter').textContent()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
  if (await reach(page, ['word_order_reconstruction'])) {
    await fillWordOrder(page) // bank order — a genuine learner mistake
    await page.getByTestId('v2lx-check').click()
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    await shot(page, '05-word-order-feedback-non-correct')
  }
})

// ---- 06–09 completion -------------------------------------------------------

test('06–09 completion, light, 390px', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  expect(await reach(page, ['fixed_element_completion'])).toBe(true)

  const hasBank = await page.locator('[data-testid="v2lx-word-bank"]').count()
  await shot(page, hasBank ? '06-completion-bank-empty' : '08-completion-input-focused')

  await fillCompletion(page)
  await shot(page, hasBank ? '07-completion-bank-filled' : '08-completion-input-focused')

  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await shot(page, '09-completion-feedback')

  // Two more completion shapes the Engine opens on its own schedule: the
  // free-input support lane, and the MULTI-GAP case this slice exists to fix.
  let needInput = true
  let needMulti = true
  const before = await page.getByTestId('v2lx-step-counter').textContent()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
  for (let i = 0; i < 10 && (needInput || needMulti); i++) {
    if (!(await reach(page, ['fixed_element_completion']))) break
    const gaps = Number(await page.getByTestId('v2lx-activity-completion').getAttribute('data-gaps'))
    const hasWordBank = await page.locator('[data-testid="v2lx-word-bank"]').count()
    if (needInput && !hasWordBank) {
      await page.getByTestId('v2lx-slot-0').focus()
      await page.getByTestId('v2lx-slot-0').fill('still')
      await shot(page, '08-completion-input-focused')
      needInput = false
    }
    if (needMulti && gaps > 1) {
      await fillCompletion(page)
      await shot(page, '23-completion-multi-gap')
      needMulti = false
    }
    if (!(await answerAndAdvance(page))) break
  }
  console.log(`[matrix] free-input frame captured: ${!needInput}; multi-gap frame captured: ${!needMulti}`)
})

// ---- 10–12 guided writing ---------------------------------------------------

test('10–12 guided writing, light, 390px', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  expect(await reach(page, ['guided_production', 'free_production'])).toBe(true)
  const input = page.getByTestId('v2lx-production-input')
  test.skip(!(await input.count()), 'planned in the speaking modality')

  await shot(page, '10-guided-writing-empty')
  const a = await activity(page)
  await input.fill(a?.text_en || 'I still live here.')
  await shot(page, '11-guided-writing-filled')
  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await shot(page, '12-guided-writing-feedback')
})

// ---- 13–14 the transition ---------------------------------------------------

test('13–14 transition out and in', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  expect(await reach(page, ['word_order_reconstruction', 'fixed_element_completion'])).toBe(true)
  const recipe = await recipeNow(page)
  if (recipe === 'word_order_reconstruction') await buildWordOrderCorrectly(page)
  else await fillCompletion(page)
  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()

  // The slide is 220/260ms — too fast to photograph reliably. Slow the MOTION
  // TOKENS (not the design) so the frame is deterministic; the distance, easing
  // and direction under test are unchanged.
  await page.addStyleTag({ content: '.v2lx { --v2-dur-stage-out: 2400ms !important; --v2-dur-stage-in: 2400ms !important; }' })
  await page.getByTestId('v2lx-continue').click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(OUT, '13-transition-out.png') })
  await page.waitForFunction(() => document.querySelector('[data-testid="v2lx-stage"]')?.dataset.phase === 'in', null, { timeout: 20000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, '14-transition-in.png') })
})

// ---- 15–17 dark -------------------------------------------------------------

test('15–17 dark theme', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { dark: true })
  if (await reach(page, ['word_order_reconstruction'])) {
    await page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])').first().click()
    await page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])').first().click()
    await shot(page, '15-dark-word-order')
    await page.getByTestId('v2lx-restart').click()
    await buildWordOrderCorrectly(page)
    await page.getByTestId('v2lx-check').click()
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  if (await reach(page, ['fixed_element_completion'])) {
    await fillCompletion(page)
    await shot(page, '16-dark-completion')
    await page.getByTestId('v2lx-check').click()
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  if (await reach(page, ['guided_production', 'free_production'])) {
    const input = page.getByTestId('v2lx-production-input')
    if (await input.count()) {
      const a = await activity(page)
      await input.fill(a?.text_en || 'I still live here.')
      await shot(page, '17-dark-guided-writing')
    }
  }
})

// ---- 18–20 mobile 320px -----------------------------------------------------

test('18–20 mobile 320px', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { width: 320, height: 720 })
  const noOverflow = async () => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(over, 'horizontal overflow at 320px').toBe(false)
  }
  if (await reach(page, ['word_order_reconstruction'])) {
    await buildWordOrderCorrectly(page)
    await noOverflow()
    await shot(page, '18-mobile-320-word-order')
    await page.getByTestId('v2lx-check').click()
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  if (await reach(page, ['fixed_element_completion'])) {
    await fillCompletion(page)
    await noOverflow()
    await shot(page, '19-mobile-320-completion')
    await page.getByTestId('v2lx-check').click()
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  if (await reach(page, ['guided_production', 'free_production'])) {
    const input = page.getByTestId('v2lx-production-input')
    if (await input.count()) {
      const a = await activity(page)
      await input.fill(a?.text_en || 'I still live here.')
      await noOverflow()
      await shot(page, '20-mobile-320-writing')
    }
  }
})

// ---- 21–22 reduced motion ---------------------------------------------------

test('21–22 reduced motion', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { reduced: true })
  if (await reach(page, ['word_order_reconstruction'])) {
    await buildWordOrderCorrectly(page)
    await page.getByTestId('v2lx-check').click()
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    // With motion reduced, the state must be fully legible without any movement.
    await shot(page, '21-reduced-motion-word-order')
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before) // advance must not depend on an animation ending
  }
  expect(await reach(page, ['fixed_element_completion'])).toBe(true)
  await fillCompletion(page)
  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await shot(page, '22-reduced-motion-completion')
})
