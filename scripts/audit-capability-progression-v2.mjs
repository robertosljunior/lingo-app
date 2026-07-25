#!/usr/bin/env node
// audit-capability-progression-v2.mjs — Slice V2.21-R3 §3…§12 and §27.
//
// The R2 audits proved WHAT the learner sees (variety). This one answers the
// R3 question: WHY a learner who answers correctly stays in recognition.
//
// It runs the REAL pipeline (no mocks, no forced plans, real response
// contract) and prints, per scenario:
//
//   §3  the per-interaction capability trace;
//   §4  evidence fragmentation (sense/construction, reading/listening,
//       supported/independent, direct/indirect, capability keys);
//   §5  introduction-group primary-target attribution;
//   §7  modality fragmentation;
//   §8  support fragmentation (which lane advancement actually waits for);
//   §9  the opportunity trace per target after its first recognition evidence;
//   §10 the classified cause per stuck target;
//   §11 the TARGET COMPLETION FUNNEL — the central R3 metric;
//   §12 the first blocking stage;
//   §27 the recipe reachability matrix.
//
// It CHANGES NOTHING and never fails CI: it is a measurement instrument.
//
//   node scripts/audit-capability-progression-v2.mjs [--json] [--scenario <id>]

import { runSimulationV2 } from '../src/lib/pedagogy-v2/simulation-runner.js'
import { buildStandardScenarioV2 } from '../src/lib/pedagogy-v2/simulation-scenarios.js'
import { loadPedagogyV2Registry } from '../src/lib/pedagogy-v2/registry.js'
import {
  analyzeCapabilityProgressionV2,
  DEFAULT_PROGRESSION_SCENARIOS,
} from '../src/lib/pedagogy-v2/capability-progression-analyzer.js'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const scenarioIds = (() => {
  const i = args.indexOf('--scenario')
  return i >= 0 ? [args[i + 1]] : [...DEFAULT_PROGRESSION_SCENARIOS]
})()

const registry = loadPedagogyV2Registry()
const reports = []

for (const scenarioId of scenarioIds) {
  const scenario = buildStandardScenarioV2(scenarioId, { registry })
  const result = await runSimulationV2(scenario, { registry })
  reports.push(analyzeCapabilityProgressionV2(result, { registry }))
}

if (asJson) {
  console.log(JSON.stringify({ reports }, null, 2))
  process.exit(0)
}

const show = (label, value) => {
  console.log(`\n--- ${label}`)
  console.dir(value, { depth: 8, maxArrayLength: 60 })
}

for (const r of reports) {
  console.log(`\n${'='.repeat(70)}\n${r.scenario_id} — ${r.interaction_count} interactions\n${'='.repeat(70)}`)

  console.log('\n--- capability trace (§3, first 12 + last 6)')
  const traceRows = [...r.trace.slice(0, 12), ...(r.trace.length > 18 ? [{ index: '…' }] : []), ...r.trace.slice(-6)]
  for (const t of traceRows) {
    if (t.index === '…') { console.log('   …'); continue }
    console.log(
      `  #${String(t.index).padStart(3)} s${t.session} ${t.pack.padEnd(18)} ${t.recipe.padEnd(22)}`
      + ` ${t.capability}/${t.modality}/${t.support_tier} ${t.outcome.padEnd(9)}`
      + ` → ${t.primary_target} [w=${t.direct_weight}] lane=${t.lane_after.capability_key}`
      + ` ew=${t.lane_after.effective_weight} m=${t.lane_after.mastery_estimate} lvl=${t.lane_after.evidence_level}`,
    )
  }

  show('target completion funnel (§11)', r.funnel)
  show('first blocking stage (§12)', r.first_block)
  show('evidence fragmentation (§4)', r.fragmentation)
  show('introduction-group primary attribution (§5)', r.introduction_groups)
  show('modality fragmentation (§7)', r.modality_fragmentation)
  show('support fragmentation (§8)', r.support_fragmentation)
  show('opportunity trace (§9)', r.opportunity_summary)
  show('classified causes (§10)', r.causes)
  show('recipe reachability matrix (§27)', r.recipe_matrix)
  if (r.findings.length) show('findings', r.findings)
}

console.log('\n(advisory audit — informational only, never fails CI)')
