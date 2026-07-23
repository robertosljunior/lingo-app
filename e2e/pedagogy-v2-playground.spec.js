// pedagogy-v2-playground.spec.js — E2E of the Slice V2.12 Pedagogy V2 Playground
// (§26). The Playground is a diagnostics-only surface: in the built preview app
// (import.meta.env.DEV === false) it is reachable ONLY when the
// pedagogy_v2_diagnostics_enabled flag is on. These scenarios prove the gate, a
// real Sessão V2 with its diagnostics (pipeline / StudyFocus / ActivityPlan /
// Assessment / evidence), the Sandbox isolation guarantee (learner_evidence_v2
// never changes across repeated evaluations) and the mobile no-overflow smoke.
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, readStore, attachErrorMonitor, PROFILE_A } from './helpers.js'
import { setPilotFlag, setDiagnosticsFlag, openLab, openPlayground, answerPlaygroundActivity } from './v2-helpers.js'

test.describe('gating', () => {
  test('the Playground card is hidden while diagnostics is off', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, false)
    await openLab(page)
    await expect(page.getByTestId('v2-open-playground')).toHaveCount(0)
  })

  test('with diagnostics on, the lab exposes the Playground card and it opens', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, true)
    await openLab(page)
    await expect(page.getByTestId('v2-open-playground')).toBeVisible()
    await page.getByTestId('v2-open-playground').click()
    await expect(page.getByTestId('v2pg-screen')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedagogy V2 Playground' })).toBeVisible()
    await expect(page.getByTestId('v2pg-pipeline-badge')).toContainText('Pipeline: Pedagogy V2')
  })
})

test.describe('Sessão V2', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, true)
  })

  test('runs a focused yet session and shows the V2 diagnostics + records evidence', async ({ page }) => {
    const monitor = attachErrorMonitor(page)
    await openPlayground(page)

    // Sessão V2 is the default mode; pick focused + the yet pack, then start.
    await page.getByTestId('v2pg-session-mode').selectOption('focused')
    await page.getByTestId('v2pg-session-pack').selectOption('pedagogy_v2_yet')
    await page.getByTestId('v2pg-session-start').click()

    // A real authored activity renders through the shared V2 renderers.
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()

    // Slice V2.16: the Focus Resolution diagnostics panel is present and shows a
    // materialized selection (no magic cap; termination by candidate exhaustion).
    const fr = page.getByTestId('v2pg-focus-resolution')
    await expect(fr).toBeVisible()
    await fr.getByText('Focus Resolution').click()
    await expect(fr).toContainText('selected rank')
    await expect(fr).toContainText('candidates')

    await answerPlaygroundActivity(page)

    // Feedback appears, built by the pure view model.
    await expect(page.getByTestId('v2pg-feedback')).toBeVisible()

    // Open the technical diagnostics and confirm every required section.
    await page.getByTestId('v2pg-diagnostics').getByText('Diagnóstico técnico').first().click()
    const diag = page.getByTestId('v2pg-diagnostics')
    await expect(diag.getByTestId('v2pg-pipeline-badge')).toBeVisible()
    await expect(diag.getByTestId('v2pg-diag-focus')).toBeVisible()
    await expect(diag.getByTestId('v2pg-diag-plan')).toContainText('activity_id')
    await expect(diag.getByTestId('v2pg-diag-assessment')).toContainText('status')
    // Slice V2.13: the typed diagnosis panel is present (raw → diagnosis → feedback).
    await expect(diag.getByTestId('v2pg-diag-diagnosis')).toContainText('cause coverage')
    await expect(diag.getByTestId('v2pg-diag-planned-evidence')).toBeVisible()
    await expect(diag.getByTestId('v2pg-diag-recorded-evidence')).toContainText('evidence:')

    // Real evidence was persisted in the normal session store.
    const evidence = await readStore(page, 'learner_evidence_v2')
    expect(evidence.length).toBeGreaterThan(0)
    monitor.assertClean?.()
  })
})

