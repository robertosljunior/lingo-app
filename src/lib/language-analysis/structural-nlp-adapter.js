// structural-nlp-adapter.js — stable structural analysis contract. The rest of
// the app must never import wink-nlp or Compromise directly; it talks to this
// contract only, so the primary engine can be swapped based on benchmark
// evidence (see scripts/benchmark-structural-nlp.mjs).
//
// Contract:
//   analyzeStructure(text) => {
//     engine, tokens, sentences, pos, lemmas, auxiliaries, verbs, subjects,
//     objects, negations, sentence_type, tense_candidates, intent_signals,
//     evidence
//   }
//
// Three implementations:
//   HeuristicStructuralNlpAdapter  — zero-dependency, deterministic, offline;
//                                    powers the pipeline and its goldens.
//   WinkStructuralNlpAdapter       — wink-nlp (preferred primary once loaded).
//   CompromiseStructuralNlpAdapter — legacy/comparative engine.

export const STRUCTURAL_CONTRACT_VERSION = '1'

const AUXILIARIES = new Set([
  'do', 'does', 'did', 'be', 'been', 'being', 'is', 'are', 'am', "'m", 'was', 'were',
  'have', 'has', 'had', 'will', "'ll", 'would', 'can', 'could', 'should', 'shall',
  'may', 'might', 'must', "'ve", "'d", "'re", "'s",
])
const MODALS = new Set(['will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must'])
const THIRD_SINGULAR_SUBJECTS = new Set(['he', 'she', 'it', 'this', 'that'])
const NON_THIRD_SUBJECTS = new Set(['i', 'you', 'we', 'they', 'these', 'those'])
const NEGATORS = new Set(['not', 'never', "n't", 'no'])
const WH = new Set(['what', 'when', 'where', 'why', 'who', 'whom', 'whose', 'which', 'how'])
const PREPOSITIONS = new Set(['in', 'on', 'at', 'for', 'to', 'with', 'from', 'by', 'about', 'of', 'into', 'over', 'under'])
const DETERMINERS = new Set(['a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'this', 'that', 'these', 'those'])
const REQUEST_MARKERS = new Set(['please', 'could', 'can', 'would', 'may'])
const COMMON_BASE_VERBS = new Set([
  'go', 'work', 'play', 'eat', 'drink', 'have', 'want', 'need', 'like', 'make', 'do',
  'get', 'give', 'take', 'see', 'come', 'live', 'study', 'read', 'write', 'run',
  'walk', 'talk', 'speak', 'buy', 'sell', 'help', 'call', 'ask', 'tell', 'know',
  'think', 'feel', 'look', 'find', 'use', 'try', 'start', 'stop', 'open', 'close',
  'bring', 'show', 'pass', 'send', 'order', 'book', 'cook', 'travel', 'wait', 'listen',
])
const FUTURE_MARKERS = new Set(['tomorrow', 'tonight', 'later', 'soon', 'next'])

function rawTokens(text) {
  const src = (text || '').trim()
  if (!src) return []
  // Keep contraction clitics as separate lowercase tokens for auxiliary detection.
  const matches = src.match(/[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[.,!?;:]/g) || []
  return matches
}

function splitClitic(token) {
  // "I'll" → ["i", "'ll"], "don't" → ["do", "n't"], "can't" → ["ca", "n't"],
  // "she's" → ["she", "'s"]. The n't negator is split off as its own token so
  // negation detection works regardless of where the apostrophe sits.
  const low = token.toLowerCase()
  if (/n['’]t$/.test(low)) {
    const head = low.replace(/n['’]t$/, '')
    return head ? [head, "n't"] : ["n't"]
  }
  const apos = low.indexOf("'")
  if (apos <= 0) return [low]
  return [low.slice(0, apos), low.slice(apos)]
}

function crudeLemma(word) {
  const w = word.toLowerCase()
  if (w === 'goes' || w === 'went' || w === 'gone') return 'go'
  if (w === 'has' || w === 'had') return 'have'
  if (w === 'is' || w === 'are' || w === 'am' || w === 'was' || w === 'were' || w === 'been') return 'be'
  if (w === 'does' || w === 'did') return 'do'
  if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y'
  if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (/([^s])s$/.test(w) && !/ss$/.test(w) && w.length > 3) return w.slice(0, -1)
  return w
}

function isThirdSingularVerb(word) {
  const w = word.toLowerCase()
  if (w === 'goes' || w === 'does' || w === 'has' || w === 'is' || w === 'was') return true
  return /(?:[^s]s|es)$/.test(w) && !AUXILIARIES.has(w) && w.length > 3 && !/ss$/.test(w)
}

/**
 * Dependency-free structural analyzer. Deterministic and offline; it does not
 * try to be a full parser — it extracts exactly the evidence the pedagogical
 * rules and semantic retrieval consume.
 */
export class HeuristicStructuralNlpAdapter {
  constructor() { this.engine = 'heuristic' }

  analyzeStructure(text) {
    const src = (text || '').trim()
    const rawToks = rawTokens(src)
    const tokens = []
    for (const t of rawToks) {
      if (/[.,!?;:]/.test(t)) { tokens.push(t); continue }
      for (const piece of splitClitic(t)) tokens.push(piece)
    }
    const words = tokens.filter((t) => /[a-z0-9]/i.test(t))
    const lower = words.map((w) => w.toLowerCase())

    const auxiliaries = []
    const verbs = []
    const subjects = []
    const objects = []
    const negations = []
    const pos = []
    const lemmas = []

    lower.forEach((w, i) => {
      const lemma = crudeLemma(w)
      lemmas.push(lemma)
      let tag = 'X'
      if (NEGATORS.has(w)) { tag = 'NEG'; negations.push({ token: w, index: i }) }
      else if (AUXILIARIES.has(w) || MODALS.has(w)) { tag = MODALS.has(w) ? 'MD' : 'AUX'; auxiliaries.push({ token: w, index: i, modal: MODALS.has(w) }) }
      else if (WH.has(w)) tag = 'WH'
      else if (PREPOSITIONS.has(w)) tag = 'IN'
      else if (DETERMINERS.has(w)) tag = 'DT'
      else if (THIRD_SINGULAR_SUBJECTS.has(w) || NON_THIRD_SUBJECTS.has(w)) { tag = 'PRP'; subjects.push({ token: w, index: i, third_singular: THIRD_SINGULAR_SUBJECTS.has(w) }) }
      else tag = 'WORD'
      pos.push({ token: w, tag, index: i })
    })

    // Main-verb candidates: words that look verbal and are not auxiliaries.
    lower.forEach((w, i) => {
      if (AUXILIARIES.has(w) || MODALS.has(w) || NEGATORS.has(w) || DETERMINERS.has(w) || PREPOSITIONS.has(w) || WH.has(w)) return
      const base = crudeLemma(w)
      const isVerb = COMMON_BASE_VERBS.has(w) || COMMON_BASE_VERBS.has(base) || isThirdSingularVerb(w) || /(?:ed|ing)$/.test(w)
      if (isVerb) {
        verbs.push({
          token: w, index: i, lemma: base,
          form: /ing$/.test(w) ? 'VBG' : /ed$/.test(w) ? 'VBD_OR_VBN' : isThirdSingularVerb(w) ? 'VBZ' : 'VB',
          third_singular: isThirdSingularVerb(w),
          base_form: COMMON_BASE_VERBS.has(w) && !isThirdSingularVerb(w) && !/(?:ed|ing)$/.test(w),
        })
      }
    })

    // Objects: noun-ish words after a determiner or the main verb.
    lower.forEach((w, i) => {
      if (pos[i].tag !== 'WORD') return
      const prev = lower[i - 1]
      if (DETERMINERS.has(prev) || (verbs.length && verbs[0].index < i)) {
        if (!verbs.some((v) => v.index === i)) objects.push({ token: w, index: i })
      }
    })

    const punctuation = src.match(/[?.!]$/)?.[0] || null
    const first = lower[0]
    const startsWithAux = auxiliaries.some((a) => a.index === 0)
    const startsWithWh = first && WH.has(first)
    let sentence_type = 'statement'
    if (punctuation === '?' || startsWithAux || startsWithWh) sentence_type = 'question'
    // Imperative: starts with a base verb (or please + base verb) and has no explicit subject before it.
    const firstContentIdx = REQUEST_MARKERS.has(first) && first === 'please' ? 1 : 0
    const firstContent = lower[firstContentIdx]
    const noSubjectBeforeVerb = subjects.length === 0 || subjects[0].index > (verbs[0]?.index ?? Infinity)
    if (sentence_type !== 'question' && verbs.length && (COMMON_BASE_VERBS.has(firstContent)) && noSubjectBeforeVerb) {
      sentence_type = 'imperative'
    }

    // Tense candidates.
    const tense_candidates = []
    if (auxiliaries.some((a) => a.token === 'will' || a.token === "'ll")) tense_candidates.push('future_will')
    if (auxiliaries.some((a) => (a.token === 'have' || a.token === 'has')) && verbs.some((v) => v.form === 'VBD_OR_VBN')) tense_candidates.push('present_perfect')
    if (auxiliaries.some((a) => ['is', 'are', 'am'].includes(a.token)) && verbs.some((v) => v.form === 'VBG')) tense_candidates.push('present_continuous')
    if (verbs.some((v) => v.form === 'VBZ' || v.form === 'VB') && !tense_candidates.length) tense_candidates.push('simple_present')
    if (verbs.some((v) => v.form === 'VBD_OR_VBN') && !auxiliaries.length) tense_candidates.push('simple_past')
    if (!tense_candidates.length) tense_candidates.push('simple_present')

    // Intent signals — cheap surface cues used to seed semantic retrieval.
    const intent_signals = []
    if (REQUEST_MARKERS.has(first) || lower.includes('please') || (sentence_type === 'question' && (first === 'could' || first === 'can' || first === 'may'))) {
      intent_signals.push(lower.includes('please') || first === 'could' || first === 'would' ? 'polite_request' : 'request')
    }
    if (sentence_type === 'imperative') intent_signals.push('request')
    if (tense_candidates.includes('future_will') || lower.some((w) => FUTURE_MARKERS.has(w))) intent_signals.push('future_plan')
    if (tense_candidates.includes('present_perfect')) intent_signals.push('past_experience')
    if (sentence_type === 'question') intent_signals.push('question')

    return {
      engine: this.engine,
      contract_version: STRUCTURAL_CONTRACT_VERSION,
      tokens,
      sentences: src ? [src] : [],
      pos,
      lemmas,
      auxiliaries,
      verbs,
      subjects,
      objects,
      negations,
      sentence_type,
      tense_candidates,
      intent_signals: [...new Set(intent_signals)],
      evidence: {
        word_count: words.length,
        starts_with_auxiliary: startsWithAux,
        starts_with_wh: !!startsWithWh,
        has_third_singular_subject: subjects.some((s) => s.third_singular),
        main_verb: verbs[0] || null,
        end_punctuation: punctuation,
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Engine-backed adapters. Both wrap a lazily-loaded engine and normalize to the
// same contract by delegating structural bookkeeping to the heuristic analyzer,
// then overriding POS/lemmas with real engine output when available. This keeps
// a single canonical evidence shape regardless of the primary engine chosen.
// ---------------------------------------------------------------------------
export class WinkStructuralNlpAdapter {
  constructor({ loadEngine } = {}) {
    this.engine = 'wink'
    this._loadEngine = loadEngine
    this._wink = null
    this._heuristic = new HeuristicStructuralNlpAdapter()
  }

  async ensure() {
    if (this._wink) return this._wink
    const load = this._loadEngine || (async () => {
      const [{ default: winkNLP }, { default: model }] = await Promise.all([
        import('wink-nlp'),
        import('wink-eng-lite-web-model'),
      ])
      return winkNLP(model)
    })
    this._wink = await load()
    return this._wink
  }

  async analyzeStructure(text) {
    const base = this._heuristic.analyzeStructure(text)
    try {
      const wink = await this.ensure()
      const its = wink.its
      const doc = wink.readDoc(text || '')
      const posTags = doc.tokens().out(its.pos)
      const toks = doc.tokens().out()
      const lemmas = doc.tokens().out(its.lemma)
      const pos = toks.map((token, i) => ({ token, tag: posTags[i], index: i }))
      return { ...base, engine: this.engine, pos, lemmas, engine_pos_available: true }
    } catch {
      return { ...base, engine: 'wink->heuristic', engine_pos_available: false }
    }
  }
}

export class CompromiseStructuralNlpAdapter {
  constructor({ loadEngine } = {}) {
    this.engine = 'compromise'
    this._loadEngine = loadEngine
    this._nlp = null
    this._heuristic = new HeuristicStructuralNlpAdapter()
  }

  async ensure() {
    if (this._nlp) return this._nlp
    const load = this._loadEngine || (async () => (await import('compromise')).default)
    this._nlp = await load()
    return this._nlp
  }

  async analyzeStructure(text) {
    const base = this._heuristic.analyzeStructure(text)
    try {
      const nlp = await this.ensure()
      const doc = nlp(text || '')
      const terms = doc.json({ terms: true }).flatMap((s) => s.terms || [])
      const pos = terms.map((t, i) => ({ token: t.text, tag: (t.tags && t.tags[0]) || 'X', index: i }))
      const lemmas = terms.map((t) => (t.normal || t.text || '').toLowerCase())
      return { ...base, engine: this.engine, pos, lemmas, engine_pos_available: true }
    } catch {
      return { ...base, engine: 'compromise->heuristic', engine_pos_available: false }
    }
  }
}

/**
 * Factory. wink is the preferred primary per the initial benchmark policy; the
 * heuristic engine is the deterministic default used when no async engine is
 * requested (tests, first-paint, cold offline). Selection can change only with
 * benchmark evidence.
 */
export function createStructuralNlp({ primary = 'heuristic', loaders = {} } = {}) {
  if (primary === 'wink') return new WinkStructuralNlpAdapter({ loadEngine: loaders.wink })
  if (primary === 'compromise') return new CompromiseStructuralNlpAdapter({ loadEngine: loaders.compromise })
  return new HeuristicStructuralNlpAdapter()
}
