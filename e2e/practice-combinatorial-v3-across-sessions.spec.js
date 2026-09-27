import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, openV2Home, waitForAdvance } from './v2-helpers.js'
import { readActivity, answerCorrectly, readFeedbackOutcome } from './combinatorial-answers.js'

for (const enabled of [false, true]) {
  test(`240 learner-facing activities: V3 ${enabled ? 'ON' : 'OFF'}`, async ({ page, context }) => {
    await enableTestHooks(context)
    await context.addInitScript(() => {
      delete window.SpeechRecognition; delete window.webkitSpeechRecognition
      let seed = 20260927
      Math.random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296 }
    })
    const baseTime = Date.UTC(2026, 8, 27, 12)
    await page.clock.setFixedTime(baseTime)
    await seedFixtures(page, { active: PROFILE_A })
    await page.evaluate(enabled => window.__e2e.db.setSetting('combinatorialSupplyV3', { enabled, strict_unseen: true }), enabled)
    await setLearnerFlag(page, true)
    const rows = []
    mkdirSync('test-evidence', { recursive: true })
    const path = `test-evidence/v3-practice-${enabled ? 'on' : 'off'}.json`
    const runtime = await page.evaluate(() => ({ user_agent: navigator.userAgent, speech_input: !!window.SpeechRecognition, audio_output: 'speechSynthesis' in window }))
    try {
      for (let session = 1; session <= 20; session++) {
        // Reload proves persisted use survives a new runtime, no learner reset.
        await page.clock.setFixedTime(baseTime + (session - 1) * 86400000)
        await page.reload()
        await openV2Home(page)
        await page.getByTestId('v2lxh-primary').click()
        for (let activity_index = 1; activity_index <= 12; activity_index++) {
          await expect(page.locator('[data-testid^="v2lx-activity-"]')).toBeVisible()
          await page.waitForFunction(() => !!window.__e2e?.v2Activity)
          const activity = await readActivity(page)
          const counter = await page.getByTestId('v2lx-step-counter').textContent()
          await page.clock.setFixedTime(baseTime + (session - 1) * 86400000 + activity_index * 60000)
          const result = await answerCorrectly(page, activity)
          expect(result.answered).toBe(true)
          const outcome = result.graded ? await readFeedbackOutcome(page) : 'observed'
          rows.push({ session, activity_index, profile_id: PROFILE_A, ...activity,
            focus: activity.planner_focus_key, target: activity.target_id, construction: activity.construction_id,
            selection_reason: activity.supply?.selection_reason, candidate_count: activity.total_candidates,
            eligible_supply_count: activity.supply?.eligible_supply_count, unseen_supply_count: activity.supply?.unseen_supply_count,
            timestamp: new Date(baseTime + (session - 1) * 86400000 + activity_index * 60000).toISOString(), outcome })
          expect(outcome).toBe(result.graded ? 'correct' : 'observed')
          if (result.graded) await page.getByTestId('v2lx-continue').click()
          await waitForAdvance(page, counter)
        }
        await expect(page.getByTestId('v2lx-summary')).toBeVisible()
        await page.getByTestId('v2lx-finish').click()
        console.log(`V3 ${enabled ? 'ON' : 'OFF'}: session ${session}, ${rows.length} activities`)
        writeFileSync(path, JSON.stringify({ enabled, seed: 20260927, runtime, rows }, null, 2))
      }
      expect(rows).toHaveLength(240)
      const journal = await page.evaluate(async () => {
        const settings = await window.__e2e.db.getSettings()
        return Object.entries(settings).filter(([k,v]) => k.startsWith('learner_interaction_v2:') && v.profile_id === 'profile-a').map(([,v]) => v)
      })
      expect(journal).toHaveLength(240)
      writeFileSync(path.replace('.json', '-journal.json'), JSON.stringify(journal, null, 2))
      if (enabled) {
        const seen = new Set()
        for (const row of rows) {
          if (row.supply?.v3_eligible_count > 0 && row.supply?.unseen_supply_count > 0) expect(seen.has(row.text_en), 'V3_AVOIDABLE_LITERAL_REPEAT').toBe(false)
          seen.add(row.text_en)
        }
      }
    } finally {
      writeFileSync(path, JSON.stringify({ enabled, seed: 20260927, runtime, rows }, null, 2))
    }
  })
}
