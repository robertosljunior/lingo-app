// benchmark-structural-nlp.mjs — compares wink-nlp vs Compromise on the labeled
// structural corpus and emits the decision report. Selection policy: one primary
// engine, chosen by structural accuracy then latency/bundle; the other kept only
// as a comparative/fallback adapter. Preference: wink primary unless evidence
// says otherwise.

import { STRUCTURAL_CORPUS } from '../content-authoring/validation-corpora/structural-benchmark-corpus.mjs'
import { WinkStructuralNlpAdapter, CompromiseStructuralNlpAdapter } from '../src/lib/language-analysis/structural-nlp-adapter.js'

async function scoreEngine(adapter) {
  let correct = 0, total = 0
  const failures = []
  const start = performance.now()
  for (const c of STRUCTURAL_CORPUS) {
    const s = await adapter.analyzeStructure(c.text)
    const got = {
      sentence_type: s.sentence_type,
      has_auxiliary: s.auxiliaries.length > 0,
      has_negation: s.negations.length > 0,
      third_singular_subject: s.subjects.some((x) => x.third_singular),
    }
    for (const key of Object.keys(c.labels)) {
      total++
      if (got[key] === c.labels[key]) correct++
      else if (failures.length < 20) failures.push({ text: c.text, key, expected: c.labels[key], got: got[key] })
    }
  }
  const latency_ms = +((performance.now() - start) / STRUCTURAL_CORPUS.length).toFixed(3)
  return { structural_accuracy: +(correct / total).toFixed(4), latency_ms, failures }
}

// Approx installed bundle sizes (node_modules on-disk, indicative only).
async function bundleBytes(pkg) {
  try {
    const { execSync } = await import('node:child_process')
    const out = execSync(`du -sb node_modules/${pkg} 2>/dev/null | cut -f1`).toString().trim()
    return Number(out) || 0
  } catch { return 0 }
}

const wink = await scoreEngine(new WinkStructuralNlpAdapter())
const compromise = await scoreEngine(new CompromiseStructuralNlpAdapter())
wink.bundle_bytes = await bundleBytes('wink-eng-lite-web-model') + await bundleBytes('wink-nlp')
compromise.bundle_bytes = await bundleBytes('compromise')

const selected_primary = wink.structural_accuracy >= compromise.structural_accuracy ? 'wink' : 'compromise'
const report = {
  corpus_size: STRUCTURAL_CORPUS.length,
  wink, compromise,
  selected_primary,
  reason: selected_primary === 'wink'
    ? `wink structural accuracy ${wink.structural_accuracy} >= compromise ${compromise.structural_accuracy}; kept Compromise as comparative/fallback adapter.`
    : `compromise structural accuracy ${compromise.structural_accuracy} > wink ${wink.structural_accuracy}.`,
}
console.log(JSON.stringify(report, null, 2))
