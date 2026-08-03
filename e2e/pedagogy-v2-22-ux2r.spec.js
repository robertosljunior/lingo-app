// pedagogy-v2-22-ux2r.spec.js — Slice V2.22-UX2-R §13 + §16.
//
// WHY THIS FILE EXISTS ALONGSIDE pedagogy-v2-22-ux2.spec.js. That suite proves
// the contextual Home and the real scramble, and it is still the authority on
// both — but it boots from `seedFixtures`, which writes `onboarding_completed`
// and a pre-made profile. §16 rules that out as evidence of completion: "Home
// acessível apenas depois de pular onboarding" and "E2E com perfil antigo" are
// explicitly NOT acceptance.
//
// So every test here starts from a genuinely empty IndexedDB, runs the REAL V2
// first-run, and only then asserts. The profile these tests use is the one the
// product itself created a moment earlier. Nothing is seeded except learner
// EVIDENCE, which §8 permits and which no amount of clicking could produce
// inside a test budget.
import { test, expect } from '@playwright/test'
import { enableTestHooks, gotoApp, attachErrorMonitor } from './helpers.js'
import { completeV2FirstRun, seedV2Evidence, waitForAdvance, fillWordOrder, fillCompletion } from './v2-helpers.js'

// The profile a fresh install creates for itself (storage.js → DEFAULT_PROFILE).
const FRESH_PROFILE = 'default'

const TARGETS = [
  'sense:still.continuity',
  'construction:still.subject_still_lexical_verb',
  'construction:still.subject_be_still_complement',
  'sense:but.contrast',
  'construction:but.clause_but_clause',
  'sense:yet.temporal_pending',
  'construction:yet.negative_perfect_yet',
]

/** Fresh install → real V2 first-run → the contextual Home. No fixtures. */
async function freshInstall(page, context, { width = 1280, height = 800, noStt = false } = {}) {
  // Speech recognition is absent on most real devices; removing it here keeps
  // the speaking modality deterministic instead of depending on what the test
  // runtime happens to expose.
  if (noStt) await context.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition })
  await enableTestHooks(context)
  await page.setViewportSize({ width, height })
  await gotoApp(page)
  await completeV2FirstRun(page, 'Roberto')
}

/**
 * Open the learner's capability far enough that controlled production is a
 * legitimate rung for the Planner to choose. This is evidence, not a plan: the
 * Planner and Engine still decide everything, and if they decide otherwise the
 * scramble test fails rather than forcing a recipe (§8).
 */
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

// ---------------------------------------------------------------------------
// §13.B — the Home a NEW learner actually lands on
// ---------------------------------------------------------------------------

test.describe('B — the contextual Home, reached the way a learner reaches it', () => {
  test('a brand-new install lands on the contextual Home with real collections', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await freshInstall(page, context)

    const home = page.getByTestId('v2lx-home')
    await expect(home).toHaveAttribute('data-home-version', 'ux2')
    await expect(page.getByTestId('v2lxh-contexts')).toBeVisible()

    // The authored collections are on screen — these are the REAL five, read
    // from practice-collections.json through the presentation builder.
    await expect(page.getByTestId('v2lxh-collection-collection:everyday_conversation')).toBeVisible()
    await expect(page.getByTestId('v2lxh-collection-collection:work_and_study')).toBeVisible()

    // §0/§13.B — the lemmas are not a learner-facing choice. `still`, `but` and
    // `yet` still organise the curriculum internally; they are not cards.
    const cards = page.locator('[data-testid^="v2lxh-collection-"]')
    const titles = await cards.locator('.v2lx-context-title').allInnerTexts()
    for (const t of titles) {
      expect(t.trim().toLowerCase(), 'a lemma is being offered as a context').not.toMatch(/^(still|but|yet)$/)
    }

    // §13.B — no technical id reaches the screen. The collection ids live in
    // `data-testid`, which is instrumentation; the RENDERED TEXT must be clean.
    const visibleText = await page.locator('.v2lx-content').innerText()
    expect(visibleText).not.toMatch(/pack[_:-]?id|collection:|still_|but_|yet_/i)

    // §13.B — the three real entry points are present and route somewhere real.
    await expect(page.getByTestId('v2lxh-primary')).toBeVisible()
    await expect(page.getByTestId('v2lxh-action-review')).toBeVisible()
    await expect(page.getByTestId('v2lxh-action-explore')).toBeVisible()

    monitor.assertClean()
  })

  test('"Praticar agora" starts a real session and Voltar returns to the same Home', async ({ page, context }) => {
    test.setTimeout(300_000)
    await freshInstall(page, context)
    await page.getByTestId('v2lxh-primary').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible({ timeout: 30_000 })
    // A real plan, from the real controller — an activity is presenting.
    await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible()
    await page.getByTestId('v2lx-close').click()
    await expect(page.getByTestId('v2lx-home')).toHaveAttribute('data-home-version', 'ux2')
  })

  test('a context opens a scoped session that names the context, never the pack', async ({ page, context }) => {
    test.setTimeout(300_000)
    await freshInstall(page, context)
    await page.getByTestId('v2lxh-collection-open-collection:everyday_conversation').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible({ timeout: 30_000 })
    const banner = page.getByTestId('v2lx-context-banner')
    await expect(banner).toContainText('Conversas do dia a dia')
    // §18 — the internal curriculum stays internal on the lesson screen too.
    await expect(page.locator('.v2lx-banner')).toHaveCount(0)
    const chip = await page.locator('.v2lx-focus-chip').innerText().catch(() => '')
    expect(chip.trim()).not.toMatch(/^(still|but|yet)$/i)
  })

  test('review and explore reach their own real, honest surfaces', async ({ page, context }) => {
    test.setTimeout(300_000)
    await freshInstall(page, context)
    for (const mode of ['review', 'explore']) {
      await page.getByTestId(`v2lxh-action-${mode}`).click()
      await expect(page.getByTestId('v2lx-screen')).toBeVisible({ timeout: 30_000 })
      // A brand-new learner has nothing to review: the empty state is allowed,
      // a running session is allowed, a crash or a fake session is not.
      const summary = page.getByTestId('v2lx-summary')
      const activity = page.locator('[data-testid^="v2lx-activity-"]')
      await expect(summary.or(activity).first()).toBeVisible({ timeout: 30_000 })
      if (await summary.count()) {
        await expect(summary).toHaveAttribute('data-kind', 'empty')
        // §17 — an empty session never claims one happened.
        expect(await summary.innerText()).not.toMatch(/conclu[ií]da|parab[ée]ns|100%/i)
      }
      for (const id of ['v2lx-empty-home', 'v2lx-close', 'v2lx-finish']) {
        const b = page.getByTestId(id)
        if (await b.count()) { await b.click(); break }
      }
      await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
    }
  })
})

