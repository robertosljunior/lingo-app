#!/usr/bin/env node
// audit-practice-dynamics-v2.mjs — Slice V2.21 §1/§2/§13/§15/§18.
//
// Reproduces the REAL reported journey (5 sittings x 12 activities, a learner
// who answers correctly) through the REAL pipeline and prints:
//
//   1. the chronological trace of all 60 activities (planner focus, engine
//      candidate pool, acceptable band, exemplar recency, evidence);
//   2. the repetition metrics (§13);
//   3. the acceptable-band distribution (§9);
//   4. the capability trajectory (§15);
//   5. the recipe reachability / starvation finding (§18).
//
// It CHANGES NOTHING. It is a measurement instrument: run it before and after a
// fix and compare. Advisory — it never fails CI.
//
//   node scripts/audit-practice-dynamics-v2.mjs [--json] [--scenario <id>]

import { runSimulationV2 } from '../src/lib/pedagogy-v2/simulation-runner.js'
import { buildStandardScenarioV2 } from '../src/lib/pedagogy-v2/simulation-scenarios.js'
import { loadPedagogyV2Registry } from '../src/lib/pedagogy-v2/registry.js'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const scenarioId = (() => {
  const i = args.indexOf('--scenario')
  return i >= 0 ? args[i + 1] : 'real-successful-60'
})()
const SESSION_SIZE = 12

const registry = loadPedagogyV2Registry()

function sessionIndexOf(i) { return Math.floor(i / SESSION_SIZE) }

/** Longest run of consecutive equal values in a list. */
function maxStreak(values) {
  let best = 0; let cur = 0; let prev
  for (const v of values) {
    if (v != null && v === prev) cur += 1
    else cur = 1
    prev = v
    if (cur > best) best = cur
  }
  return best
}

function rate(n, d) { return d ? Math.round((n / d) * 1000) / 1000 : 0 }

function buildMetrics(interactions) {
  const n = interactions.length
  const texts = interactions.map((it) => it.activity_plan_text ?? null)
  const exemplars = interactions.map((it) => it.activity_plan.exemplar_id)
  const targets = interactions.map((it) => it.target.target_id)
  const constructions = interactions.map((it) => it.activity_plan.construction_id)
  const packs = interactions.map((it) => it.pack_after)
  const recipes = interactions.map((it) => it.recipe)
  const focusKeys = interactions.map((it) => {
    const f = it.study_focus
    return [f.pack_id, f.focus_type, f.target?.target_id ?? '-', f.capability ?? '-', f.modality ?? '-'].join('|')
  })

  const count = (list) => { const m = new Map(); for (const v of list) m.set(v, (m.get(v) || 0) + 1); return m }
  const repeats = (list) => [...count(list).values()].reduce((a, c) => a + (c - 1), 0)
  const immediate = (list) => list.filter((v, i) => i > 0 && v === list[i - 1]).length

  // Rolling window of 12 (one sitting worth) — unique exemplars per window.
  const rolling = []
  for (let i = 0; i + SESSION_SIZE <= n; i++) {
    rolling.push(new Set(exemplars.slice(i, i + SESSION_SIZE)).size)
  }

  const focusSwitches = focusKeys.filter((v, i) => i > 0 && v !== focusKeys[i - 1]).length

  return {
    interactions: n,
    exact_text_repeat_rate: rate(repeats(texts.filter(Boolean)), n),
    immediate_exact_repeat_rate: rate(immediate(texts), n),
    exemplar_repeat_rate: rate(repeats(exemplars), n),
    unique_exemplar_ratio: rate(new Set(exemplars).size, n),
    unique_exemplars: new Set(exemplars).size,
    rolling_12_unique_exemplars: {
      min: rolling.length ? Math.min(...rolling) : null,
      mean: rolling.length ? Math.round((rolling.reduce((a, c) => a + c, 0) / rolling.length) * 100) / 100 : null,
      max: rolling.length ? Math.max(...rolling) : null,
    },
    target_streak_max: maxStreak(targets),
    construction_streak_max: maxStreak(constructions),
    pack_streak_max: maxStreak(packs),
    recipe_streak_max: maxStreak(recipes),
    focus_repeat_rate: rate(repeats(focusKeys), n),
    focus_switch_rate: rate(focusSwitches, Math.max(1, n - 1)),
    top_texts: [...count(texts.filter(Boolean))].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([text, c]) => ({ text, count: c, share: rate(c, n) })),
    top_exemplars: [...count(exemplars)].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, c]) => ({ exemplar_id: id, count: c, share: rate(c, n) })),
    recipe_distribution: Object.fromEntries([...count(recipes)].sort((a, b) => b[1] - a[1])),
    capability_distribution: Object.fromEntries([...count(interactions.map((it) => it.capability))].sort((a, b) => b[1] - a[1])),
    modality_distribution: Object.fromEntries([...count(interactions.map((it) => it.modality))].sort((a, b) => b[1] - a[1])),
  }
}

