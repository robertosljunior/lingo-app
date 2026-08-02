#!/usr/bin/env node
// audit-practice-collections-v2.mjs — Slice V2.22-UX2 §29.
//
// The editorial navigation layer is the one part of V2 a human authors by hand
// against ids they cannot see, so it needs a machine check: does every member
// still resolve, does every context still have real depth, does a context
// genuinely cross the internal curriculum, and did a technical name leak into
// learner-facing copy?
//
// Unlike the other V2 audits this one HARD FAILS (exit 1). A collection that
// points at a deleted exemplar, or a card labelled with a pack id, is a build
// defect — it would ship a broken or dishonest Home. Coverage findings (orphan
// exemplars, single-pack contexts) stay advisory: those are editorial calls.
//
//   node scripts/audit-practice-collections-v2.mjs [--json]

import { auditPracticeCollectionsV2 } from '../src/lib/pedagogy-v2/practice-collections-audit.js'
import { buildStudyScopeFromCollectionV2 } from '../src/lib/pedagogy-v2/study-scope.js'
import { loadPracticeCollectionsV2 } from '../src/lib/pedagogy-v2/practice-collections.js'
import { loadPedagogyV2Registry } from '../src/lib/pedagogy-v2/registry.js'

const asJson = process.argv.includes('--json')
const registry = loadPedagogyV2Registry()
const report = auditPracticeCollectionsV2({ registry })

// §28.3 / §29 — every collection must also be able to BECOME a scope. A
// catalogue that audits clean but cannot produce a usable scope would fail only
// at runtime, in front of a learner.
const scopeRows = loadPracticeCollectionsV2().collections.map((c) => {
  const scope = buildStudyScopeFromCollectionV2(c.collection_id, registry)
  return {
    collection_id: c.collection_id,
    scope_ok: !!scope && !scope.error,
    scope_error: scope?.error ?? null,
    allowed_exemplars: scope?.allowed_exemplar_ids?.length ?? 0,
    allowed_targets: scope?.allowed_target_ids?.length ?? 0,
    allowed_packs: scope?.allowed_pack_ids?.length ?? 0,
  }
})
const scopeFailures = scopeRows.filter((r) => !r.scope_ok)
  .map((r) => ({ code: 'COLLECTION_SCOPE_UNBUILDABLE', collection_id: r.collection_id, reason: r.scope_error }))

const failures = [...report.failures, ...scopeFailures]
const out = { ...report, ok: failures.length === 0, failures, scopes: scopeRows }

if (asJson) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log('\nPractice Collections V2 — editorial audit\n')
  console.log('  collection                          exemplars  constructions  packs  spans')
  for (const r of out.collections) {
    const scope = scopeRows.find((s) => s.collection_id === r.collection_id)
    console.log(
      `  ${r.collection_id.padEnd(34)} ${String(r.exemplars).padStart(9)} ${String(r.constructions).padStart(14)}`
      + ` ${String(r.internal_packs).padStart(6)}  ${r.spans_multiple_packs ? 'yes' : 'NO '}`
      + `   targets=${scope?.allowed_targets ?? '?'}`,
    )
  }
  const c = out.coverage
  console.log(`\n  coverage: ${c.exemplars_in_a_collection}/${c.authored_exemplars} authored exemplars are in at least one collection`
    + ` (${c.orphan_exemplars} orphan, advisory)`)
  for (const f of out.findings) console.log(`  advisory — ${f.code}: ${JSON.stringify(f.collection_ids ?? f.count)}`)
  if (out.failures.length) {
    console.log('\n  FAILURES:')
    for (const f of out.failures) console.log(`   ✗ ${f.code} ${JSON.stringify(f)}`)
  } else {
    console.log('\n  no structural failures.')
  }
}

process.exit(out.ok ? 0 : 1)
