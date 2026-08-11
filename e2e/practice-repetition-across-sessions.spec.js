// practice-repetition-across-sessions.spec.js — the anti-repetition contract,
// measured on the REAL learner-facing "Praticar" flow.
//
// WHY THIS SPEC EXISTS
// The repetition complaint was investigated twice with harnesses that answered
// recognition by clicking the FIRST option. That measures a learner who is
// guessing: wrong answers drive the Planner into remediation, remediation pins
// one construction, and the resulting "the same 4 sentences forever" is the
// harness's own doing. Every assessable activity here is answered CORRECTLY,
// read from the plan's response contract (`correct_option_id`, the canonical
// token order, the masked completion tokens) — so what it measures is the
// product a succeeding learner actually gets.
//
// It also runs FIVE consecutive complete sessions on ONE profile without ever
// clearing IndexedDB, because the defect is cross-session: within a single
// session the engine already rotates, and only a preserved evidence tail can
// show whether the next session starts on the same sentence again.
//
// WHAT IT ASSERTS
//   * the bundle under test really carries the current selection semantics
//     (engine_version) — a stale service-worker/dist copy can never make this
//     spec pass by accident;
//   * every assessable activity was actually assessed CORRECT (the harness is
//     honest about what it measured);
//   * `avoidable_exact_repeat === 0`: the engine never re-served an exemplar it
//     had used recently while its own acceptable band still held one it had
//     not;
//   * no sentence is ever shown twice in a row.
//
// It ALSO attaches the full per-activity trace and the aggregate report, which
// is the artefact the supply/planner findings are argued from — those are not
// asserted here because they are not the engine's to fix.

import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'
import { setLearnerFlag, openV2Home, waitForAdvance, fillWordOrder } from './v2-helpers.js'

const SESSIONS = 5
// Mirrors the study controller's `maxActivities` cap. A session that stops short
// of it means the Planner ran dry for this profile, which is itself a
// regression — so this is asserted, not tolerated.
const MAX_ACTIVITIES_PER_SESSION = 12

/**
 * Declare this runtime's speech capability HONESTLY, before boot.
 *
 * Headless Chromium exposes `webkitSpeechRecognition` but has no microphone and
 * no recognition service behind it, so `detectRuntimeCapabilitiesV2` reports
 * `speech_input: true` and the engine legitimately serves speaking activities
 * that nothing in CI can answer. Deleting the constructor makes the detector
 * report what is actually true here; the runtime-availability gate then filters
 * the speaking recipes exactly as it does on a device without a microphone.
 * This is the runtime contract doing its job — not a way of making an
 * unanswerable activity look answered. The resulting capability profile is
 * recorded in the report so the measurement states the runtime it describes.
 */
async function declareNoSpeechInput(context) {
  await context.addInitScript(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })
}

/** Read the current decision's full telemetry from the e2e hook. */
async function readActivity(page) {
  return page.evaluate(() => window.__e2e?.v2Activity ?? null)
}

/**
 * Answer the presenting activity CORRECTLY, from the plan's own response
 * contract. Returns { answered, reason } — `answered:false` means the runtime
 * genuinely cannot execute this activity here (speaking without STT), which is
 * recorded rather than faked.
 */
