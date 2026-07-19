// simulate-pedagogy-v2.mjs — deterministic pedagogy V2 simulation CLI
// (Slice V2.7). Read-only: runs artificial learner journeys through the REAL
// planner/engine/assessment/evidence pipeline over an in-memory model. NEVER
// touches the user's IndexedDB, never reads Date.now in the core, never sends
// anything over the network. Output is deterministic.
//
//   node scripts/simulate-pedagogy-v2.mjs --scenario new-learner --format text
//   node scripts/simulate-pedagogy-v2.mjs --scenario all --format json
//   node scripts/simulate-pedagogy-v2.mjs --scenario new-learner --interactions 20 --seed s
//
// Exit non-zero ONLY on: crash, invariant violation, or non-determinism.
// Trajectory warnings never fail the process.

import { runSimulationV2 } from '../src/lib/pedagogy-v2/simulation-runner.js'
import { computePedagogicalMetricsV2 } from '../src/lib/pedagogy-v2/pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from '../src/lib/pedagogy-v2/trajectory-analyzer.js'
import { STANDARD_SCENARIO_IDS, buildStandardScenarioV2 } from '../src/lib/pedagogy-v2/simulation-scenarios.js'
import { serializeScenarioV2 } from '../src/lib/pedagogy-v2/simulation-contracts.js'

function parseArgs(argv) {
  const args = { scenario: 'new-learner', format: 'text', interactions: null, seed: null, determinism: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const eat = () => argv[++i]
    if (a === '--scenario' || a.startsWith('--scenario=')) args.scenario = a.includes('=') ? a.split('=')[1] : eat()
    else if (a === '--format' || a.startsWith('--format=')) args.format = a.includes('=') ? a.split('=')[1] : eat()
    else if (a === '--interactions' || a.startsWith('--interactions=')) args.interactions = Number(a.includes('=') ? a.split('=')[1] : eat())
    else if (a === '--seed' || a.startsWith('--seed=')) args.seed = a.includes('=') ? a.split('=')[1] : eat()
    else if (a === '--check-determinism') args.determinism = true
  }
  return args
}

async function runOne(id, args) {
  const overrides = {}
  if (Number.isInteger(args.interactions) && args.interactions > 0) overrides.maximum_interactions = args.interactions
  if (args.seed != null) overrides.seed = args.seed
  const scenario = buildStandardScenarioV2(id, overrides)
  const result = await runSimulationV2(scenario)
  const metrics = computePedagogicalMetricsV2(result)
  const { trajectory, findings } = analyzeTrajectoryV2(result)

  // Determinism self-check: a second run must be byte-identical on metrics.
  if (args.determinism) {
    const again = computePedagogicalMetricsV2(await runSimulationV2(buildStandardScenarioV2(id, overrides)))
    if (JSON.stringify(again) !== JSON.stringify(metrics)) {
      throw new Error(`NON_DETERMINISM:${id}`)
    }
  }
  return { scenario_id: scenario.scenario_id, serialized_scenario_hashlen: serializeScenarioV2(scenario).length, interactions: result.interactions.length, metrics, trajectory, findings }
}

function printText(summary) {
  const lines = []
  lines.push(`# ${summary.scenario_id} — ${summary.interactions} interactions`)
  const m = summary.metrics
  lines.push(`  target isolation: ${m.target_isolation_rate.rate} (${m.target_isolation_rate.numerator}/${m.target_isolation_rate.denominator})`)
  lines.push(`  capability depth: ${JSON.stringify(m.capability_depth)}`)
  lines.push(`  modality balance: ${JSON.stringify(m.modality_balance.counts)} · unpracticed available: ${m.modality_balance.unpracticed_available.join(',') || 'none'}`)
  lines.push(`  review ratio: ${m.review_ratio.ratio} · pack switches: ${m.pack_switch.count} ${JSON.stringify(m.pack_switch.reasons)}`)
  lines.push(`  cross-pack transfer: ${m.cross_pack_transfer.total}`)
  lines.push(`  repetition (target/pack/modality): ${m.repetition_pressure.same_target}/${m.repetition_pressure.same_pack}/${m.repetition_pressure.same_modality}`)
  const bySeverity = { error: [], warning: [], info: [] }
  for (const f of summary.findings) bySeverity[f.severity].push(f.code)
  lines.push(`  findings — error: ${bySeverity.error.join(',') || 'none'} · warning: ${[...new Set(bySeverity.warning)].join(',') || 'none'}`)
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const ids = args.scenario === 'all' ? STANDARD_SCENARIO_IDS : [args.scenario]
  for (const id of ids) {
    if (!STANDARD_SCENARIO_IDS.includes(id)) {
      console.error(`Unknown scenario: ${id}. Known: ${STANDARD_SCENARIO_IDS.join(', ')}`)
      process.exit(2)
    }
  }
  const summaries = []
  let graveTotal = 0
  for (const id of ids) {
    const summary = await runOne(id, args)
    graveTotal += summary.findings.filter((f) => f.severity === 'error').length
    summaries.push(summary)
  }

  if (args.format === 'json') {
    console.log(JSON.stringify({ simulate_version: 1, scenarios: summaries }, null, 2))
  } else {
    console.log(summaries.map(printText).join('\n\n'))
    console.log('')
    console.log(graveTotal ? `✗ ${graveTotal} grave finding(s) across ${summaries.length} scenario(s).` : `All ${summaries.length} scenario(s) ran with no grave findings (warnings are informational).`)
  }

  // Grave findings (invariant-level) fail the process; warnings never do.
  if (graveTotal) process.exit(1)
}

main().catch((e) => { console.error(String(e?.stack || e)); process.exit(1) })
