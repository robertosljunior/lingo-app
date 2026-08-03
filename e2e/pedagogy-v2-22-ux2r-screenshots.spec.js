// pedagogy-v2-22-ux2r-screenshots.spec.js — Slice V2.22-UX2-R §14.
//
// The 18 required frames, every one of them the REAL production app: real
// first-run, real Planner, real Engine, real Assessment. Nothing is a mockup, a
// Lab screen or a reconstruction, and no ActivityPlan is injected.
//
// The onboarding and Home frames run against a genuinely empty IndexedDB and go
// through the real V2 first-run, because §16 rules out any frame that was only
// reachable by skipping onboarding.
//
// Runs only with V2_SHOTS=1 (`V2_SHOTS=1 npx playwright test
// e2e/pedagogy-v2-22-ux2r-screenshots.spec.js --project=chromium-desktop`).
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { enableTestHooks, gotoApp } from './helpers.js'
import { completeV2FirstRun, seedV2Evidence, waitForAdvance, fillWordOrder, fillCompletion } from './v2-helpers.js'

const OUT = path.resolve('test-evidence/v2-22-ux2r-production')
const enabled = process.env.V2_SHOTS === '1'
test.skip(!enabled, 'set V2_SHOTS=1 to regenerate the production visual matrix')
test.describe.configure({ mode: 'serial' })
test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }) })

const FRESH_PROFILE = 'default'

const shot = async (page, name) => {
  await page.evaluate(async () => { await document.fonts.ready })
  await page.waitForTimeout(360)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
}

const TARGETS = [
  'sense:still.continuity',
  'construction:still.subject_still_lexical_verb',
  'construction:still.subject_be_still_complement',
  'sense:but.contrast',
  'construction:but.clause_but_clause',
  'sense:yet.temporal_pending',
  'construction:yet.negative_perfect_yet',
]

async function seedOpenLearner(page) {
  const rows = []
  for (const target_id of TARGETS) {
    const target_type = target_id.startsWith('sense:') ? 'sense' : 'construction'
    rows.push({ target_type, target_id, modality: 'reading', n: 10 })
    rows.push({ target_type, target_id, modality: 'listening', n: 10 })
    rows.push({ target_type, target_id, modality: 'reading', capability: 'comprehension', n: 10 })
    rows.push({ target_type, target_id, modality: 'listening', capability: 'comprehension', activity_kind: 'listening_recognition', n: 10 })
  }
  await seedV2Evidence(page, FRESH_PROFILE, rows)
  await page.reload()
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
}

/** A clean install at a given viewport/theme, through the REAL first-run. */
async function boot(page, context, { width = 375, height = 812, dark = false, reduced = false, onboardingOnly = false } = {}) {
  await context.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })
  await enableTestHooks(context)
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  if (dark) await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width, height })
  await gotoApp(page)
  await expect(page.getByTestId('v2lx-onboarding')).toBeVisible({ timeout: 20_000 })
  if (onboardingOnly) return
  await completeV2FirstRun(page, 'Roberto')
}

// ---- 01–04 · the V2 first-run ----------------------------------------------

for (const [n, width] of [['01', 320], ['02', 375], ['03', 430]]) {
  test(`${n} — first-run at ${width}px`, async ({ page, context }) => {
    await boot(page, context, { width, onboardingOnly: true })
    await shot(page, `${n}-v2-onboarding-${width}-light`)
  })
}

test('04 — first-run, dark', async ({ page, context }) => {
  await boot(page, context, { width: 375, dark: true, onboardingOnly: true })
  await shot(page, '04-v2-onboarding-dark')
})

// ---- 05–08 · the contextual Home -------------------------------------------

for (const [n, width] of [['05', 320], ['06', 375], ['07', 430]]) {
  test(`${n} — contextual Home at ${width}px`, async ({ page, context }) => {
    await boot(page, context, { width })
    await shot(page, `${n}-home-contextual-${width}`)
  })
}

test('08 — contextual Home, dark', async ({ page, context }) => {
  await boot(page, context, { width: 375, dark: true })
  await shot(page, '08-home-contextual-dark')
})

// ---- 09–10 · choosing a context and a format --------------------------------

test('09 — a collection selected, 10 — the format row', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  // The catalogue, scrolled so a whole context card with its format row is the
  // subject of the frame.
  await page.locator('.v2lx-home-scroll').evaluate((el) => { el.scrollTop = 260 })
  await shot(page, '09-collection-selected')
  await page.locator('.v2lx-context-card').first().locator('.v2lx-format-chip').first().focus()
  await shot(page, '10-format-selector')
})

// ---- 11–16 · a real session, end to end -------------------------------------

/**
 * Walk the REAL session from a chosen entry point until `want` is served, then
 * hand it to `capture`. `recipe_preference` is ADVISORY — the Planner may serve
 * other rungs first and may end the session — so a session that ends is
 * re-entered through the same entry point rather than forced.
 *
 * Nothing here injects a plan, skips a gate or fabricates an activity: if the
 * recipe never comes, the frame is missing and the test fails.
 */
