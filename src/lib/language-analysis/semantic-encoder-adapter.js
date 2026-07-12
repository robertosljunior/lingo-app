// semantic-encoder-adapter.js — semantic retrieval contract. USE (Universal
// Sentence Encoder over TensorFlow.js) is the production encoder, loaded locally
// and lazily. USE is used ONLY for retrieval / approximate intent / example
// selection — never to decide grammatical correctness and never to fail free
// production on low similarity.
//
// Contract:
//   embed(texts) => Promise<number[][]>
//   rank(query, candidates) => Promise<[{ candidate, score, index }]>  (desc)
//   classifyIntent(text, exemplars) => Promise<[{ intent, score }]>    (desc)
//
// Two implementations:
//   HashingSemanticEncoder      — deterministic, offline, zero-dependency token
//                                 n-gram encoder. Powers the pipeline without a
//                                 model download; good enough for coarse
//                                 retrieval and fully testable.
//   UseSemanticEncoderAdapter   — wraps @tensorflow-models/universal-sentence-
//                                 encoder with a LOCAL modelUrl/vocabUrl (no
//                                 mandatory CDN), injected via a loader.

export const SEMANTIC_CONTRACT_VERSION = '1'
const DIM = 128

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function normTokens(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim().split(/\s+/).filter(Boolean)
}

/**
 * Deterministic bag-of-n-grams encoder. Not a neural model — it captures lexical
 * overlap and short-order signal, which is enough for coarse example retrieval
 * and to keep the pipeline offline. It intentionally under-claims: the
 * orchestrator never lets its scores alone create or clear an error.
 */
export class HashingSemanticEncoder {
  constructor() {
    this.model_version = 'hashing-1'
    this.contract_version = SEMANTIC_CONTRACT_VERSION
  }

  _vec(text) {
    const toks = normTokens(text)
    const v = new Array(DIM).fill(0)
    const grams = []
    for (let i = 0; i < toks.length; i++) {
      grams.push(toks[i])
      if (i + 1 < toks.length) grams.push(toks[i] + ' ' + toks[i + 1])
    }
    for (const g of grams) v[hashStr(g) % DIM] += 1
    return v
  }

  async embed(texts) {
    const arr = Array.isArray(texts) ? texts : [texts]
    return arr.map((t) => this._vec(t))
  }

  async rank(query, candidates) {
    const qv = this._vec(typeof query === 'string' ? query : query?.text || '')
    return candidates
      .map((c, index) => {
        const text = typeof c === 'string' ? c : c.text
        return { candidate: c, index, score: +cosine(qv, this._vec(text)).toFixed(4) }
      })
      .sort((a, b) => b.score - a.score)
  }

  async classifyIntent(text, exemplars) {
    // exemplars: [{ intent, text }]. Aggregate best score per intent.
    const ranked = await this.rank(text, exemplars)
    const byIntent = new Map()
    for (const r of ranked) {
      const intent = r.candidate.intent
      if (!intent) continue
      if (!byIntent.has(intent) || r.score > byIntent.get(intent)) byIntent.set(intent, r.score)
    }
    return [...byIntent.entries()].map(([intent, score]) => ({ intent, score })).sort((a, b) => b.score - a.score)
  }
}

/**
 * USE adapter. The heavy model is injected through `loadModel`, which production
 * wiring implements as:
 *   () => use.load({ modelUrl: LOCAL_MODEL_URL, vocabUrl: LOCAL_VOCAB_URL })
 * pointing at locally hosted / downloaded assets. On any load failure the caller
 * should fall back to HashingSemanticEncoder — semantics degrade, correctness
 * does not.
 */
export class UseSemanticEncoderAdapter {
  constructor({ loadModel, modelVersion = 'use-lite-1' } = {}) {
    this._loadModel = loadModel
    this._model = null
    this.model_version = modelVersion
    this.contract_version = SEMANTIC_CONTRACT_VERSION
  }

  async ensure() {
    if (this._model) return this._model
    if (!this._loadModel) throw new Error('no_model_loader')
    this._model = await this._loadModel()
    return this._model
  }

  async embed(texts) {
    const arr = Array.isArray(texts) ? texts : [texts]
    const model = await this.ensure()
    const embeddings = await model.embed(arr)
    // tfjs tensor → array; support both tensor and plain-array test doubles.
    const data = typeof embeddings.array === 'function' ? await embeddings.array() : embeddings
    if (typeof embeddings.dispose === 'function') embeddings.dispose()
    return data
  }

  async rank(query, candidates) {
    const texts = [typeof query === 'string' ? query : query.text, ...candidates.map((c) => (typeof c === 'string' ? c : c.text))]
    const vecs = await this.embed(texts)
    const qv = vecs[0]
    return candidates
      .map((c, index) => ({ candidate: c, index, score: +cosine(qv, vecs[index + 1]).toFixed(4) }))
      .sort((a, b) => b.score - a.score)
  }

  async classifyIntent(text, exemplars) {
    const ranked = await this.rank(text, exemplars)
    const byIntent = new Map()
    for (const r of ranked) {
      const intent = r.candidate.intent
      if (!intent) continue
      if (!byIntent.has(intent) || r.score > byIntent.get(intent)) byIntent.set(intent, r.score)
    }
    return [...byIntent.entries()].map(([intent, score]) => ({ intent, score })).sort((a, b) => b.score - a.score)
  }
}

export function createSemanticEncoder({ useLoader = null } = {}) {
  if (useLoader) return new UseSemanticEncoderAdapter({ loadModel: useLoader })
  return new HashingSemanticEncoder()
}
