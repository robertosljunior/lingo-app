// pedagogy-v2-22-ux2-screenshots.spec.js — Slice V2.22-UX2 §27.
//
// The production visual matrix. Every frame is the REAL app driven by the REAL
// pipeline — no mockup, no static reconstruction, no injected ActivityPlan.
// Runs only with V2_SHOTS=1.

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, waitForAdvance, seedV2Evidence, fillWordOrder, fillCompletion } from './v2-helpers.js'

const OUT = path.resolve('test-evidence/v2-22-ux2-production')
const enabled = process.env.V2_SHOTS === '1'
test.skip(!enabled, 'set V2_SHOTS=1 to regenerate the visual matrix')
test.describe.configure({ mode: 'serial' })
test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }) })

const shot = async (page, name) => {
  await page.waitForTimeout(320)
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
  await seedV2Evidence(page, PROFILE_A, rows)
  await page.reload()
}

async function boot(page, context, { width = 375, height = 812, dark = false, reduced = false, seeded = false } = {}) {
  await context.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })
  await enableTestHooks(context)
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  if (dark) {
    await page.evaluate(async () => { await window.__e2e.db.setSetting('theme', 'dark') })
    await page.reload()
  }
  if (seeded) await seedOpenLearner(page)
  await page.setViewportSize({ width, height })
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
}

const recipeNow = (page) => page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
const activity = (page) => page.evaluate(() => window.__e2e?.v2Activity ?? null)

/** Walk the REAL session until `wanted` is served, re-entering the same context. */
async function reach(page, wanted, reEnter, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await page.getByTestId('v2lx-summary').count()) {
      for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
        const b = page.getByTestId(id)
        if (await b.count()) { await b.click(); break }
      }
      await expect(page.getByTestId('v2lx-home')).toBeVisible()
      await reEnter()
      continue
    }
    if (!(await page.locator('[data-testid^="v2lx-activity-"]').count())) return false
    const recipe = await recipeNow(page)
    if (wanted.includes(recipe)) return true
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    if (recipe === 'exposure') {
      await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue
    }
    if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) {
      const a = await activity(page)
      await (a?.correct_option_id ? page.getByTestId(`v2lx-option-${a.correct_option_id}`) : page.locator('[data-testid^="v2lx-option-"]').first()).click()
    } else if (recipe === 'fixed_element_completion') {
      await fillCompletion(page); await page.getByTestId('v2lx-check').click()
    } else if (['guided_production', 'free_production'].includes(recipe)) {
      const input = page.getByTestId('v2lx-production-input')
      if (!(await input.count())) return false
      const a = await activity(page)
      await input.fill(a?.text_en || 'I still work here.'); await page.getByTestId('v2lx-check').click()
    } else return false
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  return false
}

async function buildScrambleCorrectly(page) {
  const a = await activity(page)
  const target = String(a?.text_en || '').trim().split(/\s+/)
  if (!target.length) { await fillWordOrder(page); return }
  for (const word of target) {
    const chip = page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])', { hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })
    if (await chip.count()) await chip.first().click()
    else await page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])').first().click()
  }
}

// ---- Home, every width + dark ----------------------------------------------

test('01–04 the contextual Home at 320 / 375 / 430 and in dark', async ({ page, context }) => {
  test.setTimeout(300_000)
  for (const [name, w, h] of [['home-320-light', 320, 720], ['home-375-light', 375, 812], ['home-430-light', 430, 932]]) {
    await page.setViewportSize({ width: w, height: h })
    if (name === 'home-320-light') await boot(page, context, { width: w, height: h })
    await expect(page.getByTestId('v2lxh-contexts')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), `overflow at ${w}px`).toBe(false)
    await shot(page, name)
  }
})

test('05 the Home in dark', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context, { dark: true })
  await shot(page, 'home-375-dark')
})

test('06 the contextual catalogue', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  await page.getByTestId('v2lxh-contexts').scrollIntoViewIfNeeded()
  await shot(page, 'context-catalog')
})

