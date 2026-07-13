// Real semantic model (USE) — end-to-end through the app's own modules and the
// Settings UI. The pinned Google origin is intercepted and fulfilled from the
// on-disk cache (e2e/.cache/use-model, populated by global setup) because the
// sandbox browser has no route to the external origin. Everything else is real:
// real download bytes, real SHA-256 verification, real transactional install,
// real TensorFlow.js + USE loaded from IndexedDB, real 512-dim embeddings.
import { test, expect } from '@playwright/test'
import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
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

async function gotoSettings(page) {
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByTestId('semantic-model-settings')).toBeVisible()
}

const analyze = (page, params) => page.evaluate((p) => window.__LINGO_E2E__.semantic.analyze(p), params)
const status = (page) => page.evaluate(() => window.__LINGO_E2E__.semantic.status())

test('download via UI → effective USE → analyses → offline persists → remove', async ({ page, context }) => {
  test.skip(!ASSETS_AVAILABLE, 'USE model assets unavailable (no cache + no network to the pinned origin) — environment-gated')
  test.setTimeout(150_000)
  await routeModel(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })

  // Before install: basic mode, hashing engine, and free is NEVER failed.
  await gotoSettings(page)
  await expect(page.getByTestId('semantic-model-status')).toHaveText('Não instalado')
  await expect(page.getByTestId('semantic-model-mode')).toBeVisible()
  expect((await status(page)).effective_engine).toBe('hashing')

  // Download through the real UI button.
  await page.getByTestId('semantic-model-download').click()
  await expect(page.getByTestId('semantic-model-status')).toHaveText('Pronto para uso offline', { timeout: 120_000 })

  // Effective engine is genuinely USE (not hashing, not a mock).
  const st = await status(page)
  expect(st.requested_engine).toBe('use')
  expect(st.effective_engine).toBe('use')
  expect(st.fallback_used).toBe(false)

  // Free: a valid polite request is accepted, analyzed by USE + Harper.
  const free = await analyze(page, { text: 'Please give me a dessert.', assessmentMode: 'free', level: 'A1' })
  expect(free.engines.semantic_effective).toBe('use')
  expect(free.engines.grammar_effective).toBe('harper')
  expect(['valid', 'valid_with_suggestions']).toContain(free.verdict)

  // Real grammar error is caught (grammar axis, independent of meaning).
  const err = await analyze(page, { text: 'He go to work every day.', assessmentMode: 'free', level: 'A1' })
  expect(err.engines.semantic_effective).toBe('use')
  expect(err.verdict).not.toBe('valid')

  // Offline: drop the interception, go offline, reload — USE still loads from
  // IndexedDB with no network.
  await context.unroute(`${BASE}/**`)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.waitForFunction(() => window.__LINGO_E2E__ && window.__LINGO_E2E__.semantic)
  expect((await status(page)).effective_engine).toBe('use')
  await context.setOffline(false)

  // Remove → back to basic mode; free still never fails.
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
  // An unusual-but-valid sentence is not failed for low semantic similarity.
  const r = await analyze(page, { text: 'I would rather stay home tonight.', assessmentMode: 'free', level: 'B1' })
  expect(r.engines.semantic_effective).toBe('hashing')
  expect(r.verdict).not.toBe('needs_revision')
})
