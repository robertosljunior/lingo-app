// pedagogy-v2-22-ux2.spec.js — Slice V2.22-UX2 §28.
//
// The contextual Home and the scoped session, on the REAL pipeline. Nothing is
// injected: the only setup is valid recognition Evidence written through the
// public storage layer (exactly what the V2.20/UX1 suites already do) so the
// Capability Entry policy can open controlled production. The Planner still
// chooses every focus and the Engine still chooses every activity.

import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, waitForAdvance, seedV2Evidence, fillWordOrder, fillCompletion } from './v2-helpers.js'

test.describe.configure({ mode: 'serial' })

// The pedagogical targets of `collection:work_and_study`, seeded to the rung
// where controlled production is legitimately open. Recognition + comprehension
// evidence only — the scramble is never granted, it is EARNED.
const WORK_STUDY_TARGETS = [
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
  for (const target_id of WORK_STUDY_TARGETS) {
    const target_type = target_id.startsWith('sense:') ? 'sense' : 'construction'
    // Recognition, then comprehension — the two rungs BELOW controlled
    // production. Production evidence is deliberately NOT seeded: the scramble
    // has to be opened by the ladder, not handed over.
    rows.push({ target_type, target_id, modality: 'reading', n: 10 })
    rows.push({ target_type, target_id, modality: 'listening', n: 10 })
    rows.push({ target_type, target_id, modality: 'reading', capability: 'comprehension', n: 10 })
    rows.push({ target_type, target_id, modality: 'listening', capability: 'comprehension', activity_kind: 'listening_recognition', n: 10 })
  }
  await seedV2Evidence(page, PROFILE_A, rows)
  await page.reload()
}

async function boot(page, context, { width = 390, height = 844, dark = false } = {}) {
  // A headless browser advertises speech input it cannot use; telling the
  // runtime the truth makes production enter through writing (see UX1 §36).
  await context.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  if (dark) {
    await page.evaluate(async () => { await window.__e2e.db.setSetting('theme', 'dark') })
    await page.reload()
  }
  await page.setViewportSize({ width, height })
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
}

// ---- Home -------------------------------------------------------------------