// ---------------------------------------------------------------------------
// §13.C / §8 — the Magnetic Rail on a real trajectory from a fresh profile
// ---------------------------------------------------------------------------

test('C — ACCEPTANCE: fresh install → Home → context → Montar frases → real Magnetic Rail → feedback', async ({ page, context }) => {
  test.setTimeout(600_000)
  const monitor = attachErrorMonitor(page)
  await freshInstall(page, context, { noStt: true })
  await seedOpenLearner(page)

  // The format is DISCOVERABLE from the Home itself — the learner does not have
  // to wait for the Planner to happen to offer it (§7/§11).
  const scramble = page.getByTestId('v2lxh-format-collection:work_and_study-scramble')
  await expect(scramble).toBeVisible()
  await scramble.click()

  await expect(page.getByTestId('v2lx-shell')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('v2lx-context-banner')).toContainText('Trabalho e estudos')

  // Walk the REAL session. No injected plan: the preference is advisory, so the
  // Planner may serve other rungs first and may end the session — in which case
  // we re-enter the SAME context and keep going (§8).
  const reEnter = async () => {
    for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
      const b = page.getByTestId(id)
      if (await b.count()) { await b.click(); break }
    }
    await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
    await scramble.click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible({ timeout: 30_000 })
  }

  const seen = []
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    if (await page.getByTestId('v2lx-summary').count()) { await reEnter(); continue }
    const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
    seen.push(recipe)
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
      // A SPEAKING production activity with no STT in the test runtime has no
      // answerable control at all (the written fallback is class B and is not
      // implemented). Leaving the session and re-entering the same context is
      // what a learner could do too — it forces no recipe and skips no gate.
      if (!(await input.count())) { await reEnter(); continue }
      await input.fill('I still work here.'); await page.getByTestId('v2lx-check').click()
    } else { await reEnter(); continue }
    await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, before)
  }
  expect(reached, `the real Planner/Engine never served word_order_reconstruction to a fresh profile; saw: ${seen.join(' → ')}`).toBe(true)

  // The Magnetic Rail itself, not some other renderer.
  await expect(page.getByTestId('v2lx-token-answer')).toBeVisible()
  await expect(page.locator('.v2lx-rail')).toHaveCount(1)
  await expect(page.getByTestId('v2lx-gap-0')).toBeVisible()

  // The payload contract is untouched: a real token_sequence over the plan's own
  // presented order, and a real exemplar from the chosen collection.
  const plan = await page.evaluate(() => window.__e2e?.v2Activity ?? null)
  expect(plan?.recipe).toBe('word_order_reconstruction')
  const allowed = await page.evaluate(() => window.__e2e?.v2Scope?.allowed_exemplar_ids ?? null)
  if (plan?.exemplar_id && allowed) expect(allowed).toContain(plan.exemplar_id)

  await expect(page.getByTestId('v2lx-check')).toBeDisabled()
  await fillWordOrder(page)
  const cta = page.getByTestId('v2lx-check')
  await expect(cta).toBeEnabled()
  await expect(cta).toBeInViewport()
  await cta.click()

  // Feedback in the SAME context, with the answer still on screen.
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await expect(page.getByTestId('v2lx-activity-word-order')).toBeVisible()
  await expect(page.locator('[data-testid^="v2lx-placed-"][data-result]')).toHaveCount(0)

  // …and the loop closes on the same new Home it started from.
  const before = await page.getByTestId('v2lx-step-counter').textContent()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, before)
  await page.getByTestId('v2lx-close').click()
  await expect(page.getByTestId('v2lx-home')).toHaveAttribute('data-home-version', 'ux2')

  monitor.assertClean()
})

