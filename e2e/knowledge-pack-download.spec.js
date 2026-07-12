// Knowledge pack download UI — real flow through Settings → "Conhecimento
// linguístico". A controlled catalog + asset are served by intercepting the
// allowlisted GitHub URLs (no real network), so the app exercises the genuine
// path: fetch catalog → download asset → verify SHA-256 → transactional install
// → offline availability → remove (history preserved).
import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'

const PACK = {
  manifest: {
    schema_version: '1', pack_id: 'semantic_test_download', pack_kind: 'semantic_knowledge',
    title: { pt: 'Pacote de teste', en: 'Test pack' }, language_pair: 'pt-BR/en', version: 1,
    levels: ['A1'], dependencies: [], min_app_version: '1.0.0',
    analysis_compatibility: { min_version: '1', max_version: '1' },
  },
  concepts: [{ concept_id: 'td_c1', surface: 'x', lemma: 'x', level: 'A1', roles: ['x'], meaning_pt: 'teste', intent_tags: [], grammar_tags: [], related_concepts: [] }],
  usage_rules: [], semantic_frames: [], contrast_sets: [], patterns: [], transformations: [],
  explanations_pt: [], natural_alternatives: [], retrieval_exemplars: [], golden_tests: [],
  coverage: { concepts_expected: 1, concepts_implemented: 1, levels: { A1: 'complete_for_scope' }, known_gaps: [] },
}
const PACK_BYTES = Buffer.from(JSON.stringify(PACK))
const PACK_SHA = createHash('sha256').update(PACK_BYTES).digest('hex')
const ASSET_URL = 'https://objects.githubusercontent.com/lingo/semantic_test_download-v1.json'
const CATALOG = {
  catalog_version: 1,
  packs: [{
    pack_id: 'semantic_test_download', version: 1, title_pt: 'Pacote de teste', levels: ['A1'],
    asset_url: ASSET_URL, sha256: PACK_SHA, size_bytes: PACK_BYTES.byteLength,
    schema_version: '1', min_app_version: '1.0.0', dependencies: [],
    coverage: PACK.coverage,
  }],
}

async function routeCatalog(context, { assetBytes = PACK_BYTES } = {}) {
  await context.route('**/releases/download/**/catalog-v1.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }))
  await context.route(ASSET_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: assetBytes }))
}

async function gotoSettings(page) {
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByTestId('knowledge-packs-settings')).toBeVisible()
}

test('download → checksum verify → install → offline → remove', async ({ page, context }) => {
  await routeCatalog(context)
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await gotoSettings(page)

  // Load catalog and see the not-yet-installed pack as available.
  await page.getByTestId('knowledge-load-catalog').click()
  const stateChip = page.getByTestId('catalog-state-semantic_test_download')
  await expect(stateChip).toHaveText('Disponível')

  // Download → real fetch + SHA-256 verify + transactional install.
  await page.getByTestId('catalog-download-semantic_test_download').click()
  await expect(stateChip).toHaveText('Instalado', { timeout: 15000 })

  // Persisted: reload and confirm it is installed from the remote source.
  await page.reload()
  await gotoSettings(page)
  await expect(page.getByTestId('knowledge-status-semantic_test_download')).toBeVisible()

  // Offline availability: the installed pack is readable from IndexedDB with no
  // network (reads never touch the catalog/asset URLs).
  const installedActive = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('app-idiomas-knowledge'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    return new Promise((res) => { const tx = db.transaction('semantic_packs', 'readonly'); const rq = tx.objectStore('semantic_packs').get('semantic_test_download'); rq.onsuccess = () => res(!!rq.result && rq.result.status === 'installed') })
  })
  expect(installedActive).toBe(true)

  // Remove and confirm it falls back / disappears from installed remotes.
  await page.getByTestId('knowledge-pack-semantic_test_download').getByRole('button', { name: /Remover/ }).click()
  await expect(page.getByTestId('knowledge-pack-semantic_test_download')).toHaveCount(0)
})

test('checksum mismatch → Falha and Tentar novamente (never installs)', async ({ page, context }) => {
  // Serve tampered bytes so the SHA-256 in the catalog no longer matches.
  await routeCatalog(context, { assetBytes: Buffer.from(JSON.stringify({ ...PACK, tampered: true })) })
  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await gotoSettings(page)

  await page.getByTestId('knowledge-load-catalog').click()
  await page.getByTestId('catalog-download-semantic_test_download').click()
  await expect(page.getByTestId('catalog-state-semantic_test_download')).toHaveText('Falha', { timeout: 15000 })
  await expect(page.getByTestId('catalog-retry-semantic_test_download')).toBeVisible()

  // Nothing was installed.
  const installed = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('app-idiomas-knowledge'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    return new Promise((res) => { const tx = db.transaction('semantic_packs', 'readonly'); const rq = tx.objectStore('semantic_packs').get('semantic_test_download'); rq.onsuccess = () => res(!!rq.result) })
  })
  expect(installed).toBe(false)
})
