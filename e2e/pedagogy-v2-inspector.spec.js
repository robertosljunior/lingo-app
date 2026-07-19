// pedagogy-v2-inspector.spec.js — E2E of the read-only Pedagogy V2 Inspector
// (Slice V2.7, §32). The inspector is a diagnostics-only tool: in the built
// preview app (import.meta.env.DEV === false) it is reachable ONLY when the
// pedagogy_v2_diagnostics_enabled flag is on. These scenarios prove the gating,
// that it visualizes REAL learner state loaded from IndexedDB, explains the
// planner, and exports a privacy-safe diagnostic (no profile_id, no free text).
// It never edits data and never claims a global mastery.
import { test, expect } from '@playwright/test'
import { enableTestHooks, seedFixtures, attachErrorMonitor, readStore, PROFILE_A } from './helpers.js'
import { setPilotFlag, setDiagnosticsFlag, openLab, seedV2Evidence } from './v2-helpers.js'

// Reading recognition evidence for a still sense + construction, enough to give
// the inspector real per-lane state and review candidates to render.
const SEED_ROWS = [
  { target_type: 'sense', target_id: 'sense:still.continuity', modality: 'reading', n: 3 },
  { target_type: 'sense', target_id: 'sense:still.continuity', modality: 'listening', n: 1 },
  { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb', modality: 'reading', n: 3 },
]

async function openInspectorFromLab(page) {
  await openLab(page)
  await page.getByTestId('v2-open-inspector').click()
  await expect(page.getByTestId('v2-inspector-screen')).toBeVisible()
}

test.describe('gating', () => {
  test('the inspector entry is hidden while diagnostics is off', async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, false)
    await openLab(page)
    await expect(page.getByTestId('v2-open-inspector')).toHaveCount(0)
  })

  test('with diagnostics on, the lab exposes the inspector entry and it opens', async ({ page, context }) => {
    const monitor = attachErrorMonitor(page)
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, true)
    await openLab(page)
    await expect(page.getByTestId('v2-open-inspector')).toBeVisible()
    await page.getByTestId('v2-open-inspector').click()
    await expect(page.getByTestId('v2-inspector-screen')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedagogy V2 Inspector' })).toBeVisible()
    monitor.assertClean?.()
  })
})

test.describe('visualizing real learner state', () => {
  test.beforeEach(async ({ page, context }) => {
    await enableTestHooks(context)
    await seedFixtures(page, { active: PROFILE_A })
    await setPilotFlag(page, true)
    await setDiagnosticsFlag(page, true)
    await seedV2Evidence(page, PROFILE_A, SEED_ROWS)
  })

  test('loads the seeded targets, lexeme facts and a planner explanation', async ({ page }) => {
    await openInspectorFromLab(page)
    // The async state load replaces the loading placeholder with the real view.
    await expect(page.getByTestId('v2-inspector-loading')).toHaveCount(0)
    await expect(page.getByTestId('v2-inspector-targets')).toBeVisible()
    await expect(page.getByTestId('v2-inspector-targets')).toContainText('sense:still.continuity')
    await expect(page.getByTestId('v2-inspector-lexeme')).toBeVisible()
    await expect(page.getByTestId('v2-inspector-planner')).toBeVisible()
    await expect(page.getByTestId('v2-inspector-candidates')).toContainText('Candidatos:')
  })

  test('the review-queue and timeline sections render from real evidence', async ({ page }) => {
    await openInspectorFromLab(page)
    await expect(page.getByTestId('v2-inspector-review-queue')).toBeVisible()
    await expect(page.getByTestId('v2-inspector-timeline')).toBeVisible()
    // Timeline is fed by recorded evidence for the seeded target.
    await expect(page.getByTestId('v2-inspector-timeline')).toContainText('sense:still.continuity')
  })

  test('the target selector filters to a single target', async ({ page }) => {
    await openInspectorFromLab(page)
    await page.getByTestId('v2-inspector-target-select').selectOption('sense:still.continuity')
    await expect(page.getByTestId('v2-inspector-targets')).toContainText('(selecionado)')
  })

  test('explains independence availability as an instrument property, not a learner deficit (Slice V2.8)', async ({ page }) => {
    await openInspectorFromLab(page)
    await expect(page.getByTestId('v2-inspector-targets')).toBeVisible()
    const indep = page.getByTestId('v2-inspector-independence').first()
    await expect(indep).toBeVisible()
    // Recognition has no independent recipe → framed as "not measured by this
    // activity type", never as "the learner has not mastered".
    const body = await page.getByTestId('v2-inspector-targets').innerText()
    expect(body).toContain('Independência mensurável')
    expect(body).not.toMatch(/aluno (ainda )?não domina/i)
  })

  test('never shows a global-mastery claim about the word', async ({ page }) => {
    await openInspectorFromLab(page)
    await expect(page.getByTestId('v2-inspector-targets')).toBeVisible()
    const body = await page.getByTestId('v2-inspector-screen').innerText()
    expect(body).not.toMatch(/domínio|palavra aprendida|nível \d/i)
  })

  test('exports a privacy-safe diagnostic and never mutates learner data', async ({ page }) => {
    await openInspectorFromLab(page)
    const before = await readStore(page, 'learner_evidence_v2')
    await page.getByTestId('v2-inspector-export').click()
    const out = page.getByTestId('v2-inspector-export-output')
    await expect(out).toBeVisible()
    const json = JSON.parse(await out.innerText())
    expect(json.export_version).toBe(1)
    expect(json).not.toHaveProperty('profile_id')
    expect(JSON.stringify(json)).not.toContain(PROFILE_A)
    // Read-only: the export did not add, change or remove any evidence.
    const after = await readStore(page, 'learner_evidence_v2')
    expect(after.length).toBe(before.length)
  })
})