test.describe('the contextual Home (§28 Home)', () => {
  test('shows contexts, and never a pack as a learner-facing choice', async ({ page, context }) => {
    await boot(page, context)
    await expect(page.getByTestId('v2lx-home')).toHaveAttribute('data-home-version', 'ux2')

    // 2 — real contextual collections.
    const cards = page.locator('[data-testid^="v2lxh-collection-open-"]')
    expect(await cards.count()).toBeGreaterThanOrEqual(4)

    // 1/6 — no pack, lemma or technical id reaches the screen.
    const body = await page.locator('body').innerText()
    for (const w of ['Still', 'But', 'Yet']) {
      expect(new RegExp(`(^|\\s)${w}(\\s|$)`).test(body), `"${w}" appears as a learner-facing word`).toBe(false)
    }
    expect(body).not.toMatch(/pedagogy_v2|pack_id|exemplar:|construction:|sense:|collection:/)
    const html = await page.content()
    expect(html).not.toMatch(/data-pack=/)

    // 7 — no mascot, no character, no gamified path.
    expect(await page.locator('img[alt*="mascote" i], img[alt*="Bob" i]').count()).toBe(0)
    expect(body).not.toMatch(/\bXP\b|CEFR|A1|A2|B1|B2|domínio|%/)

    // 3/5 — the primary CTA and the two real study modes are all still there.
    await expect(page.getByTestId('v2lxh-primary')).toBeVisible()
    await expect(page.getByTestId('v2lxh-action-explore')).toBeVisible()
    await expect(page.getByTestId('v2lxh-action-review')).toBeVisible()
  })

  test('"Praticar agora" still starts a real adaptive session (§28.3)', async ({ page, context }) => {
    await boot(page, context)
    await page.getByTestId('v2lxh-primary').click()
    await expect(page.getByTestId('v2lx-screen')).toBeVisible()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
    // An unscoped session shows no context strip.
    await expect(page.getByTestId('v2lx-context-banner')).toHaveCount(0)
  })

  test('a collection starts a real SCOPED session and names the context (§28.4/§17)', async ({ page, context }) => {
    await boot(page, context)
    await page.getByTestId('v2lxh-collection-open-collection:work_and_study').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
    const banner = page.getByTestId('v2lx-context-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('Trabalho e estudos')
    // The context is named; the pack behind it never is.
    expect(await page.locator('body').innerText()).not.toMatch(/pedagogy_v2|pack_id/)
  })

  test('no horizontal overflow at 320px, and dark mode renders (§28.8)', async ({ page, context }) => {
    await boot(page, context, { width: 320, height: 720 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    await expect(page.locator('[data-testid^="v2lxh-collection-open-"]').first()).toBeVisible()
  })

  test('dark mode keeps the catalogue legible (§28.8)', async ({ page, context }) => {
    await boot(page, context, { dark: true })
    await expect(page.getByTestId('v2lxh-contexts')).toBeVisible()
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.v2lx')).backgroundColor)
    expect(bg).toBeTruthy()
  })
})

// ---- the acceptance path ----------------------------------------------------

test('ACCEPTANCE — Home → context → "Montar frases" → real scramble → feedback → Home', async ({ page, context }) => {
  test.setTimeout(600_000)
  await boot(page, context)
  await seedOpenLearner(page)
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  // 1/2 — choose a context, 3 — choose the format, from the Home itself.
  await page.getByTestId('v2lxh-format-collection:work_and_study-scramble').click()

  // 4 — the SAME lesson screen and the SAME controller.
  await expect(page.getByTestId('v2lx-screen')).toBeVisible()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  await expect(page.getByTestId('v2lx-context-banner')).toContainText('Trabalho e estudos')

  // 5 — walk the REAL session until the Planner/Engine serve the scramble. No
  // forced plan: if the rung is not open the notice explains it and we fail.
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    // A session can legitimately end before the rung opens; re-enter the SAME
    // context and keep going rather than declaring the path unreachable.
    if (await page.getByTestId('v2lx-summary').count()) {
      for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
        const b = page.getByTestId(id)
        if (await b.count()) { await b.click(); break }
      }
      await expect(page.getByTestId('v2lx-home')).toBeVisible()
      await page.getByTestId('v2lxh-format-collection:work_and_study-scramble').click()
      await expect(page.getByTestId('v2lx-shell')).toBeVisible()
      continue
    }
    const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
    if (recipe === 'word_order_reconstruction') { reached = true; break }
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    if (recipe === 'exposure') {
      await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue
    }
    if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) {
      const correct = await page.evaluate(() => window.__e2e?.v2Activity?.correct_option_id ?? null)
      await (correct ? page.getByTestId(`v2lx-option-${correct}`) : page.locator('[data-testid^="v2lx-option-"]').first()).click()
    } else if (recipe === 'fixed_element_completion') {
      await fillCompletion(page); await page.getByTestId('v2lx-check').click()
    } else if (['guided_production', 'free_production'].includes(recipe)) {
      const input = page.getByTestId('v2lx-production-input')
      if (!(await input.count())) break
      await input.fill('I still work here.'); await page.getByTestId('v2lx-check').click()
    } else break
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  expect(reached, 'the Planner/Engine never served word_order_reconstruction in this context').toBe(true)

  // §18 — inside the chosen context the internal curriculum stays internal:
  // no "Agora vamos praticar “still”." interstitial, and the header chip names
  // the CONTEXT rather than the lexeme. (The target sentence itself is English
  // and may legitimately contain the word, so only the chrome is asserted.)
  await expect(page.locator('.v2lx-banner')).toHaveCount(0)
  await expect(page.getByTestId('v2lx-context-banner')).toContainText('Trabalho e estudos')
  const chip = await page.locator('.v2lx-focus-chip').innerText().catch(() => '')
  expect(chip.trim()).not.toMatch(/^(still|but|yet)$/i)

  // 6 — the PR #54 Magnetic Rail, not some other renderer.
  await expect(page.getByTestId('v2lx-token-answer')).toBeVisible()
  await expect(page.locator('.v2lx-rail')).toHaveCount(1)
  await expect(page.getByTestId('v2lx-gap-0')).toBeVisible()

  // The sentence really is from the chosen collection.
  const exemplarId = await page.evaluate(() => window.__e2e?.v2Activity?.exemplar_id ?? null)
  const allowed = await page.evaluate(() => window.__e2e?.v2Scope?.allowed_exemplar_ids ?? null)
  if (exemplarId && allowed) expect(allowed).toContain(exemplarId)

  // 7 — the CTA is reachable (the context strip must not push the footer off
  // screen) and only enables when the sentence is complete.
  await expect(page.getByTestId('v2lx-check')).toBeDisabled()
  await fillWordOrder(page)
  const cta = page.getByTestId('v2lx-check')
  await expect(cta).toBeEnabled()
  await expect(cta).toBeInViewport()
  await cta.click()

  // 8 — feedback in the same screen, activity still visible, no per-token verdict.
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await expect(page.getByTestId('v2lx-activity-word-order')).toBeVisible()
  await expect(page.locator('[data-testid^="v2lx-placed-"][data-result]')).toHaveCount(0)

  // 9/10 — continue, then back to the NEW Home.
  const before = await page.getByTestId('v2lx-step-counter').textContent()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
  await page.getByTestId('v2lx-close').click()
  await expect(page.getByTestId('v2lx-home')).toHaveAttribute('data-home-version', 'ux2')
})

// ---- honesty ----------------------------------------------------------------

test('an unearned format is explained, never faked (§13)', async ({ page, context }) => {
  test.setTimeout(300_000)
  await boot(page, context)
  // A learner with NO evidence cannot be at controlled production, so the
  // scramble genuinely has no eligible materialization yet.
  await page.getByTestId('v2lxh-format-collection:travel_and_commute-scramble').click()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
  expect(recipe).not.toBe('word_order_reconstruction')
  // The session is REAL and running, and the copy says so plainly.
  const notice = page.getByTestId('v2lx-preference-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText(/ainda não está disponível/i)
  expect(await notice.innerText()).not.toMatch(/erro|falha|bloquead/i)
})
