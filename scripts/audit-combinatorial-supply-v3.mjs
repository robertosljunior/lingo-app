#!/usr/bin/env node

import {
  auditCombinatorialCorpusV3,
  materializeCombinatorialCorpusV3,
} from '../src/lib/pedagogy-v3/combinatorial-supply.js'

const rows = materializeCombinatorialCorpusV3()
const audit = auditCombinatorialCorpusV3(rows)

console.log(JSON.stringify(audit, null, 2))

if (audit.total_realizations < 2000) {
  console.error(`V3_COMBINATORIAL_SUPPLY_BELOW_FLOOR:${audit.total_realizations}<2000`)
  process.exit(1)
}
if (audit.distinct_english_texts !== audit.total_realizations) {
  console.error(`V3_COMBINATORIAL_DUPLICATE_ENGLISH:${audit.distinct_english_texts}/${audit.total_realizations}`)
  process.exit(1)
}
if (audit.min_realizations_per_focus < 64) {
  console.error(`V3_COMBINATORIAL_FOCUS_DEPTH_BELOW_FLOOR:${audit.min_realizations_per_focus}<64`)
  process.exit(1)
}
