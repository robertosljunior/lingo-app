// long-horizon-analyzer.js — windowed trajectory metrics, curriculum
// saturation and long-horizon diagnostics (Slice V2.10). A 500-interaction
// average hides late degradation: these tools split a SimulationResultV2 into
// temporal windows and ask whether review starts dominating, novelty dries up
// while unseen material remains, parallel modalities never arrive, packs get
// abandoned, one target loops, or capability depth plateaus.
//
// Everything here is DIAGNOSTIC: warnings never fail CI and nothing feeds back
// into a planner/engine decision. Saturation is a FACT, not a finding — with
// only two packs a long journey legitimately exhausts novelty, and that is
// curriculum reality, not planner starvation.

import { makeFinding } from './observability-contracts.js'
import { loadPedagogyV2Registry } from './registry.js'
import { CAPABILITY_LADDER } from './capability-entry.js'
import { availableModalitiesFor } from './pedagogical-metrics.js'

const round4 = (n) => +Number(n).toFixed(4)

// Diagnostic thresholds ONLY (like OBSERVABILITY_POLICY_V2 — they change what
// is FLAGGED, never what the planner decides).
export const LONG_HORIZON_POLICY_V2 = Object.freeze({
  policy_version: 1,
  // Default temporal windows (1-based interaction indexes, clipped to horizon).
  windows: [[1, 50], [51, 100], [101, 200], [201, 500]],
  // A late window (≥ min size) where review+remediate exceed this share.
  late_review_dominance_ratio: 0.8,
  late_window_min_interactions: 20,
  // A late window (≥ this size) with zero introductions while unseen eligible
  // targets remain → late novelty starvation.
  novelty_window_min_interactions: 50,
  // A modality with at least this many eligible opportunities across the last
  // windows and zero practice → long-horizon modality starvation.
  modality_min_eligible_opportunities: 10,
  // A pack unvisited across a late window of at least this size (adaptive).
  pack_window_min_interactions: 100,
  // One target above this share of a late window → target loop.
  target_loop_share: 0.5,
  target_loop_window_min_interactions: 50,
  // Plateau: max ladder rung never rises after the first window across ≥ this
  // many windows while a deeper rung is trainable.
  plateau_min_windows: 3,
})

/** Clip the policy windows to the actual horizon; drop empty windows. */
export function clipWindowsV2(horizon, windows = LONG_HORIZON_POLICY_V2.windows) {
  const out = []
  for (const [a, b] of windows) {
    if (a > horizon) break
    out.push([a, Math.min(b, horizon)])
  }
  return out
}

/**
 * Curriculum saturation — a FACT about content coverage, never a finding:
 * every pack target (sense/construction/function) the registry offers has
 * been exposed. remaining_eligible_unseen_targets counts the rest.
 */
export function computeCurriculumSaturationV2(result, { registry = loadPedagogyV2Registry() } = {}) {
  const all = new Set()
  for (const pack of registry.packs) {
    for (const s of pack.senses || []) all.add(s.sense_id)
    for (const c of pack.constructions || []) all.add(c.construction_id)
    for (const f of pack.communicative_functions || []) all.add(f.function_id)
  }
  const exposed = new Set((result.final_learner_states || [])
    .filter((s) => (s.exposure?.count || 0) > 0)
    .map((s) => s.target.target_id))
  let unseen = 0
  for (const id of all) if (!exposed.has(id)) unseen += 1
  return {
    curriculum_saturation: unseen === 0,
    remaining_eligible_unseen_targets: unseen,
    total_targets: all.size,
    exposed_targets: all.size - unseen,
  }
}

function windowSlice(interactions, [a, b]) {
  return interactions.filter((it) => it.index + 1 >= a && it.index + 1 <= b)
}

function longestRun(values) {
  let max = 0; let cur = 0; let prev
  for (const v of values) {
    if (v != null && v === prev) cur += 1
    else { cur = 1; prev = v }
    if (cur > max) max = cur
  }
  return max
}

