#!/usr/bin/env node
// audit-adaptive-pacing-v2.mjs — Slice V2.21-R3b §3/§4/§21.
//
// After PR #51 the pipeline is no longer BLOCKED (controlled production is
// reachable), but the adaptive pace is slow: 60 activities of a learner who
// answers correctly still produce no writing and no scramble. This audit
// measures WHY, in terms of breadth vs depth:
//
//   - ACTIVE TARGET (§3): exposed, not yet consolidated at its current rung,
//     and not permanently blocked. How many are open at the same time?
//   - PACING (§4): new-target introductions per 12, deepen opportunities per
//     12, selected/available deepen ratio, and the time from first exposure to
//     each advancement.
//
// Read-only. Advisory. Never fails CI.
//
//   node scripts/audit-adaptive-pacing-v2.mjs [--scenario <id>] [--json]

import { runSimulationV2 } from '../src/lib/pedagogy-v2/simulation-runner.js'
import { buildStandardScenarioV2 } from '../src/lib/pedagogy-v2/simulation-scenarios.js'
import { loadPedagogyV2Registry } from '../src/lib/pedagogy-v2/registry.js'
import { CAPABILITY_LADDER } from '../src/lib/pedagogy-v2/capability-entry.js'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const scenarioId = (() => {
  const i = args.indexOf('--scenario')
  return i >= 0 ? args[i + 1] : 'real-successful-60'
})()
const WINDOW = 12

const registry = loadPedagogyV2Registry()
const scenario = buildStandardScenarioV2(scenarioId)
const result = await runSimulationV2(scenario, { registry })

// ---------- per-activity pacing series (§3) ----------
// "Deepened" here means the activity practised a target that had already been
// exposed before this step — the observable counterpart of the analytic
// definition, computed from the run itself rather than from planner internals.
const firstSeen = new Map()
const deepestCapability = new Map()
const series = []
let newTargets = 0
let deepenSelections = 0
let newSelections = 0

for (const it of result.interactions) {
  const target = it.target.target_id
  const isNew = !firstSeen.has(target)
  if (isNew) { firstSeen.set(target, it.index); newTargets += 1 }

  const prevDepth = deepestCapability.get(target) ?? -1
  const depth = CAPABILITY_LADDER.indexOf(it.capability)
  if (depth > prevDepth) deepestCapability.set(target, depth)

  if (it.study_focus.is_new_target) newSelections += 1
  else deepenSelections += 1

  // A target is ACTIVE while it has been exposed and has not yet reached the
  // controlled-production rung (the depth this slice is trying to reach).
  const active = [...deepestCapability.entries()]
    .filter(([, d]) => d < CAPABILITY_LADDER.indexOf('controlled_production'))
  const byRung = {}
  for (const [, d] of deepestCapability) {
    const name = CAPABILITY_LADDER[d] ?? 'unknown'
    byRung[name] = (byRung[name] || 0) + 1
  }

  series.push({
    activity: it.index,
    target,
    focus_type: it.study_focus.focus_type,
    capability: it.capability,
    recipe: it.recipe,
    first_seen_at: firstSeen.get(target),
    is_new_target: !!it.study_focus.is_new_target,
    active_target_count: active.length,
    new_targets_total: newTargets,
    targets_at_recognition: byRung.recognition || 0,
    targets_at_comprehension: byRung.comprehension || 0,
    targets_at_controlled: byRung.controlled_production || 0,
    targets_at_free: byRung.free_production || 0,
  })
}

// ---------- pacing rates (§4) ----------
const perWindow = []
for (let start = 0; start < series.length; start += WINDOW) {
  const slice = series.slice(start, start + WINDOW)
  if (!slice.length) continue
  perWindow.push({
    window: `${start + 1}-${start + slice.length}`,
    new_target_introductions: slice.filter((s) => s.is_new_target).length,
    deepen_selections: slice.filter((s) => !s.is_new_target).length,
    active_target_count_end: slice[slice.length - 1].active_target_count,
    capabilities: slice.reduce((acc, s) => { acc[s.capability] = (acc[s.capability] || 0) + 1; return acc }, {}),
  })
}

// Time (in activities) from first exposure of a target to each advancement.
const advancementLatency = {}
for (const cap of CAPABILITY_LADDER) {
  const deltas = []
  for (const [target, at] of firstSeen) {
    const reached = result.interactions.find((it) => it.target.target_id === target && it.capability === cap)
    if (reached) deltas.push(reached.index - at)
  }
  if (deltas.length) {
    advancementLatency[cap] = {
      targets_reaching: deltas.length,
      mean_activities_after_first_exposure: Math.round((deltas.reduce((a, c) => a + c, 0) / deltas.length) * 100) / 100,
      min: Math.min(...deltas), max: Math.max(...deltas),
    }
  }
}

const actives = series.map((s) => s.active_target_count)
const report = {
  audit_version: 1,
  scenario_id: scenario.scenario_id,
  activities: series.length,
  targets_exposed: firstSeen.size,
  active_target_max: actives.length ? Math.max(...actives) : 0,
  active_target_mean: actives.length ? Math.round((actives.reduce((a, c) => a + c, 0) / actives.length) * 100) / 100 : 0,
  new_target_selections: newSelections,
  deepen_selections: deepenSelections,
  new_to_deepen_ratio: deepenSelections ? Math.round((newSelections / deepenSelections) * 100) / 100 : null,
  capability_distribution: series.reduce((acc, s) => { acc[s.capability] = (acc[s.capability] || 0) + 1; return acc }, {}),
  recipe_distribution: series.reduce((acc, s) => { acc[s.recipe] = (acc[s.recipe] || 0) + 1; return acc }, {}),
  per_window: perWindow,
  advancement_latency: advancementLatency,
  series,
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`\n=== V2.21-R3b adaptive pacing — ${report.scenario_id} (${report.activities} activities) ===\n`)
  console.log(`targets exposed: ${report.targets_exposed} · active max: ${report.active_target_max} · active mean: ${report.active_target_mean}`)
  console.log(`new-target selections: ${report.new_target_selections} · deepen: ${report.deepen_selections} · new/deepen: ${report.new_to_deepen_ratio}`)
  console.log('capabilities:', JSON.stringify(report.capability_distribution))
  console.log('recipes:', JSON.stringify(report.recipe_distribution))
  console.log('\n--- per 12-activity window')
  console.table(report.per_window)
  console.log('\n--- activities from first exposure to each rung')
  console.table(report.advancement_latency)
  console.log('\n--- product trajectory (§22)')
  console.log(series.map((s) => `${String(s.activity + 1).padStart(3)} ${s.capability.padEnd(20)} ${s.recipe}`).join('\n'))
  console.log('\n(advisory audit — informational only, never fails CI)\n')
}
