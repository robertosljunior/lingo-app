// Real-model E2E — consolidated so the whole file runs SERIALLY on a single
// worker (Playwright: one file = one worker) inside the dedicated `use-model`
// Playwright project, which `dependencies` schedule to run AFTER the parallel
// projects finish. This removes the CPU/memory contention that made the real
// Universal Sentence Encoder specs flake when several 25 MB CPU-backend loads
// happened at once. Nothing here is mocked or skipped: real download bytes, real
// SHA-256 verify, real TensorFlow.js + USE from IndexedDB, real structural NLP.
import { test, expect } from '@playwright/test'
import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'
import { USE_CACHE_DIR } from './use-model-setup.mjs'

// One file in the `use-model` project (fullyParallel:false) → one worker → the
// tests run one after another with no cross-suite contention. We intentionally
// do NOT use describe.serial mode, so one failure never skips the rest.

const BASE = 'https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder'

let ASSETS_AVAILABLE = true
test.beforeAll(async () => {
  try { await access(path.join(USE_CACHE_DIR, 'model.json')); await access(path.join(USE_CACHE_DIR, 'group1-shard7of7')) }
  catch { ASSETS_AVAILABLE = false }
})

async function routeModel(context) {
  await context.route(`${BASE}/**`, async (route) => {
    const name = route.request().url().split('/').pop().split('?')[0]
    try { const buf = await readFile(path.join(USE_CACHE_DIR, name)); await route.fulfill({ status: 200, body: buf }) }
    catch { await route.fulfill({ status: 404, body: 'nf' }) }
  })
}

async function gotoSettings(page) {
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByTestId('semantic-model-settings')).toBeVisible()
}
async function installModelViaUI(page) {
  await gotoSettings(page)
  await page.getByTestId('semantic-model-download').click()
  await expect(page.getByTestId('semantic-model-status')).toHaveText('Pronto para uso offline', { timeout: 120_000 })
}
const analyze = (page, params) => page.evaluate((p) => window.__LINGO_E2E__.semantic.analyze(p), params)
const status = (page) => page.evaluate(() => window.__LINGO_E2E__.semantic.status())

const LESSON = `lesson_id: e2e_real_model_001
level: A1
focus: free_production
q:
  - id: 1
    t: answer_question
    pt: Peça uma sobremesa em um restaurante.
    p: Escreva um pedido educado em inglês.
    a: Could I have a dessert, please?
    f: request
  - id: 2
    t: answer_question
    pt: Fale sobre a rotina dele.
    p: Escreva uma frase no presente simples.
    a: He goes to work every day.
    f: subject_verb_agreement
`