/**
 * Windowed metrics over a SimulationResultV2 (§16): per temporal window —
 * focus-type mix, modality/capability distribution, unaided production,
 * support tiers, repetition, pack switches, cross-pack transfer, new-item
 * rate and windowed opportunity coverage (incl. entry/expansion split).
 */
export function computeWindowedMetricsV2(result, { windows } = {}) {
  const interactions = result.interactions || []
  const clipped = clipWindowsV2(interactions.length, windows ?? LONG_HORIZON_POLICY_V2.windows)
  return clipped.map(([a, b]) => {
    const slice = windowSlice(interactions, [a, b])
    const n = slice.length
    const focusCounts = {}
    const modality = {}
    const capability = {}
    const tiers = {}
    const coverage = {}
    const dom = (key) => {
      if (!coverage[key]) coverage[key] = { eligible_opportunities: 0, selected_opportunities: 0, entry_opportunities: 0, expansion_opportunities: 0 }
      return coverage[key]
    }
    let newItems = 0
    let switches = 0
    let transfers = 0
    for (const it of slice) {
      const ft = it.study_focus?.focus_type ?? 'unknown'
      focusCounts[ft] = (focusCounts[ft] || 0) + 1
      if (it.modality) modality[it.modality] = (modality[it.modality] || 0) + 1
      if (it.capability) capability[it.capability] = (capability[it.capability] || 0) + 1
      tiers[it.support_tier] = (tiers[it.support_tier] || 0) + 1
      newItems += (it.new_item_refs || []).length
      if (it.pack_before && it.pack_before !== it.pack_after) switches += 1
      transfers += (it.study_focus?.reason_codes || []).filter((c) => c.startsWith('CROSS_PACK') || c.startsWith('KNOWN_')).length
      const selKey = it.capability && it.modality ? `${it.capability}_${it.modality}` : null
      const eligible = new Set(it.eligible_domains || [])
      if (selKey) eligible.add(selKey)
      for (const d of eligible) dom(d).eligible_opportunities += 1
      for (const d of it.eligible_entry_domains || []) dom(d).entry_opportunities += 1
      for (const d of it.eligible_expansion_domains || []) dom(d).expansion_opportunities += 1
      if (selKey) dom(selKey).selected_opportunities += 1
    }
    const production = slice.filter((it) => ['controlled_production', 'free_production'].includes(it.capability))
    const reviewShare = n ? ((focusCounts.review || 0) + (focusCounts.remediate || 0)) / n : 0
    return {
      window: [a, b],
      interactions: n,
      focus_type_counts: focusCounts,
      review_remediate_share: round4(reviewShare),
      modality_counts: modality,
      capability_counts: capability,
      support_tier_counts: tiers,
      unaided_production_rate: production.length ? round4(production.filter((it) => it.support_tier === 'none').length / production.length) : null,
      longest_same_target_run: longestRun(slice.map((it) => it.target.target_id)),
      pack_switches: switches,
      cross_pack_transfer_codes: transfers,
      new_item_rate: n ? round4(newItems / n) : 0,
      opportunity_coverage: coverage,
    }
  })
}

/**
 * Long-horizon diagnostics (§17): warnings only, computed over the windowed
 * metrics + saturation. Never fails CI, never feeds the planner.
 */
