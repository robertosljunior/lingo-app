#!/usr/bin/env node
// audit-catalog-scale-v2.mjs — Slice V2.21-R3c §3/§4/§6/§12.
//
// The PR #52 blocker: the SAME successful learner, over the SAME horizon, with
// the SAME seed and the same correct answers, progresses to controlled
// production at 3 and 6 packs but collapses back to recognition-only at 9. If
// that is real, the planner depends on the catalogue being small — which blocks
// V2.22 (Collocation Foundation) before it starts.
//
// This audit formalises the synthetic scale harness (§3) as a permanent,
// repeatable measurement: 3 / 6 / 9 / 12 packs, everything else held constant.
// Synthetic packs exist only here (see synthetic-scale-catalog.js); the product
// registry is untouched.
//
// It also implements §4 (first divergence) and §6 (cross-pack exemption growth),
// because "with more packs it gets diluted" is not an acceptable explanation —
// we need to know WHICH candidate wins and WHY.
//
// Read-only. Advisory. Never fails CI.
//
//   node scripts/audit-catalog-scale-v2.mjs [--json] [--diverge] [--packs 3,6,9,12]

import { runSimulationV2 } from '../src/lib/pedagogy-v2/simulation-runner.js'
import { buildStandardScenarioV2 } from '../src/lib/pedagogy-v2/simulation-scenarios.js'
import {
  buildSyntheticScaleRegistryV2, SYNTHETIC_SCALE_PACK_COUNTS,
} from '../src/lib/pedagogy-v2/synthetic-scale-catalog.js'
import { CAPABILITY_LADDER } from '../src/lib/pedagogy-v2/capability-entry.js'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const withDivergence = args.includes('--diverge') || asJson
const packCounts = (() => {
  const i = args.indexOf('--packs')
  if (i < 0) return SYNTHETIC_SCALE_PACK_COUNTS
  return args[i + 1].split(',').map((n) => Number(n.trim()))
})()

const CONTROLLED = CAPABILITY_LADDER.indexOf('controlled_production')

/** One scale point: run the real 60-activity successful journey over N packs. */
export async function runScalePoint(packCount, { scenarioId = 'real-successful-60' } = {}) {
  const registry = buildSyntheticScaleRegistryV2(packCount)
  const scenario = buildStandardScenarioV2(scenarioId)
  const result = await runSimulationV2(scenario, { registry })

  const firstSeen = new Map()
  const deepest = new Map()
  const capabilities = {}
  const recipes = {}
  const focusTypes = {}
  const targetCounts = new Map()
  const exemplarCounts = new Map()
  const activeSeries = []
  let immediateRepeat = 0
  let previousTarget = null
  let introductions = 0
  let crossPack = 0

  for (const it of result.interactions) {
    const target = it.target.target_id
    if (!firstSeen.has(target)) firstSeen.set(target, it.index)
    const depth = CAPABILITY_LADDER.indexOf(it.capability)
    if (depth > (deepest.get(target) ?? -1)) deepest.set(target, depth)

    capabilities[it.capability] = (capabilities[it.capability] || 0) + 1
    recipes[it.recipe] = (recipes[it.recipe] || 0) + 1
    const ft = it.study_focus.focus_type
    focusTypes[ft] = (focusTypes[ft] || 0) + 1
    if (it.study_focus.is_new_target) introductions += 1
    if (ft === 'cross_pack_progression') crossPack += 1

    targetCounts.set(target, (targetCounts.get(target) || 0) + 1)
    const exemplarId = it.activity_plan?.exemplar_id ?? it.exemplar_id
    if (exemplarId) exemplarCounts.set(exemplarId, (exemplarCounts.get(exemplarId) || 0) + 1)
    if (previousTarget === target) immediateRepeat += 1
    previousTarget = target

    activeSeries.push([...deepest.values()].filter((d) => d < CONTROLLED).length)
  }

  const total = result.interactions.length
  const topTarget = Math.max(0, ...targetCounts.values())
  const registryTargets = new Set()
  for (const pack of registry.packs) {
    for (const e of pack.exemplars || []) for (const t of e.pedagogical_targets || []) registryTargets.add(t.target_id)
  }

  return {
    packs: packCount,
    activities: total,
    total_targets: registryTargets.size,
    exposed_targets: firstSeen.size,
    assessed_targets: deepest.size,
    active_mean: activeSeries.length
      ? Math.round((activeSeries.reduce((a, c) => a + c, 0) / activeSeries.length) * 100) / 100 : 0,
    active_max: activeSeries.length ? Math.max(...activeSeries) : 0,
    introductions,
    cross_pack_selections: crossPack,
    deepen_selections: total - introductions,
    capability_distribution: capabilities,
    recipe_distribution: recipes,
    focus_distribution: focusTypes,
    top_target_share: total ? Math.round((topTarget / total) * 1000) / 1000 : 0,
    unique_targets: targetCounts.size,
    unique_exemplars: exemplarCounts.size,
    immediate_repeat: immediateRepeat,
    recognition_only: Object.keys(capabilities).length === 1 && !!capabilities.recognition,
    trajectory: result.interactions.map((it) => ({
      activity: it.index,
      focus_type: it.study_focus.focus_type,
      pack_id: it.pack_id ?? it.study_focus.pack_id ?? null,
      target: it.target.target_id,
      capability: it.capability,
      recipe: it.recipe,
      is_new_target: !!it.study_focus.is_new_target,
    })),
  }
}

