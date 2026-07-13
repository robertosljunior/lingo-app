// semantic-model-catalog.js — trusted catalog for the optional semantic model
// (Universal Sentence Encoder). Security mirrors the knowledge-pack path:
//   - only an allowlisted, immutable origin is accepted (Google's tfjs-models
//     storage; never a mutable branch, never a pack-supplied URL)
//   - HTTPS only, per-file SHA-256 pinned in this catalog, size + timeout guards
//   - the closed file list below is the ONLY thing that can be fetched
//   - downloaded bytes are model weights/vocab/topology — never executed as code
//
// The model is NOT part of the base bundle or initial load. The app runs fully
// on Harper + wink + rules + packs + the hashing fallback; this catalog powers an
// opt-in, assisted, offline-persisted download.

export const MODEL_ALLOWLIST = [
  'storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder',
]

// ~27 MB total. Bytes + SHA-256 are pinned so a tampered or truncated download
// is rejected before install. Order of `files` is the install/verify order; the
// weight shards must stay in manifest order for tensor assembly.
export const USE_MODEL_BASE =
  'https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder'

export const SEMANTIC_MODEL_CATALOG = {
  catalog_version: 1,
  models: [
    {
      model_id: 'use-en-v1',
      engine: 'use',
      version: 1,
      title_pt: 'Compreensão semântica em inglês',
      description_pt:
        'Ajuda o aplicativo a entender intenção, significado e alternativas naturais nas suas frases.',
      base_url: USE_MODEL_BASE,
      dim: 512,
      schema_version: '1',
      min_app_version: '1.0.0',
      size_bytes: 28369009,
      // model.json + vocab.json are named roles; shards are weight data.
      model_file: 'model.json',
      vocab_file: 'vocab.json',
      files: {
        'model.json': { sha256: '507d11df18b070f99e0ad650b9a4e6534a4cfb05040127e8ce579f00c8fa3b53', bytes: 247026, role: 'topology' },
        'vocab.json': { sha256: '1ad860b9720c16cd48e666d664a556b2515c04f5a26a4b53c0372427913b1b8e', bytes: 218327, role: 'vocab' },
        'group1-shard1of7': { sha256: '8775e61b6a4235ea230a62a0d81f1ff00f5213ce86baa5d89c29e611f8cd7412', bytes: 4194304, role: 'weights' },
        'group1-shard2of7': { sha256: 'deaf897e5eea5be6c71ea62876a092034560b6f6fbc99c87a768076385a465bd', bytes: 4194304, role: 'weights' },
        'group1-shard3of7': { sha256: '50ee49b0daf620cf0cacda2f5fcc0da5929f4a3e520034844b6f8d9f3f4ec936', bytes: 4194304, role: 'weights' },
        'group1-shard4of7': { sha256: 'c1a50daae51e7c6e1e904f5d8d638a8658a0a1d310b9345cd7a368866304d596', bytes: 4194304, role: 'weights' },
        'group1-shard5of7': { sha256: '410cde3029282e5f601c782985cbb5caa96977f6705dec981c98dd02e93fec6b', bytes: 4194304, role: 'weights' },
        'group1-shard6of7': { sha256: '83ef116b2b98dc98e03547280ca0166142fbf6b4547bf1d9e6d13a8f518c088b', bytes: 4194304, role: 'weights' },
        'group1-shard7of7': { sha256: 'a29a5e08ee3afd839250b9187b89f1d3163749b5b1807bb175341a16c6012689', bytes: 2737832, role: 'weights' },
      },
    },
  ],
}

export const MAX_MODEL_FILE_BYTES = 8 * 1024 * 1024 // largest shard is 4 MB; headroom
export const MODEL_FETCH_TIMEOUT_MS = 60000

export function getDefaultModelEntry() {
  return SEMANTIC_MODEL_CATALOG.models[0]
}

export function isAllowlistedModelUrl(url) {
  let u
  try { u = new URL(url) } catch { return false }
  if (u.protocol !== 'https:') return false
  const hostPath = u.host + u.pathname
  return MODEL_ALLOWLIST.some((entry) => hostPath === entry || hostPath.startsWith(entry + '/'))
}

/** Ordered [filename, meta] list, weight shards after topology/vocab. */
export function modelFileList(entry) {
  return Object.entries(entry.files)
}

/** Weight-shard filenames in manifest (verify/assembly) order. */
export function weightShardNames(entry) {
  return Object.keys(entry.files)
    .filter((f) => entry.files[f].role === 'weights')
    .sort()
}

async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex')
}

export async function verifyFileChecksum(bytes, expectedSha256) {
  const actual = await sha256Hex(bytes)
  return { ok: actual === (expectedSha256 || '').toLowerCase(), actual }
}

/** Guarded fetch of a single model file: allowlist + HTTPS + size + timeout. */
export async function fetchModelFile(url, { fetchImpl = globalThis.fetch, timeoutMs = MODEL_FETCH_TIMEOUT_MS, maxBytes = MAX_MODEL_FILE_BYTES, signal } = {}) {
  if (!isAllowlistedModelUrl(url)) return { ok: false, code: 'URL_NOT_ALLOWLISTED' }
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (signal) { if (signal.aborted) return { ok: false, code: 'CANCELLED' }; signal.addEventListener('abort', onAbort) }
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) return { ok: false, code: `HTTP_${res.status}` }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > maxBytes) return { ok: false, code: 'TOO_LARGE' }
    return { ok: true, bytes: new Uint8Array(buf) }
  } catch (e) {
    if (signal?.aborted) return { ok: false, code: 'CANCELLED' }
    return { ok: false, code: e?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' }
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}
