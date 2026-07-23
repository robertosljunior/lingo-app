// semantic-equivalence.js — Slice V2.15. A PURE composite-evidence evaluator of
// meaning equivalence between a learner response and an authored target. It
// exists because essential-token presence does NOT prove meaning, and semantic
// similarity alone can neither approve nor reject (see
// test-evidence/v2-15-semantic-equivalence.md).
//
// It combines several LOCAL signals — essential entities, polarity, semantic
// similarity, engine confidence — and returns one of THREE states:
//   aligned | not_aligned | uncertain
// No single signal decides. When evidence is insufficient the result is
// `uncertain` (never fabricated into an error). Correctness never depends on
// USE being installed: hashing is treated as weak evidence (conservative → more
// `uncertain`). It is NOT an NLI / entailment engine and uses NO dictionaries,
// LLMs or remote APIs (§25).
//
// PURE: the caller (orchestrator) gathers the signals (encoder similarity,
// structural negations) and passes them in; this module does no I/O.

export const SEMANTIC_EQUIVALENCE_VERSION = 1

export const EQUIVALENCE_STATUSES = ['aligned', 'not_aligned', 'uncertain']

// Engine-aware alignment thresholds (§12/§13). Hashing similarity does not
// discriminate meaning, so only near-reproduction clears the bar; USE (or a
// controlled encoder) can clear paraphrases.
export const ALIGN_HIGH = Object.freeze({ hashing: 0.85, use: 0.70 })

const NEG_RE = /(?:^|[^a-z])(?:not|never|no|n't|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't)(?:$|[^a-z])|(?:anymore|no longer)/i

/** Conservative structural polarity of a sentence: 'negative' if it carries a
 * negation marker, else 'affirmative'. NOTE: idioms like "yet" encode negation
 * WITHOUT a marker — for those the target polarity must be AUTHORED. */
export function inferPolarityV2(text) {
  return NEG_RE.test(String(text || '')) ? 'negative' : 'affirmative'
}

function wordInText(text, word) {
  const re = new RegExp(`(?:^|[^a-z0-9])${String(word).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i')
  return re.test(String(text))
}

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFC').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Evaluate semantic equivalence. PURE.
 *
 * @param {object} p
 * @param {string} p.targetText           authored reference sentence
 * @param {string} p.responseText         learner production
 * @param {string[]} [p.essentialWords]   authored essential entities (necessary, not sufficient)
 * @param {number} [p.similarity]         cosine(response, target) in [0,1] (evidence only)
 * @param {'hashing'|'use'} [p.engine]    effective semantic engine
 * @param {'affirmative'|'negative'|null} [p.targetPolarity]  AUTHORED target polarity (reliable)
 * @param {'affirmative'|'negative'|null} [p.responsePolarity] structural response polarity
 * @returns {SemanticEquivalenceResultV2}
 */
export function evaluateSemanticEquivalenceV2({
  targetText,
  responseText,
  essentialWords = [],
  similarity = null,
  engine = 'hashing',
  targetPolarity = null,
  responsePolarity = null,
} = {}) {
  const reason_codes = []
  const essential = (essentialWords || []).filter((w) => typeof w === 'string' && w.trim())
  const missing = essential.filter((w) => !wordInText(responseText, w))
  const respPol = responsePolarity ?? inferPolarityV2(responseText)
  // Only trust polarity as a DECIDING signal when the target polarity is
  // authored (reliable). Inferred target polarity only contributes as weak
  // corroboration — never decides alone (§18 conservative).
  const tgtPolAuthored = targetPolarity === 'affirmative' || targetPolarity === 'negative'
  const threshold = ALIGN_HIGH[engine] ?? ALIGN_HIGH.hashing
  const simKnown = typeof similarity === 'number'

  const evidence = {
    essential_entities: { declared: essential, missing, preserved: essential.length > 0 && missing.length === 0 },
    polarity: { target: targetPolarity ?? null, target_authored: tgtPolAuthored, response: respPol, contradiction: tgtPolAuthored && respPol !== targetPolarity },
    semantic_similarity: { score: simKnown ? similarity : null, engine, threshold, meets_threshold: simKnown ? similarity >= threshold : false },
    intent: { available: false },
    structure: { normalized_exact: normalize(responseText) === normalize(targetText) },
  }

  const result = (status, confidence) => ({
    equivalence_version: SEMANTIC_EQUIVALENCE_VERSION,
    status,
    evidence,
    confidence: Math.round(confidence * 1e4) / 1e4,
    engine,
    reason_codes: [...reason_codes],
  })

  // 1. Exact / normalized reproduction → aligned.
  if (evidence.structure.normalized_exact) {
    reason_codes.push('EXACT_MATCH')
    return result('aligned', 0.95)
  }

  // 2. Authored polarity contradiction → not_aligned (unambiguous — §6/§24).
  if (evidence.polarity.contradiction) {
    reason_codes.push('POLARITY_CONTRADICTION')
    return result('not_aligned', 0.85)
  }

  // 3. A declared essential entity disappeared → not_aligned (§5). Missing
  // essential is strong negative evidence, independent of similarity.
  if (missing.length > 0) {
    reason_codes.push('MISSING_ESSENTIAL_ENTITY')
    return result('not_aligned', 0.8)
  }

  // 4. Essential preserved, no contradiction. Similarity is the remaining
  // evidence — but only HIGH, engine-appropriate similarity can confirm
  // alignment. Anything else is uncertain (never rejected on low similarity).
  if (essential.length > 0) reason_codes.push('ESSENTIAL_PRESERVED')
  if (simKnown && similarity >= threshold) {
    reason_codes.push('HIGH_SEMANTIC_OVERLAP')
    // Hashing overlap is weak evidence even above threshold → capped confidence.
    const confidence = engine === 'use' ? Math.min(0.9, 0.6 + similarity * 0.3) : 0.65
    return result('aligned', confidence)
  }

  reason_codes.push(simKnown ? 'INSUFFICIENT_SIMILARITY' : 'NO_SIMILARITY_SIGNAL')
  if (engine === 'hashing') reason_codes.push('HASHING_LOW_CONFIDENCE')
  return result('uncertain', 0.3)
}