async function answerCorrectly(page, activity) {
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
async function readFeedbackOutcome(page) {
  return page.evaluate(() => {
    const node = document.querySelector('[data-testid="v2lx-feedback"]')
    return node ? (node.getAttribute('data-outcome') || node.getAttribute('data-kind') || null) : null
  })
}

test.describe('Praticar — repetition across consecutive sessions', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await declareNoSpeechInput(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setLearnerFlag(page, true)
  })

  test('five consecutive sessions answered correctly never repeat an exemplar the band could still avoid', async ({ page }, testInfo) => {
    test.setTimeout(900_000)
    const monitor = attachErrorMonitor(page)
    const rows = []
    const unanswerable = []

    // H8 — pin WHAT was executed. A cached bundle predating this change cannot
    // satisfy the engine-version assertion below.
    const buildFingerprint = await page.evaluate(() => ({
      module_scripts: [...document.querySelectorAll('script[type="module"]')].map((s) => s.getAttribute('src')),
      user_agent: navigator.userAgent,
      speech_recognition_available: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      speech_synthesis_available: 'speechSynthesis' in window,
    }))

    for (let sessionNumber = 1; sessionNumber <= SESSIONS; sessionNumber++) {
      await openV2Home(page)
      await page.getByTestId('v2lxh-primary').click()
      await expect(page.getByTestId('v2lx-screen')).toBeVisible()
      await expect(page.getByTestId('v2lx-shell')).toBeVisible()

      for (let n = 0; n < MAX_ACTIVITIES_PER_SESSION + 2; n++) {
        if (await page.getByTestId('v2lx-summary').count()) break
        await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible()
        const activity = await readActivity(page)
        expect(activity, 'the e2e hook must expose the current decision').toBeTruthy()
        const counterBefore = await page.getByTestId('v2lx-step-counter').textContent()

        const result = await answerCorrectly(page, activity)
        if (!result.answered) {
          unanswerable.push({ session_number: sessionNumber, ...activity, reason: result.reason })
          break // an activity this runtime cannot execute ends the measurement honestly
        }
        const outcome = result.graded ? await readFeedbackOutcome(page) : null
        rows.push({
          session_number: sessionNumber,
          activity_number: rows.filter((r) => r.session_number === sessionNumber).length + 1,
          ...activity,
          graded: result.graded,
          feedback_outcome: outcome,
        })
        if (result.graded) await page.getByTestId('v2lx-continue').click()
        await waitForAdvance(page, counterBefore)
      }

      // An activity this runtime cannot execute stops the measurement rather
      // than being faked; say so plainly instead of failing on a missing summary.
      expect(unanswerable, `runtime could not answer: ${JSON.stringify(unanswerable)}`).toEqual([])
      await expect(page.getByTestId('v2lx-summary')).toBeVisible()
      await page.getByTestId('v2lx-finish').click()
    }

    // ---- report ------------------------------------------------------------
    const uniq = (list) => new Set(list).size
    // interactions since `id` was last presented, over the whole recorded run.
    const sinceSeen = (index, id) => {
      for (let j = index - 1; j >= 0; j--) if (rows[j].exemplar_id === id) return index - 1 - j
      return Infinity
    }
    const avoidable = []
    const staler = []
    let backToBack = 0
    rows.forEach((row, i) => {
      const band = row.band_exemplars || []
      const window = row.recent_window ?? 4
      const mine = sinceSeen(i, row.exemplar_id)
      if (mine < window) {
        const alternatives = band.filter((x) => x !== row.exemplar_id && sinceSeen(i, x) >= window)
        if (alternatives.length) avoidable.push({ at: `S${row.session_number}.${row.activity_number}`, exemplar_id: row.exemplar_id, alternatives })
      }
      const stalest = Math.max(...band.map((x) => sinceSeen(i, x)), -Infinity)
      if (band.length > 1 && mine < stalest) {
        staler.push({ at: `S${row.session_number}.${row.activity_number}`, exemplar_id: row.exemplar_id, since_seen: mine, stalest })
      }
      if (i > 0 && rows[i - 1].text_en === row.text_en) backToBack += 1
    })
    const tally = (list) => Object.entries(list.reduce((m, x) => ({ ...m, [x]: (m[x] || 0) + 1 }), {}))
      .sort((a, b) => b[1] - a[1])
    const bandSizes = rows.map((r) => (r.band_exemplars || []).length)
    const report = {
      build: buildFingerprint,
      engine_version: rows[0]?.engine_version ?? null,
      policy_version: rows[0]?.policy_version ?? null,
      sessions: SESSIONS,
      per_session: [...new Set(rows.map((r) => r.session_number))].map((s) => {
        const rs = rows.filter((r) => r.session_number === s)
        return {
          session_number: s,
          activities: rs.length,
          study_session_id: rs[0]?.study_session_id ?? null,
          lesson_session_ids: [...new Set(rs.map((r) => r.lesson_session_id))],
          unique_texts: uniq(rs.map((r) => r.text_en)),
          unique_exemplars: uniq(rs.map((r) => r.exemplar_id)),
          unique_constructions: uniq(rs.map((r) => r.construction_id)),
          recipes: [...new Set(rs.map((r) => r.recipe))].sort(),
          targets: [...new Set(rs.map((r) => r.target_id))].sort(),
          exact_text_repeat_excess: rs.length - uniq(rs.map((r) => r.text_en)),
          band_of_one: rs.filter((r) => (r.band_exemplars || []).length === 1).length,
          band_of_two_or_more: rs.filter((r) => (r.band_exemplars || []).length >= 2).length,
        }
      }),
      global: {
        activities: rows.length,
        unique_texts: uniq(rows.map((r) => r.text_en)),
        unique_exemplars: uniq(rows.map((r) => r.exemplar_id)),
        unique_constructions: uniq(rows.map((r) => r.construction_id)),
        unique_planner_focus_keys: uniq(rows.map((r) => r.planner_focus_key)),
        top_texts: tally(rows.map((r) => r.text_en)).slice(0, 10),
        top_exemplars: tally(rows.map((r) => r.exemplar_id)).slice(0, 10),
        target_share: tally(rows.map((r) => r.target_id)),
        construction_share: tally(rows.map((r) => r.construction_id)),
        focus_share: tally(rows.map((r) => r.planner_focus_key)),
        recipe_share: tally(rows.map((r) => r.recipe)),
        mean_band_exemplars: bandSizes.reduce((a, b) => a + b, 0) / (bandSizes.length || 1),
        band_size_distribution: {
          one: bandSizes.filter((b) => b === 1).length,
          two: bandSizes.filter((b) => b === 2).length,
          three: bandSizes.filter((b) => b === 3).length,
          four_or_more: bandSizes.filter((b) => b >= 4).length,
        },
        avoidable_exact_repeat: avoidable.length,
        avoidable_exact_repeat_detail: avoidable,
        chose_a_staler_alternative_was_available: staler.length,
        back_to_back_identical_text: backToBack,
      },
      unanswerable_in_this_runtime: unanswerable,
      activities: rows,
    }
    await testInfo.attach('practice-repetition-report.json', {
      body: JSON.stringify(report, null, 2), contentType: 'application/json',
    })

    // ---- assertions --------------------------------------------------------
    // H8: this is at least the engine that fixed the band/recency defects, so a
    // cached service-worker or dist copy predating them cannot pass this spec.
    expect(report.engine_version).toBeGreaterThanOrEqual(4)

    // Five COMPLETE sessions really ran, on one preserved profile.
    expect(report.per_session).toHaveLength(SESSIONS)
    for (const s of report.per_session) expect(s.activities).toBe(MAX_ACTIVITIES_PER_SESSION)
    // Each session is its own study session, and none of them was restarted.
    expect(uniq(report.per_session.map((s) => s.study_session_id))).toBe(SESSIONS)

    // The harness is honest: everything it graded, it got right. A run where
    // "correct" answers score incorrect measures a struggling learner and its
    // repetition numbers mean something else entirely.
    const graded = rows.filter((r) => r.graded)
    expect(graded.length).toBeGreaterThan(0)
    for (const row of graded) {
      expect(row.feedback_outcome, `${row.recipe} @ S${row.session_number}.${row.activity_number}`)
        .not.toBe('incorrect')
    }

    // THE CONTRACT: a sentence only comes back when the engine had nothing
    // fresher to offer inside its own acceptable band.
    expect(report.global.avoidable_exact_repeat_detail).toEqual([])
    expect(report.global.back_to_back_identical_text).toBe(0)

    monitor.assertClean?.()
  })
})
