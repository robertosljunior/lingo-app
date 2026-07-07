// models.js — curated catalog of efficient, WebLLM-compatible models.
//
// The full list (163 models) lives in web-llm's prebuiltAppConfig; we surface a
// small, sensible subset for a language-learning tutor. `id` must match a
// prebuilt model_id exactly. Sizes are approximate VRAM footprints — the
// first-run download is a one-time cost, then cached in the browser.

export const MODELS = [
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen2.5 1.5B',
    sizeMB: 1630,
    note: 'Padrão — leve, rápido e multilíngue (entende português e inglês). Dá conta de aulas e conversa de treino.',
    tier: 'balanced',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B',
    sizeMB: 879,
    note: 'Bem leve — roda em mais dispositivos. Aulas mais simples.',
    tier: 'light',
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen2.5 0.5B',
    sizeMB: 945,
    note: 'O mais leve. Rápido, mas menos consistente.',
    tier: 'light',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 1B · compatibilidade (f32)',
    sizeMB: 1129,
    note: 'Mesmo modelo leve em f32 — use se os outros falharem no teste da GPU (comum em celulares cujo driver não lida bem com f16).',
    tier: 'compat',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    sizeMB: 2264,
    note: 'Mais qualidade, mais pesado. Requer um dispositivo com boa memória.',
    tier: 'balanced',
  },
  {
    id: 'Phi-4-mini-instruct-q4f16_1-MLC',
    name: 'Phi-4 Mini',
    sizeMB: 3438,
    note: '⚠️ Pesado (3,4 GB) — em aparelhos com pouca memória o download pode fechar o app. Use só em desktop com GPU forte.',
    tier: 'quality',
  },
]

// Light multilingual default: capable enough for the EN↔PT tutoring flows and
// small enough to load on ordinary devices without OOM-killing the tab.
export const DEFAULT_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'

export function getModel(id) {
  return MODELS.find((m) => m.id === id) || MODELS[0]
}

export function formatSize(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}
