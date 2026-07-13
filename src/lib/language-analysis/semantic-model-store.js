// semantic-model-store.js — offline provisioning for the optional USE model.
// Download → per-file SHA-256 verify → TRANSACTIONAL install into IndexedDB
// (bytes + metadata commit together; a partial or cancelled download never goes
// active). Bytes live in the same knowledge DB (v2) so no service worker is
// required for offline load. On install/update/removal the embedding cache from
// any other model version is invalidated.

import { open, invalidateEmbeddingsExcept } from './knowledge-pack-store.js'
import {
  modelFileList, fetchModelFile, verifyFileChecksum, getDefaultModelEntry,
} from './semantic-model-catalog.js'

const APP_VERSION = '1.0.0'
function fileKey(model_id, filename) { return `${model_id}::${filename}` }
export function modelVersionTag(entry) { return `${entry.engine}-${entry.model_id}-v${entry.version}` }

/** Installed model metadata or null. */
export async function getInstalledModel({ dbFactory = open } = {}) {
  const db = await dbFactory()
  const rows = await db.getAll('semantic_models')
  return rows.find((r) => r.status === 'installed') || null
}

/**
 * Download + verify + transactionally install a model from a catalog entry.
 * Progress: { phase: 'downloading'|'verifying'|'installing'|'done', file?, done, total, bytes, totalBytes }.
 * Cancellable via `signal`. Never executes remote content.
 * @returns {{ ok, code?, model_id?, model_version? }}
 */
export async function installModel(entry = getDefaultModelEntry(), { fetchImpl, dbFactory = open, onProgress, signal } = {}) {
  const emit = (p) => { if (typeof onProgress === 'function') onProgress(p) }
  const files = modelFileList(entry)
  const total = files.length
  const staged = [] // { filename, bytes } — held in memory until all verified.
  let bytesDone = 0
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) return { ok: false, code: 'CANCELLED' }
    const [filename, meta] = files[i]
    emit({ phase: 'downloading', file: filename, done: i, total, bytes: bytesDone, totalBytes: entry.size_bytes })
    const res = await fetchModelFile(`${entry.base_url}/${filename}`, { ...(fetchImpl ? { fetchImpl } : {}), signal })
    if (!res.ok) return { ok: false, code: res.code, file: filename }
    if (meta.bytes != null && res.bytes.byteLength !== meta.bytes) return { ok: false, code: 'SIZE_MISMATCH', file: filename }
    emit({ phase: 'verifying', file: filename, done: i, total, bytes: bytesDone, totalBytes: entry.size_bytes })
    const sum = await verifyFileChecksum(res.bytes, meta.sha256)
    if (!sum.ok) return { ok: false, code: 'CHECKSUM_MISMATCH', file: filename, actual: sum.actual }
    staged.push({ filename, bytes: res.bytes })
    bytesDone += res.bytes.byteLength
  }
  if (signal?.aborted) return { ok: false, code: 'CANCELLED' }

  // Transactional commit: all file rows + metadata in one tx. Active only on done.
  emit({ phase: 'installing', done: total, total, bytes: bytesDone, totalBytes: entry.size_bytes })
  const db = await dbFactory()
  const tx = db.transaction(['semantic_models', 'semantic_model_files'], 'readwrite')
  const filesStore = tx.objectStore('semantic_model_files')
  // Clear any stale partial files for this model id first (within the same tx).
  for await (const c of filesStore.index('model_id').iterate(entry.model_id)) c.delete()
  for (const s of staged) {
    filesStore.put({ key: fileKey(entry.model_id, s.filename), model_id: entry.model_id, filename: s.filename, bytes: s.bytes })
  }
  const meta = {
    model_id: entry.model_id, engine: entry.engine, version: entry.version,
    model_version: modelVersionTag(entry), dim: entry.dim,
    model_file: entry.model_file, vocab_file: entry.vocab_file,
    status: 'installed', installed_at: Date.now(), size_bytes: bytesDone,
    checksum: entry.files[entry.model_file]?.sha256 || null, last_verified_at: Date.now(),
  }
  tx.objectStore('semantic_models').put(meta)
  await tx.done // commit — model is active only now.

  // Drop embeddings from any other model version (keep this one's, if any).
  await invalidateEmbeddingsExcept(meta.model_version, { dbFactory }).catch(() => {})
  return { ok: true, model_id: entry.model_id, model_version: meta.model_version }
}

