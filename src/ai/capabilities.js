// capabilities.js — the extensibility seam for the on-device AI engine.
//
// The engine exposes a registry of *capabilities*. Today only 'chat' (text
// generation) is backed by the loaded LLM. Future capabilities — e.g. 'image'
// for quiz illustrations, or 'embeddings' for smarter mistake clustering — can
// register here behind the same interface without touching callers. Each
// capability is a plain object of async methods; consumers do
// `getCapability('chat')?.stream(...)` and degrade gracefully when absent.

// Static manifest so the UI can advertise what exists and what's planned.
export const CAPABILITY_MANIFEST = [
  { key: 'chat', label: 'Conversa & geração de aulas', status: 'available' },
  { key: 'image', label: 'Imagens para quiz', status: 'planned' },
  { key: 'embeddings', label: 'Agrupamento de erros', status: 'planned' },
]

export function createCapabilityRegistry() {
  const map = new Map()
  return {
    register: (name, impl) => { map.set(name, impl) },
    get: (name) => map.get(name) || null,
    has: (name) => map.has(name),
    list: () => [...map.keys()],
    clear: () => map.clear(),
  }
}

import { logError } from '../lib/error-log.js'

// Wraps a loaded web-llm engine as the 'chat' capability. Every failure is
// recorded in the diagnostic log with the real message before rethrowing, so
// inference problems are never silently swallowed by UI catches.
export function createChatCapability(engine) {
  return {
    kind: 'chat',
    // Async iterator of token deltas.
    async *stream(messages, opts = {}) {
      try {
        const completion = await engine.chat.completions.create({
          messages,
          stream: true,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.max_tokens ?? 1024,
          top_p: opts.top_p ?? 0.95,
          ...(opts.frequency_penalty != null ? { frequency_penalty: opts.frequency_penalty } : null),
          ...(opts.repetition_penalty != null ? { repetition_penalty: opts.repetition_penalty } : null),
        })
        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content || ''
          if (delta) yield delta
        }
      } catch (e) {
        logError('ai-chat', e, { op: 'stream', messages: messages.length })
        throw e
      }
    },
    // Non-streaming convenience.
    async complete(messages, opts = {}) {
      try {
        const r = await engine.chat.completions.create({
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.max_tokens ?? 1024,
        })
        return r.choices?.[0]?.message?.content || ''
      } catch (e) {
        logError('ai-chat', e, { op: 'complete', messages: messages.length })
        throw e
      }
    },
  }
}
