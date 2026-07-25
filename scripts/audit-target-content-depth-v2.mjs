#!/usr/bin/env node
// audit-target-content-depth-v2.mjs — Slice V2.21-R1 §3/§4/§5/§20.
//
// Measures MATERIALIZABLE depth per target, not raw exemplar counts.
//
// The V2.21 diagnosis proved that the engine received focuses with a single
// eligible realization (`same_focus_candidates = 1` on all 60 steps of the real
// journey). Raw pack counts hide this completely: a construction with 5
// exemplars can still leave its SENSE with exactly one, because the engine only
// considers exemplars where the focus target is a PRIMARY pedagogical target
// (everything else is excluded as `not_targeted`).
//
// So this audit reports, per target:
//   - authored depth: how many exemplars declare it primary vs secondary;
//   - REAL depth: how many exemplars the engine could actually serve, replayed
//     against the learner-state snapshots of the real 5x12 journey;
//   - when depth is 1, WHY (§4 categories).
//
// Advisory. It never fails CI and changes nothing.
//
//   node scripts/audit-target-content-depth-v2.mjs [--json]

import { runSimulationV2 } from '../src/lib/pedagogy-v2/simulation-runner.js'
import { buildStandardScenarioV2 } from '../src/lib/pedagogy-v2/simulation-scenarios.js'
import { loadPedagogyV2Registry } from '../src/lib/pedagogy-v2/registry.js'

const asJson = process.argv.includes('--json')
const registry = loadPedagogyV2Registry()

// ---------- authored depth (static) ----------
function authoredDepth() {
  const rows = new Map() // target_id → row
  for (const pack of registry.packs || []) {
    const packId = pack.manifest.pack_id
    for (const ex of pack.exemplars || []) {
      for (const t of ex.pedagogical_targets || []) {
        const key = t.target_id
        if (!rows.has(key)) {
          rows.set(key, {
            target_id: key, target_type: t.target_type, pack_id: packId,
            primary: 0, secondary: 0, primary_ids: [], stages: new Set(),
            constructions: new Set(), contexts: new Set(),
          })
        }
        const row = rows.get(key)
        if (t.role === 'primary') { row.primary += 1; row.primary_ids.push(ex.exemplar_id) }
        else row.secondary += 1
        row.stages.add(ex.exposure_stage)
        row.constructions.add(ex.construction_id)
        if (ex.context) row.contexts.add(ex.context)
      }
    }
  }
  return [...rows.values()].map((r) => ({
    ...r,
    total_exemplars_declaring_target: r.primary + r.secondary,
    stages: [...r.stages].sort(),
    construction_count: r.constructions.size,
    context_count: r.contexts.size,
    constructions: undefined, contexts: undefined,
  }))
}

// ---------- real depth (replayed against the journey) ----------
/**
 * §4 — why did this step have a single realization? Derived from the engine's
 * own exclusion trace plus the authored depth, so the answer is measured rather
 * than guessed.
 */
function classifySingleton(step, authoredByTarget) {
  const targetId = step.study_focus?.target?.target_id
  const authored = authoredByTarget.get(targetId)
  const excl = step.engine_excluded || {}
  const hasReason = (prefix) => Object.keys(excl).some((k) => k.startsWith(prefix) && excl[k] > 0)

  if (authored && authored.primary <= 1) return 'ONLY_ONE_AUTHORED_PRIMARY_EXEMPLAR'
  if (hasReason('prerequisite_unmet') || hasReason('prerequisite_unknown')) return 'PREREQUISITE_BLOCKED'
  if (excl.exposure_stage) return 'EXPOSURE_STAGE_BLOCKED'
  if (excl.new_item_budget) return 'NEW_ITEM_BUDGET'
  if (excl.not_focus_capability || excl.not_focus_modality) return 'CAPABILITY_GATE'
  if (hasReason('RUNTIME_')) return 'RUNTIME'
  return 'OTHER'
}

const scenario = buildStandardScenarioV2('real-successful-60')
const result = await runSimulationV2(scenario, { registry })

const authored = authoredDepth()
const authoredByTarget = new Map(authored.map((r) => [r.target_id, r]))

const perStep = result.interactions.map((it) => {
  const f = it.study_focus
  const pool = it.engine_diversity?.pool || {}
  const focusKey = [f.pack_id, f.focus_type, f.target?.target_id ?? '-', f.capability ?? '-', f.modality ?? '-'].join('|')
  const singleton = (pool.same_focus_candidates ?? 0) <= 1
  return {
    index: it.index,
    focus_key: focusKey,
    target_id: f.target?.target_id ?? null,
    capability: it.capability,
    modality: it.modality,
    eligible_exemplar_count: pool.same_focus_candidates ?? null,
    eligible_exemplar_ids: pool.band_exemplars ?? null,
    blocked_reasons: it.engine_excluded || {},
    blocked_exemplar_count: Object.values(it.engine_excluded || {}).reduce((a, c) => a + c, 0),
    singleton_reason: singleton ? classifySingleton(it, authoredByTarget) : null,
  }
})

