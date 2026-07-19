// trajectory-analyzer.js — structural trajectory diagnostics over a
// SimulationResultV2 (Slice V2.7). Produces trajectory metrics and structured
// FINDINGS using OBSERVABILITY_POLICY_V2 (diagnostic thresholds ONLY — they
// change what is flagged, never what the planner/engine decides). Warnings are
// heuristic observations; the four grave codes are invariant violations that a
// real run would have halted on (the runner throws), but the analyzer can still
// detect them in a synthetic/crafted trajectory so the detection is testable.

import { OBSERVABILITY_POLICY_V2, makeFinding, GRAVE_FINDING_CODES } from './observability-contracts.js'
import { computeRecipeRuntimeAvailability, isRecipeExecutable } from './runtime-capabilities.js'
import { getLane, laneMeets } from './lesson-engine-state-queries.js'
import { loadPedagogyV2Registry } from './registry.js'
import { availableModalitiesFor } from './pedagogical-metrics.js'

const ADVANCEMENT = { min_mastery: 0.7, min_evidence_level: 'emerging' }
const GLOBAL_MASTERY_KEYS = ['mastery', 'global_mastery', 'mastery_global', 'overall_mastery', 'lexeme_mastery']
const primaryKey = (it) => `${it.target.target_type}:${it.target.target_id}`

function longestRunWithValue(values, keyFn) {
  let best = { len: 0, value: null }; let cur = 0; let prev
  for (const v of values) {
    const k = keyFn(v)
    if (k != null && k === prev) cur += 1
    else { cur = 1; prev = k }
    if (cur > best.len) best = { len: cur, value: k }
  }
  return best
}

/**
 * Analyze a SimulationResultV2 → { trajectory, findings }.
 * `findings` is ordered: grave (error) first, then warnings, then info.
 */