async function importLesson(page) {
  await page.getByRole('button', { name: 'Início', exact: true }).click()
  await page.getByText('Importar aula', { exact: true }).first().click()
  await page.locator('textarea.input').fill(LESSON)
  await page.getByRole('button', { name: 'Validar' }).click()
  await expect(page.getByText('Aula válida')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar e iniciar' }).click()
}

// Fill the free-answer box and submit. Waits for the value to actually register
// before checking the button — the button is only disabled while empty or while
// an analysis is in flight, so this removes the render-race without an inflated
// blanket timeout.
async function answerFree(page, text) {
  // Wait for the exercise (past its entrance animation) so the controlled
  // textarea is mounted and stable before typing, then confirm the value stuck
  // (a re-render on model warmup could otherwise clear an early fill).
  await expect(page.getByTestId('question-type')).toBeVisible()
  const box = page.locator('textarea.input')
  await box.click()
  await expect(async () => {
    await box.fill(text)
    await expect(box).toHaveValue(text, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  const submit = page.getByRole('button', { name: /Responder/ })
  await expect(submit).toBeEnabled({ timeout: 30_000 })
  await submit.click()
  await expect(page.getByTestId('feedback-sheet')).toBeVisible({ timeout: 60_000 })
}

// ---- semantic model install/offline/remove (real USE) ----
test('download via UI → effective USE → analyses → offline persists → remove', async ({ page, context }) => {
  test.skip(!ASSETS_AVAILABLE, 'USE model assets unavailable — environment-gated')
  test.setTimeout(180_000)
  await routeModel(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  await gotoSettings(page)
  await expect(page.getByTestId('semantic-model-status')).toHaveText('Não instalado')
  await expect(page.getByTestId('semantic-model-mode')).toBeVisible()
  expect((await status(page)).effective_engine).toBe('hashing')

  await page.getByTestId('semantic-model-download').click()
  await expect(page.getByTestId('semantic-model-status')).toHaveText('Pronto para uso offline', { timeout: 120_000 })

  const st = await status(page)
  expect(st.requested_engine).toBe('use')
  expect(st.effective_engine).toBe('use')
  expect(st.fallback_used).toBe(false)

  const free = await analyze(page, { text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1' })
  expect(free.engines.semantic_effective).toBe('use')
  expect(free.engines.grammar_effective).toBe('harper')
  expect(['valid', 'valid_with_suggestions']).toContain(free.verdict)

  const err = await analyze(page, { text: 'He go to work every day.', assessmentMode: 'free', level: 'A1' })
  expect(err.engines.semantic_effective).toBe('use')
  expect(err.verdict).not.toBe('valid')

  await context.unroute(`${BASE}/**`)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__LINGO_E2E__ && window.__LINGO_E2E__.semantic)
  expect((await status(page)).effective_engine).toBe('use')
  await context.setOffline(false)

  await gotoSettings(page)
  await page.getByTestId('semantic-model-remove').click()
  await expect(page.getByTestId('semantic-model-status')).toHaveText('Não instalado')
  expect((await status(page)).effective_engine).toBe('hashing')
  const afterRemove = await analyze(page, { text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1' })
  expect(afterRemove.engines.semantic_effective).toBe('hashing')
  expect(['valid', 'valid_with_suggestions']).toContain(afterRemove.verdict)
})

test('no model installed → honest hashing fallback, free never fails on low similarity', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  const st = await status(page)
  expect(st.requested_engine).toBe('hashing')
  expect(st.effective_engine).toBe('hashing')
  const r = await analyze(page, { text: 'I would rather stay home tonight.', assessmentMode: 'free', level: 'B1' })
  expect(r.engines.semantic_effective).toBe('hashing')
  expect(r.verdict).not.toBe('needs_revision')
})

// ---- worker UX (real USE in a Web Worker) ----
test('worker USE drives the real feedback UI for a valid free sentence', async ({ page, context }) => {
  test.skip(!ASSETS_AVAILABLE, 'USE model assets unavailable — environment-gated')
  test.setTimeout(180_000)
  const monitor = attachErrorMonitor(page)
  await routeModel(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await installModelViaUI(page)
  await importLesson(page)

  await answerFree(page, 'Please give me a dessert.')
  await expect(page.getByTestId('feedback-semantic')).toBeVisible()
  await expect(page.getByTestId('feedback-sheet')).not.toHaveAttribute('data-verdict', 'incorrect')
  const st = await page.evaluate(() => window.__LINGO_E2E__.semantic.status())
  expect(st.effective_engine).toBe('use')
  monitor.assertClean()
})

test('leaving a lesson mid-analysis cancels the worker cleanly (no stale feedback, no crash)', async ({ page, context }) => {
  test.skip(!ASSETS_AVAILABLE, 'USE model assets unavailable — environment-gated')
  test.setTimeout(180_000)
  const monitor = attachErrorMonitor(page)
  await routeModel(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await installModelViaUI(page)
  await importLesson(page)

  await expect(page.getByTestId('question-type')).toBeVisible()
  const box = page.locator('textarea.input')
  await box.click()
  await expect(async () => {
    await box.fill('Please give me a dessert.')
    await expect(box).toHaveValue('Please give me a dessert.', { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  const submit = page.getByRole('button', { name: /Responder/ })
  await expect(submit).toBeEnabled({ timeout: 30_000 })
  await submit.click()
  await page.getByRole('button', { name: 'Sair da aula' }).click()

  await expect(page.getByTestId('question-type')).toHaveCount(0)
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('feedback-sheet')).toHaveCount(0)
  monitor.assertClean()
})

// ---- free production via the structural pipeline (no USE required) ----
test('free production: valid sentence is not failed and hides the model answer', async ({ page, context }) => {
  const monitor = attachErrorMonitor(page)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await importLesson(page)

  await answerFree(page, 'Please give me a dessert.')
  await expect(page.getByTestId('feedback-semantic')).toBeVisible()
  await expect(page.getByTestId('feedback-comparison')).toHaveCount(0)
  await expect(page.getByTestId('feedback-sheet')).not.toHaveAttribute('data-verdict', 'incorrect')
  await expect(page.getByTestId('feedback-alternatives')).toContainText('Could I have a dessert, please?')
  monitor.assertClean?.()
})

test('free production: a real agreement error yields a corrected version, not a model answer', async ({ page, context }) => {
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await importLesson(page)

  await answerFree(page, 'Please give me a dessert.')
  await page.getByRole('button', { name: /Próxima/ }).click()
  await answerFree(page, 'He go to work every day.')
  await expect(page.getByTestId('feedback-corrected')).toContainText('He goes to work every day.')
  await expect(page.getByTestId('feedback-comparison')).toHaveCount(0)
})
