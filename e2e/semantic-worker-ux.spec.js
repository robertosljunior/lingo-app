// Semantic WORKER end-to-end UX. Proves the real USE model — running inside the
// dedicated Web Worker — drives the actual feedback UI (not just the deterministic
// hook), and that leaving a lesson while an analysis is in flight cancels the
// worker request cleanly (no stale feedback, no crash). Gated on the model assets
// being available (fetched into e2e/.cache/use-model by global setup).
import { test, expect } from '@playwright/test'
import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { enableTestHooks, seedFixtures, attachErrorMonitor, PROFILE_A } from './helpers.js'
import { USE_CACHE_DIR } from './use-model-setup.mjs'

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

const LESSON = `lesson_id: e2e_worker_ux_001
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
    f: request
`

async function installModelViaUI(page) {
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByTestId('semantic-model-settings')).toBeVisible()
  await page.getByTestId('semantic-model-download').click()
  await expect(page.getByTestId('semantic-model-status')).toHaveText('Pronto para uso offline', { timeout: 120_000 })
}

async function importLesson(page) {
  await page.getByRole('button', { name: 'Início', exact: true }).click()
  await page.getByText('Importar aula', { exact: true }).first().click()
  await page.locator('textarea.input').fill(LESSON)
  await page.getByRole('button', { name: 'Validar' }).click()
  await expect(page.getByText('Aula válida')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar e iniciar' }).click()
}

test('worker USE drives the real feedback UI for a valid free sentence', async ({ page, context }) => {
  test.skip(!ASSETS_AVAILABLE, 'USE model assets unavailable — environment-gated')
  test.setTimeout(150_000)
  const monitor = attachErrorMonitor(page)
  await routeModel(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  await installModelViaUI(page)
  await importLesson(page)

  await page.locator('textarea.input').fill('Please give me a dessert.')
  const submit = page.getByRole('button', { name: /Responder/ })
  await expect(submit).toBeEnabled()
  await submit.click()

  // The worker-backed analysis completes and drives the real semantic sheet.
  await expect(page.getByTestId('feedback-sheet')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('feedback-semantic')).toBeVisible()
  await expect(page.getByTestId('feedback-sheet')).not.toHaveAttribute('data-verdict', 'incorrect')
  // The effective engine is genuinely USE (via the worker), not hashing.
  const st = await page.evaluate(() => window.__LINGO_E2E__.semantic.status())
  expect(st.effective_engine).toBe('use')

  monitor.assertClean()
})

test('leaving a lesson mid-analysis cancels the worker cleanly (no stale feedback, no crash)', async ({ page, context }) => {
  test.skip(!ASSETS_AVAILABLE, 'USE model assets unavailable — environment-gated')
  test.setTimeout(150_000)
  const monitor = attachErrorMonitor(page)
  await routeModel(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  await installModelViaUI(page)
  await importLesson(page)

  await page.locator('textarea.input').fill('Please give me a dessert.')
  const submit = page.getByRole('button', { name: /Responder/ })
  await expect(submit).toBeEnabled()
  await submit.click()
  // Immediately leave while the worker analysis is (likely) still running.
  await page.getByRole('button', { name: 'Sair da aula' }).click()

  // We left the exercise: the question view is gone and no stale feedback sheet
  // ever appears once the (cancelled) worker analysis would have resolved.
  await expect(page.getByTestId('question-type')).toHaveCount(0)
  await page.waitForTimeout(1500) // give any in-flight analysis time to (not) resolve
  await expect(page.getByTestId('feedback-sheet')).toHaveCount(0)

  monitor.assertClean()
})
