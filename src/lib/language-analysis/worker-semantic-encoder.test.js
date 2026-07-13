import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorkerSemanticEncoder } from './worker-semantic-encoder.js'
import { ResilientSemanticEncoder } from './semantic-encoder-adapter.js'

// Controllable fake Worker: records posted messages and lets the test deliver
// scripted responses, so we exercise request_id routing, cancellation, timeout
// and crash recovery with no real threads or tfjs.
class FakeWorker {
  constructor() {
    this.posted = []
    this.terminated = false
    this.onmessage = null
    this.onerror = null
    FakeWorker.instances.push(this)
  }
  postMessage(msg) { this.posted.push(msg) }
  terminate() { this.terminated = true }
  deliver(msg) { this.onmessage?.({ data: msg }) }
  crash() { this.onerror?.(new Error('boom')) }
  last() { return this.posted[this.posted.length - 1] }
}
FakeWorker.instances = []

function makeEncoder(opts = {}) {
  const factory = () => new FakeWorker()
  return new WorkerSemanticEncoder({ workerFactory: factory, timeoutMs: 5000, ...opts })
}

const tick = () => new Promise((r) => setTimeout(r, 0))

// Auto-answer LOAD_MODEL so ensure() resolves, then flush the microtask queue so
// the follow-up message (EMBED / RANK) has actually been posted.
async function autoLoad(worker) {
  const load = worker.posted.find((m) => m.type === 'LOAD_MODEL')
  worker.deliver({ type: 'RESULT', request_id: load.request_id, payload: { dim: 512, backend: 'cpu', model_version: 'use-en-v1' } })
  await tick()
}

beforeEach(() => { FakeWorker.instances = [] })
afterEach(() => { vi.useRealTimers() })

describe('WorkerSemanticEncoder', () => {
  it('loads the model in the worker and reports backend/dim', async () => {
    const enc = makeEncoder()
    const p = enc.ensure()
    const w = FakeWorker.instances[0]
    await autoLoad(w)
    await p
    expect(w.posted[0].type).toBe('LOAD_MODEL')
    expect(enc.backend).toBe('cpu')
    expect(enc.dim).toBe(512)
  })

  it('embeds via the worker (no tensor work on the main side)', async () => {
    const enc = makeEncoder()
    const p = enc.embed(['a', 'b'])
    const w = FakeWorker.instances[0]
    await autoLoad(w)
    const embed = w.posted.find((m) => m.type === 'EMBED')
    expect(embed.payload.texts).toEqual(['a', 'b'])
    w.deliver({ type: 'RESULT', request_id: embed.request_id, payload: { vectors: [[1], [2]] } })
    expect(await p).toEqual([[1], [2]])
  })

  it('ranks in the worker and re-associates candidate objects by index', async () => {
    const enc = makeEncoder()
    const cands = [{ text: 'x', id: 1 }, { text: 'y', id: 2 }]
    const p = enc.rank('q', cands)
    const w = FakeWorker.instances[0]
    await autoLoad(w)
    const rank = w.posted.find((m) => m.type === 'RANK')
    expect(rank.payload.candidates).toEqual(['x', 'y'])
    w.deliver({ type: 'RESULT', request_id: rank.request_id, payload: { ranked: [{ index: 1, score: 0.9 }, { index: 0, score: 0.4 }] } })
    const out = await p
    expect(out[0].candidate).toBe(cands[1])
    expect(out[0].score).toBe(0.9)
  })

  it('classifies intent via the worker aggregate path', async () => {
    const enc = makeEncoder()
    const p = enc.classifyIntent('hi', [{ text: 'a', intent: 'request' }, { text: 'b', intent: 'opinion' }])
    const w = FakeWorker.instances[0]
    await autoLoad(w)
    const rank = w.posted.find((m) => m.type === 'RANK')
    expect(rank.payload.aggregateIntents).toBe(true)
    expect(rank.payload.intents).toEqual(['request', 'opinion'])
    w.deliver({ type: 'RESULT', request_id: rank.request_id, payload: { ranked: [], intents: [{ intent: 'request', score: 0.8 }] } })
    expect(await p).toEqual([{ intent: 'request', score: 0.8 }])
  })

  it('cancelInFlight rejects pending work with CANCELLED and tells the worker to drop it', async () => {
    const enc = makeEncoder()
    const p = enc.embed(['a'])
    const w = FakeWorker.instances[0]
    await autoLoad(w)
    const embed = w.posted.find((m) => m.type === 'EMBED')
    enc.cancelInFlight()
    await expect(p).rejects.toThrow('CANCELLED')
    const cancel = w.posted.find((m) => m.type === 'CANCEL')
    expect(cancel.payload.target_id).toBe(embed.request_id)
  })

  it('times out a stuck worker and respawns for the next call', async () => {
    vi.useFakeTimers()
    const enc = makeEncoder({ timeoutMs: 1000 })
    const p = enc.ensure()
    const w1 = FakeWorker.instances[0]
    vi.advanceTimersByTime(1001)
    await expect(p).rejects.toThrow('TIMEOUT')
    expect(w1.terminated).toBe(true)
    vi.useRealTimers()
    // Next call spawns a fresh worker.
    const p2 = enc.ensure()
    expect(FakeWorker.instances.length).toBe(2)
    await autoLoad(FakeWorker.instances[1])
    await p2
  })

  it('recovers from a worker crash (onerror) by rejecting pending and respawning', async () => {
    const enc = makeEncoder()
    const p = enc.ensure()
    const w1 = FakeWorker.instances[0]
    w1.crash()
    await expect(p).rejects.toThrow('WORKER_CRASHED')
    const p2 = enc.ensure()
    expect(FakeWorker.instances.length).toBe(2)
    await autoLoad(FakeWorker.instances[1])
    await p2
  })
})