export async function removeModel(model_id, { dbFactory = open } = {}) {
  const db = await dbFactory()
  const tx = db.transaction(['semantic_models', 'semantic_model_files'], 'readwrite')
  tx.objectStore('semantic_models').delete(model_id)
  for await (const c of tx.objectStore('semantic_model_files').index('model_id').iterate(model_id)) c.delete()
  await tx.done
  // Removing the model reverts analysis to the hashing fallback; drop USE vectors.
  await invalidateEmbeddingsExcept('hashing-1', { dbFactory }).catch(() => {})
  return { ok: true, model_id }
}

/** Raw persisted bytes for one model file, or null. */
export async function readModelFileBytes(model_id, filename, { dbFactory = open } = {}) {
  const db = await dbFactory()
  const row = await db.get('semantic_model_files', fileKey(model_id, filename))
  return row?.bytes || null
}

/**
 * Assemble what USE needs to load fully offline:
 *   modelArtifacts — { modelTopology, weightSpecs, weightData } from cached bytes
 *   vocab          — parsed vocabulary JSON
 * The caller wraps modelArtifacts with tf.io.fromMemory (see the production
 * loader) so nothing is fetched over the network. Verifies checksums on read
 * (last_verified_at) to detect on-disk corruption before use.
 * @returns {{ ok, code?, modelArtifacts?, vocab?, dim?, model_version? }}
 */
export async function readModelArtifacts(model_id, { dbFactory = open, verify = true } = {}) {
  const db = await dbFactory()
  const meta = await db.get('semantic_models', model_id)
  if (!meta || meta.status !== 'installed') return { ok: false, code: 'MODEL_NOT_INSTALLED' }
  const entry = getDefaultModelEntry()
  const read = async (name) => {
    const bytes = await readModelFileBytes(model_id, name, { dbFactory })
    if (!bytes) return null
    if (verify && entry.files[name]?.sha256) {
      const sum = await verifyFileChecksum(bytes, entry.files[name].sha256)
      if (!sum.ok) return { __corrupt: true }
    }
    return bytes
  }
  const modelBytes = await read(meta.model_file)
  const vocabBytes = await read(meta.vocab_file)
  if (modelBytes?.__corrupt || vocabBytes?.__corrupt) return { ok: false, code: 'MODEL_CORRUPTED' }
  if (!modelBytes || !vocabBytes) return { ok: false, code: 'MODEL_CORRUPTED' }

  let modelJSON, vocab
  try {
    modelJSON = JSON.parse(new TextDecoder().decode(modelBytes))
    vocab = JSON.parse(new TextDecoder().decode(vocabBytes))
  } catch { return { ok: false, code: 'MODEL_CORRUPTED' } }

  const weightSpecs = (modelJSON.weightsManifest || []).flatMap((g) => g.weights)
  // Shard order comes from the model's OWN manifest (authoritative), not the
  // catalog — so any valid installed model assembles correctly.
  const shardNames = (modelJSON.weightsManifest || []).flatMap((g) => g.paths || [])
  const shardBuffers = []
  let totalLen = 0
  for (const name of shardNames) {
    const b = await read(name)
    if (!b || b.__corrupt) return { ok: false, code: 'MODEL_CORRUPTED' }
    shardBuffers.push(b); totalLen += b.byteLength
  }
  const weightData = new Uint8Array(totalLen)
  let off = 0
  for (const b of shardBuffers) { weightData.set(b, off); off += b.byteLength }

  const modelArtifacts = {
    modelTopology: modelJSON.modelTopology,
    format: modelJSON.format,
    generatedBy: modelJSON.generatedBy,
    convertedBy: modelJSON.convertedBy,
    signature: modelJSON.signature,
    userDefinedMetadata: modelJSON.userDefinedMetadata,
    weightSpecs,
    weightData: weightData.buffer,
  }
  return { ok: true, modelArtifacts, vocab, dim: meta.dim, model_version: meta.model_version }
}
