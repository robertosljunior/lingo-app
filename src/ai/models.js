// models.js — curated catalog of efficient, WebLLM-compatible models.
//
// The full list (163 models) lives in web-llm's prebuiltAppConfig; we surface a
// small, sensible subset for a language-learning tutor. `id` must match a
// prebuilt model_id exactly. Sizes are approximate VRAM footprints — the
// first-run download is a one-time cost, then cached in the browser.

export const MODELS = [
  {
    id: 'Phi-4-mini-instruct-q4f16_1-MLC',
    name: 'Phi-4 Mini',
    sizeMB: 3438,
    note: 'Mais capaz. Melhor qualidade de aula e conversa. Pede um dispositivo forte.',
    tier: 'quality',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    sizeMB: 2264,
    note: 'Bom equilíbrio entre qualidade e tamanho.',
    tier: 'balanced',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen2.5 1.5B',
    sizeMB: 1630,
    note: 'Leve e rápido, multilíngue. Boa escolha padrão.',
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
]

// The user's requested default; falls back to the first entry if unavailable.
export const DEFAULT_MODEL_ID = 'Phi-4-mini-instruct-q4f16_1-MLC'

export function getModel(id) {
  return MODELS.find((m) => m.id === id) || MODELS[0]
}

export function formatSize(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}