describe('ResilientSemanticEncoder with a worker adapter', () => {
  it('degrades to hashing when the worker fails to load, and reports honestly', async () => {
    const enc = makeEncoder()
    const resilient = new ResilientSemanticEncoder({ useAdapter: enc })
    const p = resilient.rank('a', ['b', 'c'])
    const w = FakeWorker.instances[0]
    const load = w.posted.find((m) => m.type === 'LOAD_MODEL')
    w.deliver({ type: 'ERROR', request_id: load.request_id, payload: { code: 'WORKER_CRASHED' } })
    const out = await p
    expect(Array.isArray(out)).toBe(true) // hashing produced a ranking
    const rep = resilient.report()
    expect(rep.effective_engine).toBe('hashing')
    expect(rep.fallback_used).toBe(true)
    expect(rep.fallback_reason).toBe('WORKER_CRASHED')
  })

  it('falls back at RUNTIME if a worker call fails after the model loaded', async () => {
    const enc = makeEncoder()
    const resilient = new ResilientSemanticEncoder({ useAdapter: enc })
    // First call loads then succeeds.
    const p1 = resilient.embed(['warm'])
    const w = FakeWorker.instances[0]
    await autoLoad(w)
    const e1 = w.posted.find((m) => m.type === 'EMBED')
    w.deliver({ type: 'RESULT', request_id: e1.request_id, payload: { vectors: [[1]] } })
    await p1
    expect(resilient.effectiveKind()).toBe('use')
    // Second call: worker errors → resilient serves hashing instead of throwing.
    const p2 = resilient.rank('a', ['b'])
    await tick()
    const rank = w.posted.find((m) => m.type === 'RANK')
    w.deliver({ type: 'ERROR', request_id: rank.request_id, payload: { code: 'WORKER_ERROR' } })
    const out = await p2
    expect(Array.isArray(out)).toBe(true)
    expect(resilient.effectiveKind()).toBe('hashing')
  })

  it('never downgrades the engine on an intentional CANCELLED', async () => {
    const enc = makeEncoder()
    const resilient = new ResilientSemanticEncoder({ useAdapter: enc })
    const p1 = resilient.embed(['warm'])
    const w = FakeWorker.instances[0]
    await autoLoad(w)
    const e1 = w.posted.find((m) => m.type === 'EMBED')
    w.deliver({ type: 'RESULT', request_id: e1.request_id, payload: { vectors: [[1]] } })
    await p1
    const p2 = resilient.rank('a', ['b'])
    await tick()
    resilient.cancelInFlight()
    await expect(p2).rejects.toThrow('CANCELLED')
    expect(resilient.effectiveKind()).toBe('use') // still USE — cancel is not a failure
  })
})
