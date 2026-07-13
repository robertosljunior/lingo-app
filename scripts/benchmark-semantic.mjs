// benchmark-semantic.mjs — calibrate the semantic encoder on the labeled corpus.
// Reports mean similarity for match vs mismatch, the separation margin, a
// suggested threshold, ranking accuracy, and a PER-CATEGORY breakdown across the
// eight calibration categories. Runs on the hashing fallback by default (which is
// EXPECTED to discriminate weakly — it is only a coarse offline stand-in). A
// provisioned USE model can be passed to compare; USE similarities sit in a
// narrow high band, which is exactly why the pipeline uses per-frame thresholds
// and never fails free production on similarity alone.
//
// IMPORTANT: similarity is advisory only. In free mode it never reprova; in
// equivalent mode it is fused with negation/entities/tense/intent/grammar.

import { ALL_PAIRS, CATEGORY_COUNTS } from '../content-authoring/validation-corpora/semantic-calibration-corpus.mjs'
import { HashingSemanticEncoder } from '../src/lib/language-analysis/semantic-encoder-adapter.js'

async function similarity(encoder, a, b) {
  const ranked = await encoder.rank(a, [b])
  return ranked[0].score
}

const mean = (xs) => (xs.length ? +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(4) : null)

async function run(encoder, name) {
  const rows = []
  for (const p of ALL_PAIRS) rows.push({ ...p, sim: await similarity(encoder, p.a, p.b) })
  const binary = rows.filter((r) => r.label !== 'ambiguous')
  const matches = binary.filter((r) => r.label === 'match').map((r) => r.sim)
  const mismatches = binary.filter((r) => r.label === 'mismatch').map((r) => r.sim)
  const meanMatch = mean(matches)
  const meanMismatch = mean(mismatches)
  const threshold = +(((meanMatch + meanMismatch) / 2)).toFixed(4)
  let correct = 0
  for (const r of binary) if ((r.sim >= threshold ? 'match' : 'mismatch') === r.label) correct++

  // Per-category mean similarity (all pairs, incl. ambiguous).
  const byCat = {}
  for (const r of rows) (byCat[r.category] ||= []).push(r.sim)
  const per_category = Object.fromEntries(Object.entries(byCat).map(([c, xs]) => [c, { pairs: xs.length, mean_similarity: mean(xs) }]))

  return {
    engine: name,
    pairs: rows.length,
    binary_pairs: binary.length,
    category_counts: CATEGORY_COUNTS,
    mean_similarity_match: meanMatch,
    mean_similarity_mismatch: meanMismatch,
    separation_margin: meanMatch != null && meanMismatch != null ? +(meanMatch - meanMismatch).toFixed(4) : null,
    suggested_threshold: threshold,
    classification_accuracy: +(correct / binary.length).toFixed(4),
    per_category,
    caveat: 'Advisory only. Hashing is a coarse fallback (weak discrimination is EXPECTED); the pipeline uses per-frame thresholds and never fails free mode on low similarity. Equivalent mode fuses similarity with grammar/negation/entities/tense/intent.',
  }
}

const report = { hashing: await run(new HashingSemanticEncoder(), 'hashing') }
console.log(JSON.stringify(report, null, 2))