// ---- contextual session -----------------------------------------------------

test('07–08 a selected collection and the session entry', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  const card = page.getByTestId('v2lxh-collection-collection:work_and_study')
  await card.scrollIntoViewIfNeeded()
  await card.hover()
  await shot(page, 'collection-selected')

  await page.getByTestId('v2lxh-collection-open-collection:work_and_study').click()
  await expect(page.getByTestId('v2lx-context-banner')).toBeVisible()
  await shot(page, 'contextual-session-entry')
})

// ---- the exercises, reached through the real pipeline ------------------------

test('09 + 12 the scramble and its feedback', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { seeded: true })
  const enter = async () => {
    await expect(page.getByTestId('v2lx-home')).toBeVisible()
    await page.getByTestId('v2lxh-format-collection:work_and_study-scramble').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  }
  await enter()
  expect(await reach(page, ['word_order_reconstruction'], enter, 60)).toBe(true)
  await expect(page.locator('.v2lx-rail')).toHaveCount(1)
  await shot(page, 'scramble-magnetic-rail')

  await buildScrambleCorrectly(page)
  await page.getByTestId('v2lx-check').click()
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await shot(page, 'feedback')
})

test('10 completion, reached in the same context', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { seeded: true })
  const enter = async () => {
    await expect(page.getByTestId('v2lx-home')).toBeVisible()
    await page.getByTestId('v2lxh-format-collection:work_and_study-completion').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  }
  await enter()
  expect(await reach(page, ['fixed_element_completion'], enter, 60)).toBe(true)
  await fillCompletion(page)
  await shot(page, 'completion')
})

test('11 guided writing, reached in the same context', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { seeded: true })
  const enter = async () => {
    await expect(page.getByTestId('v2lx-home')).toBeVisible()
    await page.getByTestId('v2lxh-format-collection:work_and_study-writing').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  }
  await enter()
  expect(await reach(page, ['guided_production', 'free_production'], enter, 60)).toBe(true)
  const input = page.getByTestId('v2lx-production-input')
  expect(await input.count()).toBeGreaterThan(0)
  const a = await activity(page)
  await input.fill(a?.text_en || 'I still work here.')
  await shot(page, 'guided-writing')
})

// ---- summary + honest empty states ------------------------------------------

test('13 the session summary', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { seeded: true })
  const enter = async () => {
    await page.getByTestId('v2lxh-collection-open-collection:work_and_study').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  }
  await enter()
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId('v2lx-summary').count()) break
    if (!(await reach(page, [], enter, 1))) {
      if (await page.getByTestId('v2lx-summary').count()) break
    }
    if (!(await page.locator('[data-testid^="v2lx-activity-"]').count())) break
  }
  if (await page.getByTestId('v2lx-summary').count()) await shot(page, 'session-summary')
})

test('14–15 review and explore empty states', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  await page.getByTestId('v2lxh-action-review').click()
  await expect(page.getByTestId('v2lx-screen')).toBeVisible()
  await page.waitForTimeout(900)
  await shot(page, 'review-empty')

  await page.getByTestId('v2lx-empty-home').click().catch(() => {})
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
  await page.getByTestId('v2lxh-action-explore').click()
  await expect(page.getByTestId('v2lx-screen')).toBeVisible()
  await page.waitForTimeout(900)
  await shot(page, 'explore-empty')
})

test('16 reduced motion', async ({ page, context }) => {
  test.setTimeout(900_000)
  await boot(page, context, { reduced: true, seeded: true })
  await shot(page, 'reduced-motion-home')
  const enter = async () => {
    await page.getByTestId('v2lxh-format-collection:work_and_study-scramble').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  }
  await enter()
  if (await reach(page, ['word_order_reconstruction'], enter)) {
    await buildScrambleCorrectly(page)
    await page.getByTestId('v2lx-check').click()
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    await shot(page, 'reduced-motion-scramble-feedback')
  }
})
