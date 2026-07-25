// pedagogy-v2-20-polish.spec.js — E2E for Slice V2.20 (§48).
//
// Two families of guarantees:
//   1. DOGFOOD — opening Training in a dogfood build lands on the V2 product,
//      with no hidden IndexedDB flag to discover, and V1 never bleeds into it.
//   2. POLISH — the visual/structural decisions that must not silently regress:
//      the sentence has no card, recognition is not a form, feedback stays on
//      the same screen and flattened, context_recognition does not leak its
//      answer, word order uses the Engine's presented order, production never
//      says "Forma correta", motion is subtle and reduced-motion is honoured,
//      and 320–430px never overflows horizontally.
//
// Everything runs on the REAL pipeline; no mock plan is injected.

import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'
import {
  setLearnerFlag, openHub, openV2Home, openLearnerExperience,
  answerLearnerActivity, waitForAdvance, clearExperienceChoice,
} from './v2-helpers.js'

const V1_LEAKS = [
  /Gerar nova aula adaptativa/i,
  /Escolha um tema/i,
  /Escolha o que treinar/i,
  /Domínio estimado/i,
  /Prática adaptativa/i,
]

// ---------------------------------------------------------------- dogfood ----

test.describe('dogfood: Training IS the V2 experience', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
  })

  test('with NO explicit flag, Training → V2 Home → V2 Lesson (§2/§42)', async ({ page }) => {
    // Nothing is toggled: this is a developer opening the app for the first time.
    await clearExperienceChoice(page)

    await page.getByTestId('open-training-hub').click()

    // The V2 marker proves WHICH product rendered — it is a data attribute, never
    // visible to the learner (§42).
    const home = page.getByTestId('v2lx-home')
    await expect(home).toBeVisible()
    await expect(home).toHaveAttribute('data-experience', 'v2')

    // The legacy hub did not render.
    await expect(page.getByTestId('v2-pilot-open')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toHaveCount(0)

    await page.getByTestId('v2lxh-primary').click()
    const lesson = page.getByTestId('v2lx-screen')
    await expect(lesson).toBeVisible()
    await expect(lesson).toHaveAttribute('data-experience', 'v2')
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
  })

  test('the V2 surfaces contain no V1 vocabulary at all (§33/§48)', async ({ page }) => {
    await clearExperienceChoice(page)
    await openV2Home(page)
    let body = await page.locator('body').innerText()
    for (const leak of V1_LEAKS) expect(body).not.toMatch(leak)

    await page.getByTestId('v2lxh-primary').click()
    await expect(page.getByTestId('v2lx-shell')).toBeVisible()
    body = await page.locator('body').innerText()
    for (const leak of V1_LEAKS) expect(body).not.toMatch(leak)
  })

  test('the V2 lesson never runs the V1 adaptive generator (§34)', async ({ page }) => {
    await clearExperienceChoice(page)
    // Instrument the V1 generator entry point exposed on the E2E hook; if the V2
    // flow touched it, the counter would move.
    await page.evaluate(() => {
      window.__v1GenCalls = 0
      const db = window.__e2e.db
      for (const k of ['generateAdaptiveLesson', 'buildAdaptivePracticePlan', 'saveAdaptiveSession']) {
        const orig = db[k]
        if (typeof orig === 'function') {
          db[k] = (...a) => { window.__v1GenCalls += 1; return orig.apply(db, a) }
        }
      }
    })
    await openLearnerExperience(page)
    for (let i = 0; i < 3; i++) {
      if (await page.getByTestId('v2lx-summary').count()) break
      if (!(await answerLearnerActivity(page))) break
    }
    expect(await page.evaluate(() => window.__v1GenCalls)).toBe(0)
  })

  test('a DEV switch makes V1 reachable without hunting for a flag (§2)', async ({ page }) => {
    await clearExperienceChoice(page)
    await openV2Home(page)
    await expect(page.getByTestId('v2lx-dev-experience')).toBeVisible()

    await page.getByTestId('v2lx-dev-experience-v1').click()
    // Explicitly choosing V1 hands Training back to the legacy hub — the V2.20
    // regression path, still one tap away.
    await expect(page.getByTestId('v2lx-home')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toBeVisible()
  })

  test('legacy V1 mode still works as an explicit smoke (§48)', async ({ page }) => {
    await setLearnerFlag(page, false)
    await openHub(page)
    await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toBeVisible()
    // And the V2 learner surface is genuinely absent.
    await expect(page.getByTestId('v2lx-home')).toHaveCount(0)
  })
})

