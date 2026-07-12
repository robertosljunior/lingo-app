// transformation-registry.js — intent-preserving transformations. Content packs
// reference operations by `operation_id` ONLY; the executable function lives
// here in code. No pack may ship code, regex, or serialized functions. An
// unknown operation_id invalidates the pack.
//
// Every operation is a pure (string, context) => string|null function that
// preserves the requested item / polarity / tense and never introduces
// semantically disconnected content. Returning null means "not applicable".

function extractRequestedItem(text) {
  // "Please give me a dessert" / "Give me the water" → { det, item }
  const m = text.match(/\bgive\s+(?:me|us)\s+(a|an|the|some)?\s*([a-z][a-z\s]*?)[.?!]?$/i)
  if (!m) return null
  return { det: (m[1] || 'a').toLowerCase(), item: m[2].trim().toLowerCase() }
}

const OPERATIONS = {
  // Imperative request → polite "Could I have ...?"
  request_to_could_i_have(text) {
    const r = extractRequestedItem(text)
    if (!r) return null
    return `Could I have ${r.det} ${r.item}, please?`
  },
  // Imperative request → "I'd like ..."
  request_to_i_would_like(text) {
    const r = extractRequestedItem(text)
    if (!r) return null
    return `I'd like ${r.det} ${r.item}, please.`
  },
  // 3rd-person singular present agreement: "He go" → "He goes".
  add_third_person_s(text, ctx) {
    const verb = ctx?.verb
    if (!verb) return null
    const inflected = thirdPersonSingular(verb)
    if (!inflected || inflected === verb) return null
    const re = new RegExp(`\\b(he|she|it)\\s+(${verb})\\b`, 'i')
    if (!re.test(text)) return null
    return text.replace(re, (_all, subj) => `${subj} ${inflected}`)
  },
  // "He goes to work every day" → "He works every day" (drop light-verb phrase).
  simplify_go_to_work(text) {
    const m = text.match(/^(he|she|it)\s+goes\s+to\s+work\s+(.*)$/i)
    if (!m) return null
    return `${m[1]} works ${m[2]}`.replace(/\s+/g, ' ').trim()
  },
  // "every day" → "each day" (register variant, meaning preserved).
  every_to_each_day(text) {
    if (!/\bevery day\b/i.test(text)) return null
    return text.replace(/\bevery day\b/i, 'each day')
  },
}

function thirdPersonSingular(verb) {
  const v = verb.toLowerCase()
  const irregular = { go: 'goes', do: 'does', have: 'has', be: 'is' }
  if (irregular[v]) return irregular[v]
  if (/(?:ch|sh|ss|x|z|o)$/.test(v)) return v + 'es'
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies'
  return v + 's'
}

export function isKnownOperation(operationId) {
  return Object.prototype.hasOwnProperty.call(OPERATIONS, operationId)
}

export function listOperations() {
  return Object.keys(OPERATIONS)
}

/**
 * Apply a transformation by id. Returns the transformed string or null if the
 * operation does not apply. Throws only for an unknown operation id (a pack
 * validation failure that must surface loudly, never silently).
 */
export function applyTransformation(operationId, text, ctx = {}) {
  const op = OPERATIONS[operationId]
  if (!op) throw new Error(`unknown_operation:${operationId}`)
  try {
    const out = op(text, ctx)
    if (typeof out !== 'string' || !out.trim() || out.trim() === text.trim()) return null
    return out.trim()
  } catch {
    return null
  }
}

export { thirdPersonSingular }