/** §9 — how many realizations existed before vs after the acceptable band. */
function bandDistribution(interactions) {
  const buckets = { 1: 0, 2: 0, 3: 0, '4+': 0 }
  const collapsed = [] // same_focus >= 3 but band == 1 → the band killed variety
  let withPool = 0
  for (const it of interactions) {
    const pool = it.engine_diversity?.pool
    if (!pool || pool.band_size == null) continue
    withPool += 1
    const b = pool.band_size
    buckets[b >= 4 ? '4+' : String(b)] += 1
    if ((pool.same_focus_candidates ?? 0) >= 3 && b === 1) {
      collapsed.push({ index: it.index, same_focus: pool.same_focus_candidates, band: b })
    }
  }
  return {
    measured_steps: withPool,
    band_size_distribution: buckets,
    band_collapsed_steps: collapsed.length,
    band_collapsed_examples: collapsed.slice(0, 8),
    mean_same_focus_candidates: withPool
      ? Math.round((interactions.reduce((a, it) => a + (it.engine_diversity?.pool?.same_focus_candidates ?? 0), 0) / withPool) * 100) / 100
      : null,
    steps_with_zero_fresh: interactions.filter((it) => it.engine_diversity?.pool?.fresh_candidates === 0).length,
  }
}

/** §15 — where the capability trajectory stops, per sitting. */
function capabilityTrajectory(interactions) {
  const perSession = []
  for (let s = 0; s * SESSION_SIZE < interactions.length; s++) {
    const slice = interactions.slice(s * SESSION_SIZE, (s + 1) * SESSION_SIZE)
    const caps = {}
    for (const it of slice) caps[it.capability] = (caps[it.capability] || 0) + 1
    perSession.push({ session: s + 1, capabilities: caps, recipes: [...new Set(slice.map((it) => it.recipe))].sort() })
  }
  return perSession
}

/**
 * §18 — RECIPE_REACHABLE_BUT_STARVED. A recipe counts as reachable when the
 * planner produced a candidate for its capability at least once (the gate was
 * open) and the engine listed it among the scored candidates — yet across the
 * whole run it was never selected.
 */
function recipeStarvation(interactions) {
  const selected = new Set(interactions.map((it) => it.recipe))
  const offeredCapabilities = new Set()
  for (const it of interactions) {
    for (const d of it.eligible_domains || []) offeredCapabilities.add(d.split('_')[0])
  }
  const CONTROLLED = ['fixed_element_completion', 'word_order_reconstruction', 'guided_production']
  const FREE = ['free_production']
  const findings = []
  for (const r of [...CONTROLLED, ...FREE]) {
    const capability = FREE.includes(r) ? 'free_production' : 'controlled_production'
    const gateOpen = offeredCapabilities.has(capability)
    if (selected.has(r)) continue
    findings.push({
      recipe: r,
      capability,
      code: gateOpen ? 'ELIGIBLE_BUT_STARVED' : 'NOT_YET_ELIGIBLE',
      detail: gateOpen
        ? 'the planner offered this capability as an eligible domain, yet the recipe was never selected in the whole run'
        : 'the capability never became an eligible planner domain in this run',
    })
  }
  return {
    selected_recipes: [...selected].sort(),
    offered_capabilities: [...offeredCapabilities].sort(),
    findings,
  }
}

