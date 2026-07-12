// benchmark-semantic.mjs — calibrate the semantic encoder on labeled pairs.
// Reports mean similarity for match vs mismatch, the separation margin, a
// suggested threshold, and pair-ranking accuracy. Runs on the hashing fallback
// by default; pass a provisioned USE model to compare.
//
// IMPORTANT: similarity is advisory only. In free mode it never reprova; in
// equivalent mode it is combined with negation/entities/tense/intent/grammar.

import { SEMANTIC_PAIRS } from '../content-authoring/validation-corpora/semantic-calibration-corpus.mjs'
import { HashingSemanticEncoder } from '../src/lib/language-analysis/semantic-encoder-adapter.js'

async function similarity(encoder, a, b) {
  const ranked = await encoder.rank(a, [b])
  return ranked[0].score
}

async function run(encoder, name) {
  const rows = []
  for (const p of SEMANTIC_PAIRS) rows.push({ ...p, sim: await similarity(encoder, p.a, p.b) })
  const matches = rows.filter((r) => r.label === 'match').map((r) => r.sim)
  const mismatches = rows.filter((r) => r.label === 'mismatch').map((r) => r.sim)
  const mean = (xs) => +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(4)
  const meanMatch = mean(matches)
  const meanMismatch = mean(mismatches)
  const threshold = +(((meanMatch + meanMismatch) / 2)).toFixed(4)
  // Pair-ranking accuracy at the suggested threshold.
  let correct = 0
  for (const r of rows) {
    const predicted = r.sim >= threshold ? 'match' : 'mismatch'
    if (predicted === r.label) correct++
  }
  return {
    engine: name,
    pairs: rows.length,
    mean_similarity_match: meanMatch,
    mean_similarity_mismatch: meanMismatch,
    separation_margin: +(meanMatch - meanMismatch).toFixed(4),
    suggested_threshold: threshold,
    classification_accuracy: +(correct / rows.length).toFixed(4),
    hard_negatives: rows.filter((r) => r.kind === 'close_but_different').map((r) => ({ pair: `${r.a} ~ ${r.b}`, sim: r.sim })),
    caveat: 'Advisory only: free mode never fails on low similarity; equivalent mode fuses with grammar/negation/entities/tense/intent.',
  }
}

const report = { hashing: await run(new HashingSemanticEncoder(), 'hashing') }
console.log(JSON.stringify(report, null, 2))
