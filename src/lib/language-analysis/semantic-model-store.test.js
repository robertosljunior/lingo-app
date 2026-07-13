import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  installModel, removeModel, getInstalledModel, readModelArtifacts, modelVersionTag,
} from './semantic-model-store.js'
import {
  isAllowlistedModelUrl, verifyFileChecksum, modelFileList, weightShardNames, getDefaultModelEntry,
} from './semantic-model-catalog.js'
import { putCachedEmbedding, getCachedEmbedding, __TESTING__ } from './knowledge-pack-store.js'

// Small deterministic fixture model: valid model.json + vocab + one shard, with
// real SHA-256 pins computed here so the install path is exercised for real.
async function sha(bytes) { return (await verifyFileChecksum(bytes, '0')).actual }
function enc(obj) { return new TextEncoder().encode(JSON.stringify(obj)) }

async function buildEntry() {
  const modelBytes = enc({ modelTopology: { node: [] }, format: 'graph-model', weightsManifest: [{ paths: ['group1-shard1of1'], weights: [{ name: 'w', shape: [1], dtype: 'float32' }] }] })
  const vocabBytes = enc([['<S>', 0], ['</S>', 0]])
  const shardBytes = new Uint8Array([1, 2, 3, 4])
  const files = {
    'model.json': { sha256: await sha(modelBytes), bytes: modelBytes.byteLength, role: 'topology' },
    'vocab.json': { sha256: await sha(vocabBytes), bytes: vocabBytes.byteLength, role: 'vocab' },
    'group1-shard1of1': { sha256: await sha(shardBytes), bytes: shardBytes.byteLength, role: 'weights' },
  }
  const entry = {
    model_id: 'use-en-v1', engine: 'use', version: 1, dim: 512,
    base_url: 'https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder',
    model_file: 'model.json', vocab_file: 'vocab.json', size_bytes: modelBytes.byteLength + vocabBytes.byteLength + shardBytes.byteLength,
    files,
  }
  const byName = { 'model.json': modelBytes, 'vocab.json': vocabBytes, 'group1-shard1of1': shardBytes }
  const fetchImpl = async (url) => {
    const name = url.split('/').pop()
    return { ok: true, arrayBuffer: async () => byName[name].buffer.slice(byName[name].byteOffset, byName[name].byteOffset + byName[name].byteLength) }
  }
  return { entry, fetchImpl, byName }
}

// The store reads the DEFAULT catalog entry's checksums on readModelArtifacts, so
// override readModelArtifacts' verify against our fixture by disabling verify.
describe('semantic-model-catalog', () => {
  it('allowlists only the pinned Google origin over HTTPS', () => {
    expect(isAllowlistedModelUrl('https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder/model.json')).toBe(true)
    expect(isAllowlistedModelUrl('http://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder/model.json')).toBe(false)
    expect(isAllowlistedModelUrl('https://evil.example.com/model.json')).toBe(false)
    expect(isAllowlistedModelUrl('https://storage.googleapis.com/other/model.json')).toBe(false)
  })
  it('exposes an ordered file list and weight shard order for the default entry', () => {
    const entry = getDefaultModelEntry()
    expect(modelFileList(entry).length).toBe(9)
    expect(weightShardNames(entry)).toEqual([
      'group1-shard1of7', 'group1-shard2of7', 'group1-shard3of7', 'group1-shard4of7',
      'group1-shard5of7', 'group1-shard6of7', 'group1-shard7of7',
    ])
  })
})

describe('semantic-model-store', () => {
  beforeEach(async () => {
    const db = await __TESTING__.open()
    const tx = db.transaction(['semantic_models', 'semantic_model_files', 'semantic_embedding_cache'], 'readwrite')
    await tx.objectStore('semantic_models').clear()
    await tx.objectStore('semantic_model_files').clear()
    await tx.objectStore('semantic_embedding_cache').clear()
    await tx.done
  })

  it('downloads, verifies and installs transactionally, then reports installed', async () => {
    const { entry, fetchImpl } = await buildEntry()
    const phases = []
    const r = await installModel(entry, { fetchImpl, onProgress: (p) => phases.push(p.phase) })
    expect(r.ok).toBe(true)
    expect(r.model_version).toBe(modelVersionTag(entry))
    expect(phases).toContain('downloading')
    expect(phases).toContain('verifying')
    expect(phases).toContain('installing')
    const meta = await getInstalledModel()
    expect(meta?.model_id).toBe('use-en-v1')
    expect(meta.status).toBe('installed')
  })

  it('rejects a tampered file on checksum mismatch and installs nothing', async () => {
    const { entry, byName } = await buildEntry()
    byName['group1-shard1of1'] = new Uint8Array([9, 9, 9, 9]) // wrong bytes, right size
    const fetchImpl = async (url) => {
      const name = url.split('/').pop()
      const b = byName[name]
      return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }
    }
    const r = await installModel(entry, { fetchImpl })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHECKSUM_MISMATCH')
    expect(await getInstalledModel()).toBe(null)
  })

  it('cancels cleanly via signal without installing', async () => {
    const { entry, fetchImpl } = await buildEntry()
    const ctrl = new AbortController(); ctrl.abort()
    const r = await installModel(entry, { fetchImpl, signal: ctrl.signal })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CANCELLED')
    expect(await getInstalledModel()).toBe(null)
  })

  it('assembles model artifacts from persisted bytes (offline load path)', async () => {
    const { entry, fetchImpl } = await buildEntry()
    await installModel(entry, { fetchImpl })
    const art = await readModelArtifacts('use-en-v1', { verify: false })
    expect(art.ok).toBe(true)
    expect(art.dim).toBe(512)
    expect(art.modelArtifacts.modelTopology).toBeTruthy()
    expect(art.modelArtifacts.weightData.byteLength).toBe(4)
    expect(Array.isArray(art.vocab)).toBe(true)
  })

  it('reports MODEL_NOT_INSTALLED when nothing is installed', async () => {
    const art = await readModelArtifacts('use-en-v1', { verify: false })
    expect(art.ok).toBe(false)
    expect(art.code).toBe('MODEL_NOT_INSTALLED')
  })

  it('removing the model invalidates USE embeddings but keeps the store usable', async () => {
    const { entry, fetchImpl } = await buildEntry()
    await installModel(entry, { fetchImpl })
    await putCachedEmbedding(modelVersionTag(entry), 'pack', 'ex1', [0.1, 0.2])
    await removeModel('use-en-v1')
    expect(await getInstalledModel()).toBe(null)
    expect(await getCachedEmbedding(modelVersionTag(entry), 'pack', 'ex1')).toBe(null)
  })
})