export function analyzeLongHorizonV2(result, { registry = loadPedagogyV2Registry(), policy = LONG_HORIZON_POLICY_V2 } = {}) {
  const interactions = result.interactions || []
  const windows = computeWindowedMetricsV2(result, { windows: policy.windows })
  const saturation = computeCurriculumSaturationV2(result, { registry })
  const findings = []
  const add = (code, details) => findings.push(makeFinding('warning', code, details))
  const late = windows.slice(1)

  // LATE_REVIEW_DOMINANCE — review+remediate swallow a late window.
  for (const w of late) {
    if (w.interactions >= policy.late_window_min_interactions
      && w.review_remediate_share > policy.late_review_dominance_ratio) {
      add('LATE_REVIEW_DOMINANCE', { window: w.window, share: w.review_remediate_share })
    }
  }

  // LATE_NOVELTY_STARVATION — no introductions in a late window while unseen
  // eligible targets remain. Saturated curricula are exempt: exhausting the
  // content is curriculum reality, not planner starvation (§18).
  if (!saturation.curriculum_saturation) {
    for (const w of late) {
      if (w.interactions >= policy.novelty_window_min_interactions && (w.focus_type_counts.introduce || 0) === 0 && w.new_item_rate === 0) {
        add('LATE_NOVELTY_STARVATION', { window: w.window, remaining_unseen: saturation.remaining_eligible_unseen_targets })
      }
    }
  }

  // LONG_HORIZON_MODALITY_STARVATION — an available modality kept accumulating
  // eligible opportunities across the late windows yet was never practiced.
  const available = new Set(availableModalitiesFor(result.scenario?.runtime_capabilities || {}))
  const lateEligibleByModality = {}
  const latePracticedByModality = {}
  for (const w of late) {
    for (const [domKey, o] of Object.entries(w.opportunity_coverage)) {
      const m = domKey.split('_').pop()
      lateEligibleByModality[m] = (lateEligibleByModality[m] || 0) + o.eligible_opportunities
    }
    for (const [m, c] of Object.entries(w.modality_counts)) latePracticedByModality[m] = (latePracticedByModality[m] || 0) + c
  }
  for (const [m, eligible] of Object.entries(lateEligibleByModality)) {
    if (available.has(m) && eligible >= policy.modality_min_eligible_opportunities && !(latePracticedByModality[m] > 0)) {
      add('LONG_HORIZON_MODALITY_STARVATION', { modality: m, late_eligible_opportunities: eligible })
    }
  }

  // LONG_HORIZON_PACK_STARVATION — a pack abandoned across a big late window.
  if (result.scenario?.mode === 'adaptive') {
    for (const w of late) {
      if (w.interactions < policy.pack_window_min_interactions) continue
      const visited = new Set(windowSlice(interactions, w.window).map((it) => it.pack_after))
      for (const pack of registry.packs) {
        if (!visited.has(pack.manifest.pack_id)) add('LONG_HORIZON_PACK_STARVATION', { window: w.window, pack_id: pack.manifest.pack_id })
      }
    }
  }

  // LONG_HORIZON_TARGET_LOOP — one target dominating a late window.
  for (const w of late) {
    if (w.interactions < policy.target_loop_window_min_interactions) continue
    const counts = {}
    for (const it of windowSlice(interactions, w.window)) counts[it.target.target_id] = (counts[it.target.target_id] || 0) + 1
    for (const [targetId, c] of Object.entries(counts)) {
      if (c / w.interactions > policy.target_loop_share) add('LONG_HORIZON_TARGET_LOOP', { window: w.window, target_id: targetId, share: round4(c / w.interactions) })
    }
  }

  // CAPABILITY_DEPTH_PLATEAU — the deepest practiced rung never rises past the
  // first window's depth while production remains unreached.
  if (windows.length >= policy.plateau_min_windows) {
    const depth = (w) => Math.max(-1, ...Object.keys(w.capability_counts).map((c) => CAPABILITY_LADDER.indexOf(c)))
    const first = depth(windows[0])
    const maxLater = Math.max(...windows.slice(1).map(depth))
    if (maxLater <= first && first < CAPABILITY_LADDER.indexOf('controlled_production')) {
      add('CAPABILITY_DEPTH_PLATEAU', { first_window_depth: CAPABILITY_LADDER[first] ?? null, later_max_depth: CAPABILITY_LADDER[maxLater] ?? null })
    }
  }

  findings.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  return { windows, saturation, findings }
}
