// inspect-learner-v2.mjs — read-only Learner Inspector CLI (Slice V2.7).
// Works over an EXPLICIT fixture/snapshot or a freshly-simulated journey; it
// NEVER reads the browser's IndexedDB from Node. Output is deterministic.
//
//   node scripts/inspect-learner-v2.mjs --fixture path.json [--target ID] [--lexeme ID] [--format text|json]
//   node scripts/inspect-learner-v2.mjs --scenario new-learner [--interactions 40]
//
// A fixture is { now, mode?, learner_states: [...], recent_evidence: [...] }.

import { readFileSync } from 'node:fs'
import {
  buildLearnerInspectorSnapshotV2, inspectTargetV2, inspectLexemeV2, explainStudyFocusV2,
} from '../src/lib/pedagogy-v2/learner-inspector.js'
import { runSimulationV2 } from '../src/lib/pedagogy-v2/simulation-runner.js'
import { buildStandardScenarioV2, STANDARD_SCENARIO_IDS } from '../src/lib/pedagogy-v2/simulation-scenarios.js'

function parseArgs(argv) {
  const args = { fixture: null, scenario: null, target: null, lexeme: null, format: 'text', interactions: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; const eat = () => argv[++i]
    if (a.startsWith('--fixture')) args.fixture = a.includes('=') ? a.split('=')[1] : eat()
    else if (a.startsWith('--scenario')) args.scenario = a.includes('=') ? a.split('=')[1] : eat()
    else if (a.startsWith('--target')) args.target = a.includes('=') ? a.split('=')[1] : eat()
    else if (a.startsWith('--lexeme')) args.lexeme = a.includes('=') ? a.split('=')[1] : eat()
    else if (a.startsWith('--interactions')) args.interactions = Number(a.includes('=') ? a.split('=')[1] : eat())
    else if (a.startsWith('--format')) args.format = a.includes('=') ? a.split('=')[1] : eat()
  }
  return args
}

async function loadSource(args) {
  if (args.fixture) {
    const fx = JSON.parse(readFileSync(args.fixture, 'utf8'))
    return {
      learnerStates: fx.learner_states || [],
      recentEvidence: fx.recent_evidence || [],
      now: fx.now || new Date(0).toISOString(),
      mode: fx.mode || 'adaptive',
      capabilities: fx.runtime_capabilities || null,
    }
  }
  if (args.scenario) {
    if (!STANDARD_SCENARIO_IDS.includes(args.scenario)) throw new Error(`Unknown scenario: ${args.scenario}`)
    const overrides = Number.isInteger(args.interactions) ? { maximum_interactions: args.interactions } : {}
    const result = await runSimulationV2(buildStandardScenarioV2(args.scenario, overrides))
    return {
      learnerStates: result.final_learner_states,
      recentEvidence: result.evidence_generated.slice(-100),
      now: result.interactions.length ? result.interactions[result.interactions.length - 1].timestamp : new Date(0).toISOString(),
      mode: 'adaptive',
      capabilities: result.scenario.runtime_capabilities,
    }
  }
  throw new Error('Provide --fixture <path> or --scenario <id>.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const src = await loadSource(args)

  if (args.target) {
    const view = inspectTargetV2(args.target, { learnerStates: src.learnerStates })
    console.log(args.format === 'json' ? JSON.stringify(view, null, 2) : renderTarget(view))
    return
  }
  if (args.lexeme) {
    const view = inspectLexemeV2(args.lexeme, { learnerStates: src.learnerStates })
    console.log(args.format === 'json' ? JSON.stringify(view, null, 2) : JSON.stringify(view, null, 2))
    return
  }

  const snapshot = buildLearnerInspectorSnapshotV2({
    learnerStates: src.learnerStates, recentEvidence: src.recentEvidence, now: src.now,
    mode: src.mode, runtimeCapabilities: src.capabilities,
  })
  if (args.format === 'json') { console.log(JSON.stringify(snapshot, null, 2)); return }

  const lines = ['# Learner Inspector snapshot', '', '## Lexemes']
  for (const lx of snapshot.lexemes) {
    lines.push(`  ${lx.lemma} (${lx.pack_id}): ${lx.senses_encountered.length} senses, ${lx.constructions_encountered.length} constructions, ${lx.functions_encountered.length} functions · last contact ${lx.last_contact || '—'}`)
  }
  lines.push('', `## Targets (${snapshot.targets.length})`)
  for (const t of snapshot.targets) {
    lines.push(`  ${t.target_id} [${t.kind}] exposure=${t.exposure.count} caps=${Object.keys(t.capabilities).join(',') || 'none'}`)
  }
  lines.push('', `## Review queue (${snapshot.review_queue.length})`)
  for (const r of snapshot.review_queue.slice(0, 10)) lines.push(`  ${r.lemma} · ${r.capability_label} · ${r.human_reason}`)
  lines.push('', '## Planner')
  if (snapshot.planner?.selected_focus) {
    const ex = explainStudyFocusV2(snapshot.planner.selected_focus, { learnerStates: src.learnerStates })
    lines.push(`  next focus: ${ex.headline}`)
    for (const reason of ex.reasons) lines.push(`    - ${reason}`)
    lines.push(`  candidates: ${snapshot.planner.candidate_count} · filtered: ${snapshot.planner.filtered.length}`)
  } else {
    lines.push(`  status: ${snapshot.planner?.status || 'n/a'}`)
  }
  console.log(lines.join('\n'))
}

function renderTarget(v) {
  const lines = [`# ${v.target_id} [${v.kind}] owner=${v.owner_pack_id}`, `exposure: ${v.exposure.count}`]
  for (const [capKey, cap] of Object.entries(v.capabilities)) {
    lines.push(`  ${capKey}: overall=${cap.overall?.evidence_level}/${cap.overall?.mastery_estimate} supported=${cap.supported?.evidence_level} independent=${cap.independent?.evidence_level} trend=${cap.overall?.trend}`)
  }
  return lines.join('\n')
}

main().catch((e) => { console.error(String(e?.stack || e)); process.exit(1) })
