// engine.js — on-device AI engine singleton (framework-agnostic external store).
//
// Owns the WebLLM worker/engine lifecycle and a capability registry. React binds
// to it via useSyncExternalStore (see useAI.js). Model weights are large: the
// first load downloads (hundreds of MB to a few GB) and is then cached by
// web-llm in the browser's Cache Storage, so subsequent loads — and inference —
// work offline.

import { DEFAULT_MODEL_ID } from './models.js'
import { createCapabilityRegistry, createChatCapability } from './capabilities.js'

// web-llm is ~6 MB — imported lazily (only when the user activates the tutor) so
// it never lands in the main bundle. Cached after the first dynamic import.
let webllmPromise = null
function loadWebLLM() {
  if (!webllmPromise) webllmPromise = import('@mlc-ai/web-llm')
  return webllmPromise
}

const listeners = new Set()
const caps = createCapabilityRegistry()

let mlc = null       // the web-llm engine instance
let worker = null    // the underlying Web Worker

let state = {
  supported: null,   // WebGPU support: null = unchecked
  status: 'idle',    // idle | loading | ready | error
  modelId: DEFAULT_MODEL_ID,
  progress: { ratio: 0, text: '' },
  error: null,
}

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }
export function getState() { return state }

export function isSupported() {
  const ok = typeof navigator !== 'undefined' && !!navigator.gpu
  if (state.supported !== ok) set({ supported: ok })
  return ok
}

export function setPreferredModel(modelId) {
  if (modelId && modelId !== state.modelId) set({ modelId })
}

// Load (or switch to) a model. Reuses the worker; reloads in place when already
// running. Returns true on success.
export async function loadModel(modelId = state.modelId) {
  if (!isSupported()) {
    set({ status: 'error', error: 'Seu navegador não suporta WebGPU. Use Chrome ou Edge recentes num desktop, ou um navegador compatível.' })
    return false
  }
  if (state.status === 'loading') return false
  set({ status: 'loading', modelId, error: null, progress: { ratio: 0, text: 'Preparando…' } })

  const initProgressCallback = (p) => set({ progress: { ratio: p.progress ?? 0, text: p.text || '' } })

  try {
    const { CreateWebWorkerMLCEngine } = await loadWebLLM()
    if (!worker) {
      worker = new Worker(new URL('./webllm-worker.js', import.meta.url), { type: 'module' })
    }
    if (!mlc) {
      mlc = await CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback })
    } else {
      mlc.setInitProgressCallback(initProgressCallback)
      await mlc.reload(modelId)
    }
    caps.register('chat', createChatCapability(mlc))
    set({ status: 'ready', progress: { ratio: 1, text: 'Pronto' } })
    return true
  } catch (e) {
    set({ status: 'error', error: humanizeError(e) })
    return false
  }
}

export async function unloadModel() {
  try { if (mlc) await mlc.unload() } catch { /* ignore */ }
  caps.clear()
  set({ status: 'idle', progress: { ratio: 0, text: '' } })
}

// Capability access — the extensibility surface used by chat / lesson-gen / future features.
export function getCapability(name) { return caps.get(name) }
export function hasCapability(name) { return caps.has(name) }
export function listCapabilities() { return caps.list() }
export function getEngine() { return mlc }

function humanizeError(e) {
  const msg = String(e?.message || e || '')
  if (/webgpu/i.test(msg)) return 'Falha ao iniciar a WebGPU. Verifique se o navegador tem WebGPU habilitado.'
  if (/out of memory|OOM|storage/i.test(msg)) return 'Memória insuficiente para este modelo. Tente um modelo mais leve nas Configurações.'
  if (/network|fetch|Failed to fetch/i.test(msg)) return 'Falha ao baixar o modelo. Verifique a conexão (o download inicial precisa de internet).'
  return msg || 'Erro ao carregar o modelo.'
}
