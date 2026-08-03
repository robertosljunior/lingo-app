import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, PROFILE_A, PROFILE_B } from './helpers.js'
import { setLearnerFlag } from './v2-helpers.js'

async function seedRecoveredEvidence(page) {
  await page.evaluate(async ({ profileA }) => {
    const occurred = '2026-08-03T12:00:00.000Z'
    const support = { features: [], hint_count: 0, attempt_number: 1 }
    const activity = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
    const source = { source_type: 'test' }
    const shared = {
      schema_version: 1,
      learner_model_version: 1,
      profile_id: profileA,
      session_id: 'session:rx0-history',
      exemplar_id: 'exemplar:still.001',
      activity,
      partial_score: null,
      assessment_confidence: 1,
      support,
      source,
      occurred_at: occurred,
    }
    await window.__e2e.db.recordLearnerEvidenceBatchV2([
      {
        ...shared,
        evidence_id: 'evidence:rx0.interaction.1:sense:still.continuity',
        interaction_id: 'interaction:rx0.1',
        target: { target_type: 'sense', target_id: 'sense:still.continuity' },
        attribution: 'direct',
        outcome: 'incorrect',
      },
      {
        ...shared,
        evidence_id: 'evidence:rx0.interaction.1:construction:still.subject_still_lexical_verb',
        interaction_id: 'interaction:rx0.1',
        target: { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' },
        attribution: 'indirect',
        outcome: 'incorrect',
      },
      {
        ...shared,
        evidence_id: 'evidence:rx0.interaction.2:sense:still.continuity',
        interaction_id: 'interaction:rx0.2',
        target: { target_type: 'sense', target_id: 'sense:still.continuity' },
        attribution: 'direct',
        outcome: 'correct',
        occurred_at: '2026-08-03T12:02:00.000Z',
      },
    ])
  }, { profileA: PROFILE_A })
}

async function setActiveProfile(page, profileId) {
  await page.evaluate((id) => window.__e2e.db.setSetting('active_profile', id), profileId)
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

test('V2 history and review points recover persisted evidence without V1 scores or duplicate targets', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await seedRecoveredEvidence(page)
  await page.reload()
  await expect(page.getByTestId('v2lx-home')).toBeVisible()

  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByTestId('v2-history')).toBeVisible()
  await expect(page.getByTestId('v2-history-session')).toHaveCount(1)
  await expect(page.getByTestId('v2-history-session')).toContainText('2 atividades')
  await expect(page.getByTestId('v2-history')).not.toContainText(/\d+\s*%/)
  await expect(page.getByTestId('v2-history')).not.toContainText(/A1|A2|B1|B2/)

  await page.getByTestId('v2-history-session').getByRole('button').click()
  await expect(page.getByTestId('v2-history-session')).toContainText('Este registro foi recuperado')

  await page.getByRole('button', { name: 'Erros' }).click()
  await expect(page.getByTestId('v2-review-points')).toBeVisible()
  // The direct incorrect interaction becomes one point. Its indirect
  // construction evidence must not create a second learner-facing "error".
  await expect(page.getByTestId('v2-review-point')).toHaveCount(1)
  await expect(page.getByTestId('v2-start-review')).toBeVisible()
  await expect(page.getByTestId('v2-review-points')).not.toContainText(/\d+\s*%/)

  // The same physical database remains profile-isolated after a full reload.
  await setActiveProfile(page, PROFILE_B)
  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByTestId('v2-history-empty')).toBeVisible()
  await page.getByRole('button', { name: 'Erros' }).click()
  await expect(page.getByTestId('v2-review-empty')).toBeVisible()
})
