// engine.js — on-device AI engine singleton (framework-agnostic external store).
//
// Owns the WebLLM worker/engine lifecycle and a capability registry. React binds
// to it via useSyncExternalStore (see useAI.js). Model weights are large: the
// first load downloads (hundreds of MB to a few GB) and is then cached by
// web-llm in the browser's Cache Storage, so subsequent loads — and inference —
// work offline.

import { DEFAULT_MODEL_ID, getModel } from './models.js'
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

let mlc = null        // the web-llm engine instance (WebGPU backend)
let worker = null     // the underlying Web Worker for web-llm
let wasmEngine = null // the wllama engine (CPU/WASM backend), when a CPU model is loaded

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
  // CPU (WASM) models don't touch the GPU, so they skip the WebGPU gate — they
  // are exactly the escape hatch for devices where WebGPU is broken or absent.
  const isWasm = getModel(modelId)?.backend === 'wasm'
  if (!isWasm && !isSupported()) {
    set({ status: 'error', error: 'Seu navegador não suporta WebGPU. Use Chrome ou Edge recentes num desktop, ou escolha o modelo "CPU" nas Configurações.' })
    return false
  }
  if (state.status === 'loading') return false
  set({ status: 'loading', modelId, error: null, progress: { ratio: 0, text: 'Preparando…' } })

  const deviceMemoryGB = typeof navigator !== 'undefined' ? navigator.deviceMemory ?? null : null

  // Breadcrumb: if the tab dies mid-download (WebGPU/OOM kills it without a
  // catchable error), this is the trail the user finds in the diagnostic log.
  // GPU architecture matters for triage: e.g. Adreno 6xx is known to lose the
  // device on long compute passes (Android GPU watchdog) regardless of memory.
  const gpu = isWasm ? null : await describeGpu()
  logInfo('ai', `download/carga do modelo iniciado: ${modelId}`, { deviceMemoryGB, ...(isWasm ? { backend: 'wasm' } : { gpu }) })

  const initProgressCallback = (p) => set({ progress: { ratio: p.progress ?? 0, text: p.text || '' } })

  // On low-memory devices, shrink the KV-cache/context so the first inference
  // doesn't OOM the GPU right after a successful download. navigator.deviceMemory
  // rounds down to powers of 2 (a 6 GB phone reports 4), so ≤4 is the mobile tier.
  const chatOpts = deviceMemoryGB != null && deviceMemoryGB <= 4
    ? { context_window_size: 1024 }
    : deviceMemoryGB != null && deviceMemoryGB <= 6
      ? { context_window_size: 2048 }
      : undefined

  // On Android the WebGPU device is torn down when the screen turns off or the
  // browser leaves the foreground — a top cause of "device lost" during the
  // minutes-long download/warmup. Hold a screen wake lock for the duration and
  // record whether the tab went hidden anyway, so logs can tell that apart
  // from a real GPU out-of-memory.
  let wakeLock = null
  try { wakeLock = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* unsupported/denied */ }
  let tabWasHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
  const onVis = () => { if (document.visibilityState === 'hidden') tabWasHidden = true }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
  const hiddenHint = () => tabWasHidden
    ? ' A tela apagou ou o navegador foi para segundo plano durante o carregamento — no celular isso derruba a GPU. Tente de novo mantendo o app aberto e a tela ligada até terminar.'
    : ''

  try {
    if (isWasm) {
      try {
        await bootWasmEngine(getModel(modelId))
      } catch (e) {
        logError('ai', e, { modelId, backend: 'wasm', lastProgress: state.progress?.text || null, deviceMemoryGB, tabWasHidden })
        set({ status: 'error', error: humanizeError(e) })
        return false
      }
      caps.register('chat', createChatCapability(wasmEngine))
      set({ status: 'ready', progress: { ratio: 1, text: 'Pronto' } })
      logInfo('ai', `modelo pronto (inferência testada, CPU): ${modelId}`)
      return true
    }

    try {
      await bootEngine(modelId, chatOpts, initProgressCallback)
    } catch (e) {
      logError('ai', e, { modelId, lastProgress: state.progress?.text || null, deviceMemoryGB, tabWasHidden })
      if (!isFatalGpuError(e)) {
        set({ status: 'error', error: humanizeError(e) })
        return false
      }
      // GPU device lost (surfaces as mapAsync AbortError / "device lost"). The
      // worker is holding a dead GPUDevice — every later call on it fails the
      // same way, even with a smaller model. Tear everything down and retry
      // once on a fresh device with a smaller context window (weights are
      // already in Cache Storage, so this is fast).
      await destroyEngine()
      set({ progress: { ratio: 0.9, text: 'A GPU falhou no teste — aguardando ela se recuperar…' } })
      if (!(await waitForGpuAdapter())) {
        set({ status: 'error', error: 'A GPU do navegador caiu e não voltou. Feche o navegador por completo, abra de novo e tente outra vez.' + hiddenHint() })
        return false
      }
      const retryOpts = { context_window_size: Math.max(512, (chatOpts?.context_window_size ?? 4096) / 2) }
      set({ progress: { ratio: 0.9, text: 'Tentando de novo com menos memória…' } })
      logInfo('ai', `retry após perda do device de GPU: ${modelId}`, retryOpts)
      try {
        await bootEngine(modelId, retryOpts, initProgressCallback)
      } catch (e2) {
        logError('ai', e2, { modelId, phase: 'retry', lastProgress: state.progress?.text || null, deviceMemoryGB, tabWasHidden })
        if (isFatalGpuError(e2)) await destroyEngine()
        set({ status: 'error', error: humanizeError(e2) + (isFatalGpuError(e2) ? hiddenHint() : '') })
        return false
      }
    }

    caps.register('chat', createChatCapability(mlc))
    set({ status: 'ready', progress: { ratio: 1, text: 'Pronto' } })
    logInfo('ai', `modelo pronto (inferência testada): ${modelId}`)
    return true
  } finally {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    try { await wakeLock?.release() } catch { /* already released */ }
  }
}

