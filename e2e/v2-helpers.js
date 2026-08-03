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

// Toggle the read-only diagnostics/inspector flag (Slice V2.7). In the built
// preview app import.meta.env.DEV is false, so the inspector is gated purely by
// this setting.
export async function setDiagnosticsFlag(page, enabled) {
  await page.evaluate(async (enabled) => {
    await window.__e2e.db.setSetting('pedagogy_v2_diagnostics_enabled', enabled)
  }, enabled)
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

// Toggle the learner-experience product flag EXPLICITLY. Since Slice V2.20 the
// setting is three-valued: unset means "environment default", and the E2E bundle
// is built with VITE_V2_DOGFOOD=1, so unset resolves to V2. Passing `false` here
// is the way a spec pins the legacy V1 hub on purpose (§2).
export async function setLearnerFlag(page, enabled) {
  await page.evaluate(async (enabled) => {
    await window.__e2e.db.setSetting('v2_learner_experience_enabled', enabled)
  }, enabled)
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

export async function openHub(page) {
  await page.getByTestId('open-training-hub').click()
  await expect(page.getByRole('heading', { name: 'Escolha o que treinar' })).toBeVisible()
}

// → V2 Learner Home.
//
// Slice V2.18 reached it by clicking the legacy Home's "open-training-hub" card
// (Training rendered the V2 Home when the flag was on). The V2.20-R cutover then
// made the ROOT Home itself the V2 Learner Home and moved the V1 Home into
// LegacyHome.jsx — which is the only place `open-training-hub` still lives. This
// helper was not updated with it, so every spec that reached the V2 surfaces
// through here has been waiting 180s for a button that no longer renders.
//
// Both worlds are handled: when the V2 Home is already the root, nothing needs
// clicking; when the V1 opt-out is pinned, the legacy Training entry still is.
export async function openV2Home(page) {
  if (!(await page.getByTestId('v2lx-home').count())) {
    const legacyEntry = page.getByTestId('open-training-hub')
    if (await legacyEntry.count()) await legacyEntry.click()
  }
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
}

// V2 Home → "Praticar agora" → the learner lesson screen (adaptive).
export async function openLearnerExperience(page) {
  await openV2Home(page)
  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-screen')).toBeVisible()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
}

// Wait for the horizontal transition to complete after a "Continuar": either the
// factual activity counter changed (a new activity is presenting) or the session
// summary appeared. Robust against the slide animation swapping the DOM.
export async function waitForAdvance(page, counterBefore) {
  await page.waitForFunction((prev) => {
    if (document.querySelector('[data-testid="v2lx-summary"]')) return true
    const c = document.querySelector('[data-testid="v2lx-step-counter"]')
    return !!c && c.textContent !== prev
  }, counterBefore, { timeout: 15000 })
}

/**
 * Fill a V2.22 word-order rail by tapping bank chips left to right.
 *
 * Since V2.22-UX1 a used chip STAYS in the bank (faded, `data-used`), so the
 * pre-V2.22 "click the first button N times" loop would re-tap the same spent
 * chip forever. Target the un-used ones explicitly.
 */
export async function fillWordOrder(page) {
  const free = page.locator('[data-testid="v2lx-token-bank"] button:not([data-used])')
  for (let guard = 0; guard < 24; guard++) {
    const n = await free.count()
    if (!n) break
    await free.first().click()
  }
}

/**
 * Fill EVERY gap of a completion activity — one slot per masked element since
 * V2.22-UX1. With a word bank each remaining chip goes into the next empty gap;
 * with free input each slot is typed into directly.
 */
export async function fillCompletion(page, freeText = 'still') {
  // Which SHAPE the activity has is decided by the plan's support features, so
  // ask for the bank CONTAINER — not for un-used chips. A bank whose chips are
  // all spent still means "this is a word-bank activity", and trying to type
  // into a slot button would throw.
  if (await page.locator('[data-testid="v2lx-word-bank"]').count()) {
    const free = page.locator('[data-testid="v2lx-word-bank"] button:not([data-used])')
    for (let guard = 0; guard < 12; guard++) {
      if (!(await free.count())) break
      await free.first().click()
    }
    return
  }
  const slots = page.locator('[data-testid^="v2lx-slot-"]')
  const total = await slots.count()
  for (let i = 0; i < total; i++) await slots.nth(i).fill(freeText)
}

// Answers whatever learner activity is presenting, then continues to the next
// and waits for the transition to complete. Returns the recipe answered. Skips
// (returns null) an un-answerable speaking activity when STT is unavailable.
export async function answerLearnerActivity(page) {
  const activity = page.locator('[data-testid^="v2lx-activity-"]')
  await expect(activity).toBeVisible()
  const recipe = (await activity.getAttribute('data-testid')).replace('v2lx-activity-', '')
  const counterBefore = await page.getByTestId('v2lx-step-counter').textContent()
  if (recipe === 'exposure') {
    await page.getByTestId('v2lx-continue').click()
    await waitForAdvance(page, counterBefore)
    return recipe
  }
  if (recipe === 'meaning_recognition' || recipe === 'listening_recognition' || recipe === 'context_recognition') {
    // Slice V2.20 §9: context_recognition shares the single_choice contract, so
    // it evaluates on tap exactly like the other recognition recipes.
    await page.locator('[data-testid^="v2lx-option-"]').first().click() // evaluate on tap
  } else if (recipe === 'completion') {
    await fillCompletion(page)
    await page.getByTestId('v2lx-check').click()
  } else if (recipe === 'word-order') {
    await fillWordOrder(page)
    await page.getByTestId('v2lx-check').click()
  } else if (recipe === 'guided_production' || recipe === 'free_production') {
    const input = page.getByTestId('v2lx-production-input')
    if (!(await input.count())) return null // speaking modality without STT — skip
    await input.fill('I still live here.')
    await page.getByTestId('v2lx-check').click()
  } else {
    return null // speaking / pronunciation without STT in the test runtime
  }
  // Feedback appears on the SAME screen; then continue to the next activity.
  await expect(page.getByTestId('v2lx-feedback')).toBeVisible()
  await page.getByTestId('v2lx-continue').click()
  await waitForAdvance(page, counterBefore)
  return recipe
}

/** Hub → "Laboratório V2" card → pack-selection screen. */
export async function openLab(page) {
  await openHub(page)
  await page.getByTestId('v2-pilot-open').click()
  await expect(page.getByTestId('v2-lab-screen')).toBeVisible()
}

/** Hub → Lab → "Playground V2" card → the Pedagogy V2 Playground screen.
 * Requires both the pilot flag (to reach the lab) and the diagnostics flag. */
export async function openPlayground(page) {
  await openLab(page)
  await page.getByTestId('v2-open-playground').click()
  await expect(page.getByTestId('v2pg-screen')).toBeVisible()
}

// Answers whatever activity the Playground currently presents (via the shared
// V2 renderers). Returns the recipe. Used by the Sessão V2 E2E.
export async function answerPlaygroundActivity(page) {
  const activity = page.locator('[data-testid^="v2-activity-"]')
  await expect(activity).toBeVisible()
  const recipe = (await activity.getAttribute('data-testid')).replace('v2-activity-', '')
  if (recipe === 'exposure') {
    await page.getByTestId('v2-continue').click()
  } else if (recipe === 'meaning_recognition' || recipe === 'listening_recognition') {
    await page.locator('[data-testid^="v2-option-"]').first().click()
    await page.getByTestId('v2-submit').click()
  } else if (recipe === 'fixed_element_completion') {
    await page.getByTestId('v2-completion-input').fill('yet')
    await page.getByTestId('v2-submit').click()
  } else if (recipe === 'word_order_reconstruction') {
    const total = await page.locator('[data-testid="v2-token-bank"] button').count()
    for (let i = 0; i < total; i++) await page.locator('[data-testid="v2-token-bank"] button').first().click()
    await page.getByTestId('v2-submit').click()
  } else {
    await page.getByTestId('v2-production-input').fill('I still live here.')
    await page.getByTestId('v2-submit').click()
  }
  return recipe
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

// Selection screen → adaptive/review/explore study session screen.
export async function openStudyMode(page, mode) {
  await page.getByTestId(`v2-mode-${mode}`).click()
  await expect(page.getByTestId('v2-study-screen')).toBeVisible()
}

// Answers the current activity on EITHER the focused pilot screen or the study
// screen; returns its recipe. Production fallbacks are unused in the
// deterministic early session.
export async function answerCurrentActivity(page) {
  const activity = page.locator('[data-testid^="v2-activity-"]')
  await expect(activity).toBeVisible()
  const recipe = (await activity.getAttribute('data-testid')).replace('v2-activity-', '')
  if (recipe === 'exposure') {
    await page.getByTestId('v2-continue').click()
  } else if (recipe === 'meaning_recognition' || recipe === 'listening_recognition') {
    await page.locator('[data-testid^="v2-option-"]').first().click()
    await page.getByTestId('v2-submit').click()
  } else if (recipe === 'completion') {
    await page.getByTestId('v2-completion-input').fill('but')
    await page.getByTestId('v2-submit').click()
  } else if (recipe === 'word-order') {
    const total = await page.locator('[data-testid^="v2-token-"]').count()
    for (let i = 0; i < total; i++) await page.locator('[data-testid="v2-token-bank"] button').first().click()
    await page.getByTestId('v2-submit').click()
  }
  return recipe
}

/**
 * Seed valid LearnerEvidenceV2 events straight through the public storage
 * layer. `rows` = [{ target_type, target_id, modality ('reading'|'listening'),
 * capability?, activity_kind?, outcome?, n? }]; each row expands to n assessed
 * events.
 *
 * `capability` defaults to 'recognition'. `meaning_recognition` legitimately
 * carries BOTH recognition and comprehension evidence (see ACTIVITY_KIND_RULES),
 * so a spec can seed a learner who has genuinely worked through the lower rungs
 * without ever granting a production rung it has not earned.
 */
export async function seedV2Evidence(page, profileId, rows) {
  await page.evaluate(async ({ profileId, rows }) => {
    const events = []
    let seq = 0
    const t0 = Date.UTC(2026, 5, 1, 10, 0, 0)
    for (const row of rows) {
      for (let i = 0; i < (row.n ?? 3); i++) {
        seq++
        const capability = row.capability ?? 'recognition'
        events.push({
          schema_version: 1,
          learner_model_version: 1,
          evidence_id: `evidence:e2e.${row.target_id}.${row.modality}.${capability}.${i}`,
          profile_id: profileId,
          interaction_id: `interaction:e2e.${seq}`,
          session_id: 'session:e2e-fixture',
          target: { target_type: row.target_type, target_id: row.target_id },
          exemplar_id: null,
          activity: {
            activity_kind: row.activity_kind
              ?? (row.modality === 'listening' ? 'listening_recognition' : 'meaning_recognition'),
            capability,
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


/**
 * Slice V2.20 §42/§48 — clear any explicit experience choice so the app falls
 * back to the ENVIRONMENT default. In the E2E bundle (built with
 * VITE_V2_DOGFOOD=1) that default is the V2 experience, which is exactly what a
 * developer sees on a dev server. This is how the dogfood specs prove that
 * opening Training lands on V2 without touching any hidden flag.
 */
export async function clearExperienceChoice(page) {
  await page.evaluate(async () => {
    await window.__e2e.db.setSetting('v2_learner_experience_enabled', undefined)
  })
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__e2e && window.__e2e.db)
}

// ---- V2.22-UX2-R first-run ---------------------------------------------------

/**
 * Complete the V2 first-run (§4). This is what a stranger with the public URL
 * now sees on a clean install: two steps, one question, no audience split and
 * no CEFR self-assessment.
 *
 * Every spec that used to call the legacy `onboarding-*` testids goes through
 * here instead — and the ones that genuinely test the LEGACY product pin
 * `v2_learner_experience_enabled = false` first and keep using the old ids.
 */
export async function completeV2FirstRun(page, name = 'Rob') {
  await expect(page.getByTestId('v2lx-onboarding')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('v2lxo-continue').click()
  await page.getByTestId('v2lxo-name-input').fill(name)
  await page.getByTestId('v2lxo-start').click()
  await expect(page.getByTestId('v2lx-home')).toBeVisible({ timeout: 20_000 })
}

/**
 * Pin the LEGACY product BEFORE the first run, so the legacy onboarding is the
 * one that renders. Writes the setting straight to IndexedDB and reloads —
 * `setLearnerFlag` cannot be used for this because it goes through
 * `window.__e2e`, which is fine, but this variant also works on a page that has
 * not booted the store yet.
 */
export async function pinLegacyBeforeFirstRun(page) {
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('app-idiomas')
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
    })
    await new Promise((res, rej) => {
      const tx = db.transaction('settings', 'readwrite')
      tx.objectStore('settings').put({ key: 'v2_learner_experience_enabled', value: false })
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
    })
    db.close()
  })
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
}
