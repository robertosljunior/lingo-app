// engine.js — on-device AI engine singleton (framework-agnostic external store).
//
// Owns the WebLLM worker/engine lifecycle and a capability registry. React binds
// to it via useSyncExternalStore (see useAI.js). Model weights are large: the
// first load downloads (hundreds of MB to a few GB) and is then cached by
// web-llm in the browser's Cache Storage, so subsequent loads — and inference —
// work offline.

import { DEFAULT_MODEL_ID } from './models.js'
import { createCapabilityRegistry, createChatCapability } from './capabilities.js'
import { logError, logInfo } from '../lib/error-log.js'

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

  const deviceMemoryGB = typeof navigator !== 'undefined' ? navigator.deviceMemory ?? null : null

  // Breadcrumb: if the tab dies mid-download (WebGPU/OOM kills it without a
  // catchable error), this is the trail the user finds in the diagnostic log.
  logInfo('ai', `download/carga do modelo iniciado: ${modelId}`, { deviceMemoryGB })

  const initProgressCallback = (p) => set({ progress: { ratio: p.progress ?? 0, text: p.text || '' } })

  // On low-memory devices, shrink the KV-cache/context so the first inference
  // doesn't OOM the GPU right after a successful download. navigator.deviceMemory
  // rounds down to powers of 2 (a 6 GB phone reports 4), so ≤4 is the mobile tier.
  const chatOpts = deviceMemoryGB != null && deviceMemoryGB <= 4
    ? { context_window_size: 1024 }
    : deviceMemoryGB != null && deviceMemoryGB <= 6
      ? { context_window_size: 2048 }
      : undefined

  try {
    await bootEngine(modelId, chatOpts, initProgressCallback)
  } catch (e) {
    logError('ai', e, { modelId, lastProgress: state.progress?.text || null, deviceMemoryGB })
    if (!isFatalGpuError(e)) {
      set({ status: 'error', error: humanizeError(e) })
      return false
    }
    // GPU device lost (surfaces as mapAsync AbortError / "device lost"). The
    // worker is holding a dead GPUDevice — every later call on it fails the
    // same way, even with a smaller model. Tear everything down and retry once
    // on a fresh device with a smaller context window (weights are already in
    // Cache Storage, so this is fast).
    await destroyEngine()
    const retryOpts = { context_window_size: Math.max(512, (chatOpts?.context_window_size ?? 4096) / 2) }
    set({ progress: { ratio: 0.9, text: 'A GPU falhou no teste — tentando de novo com menos memória…' } })
    logInfo('ai', `retry após perda do device de GPU: ${modelId}`, retryOpts)
    try {
      await bootEngine(modelId, retryOpts, initProgressCallback)
    } catch (e2) {
      logError('ai', e2, { modelId, phase: 'retry', lastProgress: state.progress?.text || null, deviceMemoryGB })
      if (isFatalGpuError(e2)) await destroyEngine()
      set({ status: 'error', error: humanizeError(e2) })
      return false
    }
  }

  caps.register('chat', createChatCapability(mlc))
  set({ status: 'ready', progress: { ratio: 1, text: 'Pronto' } })
  logInfo('ai', `modelo pronto (inferência testada): ${modelId}`)
  return true
}

// Creates/reloads the engine and runs a warmup inference. The download
// finishing doesn't prove the GPU can run the model (activation buffers only
// get allocated on first decode), so one tiny generation surfaces
// OOM/device-lost here — with a real message — instead of leaving the user
// with a chat that errors on every turn.
async function bootEngine(modelId, chatOpts, initProgressCallback) {
  const { CreateWebWorkerMLCEngine } = await loadWebLLM()
  if (!worker) {
    worker = new Worker(new URL('./webllm-worker.js', import.meta.url), { type: 'module' })
    worker.onerror = (ev) => logError('ai-worker', ev.message || 'worker error')
  }
  if (!mlc) {
    mlc = await CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback }, chatOpts)
  } else {
    mlc.setInitProgressCallback(initProgressCallback)
    await mlc.reload(modelId, chatOpts)
  }

  set({ progress: { ratio: 0.99, text: 'Testando o modelo…' } })
  await mlc.chat.completions.create({
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 4,
    temperature: 0,
  })
}

// A lost/destroyed GPUDevice never recovers; it poisons every buffer that was
// created from it (mapAsync rejects with AbortError: "Buffer was unmapped
// before mapping was resolved"). Anything matching here requires a fresh
// worker + device before another attempt can succeed.
function isFatalGpuError(e) {
  const msg = String(e?.message || e || '')
  return /mapAsync|unmapped before|device.*(lost|destroyed)|instance.*destroyed/i.test(msg)
}

async function destroyEngine() {
  try { if (mlc) await mlc.unload() } catch { /* engine is likely already dead */ }
  try { if (worker) worker.terminate() } catch { /* ignore */ }
  mlc = null
  worker = null
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

export function humanizeError(e) {
  const msg = String(e?.message || e || '')
  if (/mapAsync|unmapped before/i.test(msg)) return 'A GPU do aparelho descartou o modelo durante o teste — falta de memória de GPU ou driver instável com f16. Feche outras abas e apps e tente de novo; se persistir, escolha o modelo "compatibilidade (f32)" nas Configurações.'
  if (/device.*(lost|destroyed)|instance.*destroyed/i.test(msg)) return 'A GPU descarregou o modelo (memória insuficiente). Troque para um modelo mais leve nas Configurações e recarregue a página.'
  if (/out of memory|OOM|allocat|storage/i.test(msg)) return 'Memória insuficiente para este modelo. Tente um modelo mais leve nas Configurações.'
  if (/shader-f16/i.test(msg)) return 'Este aparelho não suporta o formato f16 exigido pelo modelo. Tente outro modelo nas Configurações.'
  if (/context window|prompt tokens/i.test(msg)) return 'A conversa ficou longa demais para o modelo. Recarregue a página para começar de novo.'
  if (/webgpu/i.test(msg)) return 'Falha ao iniciar a WebGPU. Verifique se o navegador tem WebGPU habilitado.'
  if (/network|fetch|Failed to fetch/i.test(msg)) return 'Falha ao baixar o modelo. Verifique a conexão (o download inicial precisa de internet).'
  return msg || 'Erro ao carregar o modelo.'
}
