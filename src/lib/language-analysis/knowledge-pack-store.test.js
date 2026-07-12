import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { installKnowledgePack, removeKnowledgePack, listInstalledPacks, getCachedEmbedding, putCachedEmbedding } from './knowledge-pack-store.js'
import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'

const pack = BUILTIN_KNOWLEDGE_PACKS.find((p) => p.manifest.pack_id === 'semantic_do')

describe('knowledge-pack-store', () => {
  beforeEach(async () => {
    const { __TESTING__ } = await import('./knowledge-pack-store.js')
    const db = await __TESTING__.open()
    const tx = db.transaction(['semantic_packs', 'semantic_embedding_cache'], 'readwrite')
    await tx.objectStore('semantic_packs').clear()
    await tx.objectStore('semantic_embedding_cache').clear()
    await tx.done
  })

  it('installs a valid pack atomically and lists it', async () => {
    const r = await installKnowledgePack(pack, { source: 'remote' })
    expect(r.ok).toBe(true)
    const installed = await listInstalledPacks()
    expect(installed.map((p) => p.pack_id)).toContain('semantic_do')
  })

  it('rejects an invalid pack (never goes active)', async () => {
    const bad = { ...pack, manifest: { ...pack.manifest, pack_kind: 'lesson' } }
    const r = await installKnowledgePack(bad)
    expect(r.ok).toBe(false)
    expect(await listInstalledPacks()).toHaveLength(0)
  })

  it('does not let a builtin overwrite an imported pack', async () => {
    await installKnowledgePack(pack, { source: 'imported' })
    const r = await installKnowledgePack(pack, { source: 'builtin' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('WOULD_OVERWRITE_IMPORTED')
  })

  it('removes a pack and its embedding cache', async () => {
    await installKnowledgePack(pack, { source: 'remote' })
    await putCachedEmbedding('use-1', 'semantic_do', 'do_001', [0.1, 0.2])
    await removeKnowledgePack('semantic_do')
    expect(await listInstalledPacks()).toHaveLength(0)
    expect(await getCachedEmbedding('use-1', 'semantic_do', 'do_001')).toBeNull()
  })

  it('embedding cache is keyed by model version', async () => {
    await putCachedEmbedding('use-1', 'semantic_do', 'do_001', [1, 2, 3])
    expect(await getCachedEmbedding('use-1', 'semantic_do', 'do_001')).toEqual([1, 2, 3])
    expect(await getCachedEmbedding('use-2', 'semantic_do', 'do_001')).toBeNull()
  })
})