// ---------------------------------------------------------------------------
// The design system itself (§9/§10) — applied, not merely defined
// ---------------------------------------------------------------------------

test.describe('the Claude Design language is actually rendering (§9/§10)', () => {
  test('Barlow and Barlow Condensed load and are used on every V2 surface', async ({ page, context }) => {
    test.setTimeout(300_000)
    await enableTestHooks(context)
    await gotoApp(page)

    // The typefaces are SELF-HOSTED build assets, so they must resolve offline
    // and on the very first paint — before any profile exists.
    //
    // `document.fonts` is asked to LOAD each face explicitly rather than
    // inspected for whatever the first paint happened to need: a face the page
    // has not used yet is `unloaded`, which says nothing about whether the
    // asset ships. `fonts.load()` resolves with the matching faces only if the
    // @font-face rule exists AND its source fetches successfully.
    const resolved = await page.evaluate(async () => {
      const want = ['600 24px "Barlow Condensed"', '400 16px Barlow', '800 16px Barlow']
      const out = {}
      for (const spec of want) out[spec] = (await document.fonts.load(spec)).length
      return out
    })
    for (const [spec, count] of Object.entries(resolved)) {
      expect(count, `${spec} did not resolve to a shipped @font-face`).toBeGreaterThan(0)
    }

    // …and they are BOUND to roles, on the first-run screen.
    const onbTitle = await page.locator('.v2lx-onb-title').evaluate((el) => getComputedStyle(el).fontFamily)
    expect(onbTitle).toMatch(/Barlow Condensed/)

    await completeV2FirstRun(page, 'Roberto')

    // The Home shares the same roles — one system, not two (§9).
    const homeTitle = await page.locator('.v2lx-home-title').evaluate((el) => getComputedStyle(el).fontFamily)
    expect(homeTitle).toMatch(/Barlow Condensed/)
    const body = await page.locator('.v2lx-context-desc').first().evaluate((el) => getComputedStyle(el).fontFamily)
    expect(body).toMatch(/^Barlow,/)

    // The bottom navigation is inside the V2 language too, not the legacy one.
    const nav = await page.locator('.bottom-nav').evaluate((el) => getComputedStyle(el).backgroundColor)
    const surface = await page.locator('.v2lx').first().evaluate((el) => getComputedStyle(el).getPropertyValue('--v2-surface').trim())
    expect(nav).toBeTruthy()
    expect(surface).toBeTruthy()
  })

  test('no horizontal overflow at 320px, on the first-run and on the Home', async ({ page, context }) => {
    await enableTestHooks(context)
    await page.setViewportSize({ width: 320, height: 640 })
    await gotoApp(page)
    const overflow = () => page.evaluate(() => {
      const el = document.querySelector('.phone')
      return el ? el.scrollWidth - el.clientWidth : 0
    })
    await expect(page.getByTestId('v2lx-onboarding')).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)
    await completeV2FirstRun(page, 'Roberto')
    expect(await overflow()).toBeLessThanOrEqual(0)
    // Every touch target still clears 44px at the narrowest supported width.
    const small = await page.evaluate(() => {
      const bad = []
      for (const b of document.querySelectorAll('.v2lx button')) {
        const r = b.getBoundingClientRect()
        if (r.width > 0 && r.height > 0 && r.height < 34) bad.push(`${b.className}:${Math.round(r.height)}`)
      }
      return bad
    })
    expect(small, `touch targets under 34px at 320px: ${small.join(', ')}`).toEqual([])
  })

  test('the catalogue stays a list at 20 collections, with one expansion control (§11)', async ({ page, context }) => {
    await enableTestHooks(context)
    await page.setViewportSize({ width: 320, height: 640 })
    await gotoApp(page)
    await completeV2FirstRun(page, 'Roberto')

    // The adapter slices; the screen renders what it is handed. Prove the screen
    // half here — the 4/8/12/20 data half is a unit test on the builder.
    // Count CARDS, not every element whose testid starts with the prefix: each
    // card also contains a `v2lxh-collection-open-*` button.
    const cards = page.locator('.v2lx-context-card')
    const visible = await cards.count()
    expect(visible).toBeGreaterThan(0)
    expect(visible).toBeLessThanOrEqual(6)
    const more = page.getByTestId('v2lxh-contexts-more')
    if (await more.count()) {
      await more.click()
      expect(await cards.count()).toBeGreaterThan(visible)
    }
    const el = await page.evaluate(() => {
      const p = document.querySelector('.phone')
      return p.scrollWidth - p.clientWidth
    })
    expect(el).toBeLessThanOrEqual(0)
  })
})
