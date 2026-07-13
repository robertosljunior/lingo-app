// worker-semantic-encoder.js — main-thread proxy for the semantic worker. It
// implements the same encoder contract (ensure/embed/rank/classifyIntent) as
// UseSemanticEncoderAdapter but performs NO model load, tensor work, ranking or
// intent classification itself — every heavy call is delegated to the Web Worker.
// On any worker failure/timeout/crash it throws a structured code so the
// ResilientSemanticEncoder degrades to the on-main-thread hashing fallback.
//
// Testable: the Worker is injected via `workerFactory`, so unit tests drive a
// fake worker with no real threads or tfjs.

let _seq = 0
const nextId = () => `req-${++_seq}`

const DEFAULT_TIMEOUT_MS = 20000

/** Default factory: a real ES-module Web Worker for the semantic runtime. */
export function defaultSemanticWorkerFactory() {
  return new Worker(new URL('../../workers/semantic-worker.js', import.meta.url), {
    type: 'module', name: 'semantic-worker',
  })
}

export class WorkerSemanticEncoder {
  constructor({ workerFactory = defaultSemanticWorkerFactory, modelId = 'use-en-v1', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.kind = 'use'
    this._workerFactory = workerFactory
    this._modelId = modelId
    this._timeoutMs = timeoutMs
    this._worker = null
    this._pending = new Map() // request_id -> { resolve, reject, timer }
    this._loaded = false
    this.model_version = 'use-en-v1'
    this.backend = null
    this.dim = null
  }

  _spawn() {
    const worker = this._workerFactory()
    worker.onmessage = (e) => this._onMessage(e.data)
    // A worker-level error (script crash) rejects everything and forces a respawn.
    worker.onerror = () => this._crash('WORKER_CRASHED')
    this._worker = worker
    return worker
  }

  _onMessage(msg) {
    if (!msg || msg.request_id == null) return
    const entry = this._pending.get(msg.request_id)
    if (!entry) return // obsolete / already settled → drop
    if (msg.type === 'PROGRESS') { entry.onProgress?.(msg.payload); return }
    this._settle(msg.request_id)
    if (msg.type === 'RESULT') entry.resolve(msg.payload)
    else if (msg.type === 'CANCELLED') entry.reject(new Error('CANCELLED'))
    else entry.reject(new Error(msg.payload?.code || 'WORKER_ERROR'))
  }

  _settle(request_id) {
    const entry = this._pending.get(request_id)
    if (entry) { clearTimeout(entry.timer); this._pending.delete(request_id) }
  }

  // Reject every in-flight request and drop the worker so the next call respawns.
  _crash(code) {
    for (const [, entry] of this._pending) { clearTimeout(entry.timer); entry.reject(new Error(code)) }
    this._pending.clear()
    try { this._worker?.terminate?.() } catch { /* noop */ }
    this._worker = null
    this._loaded = false
  }

  _send(type, payload, { onProgress } = {}) {
    const worker = this._worker || this._spawn()
    const request_id = nextId()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._settle(request_id)
        // A stuck worker (lost backend, hung load) is unrecoverable for this
        // request; drop it so a fresh one can be spawned, then surface TIMEOUT.
        this._crash('TIMEOUT')
        reject(new Error('TIMEOUT'))
      }, this._timeoutMs)
      this._pending.set(request_id, { resolve, reject, timer, onProgress })
      try {
        worker.postMessage({ type, request_id, payload })
      } catch (e) {
        this._settle(request_id)
        reject(new Error('WORKER_POST_FAILED'))
      }
    })
  }

  async ensure() {
    if (this._loaded) return true
    const res = await this._send('LOAD_MODEL', { modelId: this._modelId })
    this._loaded = true
    if (res?.model_version) this.model_version = res.model_version
    if (res?.backend) this.backend = res.backend
    if (res?.dim != null) this.dim = res.dim
    return true
  }

  async embed(texts) {
    await this.ensure()
    const arr = Array.isArray(texts) ? texts : [texts]
    const res = await this._send('EMBED', { texts: arr, modelId: this._modelId })
    return res.vectors
  }

  async rank(query, candidates) {
    await this.ensure()
    const q = typeof query === 'string' ? query : query?.text || ''
    const texts = candidates.map((c) => (typeof c === 'string' ? c : c.text))
    const res = await this._send('RANK', { query: q, candidates: texts, modelId: this._modelId })
    // Re-associate original candidate objects by index (deterministic glue).
    return res.ranked.map((r) => ({ candidate: candidates[r.index], index: r.index, score: r.score }))
  }

  async classifyIntent(text, exemplars) {
    await this.ensure()
    const texts = exemplars.map((c) => (typeof c === 'string' ? c : c.text))
    const intents = exemplars.map((c) => (typeof c === 'string' ? undefined : c.intent))
    const res = await this._send('RANK', {
      query: text, candidates: texts, intents, aggregateIntents: true, modelId: this._modelId,
    })
    return res.intents || []
  }

  // Cancel every in-flight request (call on question change / Next / exit). Each
  // pending promise rejects with CANCELLED; the worker is told to drop the
  // matching result too. The model stays loaded (cheap to keep warm).
  cancelInFlight() {
    for (const [request_id, entry] of this._pending) {
      try { this._worker?.postMessage({ type: 'CANCEL', request_id: nextId(), payload: { target_id: request_id } }) } catch { /* noop */ }
      clearTimeout(entry.timer)
      entry.reject(new Error('CANCELLED'))
    }
    this._pending.clear()
  }

  async dispose() {
    try { if (this._worker) await this._send('DISPOSE', {}) } catch { /* noop */ }
    try { this._worker?.terminate?.() } catch { /* noop */ }
    this._worker = null
    this._loaded = false
  }
}