// ----------------------------------------------------------------- polish ----

test.describe('polish: the lesson looks like the product, not a lab', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
  })

  test('the sentence is the protagonist and sits on the background (§5)', async ({ page }) => {
    await openLearnerExperience(page)
    const sentence = page.getByTestId('v2lx-sentence').first()
    await expect(sentence).toBeVisible()

    // Big enough to be the protagonist, and NOT inside a white/shadowed card.
    const info = await sentence.evaluate((el) => {
      const cs = getComputedStyle(el)
      const parent = getComputedStyle(el.parentElement)
      return { size: parseFloat(cs.fontSize), parentShadow: parent.boxShadow, cardAncestor: !!el.closest('.v2lx-card') }
    })
    expect(info.size).toBeGreaterThanOrEqual(24)
    expect(info.cardAncestor).toBe(false)
    expect(info.parentShadow === 'none' || info.parentShadow === '').toBeTruthy()
  })

  test('recognition reads as an answer list, not a form (§8)', async ({ page }) => {
    await openLearnerExperience(page)
    for (let i = 0; i < 8; i++) {
      const activity = page.locator('[data-testid^="v2lx-activity-"]')
      await expect(activity).toBeVisible()
      const recipe = await activity.getAttribute('data-recipe')
      if (recipe && recipe.endsWith('recognition')) {
        // No redundant "toque na opção" instruction anywhere on screen (§8).
        expect(await page.locator('body').innerText()).not.toMatch(/toque na opção/i)

        const option = page.locator('[data-testid^="v2lx-option-"]').first()
        const style = await option.evaluate((el) => {
          const cs = getComputedStyle(el)
          return { shadow: cs.boxShadow, radius: parseFloat(cs.borderTopLeftRadius), height: el.getBoundingClientRect().height }
        })
        expect(style.shadow).toBe('none')          // no idle shadow
        expect(style.radius).toBeLessThanOrEqual(14) // smaller radius
        expect(style.height).toBeGreaterThanOrEqual(44) // touch target (§37)

        // Tap = answer, feedback on the SAME screen, activity still present.
        await option.click()
        await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
        await expect(page.getByTestId('v2lx-shell')).toBeVisible()
        await expect(activity).toBeVisible()
        // Only ONE primary CTA in this state (§31): Continuar, never Verificar.
        await expect(page.getByTestId('v2lx-continue')).toBeVisible()
        await expect(page.getByTestId('v2lx-check')).toHaveCount(0)
        return
      }
      const before = await page.getByTestId('v2lx-step-counter').textContent()
      if (recipe === 'exposure') { await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue }
      if (!(await answerLearnerActivity(page))) break
    }
  })

  test('feedback is flattened: no card nested inside the panel (§17)', async ({ page }) => {
    await openLearnerExperience(page)
    for (let i = 0; i < 8; i++) {
      const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
      const before = await page.getByTestId('v2lx-step-counter').textContent()
      if (recipe === 'exposure') { await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue }
      if (recipe && recipe.endsWith('recognition')) {
        await page.locator('[data-testid^="v2lx-option-"]').first().click()
        const fb = page.getByTestId('v2lx-feedback')
        await expect(fb).toBeVisible()
        // The panel itself is a compact 16px card, and contains no other card.
        const radius = await fb.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))
        expect(radius).toBeLessThanOrEqual(16)
        expect(await fb.locator('.v2lx-card').count()).toBe(0)
        // Any sub-block is separated by a hairline rule, not its own surface.
        const notes = fb.locator('.v2lx-fb-note')
        for (let n = 0; n < await notes.count(); n++) {
          const bg = await notes.nth(n).evaluate((el) => getComputedStyle(el).backgroundColor)
          expect(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent').toBeTruthy()
        }
        return
      }
      if (!(await answerLearnerActivity(page))) break
    }
  })

  test('word order presents the Engine order and the UI never re-shuffles (§12/§43)', async ({ page }) => {
    await openLearnerExperience(page)
    for (let i = 0; i < 10; i++) {
      const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
      if (recipe === 'word_order_reconstruction') {
        const shown = await page.locator('[data-testid="v2lx-token-bank"] button').allInnerTexts()
        // Re-render the same activity (a resize forces a paint, not a replan) and
        // confirm the bank order is IDENTICAL — no component-local randomness.
        await page.setViewportSize({ width: 400, height: 900 })
        const again = await page.locator('[data-testid="v2lx-token-bank"] button').allInnerTexts()
        expect(again).toEqual(shown)
        // The assembly area is a thin border with no inset shadow (§12).
        const shadow = await page.getByTestId('v2lx-token-answer').evaluate((el) => getComputedStyle(el).boxShadow)
        expect(shadow).toBe('none')
        return
      }
      const before = await page.getByTestId('v2lx-step-counter').textContent()
      if (recipe === 'exposure') { await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue }
      if (!(await answerLearnerActivity(page))) break
    }
  })

  test('production never shows a reference form before the answer, nor "Forma correta" (§13/§25)', async ({ page }) => {
    await openLearnerExperience(page)
    for (let i = 0; i < 12; i++) {
      const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
      if (recipe === 'guided_production' || recipe === 'free_production') {
        const input = page.getByTestId('v2lx-production-input')
        if (!(await input.count())) break // speaking modality in this runtime
        let body = await page.locator('body').innerText()
        expect(body).not.toMatch(/forma de referência|uma forma possível|forma correta|resposta correta/i)

        await input.fill('I still live here.')
        await page.getByTestId('v2lx-check').click()
        await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
        // After the answer a REFERENCE form may appear — but never as "correct".
        body = await page.locator('body').innerText()
        expect(body).not.toMatch(/forma correta|resposta correta/i)
        return
      }
      const before = await page.getByTestId('v2lx-step-counter').textContent()
      if (recipe === 'exposure') { await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue }
      if (!(await answerLearnerActivity(page))) break
    }
  })

  // The HARD gate for the §9 leak is the unit test (which can force a
  // context_recognition plan carrying a known-secret authored context). This
  // E2E complements it on the real pipeline: whenever the adaptive session does
  // schedule one, its answer must not appear outside the options. A session that
  // never schedules it is not a failure — the recipe is planner-selected.
  test('context_recognition never reveals the correct context before the answer (§9)', async ({ page }) => {
    await openLearnerExperience(page)
    let seen = false
    for (let i = 0; i < 14; i++) {
      if (await page.getByTestId('v2lx-summary').count()) break
      if (!(await page.locator('[data-testid^="v2lx-activity-"]').count())) break
      const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
      if (recipe === 'context_recognition') {
        seen = true
        const activity = page.locator('[data-testid^="v2lx-activity-"]')
        const options = await page.locator('[data-testid^="v2lx-option-"]').allInnerTexts()
        // Everything outside the options must contain none of the option texts —
        // i.e. the answer is not duplicated above the activity.
        const outside = await activity.evaluate((el) => {
          const clone = el.cloneNode(true)
          clone.querySelectorAll('[data-testid^="v2lx-option-"]').forEach((o) => o.remove())
          return clone.innerText
        })
        for (const o of options) expect(outside).not.toContain(o.trim())
        return
      }
      void seen
      const before = await page.getByTestId('v2lx-step-counter').textContent()
      if (recipe === 'exposure') { await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue }
      if (!(await answerLearnerActivity(page))) break
    }
  })

  test('motion is subtle: the slide distance is 4%, not 7% (§28)', async ({ page }) => {
    await openLearnerExperience(page)
    const distance = await page.getByTestId('v2lx-stage').evaluate(
      (el) => getComputedStyle(el).getPropertyValue('--v2-slide-distance').trim(),
    )
    expect(distance).toBe('4%')
    const rise = await page.getByTestId('v2lx-stage').evaluate(
      (el) => getComputedStyle(el).getPropertyValue('--v2-feedback-rise').trim(),
    )
    expect(rise).toBe('10px')
  })

  test('layout stays stable: showing feedback does not move the sentence (§29)', async ({ page }) => {
    await openLearnerExperience(page)
    for (let i = 0; i < 8; i++) {
      const recipe = await page.locator('[data-testid^="v2lx-activity-"]').getAttribute('data-recipe')
      if (recipe && recipe.endsWith('recognition')) {
        const prompt = page.getByTestId('v2lx-prompt').first()
        // Layout position INSIDE the document, not viewport position: a small
        // smooth scroll to expose the feedback is desired (§30), what must never
        // happen is the sentence being re-laid-out somewhere else (§29).
        const layoutY = () => prompt.evaluate((el) => {
          let y = 0
          for (let n = el; n; n = n.offsetParent) y += n.offsetTop
          return y
        })
        const before = await layoutY()
        await page.locator('[data-testid^="v2lx-option-"]').first().click()
        await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
        expect(await layoutY()).toBe(before)
        // …and the learner is still looking at it: it stays inside the viewport.
        const box = await prompt.boundingBox()
        expect(box.y).toBeGreaterThan(-1)
        expect(box.y).toBeLessThan(await page.evaluate(() => window.innerHeight))
        return
      }
      const before = await page.getByTestId('v2lx-step-counter').textContent()
      if (recipe === 'exposure') { await page.getByTestId('v2lx-continue').click(); await waitForAdvance(page, before); continue }
      if (!(await answerLearnerActivity(page))) break
    }
  })
})

