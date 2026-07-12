import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { getKnowledgeOverview, fetchCatalog, installFromCatalogEntry, deriveCatalogState, removeInstalledPack } from './knowledge-catalog-service.js'
import { __TESTING__ } from './knowledge-pack-store.js'
import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'

const enc = new TextEncoder()
const pack = BUILTIN_KNOWLEDGE_PACKS.find((p) => p.manifest.pack_id === 'semantic_do')
const packBytes = enc.encode(JSON.stringify(pack))
const sha = createHash('sha256').update(Buffer.from(packBytes)).digest('hex')

// Local controlled server — no real GitHub in tests/CI.
function localFetch(map) {
  return async (url) => {
    const body = map[url]
    if (!body) return { ok: false, status: 404 }
    return { ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) }
  }
}

const ASSET = 'https://objects.githubusercontent.com/semantic-do-v1.json'
const CATALOG = 'https://objects.githubusercontent.com/catalog-v1.json'
const catalogBody = enc.encode(JSON.stringify({
  catalog_version: 1,
  packs: [{ pack_id: 'semantic_do', version: 2, title_pt: 'Usos de do', levels: ['A1'], asset_url: ASSET, sha256: sha, size_bytes: packBytes.byteLength, schema_version: '1', min_app_version: '1.0.0', dependencies: [] }],
}))

describe('knowledge-catalog-service', () => {
  beforeEach(async () => {
    const db = await __TESTING__.open()
    const tx = db.transaction(['semantic_packs', 'semantic_embedding_cache'], 'readwrite')
    await tx.objectStore('semantic_packs').clear()
    await tx.objectStore('semantic_embedding_cache').clear()
    await tx.done
  })

  it('overview lists all 8 builtin packs as installed', async () => {
    const overview = await getKnowledgeOverview()
    expect(overview).toHaveLength(8)
    expect(overview.every((p) => p.status === 'installed')).toBe(true)
    expect(overview.find((p) => p.pack_id === 'semantic_do').source).toBe('builtin')
  })

  it('fetches a catalog from an allowlisted local server', async () => {
    const res = await fetchCatalog({ url: CATALOG, fetchImpl: localFetch({ [CATALOG]: catalogBody }) })
    expect(res.ok).toBe(true)
    expect(res.catalog.packs[0].pack_id).toBe('semantic_do')
  })

  it('rejects a catalog from a non-allowlisted host', async () => {
    const res = await fetchCatalog({ url: 'https://evil.example.com/catalog.json', fetchImpl: localFetch({}) })
    expect(res.ok).toBe(false)
    expect(res.code).toBe('URL_NOT_ALLOWLISTED')
  })

  it('downloads, checksum-verifies and installs a pack, then lists it', async () => {
    const entry = { pack_id: 'semantic_do', version: 2, asset_url: ASSET, sha256: sha, size_bytes: packBytes.byteLength }
    const r = await installFromCatalogEntry(entry, { fetchImpl: localFetch({ [ASSET]: packBytes }) })
    expect(r.ok).toBe(true)
    const overview = await getKnowledgeOverview()
    expect(overview.find((p) => p.pack_id === 'semantic_do').source).toBe('remote')
  })

  it('rejects an asset whose checksum does not match the catalog', async () => {
    const entry = { pack_id: 'semantic_do', version: 2, asset_url: ASSET, sha256: 'deadbeef', size_bytes: packBytes.byteLength }
    const r = await installFromCatalogEntry(entry, { fetchImpl: localFetch({ [ASSET]: packBytes }) })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHECKSUM_MISMATCH')
  })

  it('derives update_available when catalog version is newer', async () => {
    const overview = await getKnowledgeOverview()
    const state = deriveCatalogState([{ pack_id: 'semantic_do', version: 5 }], overview)
    expect(state[0].state).toBe('update_available')
  })

  it('removes an installed remote pack', async () => {
    const entry = { pack_id: 'semantic_do', version: 2, asset_url: ASSET, sha256: sha, size_bytes: packBytes.byteLength }
    await installFromCatalogEntry(entry, { fetchImpl: localFetch({ [ASSET]: packBytes }) })
    await removeInstalledPack('semantic_do')
    const overview = await getKnowledgeOverview()
    // Falls back to the builtin copy after removal (history/future safe).
    expect(overview.find((p) => p.pack_id === 'semantic_do').source).toBe('builtin')
  })
})
