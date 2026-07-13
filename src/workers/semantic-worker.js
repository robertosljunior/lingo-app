// semantic-worker.js — hosts the real Universal Sentence Encoder OFF the main
// thread. All heavy work (model load, tensor creation, embedding, cosine
// ranking, intent aggregation) happens here so the UI thread never janks.
//
// Message contract (see test-evidence/slice-7-3-checklist.md):
//   in : { type: 'LOAD_MODEL'|'EMBED'|'RANK'|'CANCEL'|'DISPOSE', request_id, payload }
//   out: { type: 'RESULT'|'PROGRESS'|'ERROR'|'CANCELLED', request_id, payload }
//
// Invariants: no serialized functions cross the boundary; model bytes come ONLY
// from the checksum-verified IndexedDB store (via the shared production loader) —
// never an arbitrary URL; one model singleton per worker; every request carries a
// request_id; CANCEL drops obsolete responses; the worker can be recreated after
// a crash; DISPOSE frees the model and the tf backend.

import { createProductionUseLoader } from '../lib/language-analysis/use-model-loader.js'

let model = null           // loaded USE model singleton (has .embed + __lingo)
let loadPromise = null     // in-flight load, so concurrent LOAD_MODEL coalesce
let tfRef = null           // tf module handle, kept only to dispose the backend
const cancelled = new Set() // request_ids the main thread asked us to drop

function post(type, request_id, payload) {
  // eslint-disable-next-line no-restricted-globals
  self.postMessage({ type, request_id, payload })
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function ensureModel(request_id, modelId) {
  if (model) return model
  if (!loadPromise) {
    post('PROGRESS', request_id, { phase: 'loading' })
    // The production loader dynamically imports tfjs+USE INSIDE this worker
    // (Vite code-splits them into the worker chunk) and assembles the model from
    // the local, checksum-verified bytes — fully offline, no arbitrary URL.
    const loader = createProductionUseLoader({
      modelId: modelId || 'use-en-v1',
      importTf: async () => { tfRef = await import('@tensorflow/tfjs'); return tfRef },
    })
    loadPromise = loader().catch((e) => { loadPromise = null; throw e })
  }
  model = await loadPromise
  return model
}

async function embedTexts(texts) {
  const out = await model.embed(texts)
  const data = typeof out.array === 'function' ? await out.array() : out
  if (typeof out.dispose === 'function') out.dispose()
  return data
}

// Drop a response the main thread already abandoned (question changed, Next, exit).
function isCancelled(request_id) {
  if (cancelled.has(request_id)) { cancelled.delete(request_id); return true }
  return false
}

async function handleLoad(request_id, payload) {
  const m = await ensureModel(request_id, payload?.modelId)
  if (isCancelled(request_id)) return post('CANCELLED', request_id, null)
  post('RESULT', request_id, {
    dim: m.__lingo?.dim ?? null,
    backend: m.__lingo?.backend ?? null,
    model_version: m.__lingo?.model_version ?? null,
    load_ms: m.__lingo?.load_ms ?? null,
  })
}

async function handleEmbed(request_id, payload) {
  await ensureModel(request_id, payload?.modelId)
  if (isCancelled(request_id)) return post('CANCELLED', request_id, null)
  const vectors = await embedTexts(payload.texts || [])
  if (isCancelled(request_id)) return post('CANCELLED', request_id, null)
  post('RESULT', request_id, { vectors })
}

// RANK does the embedding AND the cosine ranking in the worker so the main
// thread never touches tensors or scores. `aggregateIntents` additionally groups
// by intent (best score per intent) — intent classification stays off the main
// thread too. Candidates are plain strings; the main thread re-associates objects
// by index, which is deterministic glue, not ranking.
async function handleRank(request_id, payload) {
  await ensureModel(request_id, payload?.modelId)
  if (isCancelled(request_id)) return post('CANCELLED', request_id, null)
  const { query, candidates = [], aggregateIntents = false, intents = [] } = payload
  const vecs = await embedTexts([query, ...candidates])
  if (isCancelled(request_id)) return post('CANCELLED', request_id, null)
  const qv = vecs[0]
  const ranked = candidates
    .map((_c, index) => ({ index, score: +cosine(qv, vecs[index + 1]).toFixed(4) }))
    .sort((a, b) => b.score - a.score)
  if (aggregateIntents) {
    const byIntent = new Map()
    for (const r of ranked) {
      const intent = intents[r.index]
      if (!intent) continue
      if (!byIntent.has(intent) || r.score > byIntent.get(intent)) byIntent.set(intent, r.score)
    }
    const intentScores = [...byIntent.entries()].map(([intent, score]) => ({ intent, score })).sort((a, b) => b.score - a.score)
    return post('RESULT', request_id, { ranked, intents: intentScores })
  }
  post('RESULT', request_id, { ranked })
}

async function handleDispose(request_id) {
  try { model?.dispose?.() } catch { /* noop */ }
  try { await tfRef?.disposeVariables?.() } catch { /* noop */ }
  model = null
  loadPromise = null
  post('RESULT', request_id, { disposed: true })
}

// eslint-disable-next-line no-restricted-globals
self.onmessage = async (e) => {
  const { type, request_id, payload } = e.data || {}
  if (type === 'CANCEL') {
    // Mark the target request so its (possibly in-flight) result is dropped.
    if (payload?.target_id != null) cancelled.add(payload.target_id)
    return post('CANCELLED', request_id, { target_id: payload?.target_id ?? null })
  }
  try {
    if (type === 'LOAD_MODEL') return await handleLoad(request_id, payload)
    if (type === 'EMBED') return await handleEmbed(request_id, payload)
    if (type === 'RANK') return await handleRank(request_id, payload)
    if (type === 'DISPOSE') return await handleDispose(request_id)
    post('ERROR', request_id, { code: 'UNKNOWN_MESSAGE' })
  } catch (err) {
    // A failed load resets the singleton so a later request can retry cleanly.
    if (type === 'LOAD_MODEL') { model = null; loadPromise = null }
    post('ERROR', request_id, { code: err?.message || 'WORKER_ERROR' })
  }
}
