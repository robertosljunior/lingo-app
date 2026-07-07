// wllama-chat.js — CPU (WebAssembly) inference backend, via wllama (llama.cpp).
//
// Fallback for devices whose WebGPU device cannot survive real inference —
// e.g. Android phones with Adreno 6xx, where the OS GPU watchdog kills long
// compute passes no matter how small the model is. Everything runs on the CPU
// inside wllama's own worker, so the GPU is never touched. Models are GGUF
// files downloaded from Hugging Face and cached by wllama in Cache Storage,
// so inference works offline after the first download.
//
// Speed note: without cross-origin isolation (COOP/COEP headers, which GitHub
// Pages can't set) wllama runs single-threaded. Usable for short tutoring
// replies on a 0.5B model; not for long generations.

import wllamaWasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url'

// ~350 KB of JS — loaded lazily, and split into its own chunk (see
// vite.config.js) so it never lands in the main bundle.
let wllamaModulePromise = null
function loadWllamaModule() {
  // The package has no root entry in its published form; import the ESM build.
  if (!wllamaModulePromise) wllamaModulePromise = import('@wllama/wllama/esm/index.js')
  return wllamaModulePromise
}

// Loads a GGUF model from a direct URL and returns it behind the same
// OpenAI-style surface web-llm exposes (`chat.completions.create`), so the
// existing 'chat' capability wrapper in capabilities.js works unchanged for
// both backends. A direct URL (instead of wllama's HF repo helper) avoids an
// extra Hugging Face API round-trip and keeps the loader host-agnostic.
export async function createWllamaEngine({ ggufUrl, nCtx = 2048, onProgress }) {
  const { Wllama, LoggerWithoutDebug } = await loadWllamaModule()
  const wllama = new Wllama(
    { default: wllamaWasmUrl },
    { logger: LoggerWithoutDebug, allowOffline: true },
  )
  await wllama.loadModelFromUrl(
    ggufUrl,
    {
      n_ctx: nCtx,
      // CPU only. wllama ≥3.1 auto-offloads every layer to WebGPU, which would
      // reintroduce the exact device-loss this backend exists to escape.
      n_gpu_layers: 0,
      progressCallback: onProgress,
    },
  )
  return {
    chat: { completions: { create: (opts) => wllama.createChatCompletion(opts) } },
    unload: () => wllama.exit(),
  }
}
