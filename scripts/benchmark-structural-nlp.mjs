// benchmark-structural-nlp.mjs — honest wink vs Compromise comparison.
//
// The Slice 7 benchmark shared a heuristic layer, so accuracies were nearly
// identical. This version extracts features DIRECTLY from each engine (no shared
// post-processing) for `raw_accuracy`, then measures `enriched_accuracy` (raw +
// the common deterministic enrichment used in production) separately.

import { STRUCTURAL_CORPUS } from '../content-authoring/validation-corpora/structural-benchmark-corpus.mjs'
import { HeuristicStructuralNlpAdapter } from '../src/lib/language-analysis/structural-nlp-adapter.js'
import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'
import compromise from 'compromise'

const AUX = new Set(['do', 'does', 'did', 'is', 'are', 'am', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must'])

// ---- RAW wink: read straight from wink POS tags, nothing shared ----
const wink = winkNLP(model)
const its = wink.its
function rawWinkAnalysis(text) {
  const doc = wink.readDoc(text)
  const tokens = doc.tokens().out()
  const pos = doc.tokens().out(its.pos)
  const lower = tokens.map((t) => t.toLowerCase())
  const has_auxiliary = pos.some((p, i) => p === 'AUX' || p === 'MD' || (p === 'VERB' && AUX.has(lower[i])))
  const has_negation = pos.includes('PART') && lower.some((t) => t === 'not' || t.endsWith("n't"))
    ? true
    : lower.some((t) => t === 'not' || t === 'never' || t.endsWith("n't"))
  const first = lower[0]
  const endsQ = /\?$/.test(text.trim())
  const sentence_type = endsQ || AUX.has(first) || ['what', 'where', 'when', 'why', 'who', 'how'].includes(first) ? 'question' : 'statement'
  const third_singular_subject = pos.some((p, i) => p === 'PRON' && ['he', 'she', 'it'].includes(lower[i]))
  return { has_auxiliary, has_negation, sentence_type, third_singular_subject }
}

// ---- RAW Compromise: read straight from compromise tags, nothing shared ----
function rawCompromiseAnalysis(text) {
  const doc = compromise(text)
  const terms = doc.json({ terms: true }).flatMap((s) => s.terms || [])
  const lower = terms.map((t) => (t.normal || t.text || '').toLowerCase())
  const tagset = terms.map((t) => new Set(t.tags || []))
  const has_auxiliary = tagset.some((tags, i) => tags.has('Auxiliary') || tags.has('Modal') || AUX.has(lower[i]))
  const has_negation = tagset.some((tags) => tags.has('Negative')) || lower.some((t) => t === 'not' || t === 'never' || t.endsWith("n't"))
  const first = lower[0]
  const endsQ = /\?$/.test(text.trim())
  const sentence_type = endsQ || AUX.has(first) || ['what', 'where', 'when', 'why', 'who', 'how'].includes(first) ? 'question' : 'statement'
  const third_singular_subject = tagset.some((tags, i) => tags.has('Pronoun') && ['he', 'she', 'it'].includes(lower[i]))
  return { has_auxiliary, has_negation, sentence_type, third_singular_subject }
}

const heuristic = new HeuristicStructuralNlpAdapter()
function enrich(rawFn, text) {
  // raw engine + common deterministic enrichment (production behavior).
  const raw = rawFn(text)
  const h = heuristic.analyzeStructure(text)
  return {
    has_auxiliary: raw.has_auxiliary || h.auxiliaries.length > 0,
    has_negation: raw.has_negation || h.negations.length > 0,
    sentence_type: h.sentence_type === 'imperative' ? raw.sentence_type : (raw.sentence_type || h.sentence_type),
    third_singular_subject: raw.third_singular_subject || h.subjects.some((s) => s.third_singular),
  }
}

function score(fn) {
  let correct = 0, total = 0
  const failures = []
  const start = performance.now()
  for (const c of STRUCTURAL_CORPUS) {
    const got = fn(c.text)
    for (const key of Object.keys(c.labels)) {
      total++
      if (got[key] === c.labels[key]) correct++
      else if (failures.length < 15) failures.push({ text: c.text, key, expected: c.labels[key], got: got[key] })
    }
  }
  return { accuracy: +(correct / total).toFixed(4), latency_ms: +((performance.now() - start) / STRUCTURAL_CORPUS.length).toFixed(3), failures }
}

async function bundleBytes(pkg) {
  try {
    const { execSync } = await import('node:child_process')
    return Number(execSync(`du -sb node_modules/${pkg} 2>/dev/null | cut -f1`).toString().trim()) || 0
  } catch { return 0 }
}
function memEstimate(fn) {
  if (global.gc) global.gc()
  const before = process.memoryUsage().heapUsed
  for (const c of STRUCTURAL_CORPUS) fn(c.text)
  return Math.max(0, process.memoryUsage().heapUsed - before)
}

const winkRaw = score(rawWinkAnalysis)
const winkEnriched = score((t) => enrich(rawWinkAnalysis, t))
const compRaw = score(rawCompromiseAnalysis)
const compEnriched = score((t) => enrich(rawCompromiseAnalysis, t))

const report = {
  corpus_size: STRUCTURAL_CORPUS.length,
  wink: {
    raw_accuracy: winkRaw.accuracy,
    enriched_accuracy: winkEnriched.accuracy,
    latency_ms: winkRaw.latency_ms,
    bundle_bytes: (await bundleBytes('wink-nlp')) + (await bundleBytes('wink-eng-lite-web-model')),
    memory_estimate: memEstimate(rawWinkAnalysis),
    raw_failures: winkRaw.failures,
  },
  compromise: {
    raw_accuracy: compRaw.accuracy,
    enriched_accuracy: compEnriched.accuracy,
    latency_ms: compRaw.latency_ms,
    bundle_bytes: await bundleBytes('compromise'),
    memory_estimate: memEstimate(rawCompromiseAnalysis),
    raw_failures: compRaw.failures,
  },
}

// Selection by raw accuracy first (which engine truly analyzes better), then
// latency, then bundle size.
let selected_primary, reason
const dAcc = report.wink.raw_accuracy - report.compromise.raw_accuracy
if (Math.abs(dAcc) >= 0.02) {
  selected_primary = dAcc > 0 ? 'wink' : 'compromise'
  reason = `raw structural accuracy differs by ${dAcc.toFixed(3)} in favor of ${selected_primary}.`
} else if (report.wink.latency_ms !== report.compromise.latency_ms) {
  selected_primary = report.wink.latency_ms <= report.compromise.latency_ms ? 'wink' : 'compromise'
  reason = `raw accuracy within 0.02 (${report.wink.raw_accuracy} vs ${report.compromise.raw_accuracy}); chose ${selected_primary} on lower latency.`
} else {
  selected_primary = report.wink.bundle_bytes <= report.compromise.bundle_bytes ? 'wink' : 'compromise'
  reason = `raw accuracy and latency comparable; chose ${selected_primary} on smaller bundle.`
}

report.selected_primary = selected_primary
report.reason = reason
report.fallback_policy = `${selected_primary === 'wink' ? 'Compromise' : 'wink'} kept as comparative/fallback adapter; used only on primary failure, never overrides confident primary evidence. Not both run by default.`
report.evidence = [
  `wink raw ${report.wink.raw_accuracy} / enriched ${report.wink.enriched_accuracy}`,
  `compromise raw ${report.compromise.raw_accuracy} / enriched ${report.compromise.enriched_accuracy}`,
]
console.log(JSON.stringify(report, null, 2))