test.describe('Sandbox de avaliação', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, true)
  })

  test('evaluates multiple responses on one plan and NEVER persists evidence', async ({ page }) => {
    await openPlayground(page)
    await page.getByTestId('v2pg-mode-sandbox').click()
    await expect(page.getByTestId('v2pg-sandbox-warning')).toContainText('nenhuma evidência será gravada')

    // Baseline: the learner-evidence store before any sandbox work.
    const before = await readStore(page, 'learner_evidence_v2')

    // Materialize a real, deterministically text-answerable production activity.
    await page.getByTestId('v2pg-target-capability').selectOption('free_production')
    await page.getByTestId('v2pg-target-modality').selectOption('writing')
    await page.getByTestId('v2pg-sandbox-materialize').click()
    await expect(page.getByTestId('v2pg-sandbox-activity')).toBeVisible()

    // Response A → evaluate.
    await page.getByTestId('v2pg-sandbox-answer').fill('This price is very high.')
    await page.getByTestId('v2pg-sandbox-evaluate').click()
    await expect(page.getByTestId('v2pg-feedback')).toBeVisible()

    // The raw assessment and the presented view model are BOTH inspectable (§17).
    await page.getByTestId('v2pg-diagnostics').getByText('Diagnóstico técnico').first().click()
    await expect(page.getByTestId('v2pg-raw-assessment')).toBeVisible()
    await expect(page.getByTestId('v2pg-feedback-vm')).toBeVisible()

    // Response B → re-evaluate the SAME plan.
    await page.getByTestId('v2pg-sandbox-answer').fill('Its price is very expensive.')
    await page.getByTestId('v2pg-sandbox-evaluate').click()
    await expect(page.getByTestId('v2pg-feedback')).toBeVisible()

    // Isolation guarantee: no evidence was written across either evaluation.
    const after = await readStore(page, 'learner_evidence_v2')
    expect(after.length).toBe(before.length)
  })

  // §18/§33 — the diagnosis chain raw semantic → diagnosis → feedback is
  // inspectable for a real semantic (free production) assessment.
  test('shows the raw → diagnosis → feedback chain for a semantic assessment', async ({ page }) => {
    await openPlayground(page)
    await page.getByTestId('v2pg-mode-sandbox').click()

    // Force a semantic recipe: free production / writing.
    await page.getByTestId('v2pg-target-capability').selectOption('free_production')
    await page.getByTestId('v2pg-target-modality').selectOption('writing')
    await page.getByTestId('v2pg-sandbox-materialize').click()
    await expect(page.getByTestId('v2pg-sandbox-activity')).toBeVisible()

    await page.getByTestId('v2pg-sandbox-answer').fill('It is not ready yet.')
    await page.getByTestId('v2pg-sandbox-evaluate').click()
    await expect(page.getByTestId('v2pg-feedback')).toBeVisible()

    await page.getByTestId('v2pg-diagnostics').getByText('Diagnóstico técnico').first().click()
    const diag = page.getByTestId('v2pg-diagnostics')
    // The pipeline layers are all present and distinct (§18/§21).
    await expect(diag.getByTestId('v2pg-diag-diagnosis')).toContainText('cause coverage')
    await expect(diag.getByTestId('v2pg-diag-bridge')).toContainText('strategy')
    await expect(diag.getByTestId('v2pg-diag-raw-semantic')).toBeVisible()
    await expect(diag.getByTestId('v2pg-raw-assessment')).toBeVisible()
    await expect(diag.getByTestId('v2pg-feedback-vm')).toBeVisible()
  })

  // §35 — an authored equivalent_meaning target makes semantic_context reachable.
  // The default sandbox (but pack, first sense, free_production/writing)
  // deterministically materializes exemplar:but.012 which carries the metadata.
  test('an authored semantic target flags off-topic as semantic_context, accepts variation', async ({ page }) => {
    await openPlayground(page)
    await page.getByTestId('v2pg-mode-sandbox').click()
    await page.getByTestId('v2pg-target-capability').selectOption('free_production')
    await page.getByTestId('v2pg-target-modality').selectOption('writing')
    await page.getByTestId('v2pg-sandbox-materialize').click()
    await expect(page.getByTestId('v2pg-sandbox-activity')).toBeVisible()
    // The loaded plan's strategy is visible (§22) and is the authored one.
    await expect(page.getByTestId('v2pg-sandbox-strategy')).toContainText('equivalent_meaning')

    // C: off-topic (essential entity gone) → not_aligned → semantic_context.
    await page.getByTestId('v2pg-sandbox-answer').fill('I like bananas.')
    await page.getByTestId('v2pg-sandbox-evaluate').click()
    await expect(page.getByTestId('v2pg-feedback')).toBeVisible()
    await page.getByTestId('v2pg-diagnostics').getByText('Diagnóstico técnico').first().click()
    await expect(page.getByTestId('v2pg-diag-bridge')).toContainText('equivalent_meaning')
    await expect(page.getByTestId('v2pg-diag-diagnosis')).toContainText('semantic_context')
    // Slice V2.15: the composite Semantic Equivalence panel is present.
    await expect(page.getByTestId('v2pg-diag-equivalence')).toContainText('not_aligned')
    await expect(page.getByTestId('v2pg-diag-equivalence')).toContainText('MISSING_ESSENTIAL_ENTITY')

    // A: essential word present but meaning unconfirmable under hashing → the
    // equivalence is `uncertain` and NO meaning mismatch is invented (§23/§36.1).
    await page.getByTestId('v2pg-sandbox-answer').fill('The plan is very good.')
    await page.getByTestId('v2pg-sandbox-evaluate').click()
    await expect(page.getByTestId('v2pg-feedback')).toBeVisible()
    await expect(page.getByTestId('v2pg-diag-diagnosis')).not.toContainText('MEANING_MISMATCH')
    await expect(page.getByTestId('v2pg-diag-equivalence')).toContainText('uncertain')
  })
})

test.describe('Testar target', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, true)
  })

  test('materializes an authored activity for a chosen target without writing evidence', async ({ page }) => {
    await openPlayground(page)
    await page.getByTestId('v2pg-mode-target').click()

    const before = await readStore(page, 'learner_evidence_v2')
    await page.getByTestId('v2pg-target-pack').selectOption('pedagogy_v2_yet')
    // default isolation is "isolated"; generate a real authored activity.
    await page.getByTestId('v2pg-target-generate').click()
    await expect(page.locator('[data-testid^="v2-activity-"]')).toBeVisible()
    await expect(page.getByTestId('v2pg-isolated-note')).toContainText('nenhuma evidência')

    const after = await readStore(page, 'learner_evidence_v2')
    expect(after.length).toBe(before.length)
  })
})

test.describe('UI safety', () => {
  test('mobile smoke — no horizontal overflow on the Playground', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, true)
    await page.setViewportSize({ width: 375, height: 720 })
    await openPlayground(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