// §5 — bottleneck ranking: targets that both dominate the journey and arrive
// with a single realization.
const bottleneck = new Map()
for (const s of perStep) {
  if (!s.target_id) continue
  if (!bottleneck.has(s.target_id)) {
    bottleneck.set(s.target_id, {
      target_id: s.target_id, steps: 0, singleton_steps: 0, reasons: {},
      authored_primary: authoredByTarget.get(s.target_id)?.primary ?? 0,
      authored_total: authoredByTarget.get(s.target_id)?.total_exemplars_declaring_target ?? 0,
    })
  }
  const row = bottleneck.get(s.target_id)
  row.steps += 1
  if (s.singleton_reason) {
    row.singleton_steps += 1
    row.reasons[s.singleton_reason] = (row.reasons[s.singleton_reason] || 0) + 1
  }
}
const ranking = [...bottleneck.values()].sort((a, b) => b.singleton_steps - a.singleton_steps || b.steps - a.steps)

// §20 — TARGET_CONTENT_DEPTH_V2 findings.
// critical: the journey actually kept landing on it with a single realization.
// warning:  reached by the journey, authored depth below the 3-exemplar floor.
// info:     never reached in this horizon — not inflated to satisfy a quota.
const reachedTargets = new Set(perStep.map((s) => s.target_id).filter(Boolean))
const DEPTH_GOAL = 5
const DEPTH_FLOOR = 3
const findings = []
for (const row of authored) {
  const rank = bottleneck.get(row.target_id)
  const singletonSteps = rank?.singleton_steps ?? 0
  if (singletonSteps >= 3 && row.primary < DEPTH_GOAL) {
    findings.push({
      code: 'LOW_MATERIALIZABLE_TARGET_DEPTH', severity: 'critical', target_id: row.target_id,
      authored_primary: row.primary, authored_total: row.total_exemplars_declaring_target,
      singleton_steps: singletonSteps, goal: DEPTH_GOAL,
      detail: 'the real journey repeatedly reached this target with a single materializable realization',
    })
  } else if (reachedTargets.has(row.target_id) && row.primary < DEPTH_FLOOR) {
    findings.push({
      code: 'LOW_MATERIALIZABLE_TARGET_DEPTH', severity: 'warning', target_id: row.target_id,
      authored_primary: row.primary, authored_total: row.total_exemplars_declaring_target,
      singleton_steps: singletonSteps, goal: DEPTH_FLOOR,
      detail: 'reached by the journey with authored primary depth below the floor',
    })
  } else if (!reachedTargets.has(row.target_id) && row.primary < DEPTH_FLOOR) {
    findings.push({
      code: 'LOW_MATERIALIZABLE_TARGET_DEPTH', severity: 'info', target_id: row.target_id,
      authored_primary: row.primary, authored_total: row.total_exemplars_declaring_target,
      singleton_steps: 0, goal: DEPTH_FLOOR,
      detail: 'outside the observed horizon — not a bottleneck, do not inflate to hit a quota',
    })
  }
}

const singletonReasons = {}
for (const s of perStep) if (s.singleton_reason) singletonReasons[s.singleton_reason] = (singletonReasons[s.singleton_reason] || 0) + 1

const report = {
  audit_version: 1,
  scenario_id: scenario.scenario_id,
  steps: perStep.length,
  singleton_steps: perStep.filter((s) => s.singleton_reason).length,
  singleton_reasons: singletonReasons,
  authored_depth: authored.sort((a, b) => a.target_id.localeCompare(b.target_id)),
  bottleneck_ranking: ranking,
  findings,
  per_step: perStep,
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`\n=== V2.21-R1 target content depth — ${report.scenario_id} ===\n`)
  console.log(`steps: ${report.steps} · steps with a SINGLE materializable realization: ${report.singleton_steps}`)
  console.log('why:', JSON.stringify(report.singleton_reasons))
  console.log('\n--- authored depth per target (primary = what the engine can actually serve)')
  console.table(report.authored_depth.map((r) => ({
    target: r.target_id, type: r.target_type, pack: r.pack_id,
    primary: r.primary, secondary: r.secondary, total: r.total_exemplars_declaring_target,
    constructions: r.construction_count, contexts: r.context_count, stages: r.stages.join(','),
  })))
  console.log('\n--- bottleneck ranking (§5)')
  console.table(ranking.map((r) => ({
    target: r.target_id, steps: r.steps, singleton_steps: r.singleton_steps,
    authored_primary: r.authored_primary, reasons: JSON.stringify(r.reasons),
  })))
  console.log('\n--- TARGET_CONTENT_DEPTH_V2 findings (§20)')
  console.table(findings.map((f) => ({
    severity: f.severity, target: f.target_id, authored_primary: f.authored_primary,
    goal: f.goal, singleton_steps: f.singleton_steps,
  })))
  console.log('\n(advisory audit — informational only, never fails CI)\n')
}
