// task-relevance-gate.js — conservative lexical/concept preflight for guided
// production. This is NOT model-answer matching: it only asks whether the
// learner response contains enough topical evidence to justify awarding mastery
// for the guided scenario. When relevance cannot be confirmed, callers must
// downgrade a would-be positive result to `unable_to_assess`, never invent an
// error. Free production and speech are intentionally outside this preflight.

export const TASK_RELEVANCE_GATE_VERSION = 1

const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your',
  'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those', 'is', 'am', 'are',
  'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might', 'must', 'to',
  'of', 'in', 'on', 'at', 'for', 'from', 'with', 'by', 'as', 'and', 'or', 'but',
  'yet', 'still', 'so', 'if', 'then', 'than', 'very', 'really', 'just', 'here',
  'there', 'now', 'today', 'yesterday', 'tomorrow', 'not', 'no', 'never', 'nt',
])

// Small, stable concept families cover common learner paraphrases without
// pretending to be a general thesaurus. The fallback remains uncertainty, so a
// missing synonym can never turn a relevant answer into a fabricated error.
const CONCEPT_FAMILIES = [
  ['house', 'home', 'apartment', 'flat', 'place'],
  ['small', 'tiny', 'little', 'compact', 'cramped'],
  ['comfortable', 'comfy', 'cozy', 'cosy', 'pleasant'],
  ['cheap', 'inexpensive', 'affordable', 'lowcost'],
  ['expensive', 'costly', 'pricey'],
  ['job', 'work', 'workplace', 'office'],
  ['team', 'coworker', 'coworkers', 'colleague', 'colleagues'],
  ['happy', 'glad', 'pleased'],
  ['tired', 'exhausted', 'sleepy'],
  ['difficult', 'hard', 'tough'],
  ['easy', 'simple'],
  ['angry', 'mad'],
  ['message', 'text', 'email'],
  ['bus', 'coach'],
  ['car', 'vehicle'],
  ['shop', 'store', 'market'],
  ['price', 'cost', 'costs'],
]

const CONCEPT = new Map()
for (const family of CONCEPT_FAMILIES) {
  const canonical = family[0]
  for (const word of family) CONCEPT.set(word, canonical)
}

function normalizeToken(token) {
  let t = String(token || '').toLowerCase().replace(/[^a-z0-9']/g, '')
  if (!t) return ''
  t = t.replace(/n't$/, 'nt').replace(/'s$/, '')
  // Conservative morphology only; do not stem short words or transform verbs
  // aggressively. Plural normalization is enough for common topical nouns.
  if (t.length > 4 && t.endsWith('ies')) t = `${t.slice(0, -3)}y`
  else if (t.length > 4 && t.endsWith('es')) t = t.slice(0, -2)
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1)
  return t
}

function contentConcepts(text) {
  const out = new Set()
  for (const raw of String(text || '').split(/\s+/)) {
    const token = normalizeToken(raw)
    if (!token || token.length < 3 || STOPWORDS.has(token)) continue
    out.add(CONCEPT.get(token) || token)
  }
  return out
}

/**
 * Returns one of:
 *   confirmed      — at least one meaningful topical concept overlaps;
 *   unconfirmed    — reference is informative but response has no topical link;
 *   not_applicable — there is not enough authored/reference evidence to gate.
 *
 * `unconfirmed` means "do not award mastery automatically", not "the learner is
 * wrong". Callers should map it to unable_to_assess / retry.
 */
export function assessGuidedTaskRelevanceV2({ referenceText, responseText }) {
  const reference = contentConcepts(referenceText)
  const response = contentConcepts(responseText)

  if (reference.size < 2 || response.size === 0) {
    return {
      gate_version: TASK_RELEVANCE_GATE_VERSION,
      status: 'not_applicable',
      confidence: 0,
      shared_concepts: [],
      reference_concepts: [...reference],
    }
  }

  const shared = [...response].filter((concept) => reference.has(concept))
  if (shared.length > 0) {
    return {
      gate_version: TASK_RELEVANCE_GATE_VERSION,
      status: 'confirmed',
      confidence: Math.min(0.95, 0.75 + shared.length * 0.1),
      shared_concepts: shared,
      reference_concepts: [...reference],
    }
  }

  return {
    gate_version: TASK_RELEVANCE_GATE_VERSION,
    status: 'unconfirmed',
    confidence: 0.7,
    shared_concepts: [],
    reference_concepts: [...reference],
  }
}