/**
 * §4 — the FIRST activity at which the structural trajectory diverges between
 * two scale points. Structural means (focus_type, capability, is_new_target):
 * the pack/target ids differ trivially once clones exist, but the SHAPE of the
 * decision is directly comparable.
 */
function firstDivergence(a, b) {
  const n = Math.min(a.trajectory.length, b.trajectory.length)
  for (let i = 0; i < n; i++) {
    const x = a.trajectory[i]
    const y = b.trajectory[i]
    const same = x.focus_type === y.focus_type && x.capability === y.capability
      && x.is_new_target === y.is_new_target
    if (!same) {
      return {
        activity: i,
        [`packs_${a.packs}`]: x,
        [`packs_${b.packs}`]: y,
      }
    }
  }
  return null
}

const points = []
for (const n of packCounts) points.push(await runScalePoint(n))

const report = {
  audit_version: 1,
  scenario_id: 'golden:real-successful-60',
  scale_points: points.map(({ trajectory, ...rest }) => rest),
  scale_curve: points.map((p) => ({
    packs: p.packs, exposed: p.exposed_targets, active_mean: p.active_mean,
    introductions: p.introductions, deepen: p.deepen_selections,
    rec: p.capability_distribution.recognition || 0,
    comp: p.capability_distribution.comprehension || 0,
    controlled: p.capability_distribution.controlled_production || 0,
  })),
  diversity_curve: points.map((p) => ({
    packs: p.packs, top_target_share: p.top_target_share, unique_targets: p.unique_targets,
    unique_exemplars: p.unique_exemplars, immediate_repeat: p.immediate_repeat,
  })),
  cross_pack_curve: points.map((p) => ({
    packs: p.packs, cross_pack_selections: p.cross_pack_selections,
    introductions: p.introductions,
    cross_pack_share: p.activities ? Math.round((p.cross_pack_selections / p.activities) * 1000) / 1000 : 0,
  })),
  recognition_only_collapse: points.filter((p) => p.recognition_only).map((p) => p.packs),
  first_divergence: withDivergence && points.length > 1
    ? firstDivergence(points[0], points[points.length - 1]) : null,
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`\n=== V2.21-R3c catalogue scale — ${report.scenario_id} ===\n`)
  console.log('--- §12 scale curve')
  console.table(report.scale_curve)
  console.log('--- §12 diversity curve')
  console.table(report.diversity_curve)
  console.log('--- §6 cross-pack exemption growth')
  console.table(report.cross_pack_curve)
  console.log(`\nrecognition-only collapse at: ${report.recognition_only_collapse.length ? report.recognition_only_collapse.join(', ') + ' packs' : 'none'}`)
  if (report.first_divergence) {
    console.log('\n--- §4 first structural divergence')
    console.log(JSON.stringify(report.first_divergence, null, 2))
  }
  console.log('\n(advisory audit — informational only, never fails CI)\n')
}