export function analyzeTrajectoryV2(result, { policy = OBSERVABILITY_POLICY_V2, registry = loadPedagogyV2Registry() } = {}) {
  const interactions = result.interactions || []
  const states = result.final_learner_states || []
  const statesByTarget = new Map(states.map((s) => [s.target.target_id, s]))
  const mode = result.scenario?.mode
  const capabilities = result.scenario?.runtime_capabilities || {}
  const availability = computeRecipeRuntimeAvailability(capabilities)
  const findings = []
  const add = (severity, code, details, target_id) => findings.push(makeFinding(severity, code, details, target_id))

  // ---- grave invariant detections (severity error) ----
  // GLOBAL_MASTERY_FIELD_DETECTED
  for (const s of states) {
    for (const k of GLOBAL_MASTERY_KEYS) if (k in s) add('error', 'GLOBAL_MASTERY_FIELD_DETECTED', { key: k }, s.target.target_id)
  }
  // REVIEW_MODE_INTRODUCED_NEW_TARGET
  if (mode === 'review') {
    for (const f of result.study_focus_history || []) {
      if (f.is_new_target) add('error', 'REVIEW_MODE_INTRODUCED_NEW_TARGET', { focus_type: f.focus_type }, f.target?.target_id)
    }
  }
  // RUNTIME_UNAVAILABLE_FOCUS_SELECTED
  for (const it of interactions) {
    if (!isRecipeExecutable(availability, it.recipe, it.modality)) {
      add('error', 'RUNTIME_UNAVAILABLE_FOCUS_SELECTED', { recipe: it.recipe, modality: it.modality }, it.target.target_id)
    }
  }
  // NEW_ITEM_BUDGET_VIOLATION — a single activity introducing more than the
  // engine's per-session budget of new items is structurally impossible.
  for (const it of interactions) {
    if ((it.new_item_refs || []).length > 2) add('error', 'NEW_ITEM_BUDGET_VIOLATION', { new_item_refs: it.new_item_refs }, it.target.target_id)
  }

  // ---- trajectory warnings (heuristic) ----

  // TARGET_STAGNATION — many assessed activities on a target, best lane still
  // insufficient at the end.
  const assessedByTarget = new Map()
  for (const it of interactions) {
    if (it.assessment.status !== 'assessed') continue
    const key = it.target.target_id
    assessedByTarget.set(key, (assessedByTarget.get(key) || 0) + 1)
  }
  for (const [targetId, count] of assessedByTarget) {
    if (count < policy.stagnation_activities) continue
    const state = statesByTarget.get(targetId)
    const bestEstablished = Object.keys(state?.capabilities || {}).some((k) => laneMeets(getLane(state, k, 'overall'), { min_mastery: 0.5, min_evidence_level: 'emerging' }))
    if (!bestEstablished) add('warning', 'TARGET_STAGNATION', { assessed_activities: count }, targetId)
  }

  // PREMATURE_FREE_PRODUCTION — free production for a target before any
  // controlled production of it (should be zero; the engine gates it).
  const firstControlledIdx = new Map()
  interactions.forEach((it, i) => {
    if (it.capability === 'controlled_production' && !firstControlledIdx.has(it.target.target_id)) firstControlledIdx.set(it.target.target_id, i)
  })
  interactions.forEach((it, i) => {
    if (it.capability !== 'free_production') return
    const fc = firstControlledIdx.get(it.target.target_id)
    if (fc == null || fc > i) add('error', 'PREMATURE_FREE_PRODUCTION', { free_index: i, first_controlled_index: fc ?? null }, it.target.target_id)
  })

  // REVIEW_STARVATION — a target in the final review queue never selected as a
  // review/remediate focus, with enough opportunities.
  if (interactions.length >= policy.review_starvation_opportunities) {
    const reviewedTargets = new Set((result.study_focus_history || [])
      .filter((f) => ['review', 'remediate'].includes(f.focus_type))
      .map((f) => f.target?.target_id).filter(Boolean))
    for (const item of result.final_review_queue || []) {
      if (!reviewedTargets.has(item.target.target_id)) {
        add('warning', 'REVIEW_STARVATION', { capability_key: item.capability_key, reason_codes: item.reason_codes }, item.target.target_id)
      }
    }
  }

  // NOVELTY_STARVATION — a long consecutive run of review/remediate focuses.
  const reviewRun = longestRunWithValue(
    (result.study_focus_history || []).map((f) => (['review', 'remediate'].includes(f.focus_type) ? 'R' : 'x')),
    (v) => v,
  )
  if (reviewRun.value === 'R' && reviewRun.len >= policy.novelty_starvation_streak) {
    add('warning', 'NOVELTY_STARVATION', { consecutive_reviews: reviewRun.len })
  }

  // SUPPORT_TRAP — supported established, independent still insufficient, despite
  // independence-focus opportunities.
  const independenceByTarget = new Map()
  for (const f of result.study_focus_history || []) {
    if (f.focus_type === 'independence' && f.target?.target_id) {
      independenceByTarget.set(f.target.target_id, (independenceByTarget.get(f.target.target_id) || 0) + 1)
    }
  }
  if (interactions.length >= policy.support_trap_opportunities) {
    for (const s of states) {
      for (const [capKey, cap] of Object.entries(s.capabilities || {})) {
        const supportedEstablished = laneMeets(cap.supported, ADVANCEMENT)
        const independentInsufficient = (cap.independent?.evidence_level ?? 'insufficient') === 'insufficient'
        const tries = independenceByTarget.get(s.target.target_id) || 0
        if (supportedEstablished && independentInsufficient && tries >= 1) {
          add('warning', 'SUPPORT_TRAP', { capability_key: capKey, independence_attempts: tries }, s.target.target_id)
        }
      }
    }
  }

  // MODALITY_STARVATION — an available modality never practiced.
  if (interactions.length >= policy.modality_starvation_opportunities) {
    const counts = {}
    for (const it of interactions) counts[it.modality] = (counts[it.modality] || 0) + 1
    for (const m of availableModalitiesFor(capabilities)) {
      if (!counts[m]) add('warning', 'MODALITY_STARVATION', { modality: m, interactions: interactions.length })
    }
  }

  // PACK_STARVATION — adaptive mode, an eligible pack never visited.
  if (mode === 'adaptive' && interactions.length >= policy.pack_starvation_interactions) {
    const visited = new Set(result.pack_history || [])
    for (const pack of registry.packs) {
      if (!visited.has(pack.manifest.pack_id)) add('warning', 'PACK_STARVATION', { pack_id: pack.manifest.pack_id })
    }
  }

  // EXCESSIVE_PACK_SWITCHING — switch ratio above the diagnostic threshold.
  const switches = interactions.filter((it) => it.pack_before && it.pack_before !== it.pack_after).length
  const switchRatio = interactions.length ? switches / interactions.length : 0
  if (switchRatio > policy.ping_pong_switch_ratio) add('warning', 'EXCESSIVE_PACK_SWITCHING', { switches, ratio: +switchRatio.toFixed(4) })

  // EXCESSIVE_TARGET_REPETITION — same primary target too many times in a row.
  const targetRun = longestRunWithValue(interactions, (it) => it.target.target_id)
  if (targetRun.len > policy.excessive_target_repetition) add('warning', 'EXCESSIVE_TARGET_REPETITION', { consecutive: targetRun.len }, targetRun.value)

  // Deterministic ordering: severity (error>warning>info), then code, target.
  const sevRank = { error: 0, warning: 1, info: 2 }
  findings.sort((a, b) => (sevRank[a.severity] - sevRank[b.severity])
    || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
    || ((a.target_id || '') < (b.target_id || '') ? -1 : (a.target_id || '') > (b.target_id || '') ? 1 : 0))

  const trajectory = {
    interactions: interactions.length,
    pack_switches: switches,
    longest_target_run: targetRun.len,
    longest_review_run: reviewRun.value === 'R' ? reviewRun.len : 0,
    grave_findings: findings.filter((f) => GRAVE_FINDING_CODES.includes(f.code)).length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
  }
  return { trajectory, findings }
}