function chronologicalRows(interactions) {
  return interactions.map((it) => {
    const f = it.study_focus
    const pool = it.engine_diversity?.pool || {}
    return {
      i: it.index,
      session: sessionIndexOf(it.index) + 1,
      seq_in_session: (it.index % SESSION_SIZE) + 1,
      focus_type: f.focus_type,
      pack: f.pack_id,
      target: f.target?.target_id ?? '-',
      focus_cap: f.capability ?? '-',
      focus_mod: f.modality ?? '-',
      new_target: f.is_new_target,
      reasons: f.reason_codes.join(','),
      planner_considered: it.planner_trace?.considered ?? null,
      exemplar: it.activity_plan.exemplar_id,
      text_en: it.activity_plan_text ?? null,
      construction: it.activity_plan.construction_id,
      recipe: it.recipe,
      capability: it.capability,
      modality: it.modality,
      engine_considered: it.engine_considered,
      same_focus: pool.same_focus_candidates ?? null,
      band: pool.band_size ?? null,
      fresh: pool.fresh_candidates ?? null,
      score: it.engine_diversity?.candidate_score ?? null,
      best_score: it.engine_diversity?.best_score ?? null,
      score_delta: it.engine_diversity?.score_delta ?? null,
      since_seen: it.engine_diversity?.interactions_since_seen ?? null,
      ctx_repeat: it.engine_diversity?.context_repeat ?? null,
      outcome: it.assessment.outcome,
      excluded: it.engine_excluded || {},
      frontier: it.engine_frontier_stage,
    }
  })
}

const scenario = buildStandardScenarioV2(scenarioId)
const result = await runSimulationV2(scenario, { registry })

// The runner keeps the plan compact; re-attach the sentence text for the audit
// (it is the single most important human signal — "I am tired, but I am happy.").
const exemplarText = new Map()
for (const pack of registry.packs || []) {
  for (const ex of pack.exemplars || []) exemplarText.set(ex.exemplar_id, ex.text_en)
}
for (const it of result.interactions) it.activity_plan_text = exemplarText.get(it.activity_plan.exemplar_id) ?? null

const report = {
  audit_version: 1,
  scenario_id: scenario.scenario_id,
  persona: scenario.persona,
  sessions: Math.ceil(result.interactions.length / SESSION_SIZE),
  session_size: SESSION_SIZE,
  produced_interactions: result.interactions.length,
  requested_interactions: scenario.maximum_interactions,
  metrics: buildMetrics(result.interactions),
  band: bandDistribution(result.interactions),
  capability_trajectory: capabilityTrajectory(result.interactions),
  recipe_starvation: recipeStarvation(result.interactions),
  chronological: chronologicalRows(result.interactions),
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`\n=== V2.21 practice-dynamics audit — ${report.scenario_id} (${report.produced_interactions}/${report.requested_interactions} activities) ===\n`)
  console.table(report.chronological.map((r) => ({
    i: r.i, s: r.session, focus: r.focus_type, target: r.target.replace(/^(sense|construction):/, ''),
    cap: r.capability, mod: r.modality, recipe: r.recipe,
    exemplar: r.exemplar.replace(/^exemplar:/, ''), text: (r.text_en || '').slice(0, 34),
    pool: r.same_focus, band: r.band, fresh: r.fresh, seen: r.since_seen, out: r.outcome,
  })))
  const exclusionTotals = {}
  for (const it of result.interactions) {
    for (const [k, v] of Object.entries(it.engine_excluded || {})) exclusionTotals[k] = (exclusionTotals[k] || 0) + v
  }
  console.log('\n--- engine exclusion reasons across the run (why the pool is small)')
  console.dir(exclusionTotals, { depth: 3 })
  console.log('\n--- repetition metrics (§13)'); console.dir(report.metrics, { depth: 4 })
  console.log('\n--- acceptable band (§9)'); console.dir(report.band, { depth: 4 })
  console.log('\n--- capability trajectory (§15)'); console.dir(report.capability_trajectory, { depth: 4 })
  console.log('\n--- recipe starvation (§18)'); console.dir(report.recipe_starvation, { depth: 4 })
  console.log('\n(advisory audit — informational only, never fails CI)\n')
}