// ------------------------------------------------------------- responsive ----

test.describe('responsive + reduced motion', () => {
  for (const width of [320, 360, 375, 393, 430]) {
    test(`no horizontal overflow at ${width}px (§38)`, async ({ page, context }) => {
      await enableTestHooks(context)
      await seedFixtures(page, { active: PROFILE_A })
      await setLearnerFlag(page, true)
      await page.setViewportSize({ width, height: 780 })
      const monitor = attachErrorMonitor(page)
      await openLearnerExperience(page)

      for (let i = 0; i < 4; i++) {
        await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible()
        const overflow = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          any: [...document.querySelectorAll('.v2lx *')].some((el) => el.getBoundingClientRect().right > window.innerWidth + 1),
        }))
        expect(overflow.doc).toBeLessThanOrEqual(0)
        expect(overflow.any).toBe(false)
        if (!(await answerLearnerActivity(page))) break
        if (await page.getByTestId('v2lx-summary').count()) break
      }
      monitor.assertClean?.()
    })
  }

  test('reduced motion removes the slide entirely (§28)', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLearnerExperience(page)
    const anim = await page.getByTestId('v2lx-stage').evaluate((el) => getComputedStyle(el).animationName)
    expect(['none', '']).toContain(anim)
    // …and the flow still advances.
    const before = await page.getByTestId('v2lx-step-counter').textContent()
    await answerLearnerActivity(page)
    await expect(page.getByTestId('v2lx-step-counter')).not.toHaveText(before)
  })

  test('dark mode keeps the lesson legible (§36)', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
    await page.evaluate(async () => { await window.__e2e.db.setSetting('theme', 'dark') })
    await page.reload()
    await openLearnerExperience(page)
    const contrastOk = await page.getByTestId('v2lx-sentence').first().evaluate((el) => {
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      let bgEl = el
      let bg = getComputedStyle(bgEl).backgroundColor
      while (bgEl.parentElement && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
        bgEl = bgEl.parentElement
        bg = getComputedStyle(bgEl).backgroundColor
      }
      const l1 = lum(getComputedStyle(el).color)
      const l2 = lum(bg)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    })
    // Never dark text on a dark background (§36); AA for large text is 3:1, and
    // the sentence is large — we require comfortably more.
    expect(contrastOk).toBeGreaterThan(4.5)
  })
})