async function captureRecipe(page, { entry, want, capture, max = 60 }) {
  const reEnter = async () => {
    for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
      const b = page.getByTestId(id)
      if (await b.count()) { await b.click(); break }
    }
    await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(entry).click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible({ timeout: 30_000 })
  }
  if (!(await page.getByTestId('v2lx-shell').count())) {
    await page.getByTestId(entry).click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible({ timeout: 30_000 })
  }
  const seen = []
  for (let i = 0; i < max; i++) {
    if (await page.getByTestId('v2lx-summary').count()) { await reEnter(); continue }
    const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
    seen.push(recipe)
    if (want.includes(recipe)) { await capture(recipe); return seen }
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    if (recipe === 'exposure') {
      await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue
    }
    if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) {
      const correct = await page.evaluate(() => window.__e2e?.v2Activity?.correct_option_id ?? null)
      await (correct ? page.getByTestId(`v2lx-option-${correct}`) : page.locator('[data-testid^="v2lx-option-"]').first()).click()
    } else if (recipe === 'word_order_reconstruction') {
      await fillWordOrder(page); await page.getByTestId('v2lx-check').click()
    } else if (recipe === 'fixed_element_completion') {
      await fillCompletion(page); await page.getByTestId('v2lx-check').click()
    } else if (['guided_production', 'free_production'].includes(recipe)) {
      const input = page.getByTestId('v2lx-production-input')
      // A speaking production activity with no STT has no answerable control.
      if (!(await input.count())) { await reEnter(); continue }
      await input.fill('I still work here.'); await page.getByTestId('v2lx-check').click()
    } else { await reEnter(); continue }
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before)
  }
  throw new Error(`never served ${want.join('/')}; saw: ${seen.join(' → ')}`)
}

test('11 + 14 — the Magnetic Rail and the feedback it connects to', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  await seedOpenLearner(page)
  await captureRecipe(page, {
    entry: 'v2lxh-format-collection:work_and_study-scramble',
    want: ['word_order_reconstruction'],
    capture: async () => {
      await fillWordOrder(page)
      await shot(page, '11-word-order-magnetic-rail')
      await page.getByTestId('v2lx-check').click()
      await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
      await shot(page, '14-feedback')
    },
  })
})

test('12 — completion', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  await seedOpenLearner(page)
  // Asked for through the format the learner would actually use for it — the
  // scramble preference biases the same context away from this recipe.
  await captureRecipe(page, {
    entry: 'v2lxh-format-collection:everyday_conversation-completion',
    want: ['fixed_element_completion'],
    capture: async () => {
      await fillCompletion(page)
      await shot(page, '12-completion')
    },
  })
})

test('13 — guided writing', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  await seedOpenLearner(page)
  await captureRecipe(page, {
    entry: 'v2lxh-format-collection:work_and_study-writing',
    want: ['guided_production', 'free_production'],
    capture: async () => {
      const input = page.getByTestId('v2lx-production-input')
      await input.fill('I still work here, but I have not finished the report yet.')
      await shot(page, '13-guided-writing')
    },
  })
})

test('15 + 16 — the session summary and the return to the Home', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context)
  await seedOpenLearner(page)
  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible({ timeout: 30_000 })

  // Finish a REAL session by answering it to the end.
  for (let i = 0; i < 80; i++) {
    if (await page.getByTestId('v2lx-summary').count()) break
    const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    if (recipe === 'exposure') { await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue }
    if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) {
      const correct = await page.evaluate(() => window.__e2e?.v2Activity?.correct_option_id ?? null)
      await (correct ? page.getByTestId(`v2lx-option-${correct}`) : page.locator('[data-testid^="v2lx-option-"]').first()).click()
    } else if (recipe === 'word_order_reconstruction') {
      await fillWordOrder(page); await page.getByTestId('v2lx-check').click()
    } else if (recipe === 'fixed_element_completion') {
      await fillCompletion(page); await page.getByTestId('v2lx-check').click()
    } else if (['guided_production', 'free_production'].includes(recipe)) {
      const input = page.getByTestId('v2lx-production-input')
      if (!(await input.count())) break
      await input.fill('I still work here.'); await page.getByTestId('v2lx-check').click()
    } else break
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before)
  }
  await expect(page.getByTestId('v2lx-summary')).toBeVisible({ timeout: 30_000 })
  await shot(page, '15-session-summary')

  for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
    const b = page.getByTestId(id)
    if (await b.count()) { await b.click(); break }
  }
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
  await shot(page, '16-home-return')
})

// ---- 17–18 · the robustness axes --------------------------------------------

test('17 — reduced motion', async ({ page, context }) => {
  await boot(page, context, { reduced: true })
  await shot(page, '17-reduced-motion')
})

test('18 — desktop', async ({ page, context }) => {
  await boot(page, context, { width: 1280, height: 900 })
  await shot(page, '18-desktop')
})
