// knowledge-pack-store.js — offline storage for installed semantic_knowledge
// packs and their embedding cache. Uses a SEPARATE IndexedDB database so it can
// evolve without touching the main app schema (non-destructive upgrades). Every
// install is transactional: a pack becomes active only after it validates and
// its rows commit together; a partial/failed download never goes active.

import { openDB } from 'idb'
import { validateKnowledgePack } from './knowledge-pack-validator.js'

const DB_NAME = 'app-idiomas-knowledge'
// v2 adds the optional semantic-model stores (metadata + persisted file bytes).
// Upgrades are additive so installed packs / caches survive the bump.
const DB_VERSION = 2

export function open() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('semantic_packs')) {
        const s = db.createObjectStore('semantic_packs', { keyPath: 'pack_id' })
        s.createIndex('status', 'status')
        s.createIndex('source', 'source')
      }
      if (!db.objectStoreNames.contains('semantic_embedding_cache')) {
        // key: `${model_version}::${pack_id}::${example_id}`
        const s = db.createObjectStore('semantic_embedding_cache', { keyPath: 'key' })
        s.createIndex('model_version', 'model_version')
        s.createIndex('pack_id', 'pack_id')
      }
      if (!db.objectStoreNames.contains('semantic_models')) {
        // metadata only: { model_id, engine, version, status, installed_at, ... }
        db.createObjectStore('semantic_models', { keyPath: 'model_id' })
      }
      if (!db.objectStoreNames.contains('semantic_model_files')) {
        // persisted asset bytes: key `${model_id}::${filename}` → { bytes }
        const s = db.createObjectStore('semantic_model_files', { keyPath: 'key' })
        s.createIndex('model_id', 'model_id')
      }
    },
  })
}

/**
 * Install a validated pack atomically. Custom/imported packs are never
 * overwritten by a builtin of the same id.
 * @returns {{ ok, code?, pack_id? }}
 */
export async function installKnowledgePack(pack, { source = 'remote', dbFactory = open } = {}) {
  const validation = validateKnowledgePack(pack)
  if (!validation.valid) return { ok: false, code: 'SCHEMA_INVALID', errors: validation.errors }
  const pack_id = pack.manifest.pack_id
  const db = await dbFactory()
  const existing = await db.get('semantic_packs', pack_id)
  if (existing && existing.source === 'imported' && source === 'builtin') {
    return { ok: false, code: 'WOULD_OVERWRITE_IMPORTED', pack_id }
  }
  const tx = db.transaction('semantic_packs', 'readwrite')
  await tx.store.put({
    pack_id,
    version: pack.manifest.version,
    status: 'installed',
    source,
    installed_at: Date.now(),
    last_validated_at: Date.now(),
    coverage: pack.coverage || null,
    pack,
  })
  await tx.done // commit — pack is active only now.
  return { ok: true, pack_id }
}

export async function removeKnowledgePack(pack_id, { dbFactory = open } = {}) {
  const db = await dbFactory()
  // Removing a pack only makes future knowledge unavailable; it must not touch
  // persisted history or past feedback (those live in the main DB).
  const tx = db.transaction(['semantic_packs', 'semantic_embedding_cache'], 'readwrite')
  await tx.objectStore('semantic_packs').delete(pack_id)
  const cache = tx.objectStore('semantic_embedding_cache').index('pack_id')
  for await (const cursor of cache.iterate(pack_id)) cursor.delete()
  await tx.done
  return { ok: true, pack_id }
}

export async function listInstalledPacks({ dbFactory = open } = {}) {
  const db = await dbFactory()
  return (await db.getAll('semantic_packs')).filter((r) => r.status === 'installed')
}

export async function getActiveKnowledgePacks({ dbFactory = open } = {}) {
  return (await listInstalledPacks({ dbFactory })).map((r) => r.pack)
}

// ---- embedding cache (keyed by model version so a model swap never mixes vectors) ----
function cacheKey(model_version, pack_id, example_id) { return `${model_version}::${pack_id}::${example_id}` }

export async function getCachedEmbedding(model_version, pack_id, example_id, { dbFactory = open } = {}) {
  const db = await dbFactory()
  const row = await db.get('semantic_embedding_cache', cacheKey(model_version, pack_id, example_id))
  return row?.vector || null
}

export async function putCachedEmbedding(model_version, pack_id, example_id, vector, { dbFactory = open } = {}) {
  const db = await dbFactory()
  await db.put('semantic_embedding_cache', { key: cacheKey(model_version, pack_id, example_id), model_version, pack_id, example_id, vector })
  return { ok: true }
}

/** Drop every cached embedding NOT produced by `keepModelVersion` (called after a
 * model install/update/removal so vectors from a different model never mix). */
export async function invalidateEmbeddingsExcept(keepModelVersion, { dbFactory = open } = {}) {
  const db = await dbFactory()
  const tx = db.transaction('semantic_embedding_cache', 'readwrite')
  let removed = 0
  for await (const cursor of tx.store) {
    if (cursor.value.model_version !== keepModelVersion) { cursor.delete(); removed++ }
  }
  await tx.done
  return { ok: true, removed }
}

export const __TESTING__ = { open, DB_NAME, DB_VERSION }
