// v2-helpers.js — shared helpers for the pedagogy-V2 lab E2E suites
// (Slice V2.5): flag toggling, lab/selection navigation and generic activity
// answering. Everything drives the UI through stable selectors or talks to the
// public storage layer via the __e2e hook.
import { expect } from '@playwright/test'

export async function setPilotFlag(page, enabled) {
  await page.evaluate(async (enabled) => {
    await window.__e2e.db.setSetting('pedagogy_v2_pilot_enabled', enabled)
  }, enabled)
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

export async function openHub(page) {
  await page.getByTestId('open-training-hub').click()
  await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toBeVisible()
}

/** Hub → "Laboratório V2" card → pack-selection screen. */
export async function openLab(page) {
  await openHub(page)
  await page.getByTestId('v2-pilot-open').click()
  await expect(page.getByTestId('v2-lab-screen')).toBeVisible()
}

/** Selection screen → session screen of the given lemma ('still' | 'but'). */
export async function openPackSession(page, lemma) {
  await page.getByTestId(`v2-pack-${lemma}`).click()
  await expect(page.getByTestId('v2-pilot-screen')).toBeVisible()
  await expect(page.getByTestId('v2-session-title')).toContainText(`Laboratório V2 — ${lemma}`)
}

/** Session screen → back to the pack selection. */
export async function backToSelection(page) {
  await page.getByRole('button', { name: 'Voltar' }).first().click()
  await expect(page.getByTestId('v2-lab-screen')).toBeVisible()
}

// Answers whatever V2 activity is presenting; returns its recipe.
export async function answerCurrentV2Activity(page, { fixedElement = 'still' } = {}) {
  const screen = page.getByTestId('v2-pilot-screen')
  const activity = page.locator('[data-testid^="v2-activity-"]')
  await expect(activity).toBeVisible() // wait out the advancing → presenting hop
  const recipe = (await activity.getAttribute('data-testid')).replace('v2-activity-', '')
  expect(recipe).toBeTruthy()
  if (recipe === 'exposure') {
    await page.getByTestId('v2-continue').click()
  } else if (recipe === 'meaning_recognition' || recipe === 'listening_recognition') {
    await page.locator('[data-testid^="v2-option-"]').first().click()
    await page.getByTestId('v2-submit').click()
  } else if (recipe === 'completion') {
    await page.getByTestId('v2-completion-input').fill(fixedElement)
    await page.getByTestId('v2-submit').click()
  } else if (recipe === 'word-order') {
    const total = await page.locator('[data-testid^="v2-token-"]').count()
    for (let i = 0; i < total; i++) await page.locator('[data-testid="v2-token-bank"] button').first().click()
    await page.getByTestId('v2-submit').click()
  } else {
    // production fallback (unused in the deterministic early session)
    await page.getByTestId('v2-production-input').fill('I still live here.')
    await page.getByTestId('v2-submit').click()
  }
  return { recipe, screen }
}

export async function continueFromFeedback(page) {
  await expect(page.getByTestId('v2-feedback')).toBeVisible()
  await page.getByTestId('v2-feedback-continue').click()
}

/**
 * Seed valid LearnerEvidenceV2 events straight through the public storage
 * layer. `rows` = [{ target_type, target_id, modality ('reading'|'listening'),
 * outcome?, n? }]; each row expands to n assessed recognition events.
 */
export async function seedV2Evidence(page, profileId, rows) {
  await page.evaluate(async ({ profileId, rows }) => {
    const events = []
    let seq = 0
    const t0 = Date.UTC(2026, 5, 1, 10, 0, 0)
    for (const row of rows) {
      for (let i = 0; i < (row.n ?? 3); i++) {
        seq++
        events.push({
          schema_version: 1,
          learner_model_version: 1,
          evidence_id: `evidence:e2e.${row.target_id}.${row.modality}.${i}`,
          profile_id: profileId,
          interaction_id: `interaction:e2e.${seq}`,
          session_id: 'session:e2e-fixture',
          target: { target_type: row.target_type, target_id: row.target_id },
          exemplar_id: null,
          activity: {
            activity_kind: row.modality === 'listening' ? 'listening_recognition' : 'meaning_recognition',
            capability: 'recognition',
            modality: row.modality,
          },
          attribution: 'direct',
          outcome: row.outcome ?? 'correct',
          partial_score: null,
          assessment_confidence: 1,
          support: { features: [], hint_count: 0, attempt_number: 1 },
          source: { source_type: 'test' },
          occurred_at: new Date(t0 + seq * 60000).toISOString(),
        })
      }
    }
    await window.__e2e.db.recordLearnerEvidenceBatchV2(events)
  }, { profileId, rows })
}
