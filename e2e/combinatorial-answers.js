import { expect } from '@playwright/test'
import { fillWordOrder } from './v2-helpers.js'
/** Read the current decision's full telemetry from the e2e hook. */
export async function readActivity(page) {
  return page.evaluate(() => window.__e2e?.v2Activity ?? null)
}

/**
 * Answer the presenting activity CORRECTLY, from the plan's own response
 * contract. Returns { answered, reason } — `answered:false` means the runtime
 * genuinely cannot execute this activity here (speaking without STT), which is
 * recorded rather than faked.
 */
export async function answerCorrectly(page, activity) {
  const node = page.locator('[data-testid^="v2lx-activity-"]')
  await expect(node).toBeVisible()
  const shape = (await node.getAttribute('data-testid')).replace('v2lx-activity-', '')

  if (shape === 'exposure') {
    await page.getByTestId('v2lx-continue').click()
    return { answered: true, graded: false }
  }
  if (shape === 'meaning_recognition' || shape === 'listening_recognition' || shape === 'context_recognition') {
    // NOT "the first option": the option the contract declares correct.
    expect(activity.correct_option_id, 'recognition plan must declare its answer').toBeTruthy()
    await page.getByTestId(`v2lx-option-${activity.correct_option_id}`).click()
  } else if (shape === 'completion') {
    const expected = activity.expected_completion_tokens || []
    expect(expected.length, 'completion plan must expose its masked tokens').toBeGreaterThan(0)
    if (await page.locator('[data-testid="v2lx-word-bank"]').count()) {
      // The bank holds exactly the expected tokens in order; each tap fills the
      // next empty gap.
      for (let i = 0; i < expected.length; i++) {
        await page.locator('[data-testid="v2lx-word-bank"] button:not([data-used])').first().click()
      }
    } else {
      const slots = page.locator('[data-testid^="v2lx-slot-"]')
      const total = await slots.count()
      for (let i = 0; i < total; i++) await slots.nth(i).fill(expected[i] ?? '')
    }
    await page.getByTestId('v2lx-check').click()
  } else if (shape === 'word-order') {
    await fillWordOrder(page) // taps the canonical order out of the bank
    await page.getByTestId('v2lx-check').click()
  } else if (shape === 'guided_production' || shape === 'free_production') {
    const input = page.getByTestId('v2lx-production-input')
    if (!(await input.count())) return { answered: false, graded: false, reason: `${shape}:speaking_without_stt` }
    await input.fill(activity.text_en)
    await page.getByTestId('v2lx-check').click()
  } else {
    return { answered: false, graded: false, reason: `${shape}:not_executable_in_ci` }
  }
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  return { answered: true, graded: true }
}

/** Outcome of the interaction that just produced the visible feedback. */
export async function readFeedbackOutcome(page) {
  return page.evaluate(() => {
    const node = document.querySelector('[data-testid="v2lx-feedback"]')
    return node ? (node.getAttribute('data-outcome') || node.getAttribute('data-kind') || null) : null
  })
}