async function describeGpu() {
  try {
    const a = await navigator.gpu.requestAdapter()
    if (!a) return null
    const { vendor, architecture } = a.info ?? {}
    return [vendor, architecture].filter(Boolean).join(' ') || null
  } catch { return null }
}

// After a device loss, Chrome's GPU process can take a few seconds to come
// back; until then requestAdapter() resolves null (seen in the field as
// "Unable to find a compatible GPU" when retrying ~20ms after the loss).
// Poll before recreating the engine so the retry lands on a live GPU.
async function waitForGpuAdapter(timeoutMs = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try { if (await navigator.gpu.requestAdapter()) return true } catch { /* keep polling */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

// Creates/reloads the engine and runs a warmup inference. The download
// finishing doesn't prove the GPU can run the model (activation buffers only
// get allocated on first decode), so one tiny generation surfaces
// OOM/device-lost here — with a real message — instead of leaving the user
// with a chat that errors on every turn.
async function bootEngine(modelId, chatOpts, initProgressCallback) {
  await destroyWasmEngine() // switching CPU → GPU: free the wllama runtime first
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

// CPU (WASM) backend — wllama running llama.cpp off the main thread, GPU never
// touched. Same state machine and capability surface as the WebGPU path.
async function bootWasmEngine(model) {
  await destroyEngine()     // switching GPU → CPU: free GPU memory + the dead device, if any
  await destroyWasmEngine() // a wllama instance doesn't survive exit(); always build fresh

  // Threading is the difference between usable and unusable on phones. It
  // needs cross-origin isolation (COOP/COEP via the service worker); log the
  // actual state so a diagnostic dump shows whether this session got threads.
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? null : null
  const isolated = typeof window !== 'undefined' && !!window.crossOriginIsolated
  logInfo('ai', 'iniciando backend CPU (wasm)', { cores, crossOriginIsolated: isolated })

  const { createWllamaEngine } = await import('./wllama-chat.js')
  wasmEngine = await createWllamaEngine({
    ggufUrl: model.gguf,
    // KV cache lives in ordinary RAM here (not GPU memory), so a full 2048
    // context is fine even on the low-memory tier.
    nCtx: 2048,
    onProgress: ({ loaded, total }) => set({
      progress: { ratio: total ? loaded / total : 0, text: 'Baixando o modelo (CPU)…' },
    }),
  })
  set({ progress: { ratio: 0.99, text: 'Testando o modelo… (na CPU pode levar um minuto)' } })
  const t0 = Date.now()
  await wasmEngine.chat.completions.create({
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 4,
    temperature: 0,
  })
  // Rough speed probe — tells us from a log dump whether slowness is expected
  // (no threads) or something is actually stuck.
  logInfo('ai', `warmup CPU concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s (4 tokens)`)
}

async function destroyWasmEngine() {
  try { if (wasmEngine) await wasmEngine.unload() } catch { /* ignore */ }
  wasmEngine = null
}

export async function unloadModel() {
  try { if (mlc) await mlc.unload() } catch { /* ignore */ }
  await destroyWasmEngine()
  caps.clear()
  set({ status: 'idle', progress: { ratio: 0, text: '' } })
}

// Capability access — the extensibility surface used by chat / lesson-gen / future features.
export function getCapability(name) { return caps.get(name) }
export function hasCapability(name) { return caps.has(name) }
export function listCapabilities() { return caps.list() }
export function getEngine() { return mlc ?? wasmEngine }

export function humanizeError(e) {
  const msg = String(e?.message || e || '')
  if (/mapAsync|unmapped before/i.test(msg)) return 'A GPU do aparelho derrubou o modelo durante o teste. Em celulares (especialmente com GPU Adreno) o sistema encerra a GPU quando o modelo pesa demais. Tente o modelo "SmolLM2 360M · teste" nas Configurações — se nem ele rodar, este aparelho não consegue executar o tutor offline; use um computador.'
  if (/Unable to find a compatible GPU/i.test(msg)) return 'O navegador perdeu acesso à GPU (o processo gráfico caiu). Feche o navegador por completo, abra de novo e tente outra vez.'
  if (/device.*(lost|destroyed)|instance.*destroyed/i.test(msg)) return 'A GPU descarregou o modelo (memória insuficiente). Troque para um modelo mais leve nas Configurações e recarregue a página.'
  if (/out of memory|OOM|allocat|storage/i.test(msg)) return 'Memória insuficiente para este modelo. Tente um modelo mais leve nas Configurações.'
  if (/shader-f16/i.test(msg)) return 'Este aparelho não suporta o formato f16 exigido pelo modelo. Tente outro modelo nas Configurações.'
  if (/context window|prompt tokens/i.test(msg)) return 'A conversa ficou longa demais para o modelo. Recarregue a página para começar de novo.'
  if (/webgpu/i.test(msg)) return 'Falha ao iniciar a WebGPU. Verifique se o navegador tem WebGPU habilitado.'
  if (/network|fetch|Failed to fetch|download/i.test(msg)) return 'Falha ao baixar o modelo. Verifique a conexão (o download inicial precisa de internet).'
  return msg || 'Erro ao carregar o modelo.'
}
