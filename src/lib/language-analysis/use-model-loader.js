// use-model-loader.js — real TensorFlow.js Universal Sentence Encoder loader.
//
// This module is imported ONLY from the semantic Web Worker (src/workers/
// semantic-worker.js). Keeping the tfjs/USE dynamic imports out of the shared
// encoder-adapter module means the MAIN thread's module graph contains no
// TensorFlow at all — the heavy chunks live solely in the worker graph and are
// runtime-cached (never precached). The app runs on the hashing fallback until
// the user opts into the model download.
//
// The model is assembled from LOCALLY PERSISTED, checksum-verified bytes and
// handed to USE via `tf.io.fromMemory` (+ a `blob:` vocab URL), so loading is
// fully offline once installed — no CDN, no service worker, no arbitrary URL.
//
// On success returns the USE model (with `.embed`) tagged with `__lingo`
// telemetry. Throws a structured Error(code) on failure; the worker maps it to a
// fallback reason and never lets it reach React. `loadArtifacts` is injectable so
// this stays unit-testable without a real IndexedDB or 27 MB of weights.

export function createProductionUseLoader({
  loadArtifacts,
  importTf = () => import('@tensorflow/tfjs'),
  importUse = () => import('@tensorflow-models/universal-sentence-encoder'),
  modelId = 'use-en-v1',
} = {}) {
  return async () => {
    const load = loadArtifacts || (async () => {
      const { readModelArtifacts } = await import('./semantic-model-store.js')
      return readModelArtifacts(modelId)
    })
    const art = await load()
    if (!art?.ok) throw new Error(art?.code || 'MODEL_NOT_INSTALLED')

    const t0 = (globalThis.performance?.now?.() ?? Date.now())
    let tf, use
    try {
      tf = await importTf()
      use = await importUse()
    } catch { throw new Error('MODEL_LOAD_FAILED') }
    tf = tf.default || tf
    use = use.default || use

    // Prefer WebGL (real devices); fall back to CPU (headless / no GPU). The WASM
    // backend is intentionally unused — it lacks the SparseToDense kernel USE needs.
    let backend = 'cpu'
    try { await tf.setBackend('webgl'); await tf.ready(); backend = tf.getBackend() } catch { /* try cpu */ }
    if (tf.getBackend() !== 'webgl') { try { await tf.setBackend('cpu'); await tf.ready(); backend = tf.getBackend() } catch { throw new Error('TFJS_BACKEND_UNAVAILABLE') } }

    let vocabUrl
    try {
      const blob = new Blob([JSON.stringify(art.vocab)], { type: 'application/json' })
      vocabUrl = URL.createObjectURL(blob)
    } catch { throw new Error('MODEL_LOAD_FAILED') }

    let model
    try {
      model = await use.load({ modelUrl: tf.io.fromMemory(art.modelArtifacts), vocabUrl })
    } catch { throw new Error('MODEL_LOAD_FAILED') }
    finally { try { URL.revokeObjectURL(vocabUrl) } catch { /* noop */ } }

    model.__lingo = {
      model_version: art.model_version, dim: art.dim, backend,
      load_ms: Math.round((globalThis.performance?.now?.() ?? Date.now()) - t0),
    }
    return model
  }
}
