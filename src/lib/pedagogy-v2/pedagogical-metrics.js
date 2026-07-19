// pedagogical-metrics.js — pure metrics over a SimulationResultV2 (Slice V2.7).
// These measure PROPERTIES of a learning trajectory (isolation, modality
// balance, support dependency, transfer, retention, lexical depth …), never a
// single global mastery number. Metrics are observations: they never feed back
// into any pedagogical decision and never change a threshold.

import { resolvePedagogyEntity, loadPedagogyV2Registry } from './registry.js'

const TRANSFER_REASON_CODES = [
  'KNOWN_FUNCTION_NEW_CONSTRUCTION',
  'KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK',
  'KNOWN_LEXEME_CONTEXT_EXTENDED',
  'CROSS_PACK_PREREQUISITE_MET',
  'CROSS_PACK_TRANSFER_OPPORTUNITY',
]
const MODALITIES = ['reading', 'listening', 'writing', 'speaking']
const CAPABILITIES = ['recognition', 'comprehension', 'controlled_production', 'free_production', 'pronunciation']
const round4 = (n) => +Number(n).toFixed(4)
const primaryKey = (it) => `${it.target.target_type}:${it.target.target_id}`

/** Modalities a runtime technically supports (for starvation detection). */
export function availableModalitiesFor(capabilities = {}) {
  const out = new Set(['reading']) // recognition/reading is always executable
  if (capabilities.audio_output) out.add('listening')
  if (capabilities.text_input && capabilities.semantic_assessment) out.add('writing')
  if (capabilities.speech_input && capabilities.semantic_assessment) out.add('speaking')
  return [...out]
}

function longestRun(values, keyFn = (x) => x) {
  let max = 0; let cur = 0; let prev
  for (const v of values) {
    const k = keyFn(v)
    if (k != null && k === prev) cur += 1
    else { cur = 1; prev = k }
    if (cur > max) max = cur
  }
  return max
}

export function computePedagogicalMetricsV2(result, { registry = loadPedagogyV2Registry() } = {}) {
  const interactions = result.interactions || []
  const assessed = interactions.filter((it) => it.assessment.status === 'assessed')
  const states = result.final_learner_states || []
  const capabilities = result.scenario?.runtime_capabilities || {}

  // 8.1 target isolation rate — primary target directly assessed.
  const isolated = assessed.filter((it) => {
    const key = primaryKey(it)
    return (it.direct_targets || []).includes(key) && (it.assessed_targets || []).includes(key)
  }).length
  const target_isolation_rate = {
    numerator: isolated,
    denominator: assessed.length,
    rate: assessed.length ? round4(isolated / assessed.length) : null,
  }

  // 8.2 new-item load.
  const perActivity = interactions.map((it) => (it.new_item_refs || []).length)
  const totalNew = perActivity.reduce((a, b) => a + b, 0)
  const new_item_load = {
    total: totalNew,
    per_activity_max: perActivity.length ? Math.max(...perActivity) : 0,
    per_activity_mean: perActivity.length ? round4(totalNew / perActivity.length) : 0,
    activities_introducing_new: perActivity.filter((n) => n > 0).length,
  }

  // 8.3 unaided production rate (controlled vs free).
  const prod = (pred) => interactions.filter(pred)
  const controlled = prod((it) => it.capability === 'controlled_production')
  const free = prod((it) => it.capability === 'free_production')
  const unaided = (arr) => arr.filter((it) => it.support_tier === 'none').length
  const unaided_production_rate = {
    controlled: { unaided: unaided(controlled), total: controlled.length, rate: controlled.length ? round4(unaided(controlled) / controlled.length) : null },
    free: { unaided: unaided(free), total: free.length, rate: free.length ? round4(unaided(free) / free.length) : null },
  }

  // 8.4 support dependency per capability key (supported vs independent).
  const support_dependency = {}
  for (const s of states) {
    for (const [capKey, cap] of Object.entries(s.capabilities || {})) {
      if (!support_dependency[capKey]) support_dependency[capKey] = { supported: 0, independent: 0 }
      support_dependency[capKey].supported += cap.supported?.assessed_evidence_count || 0
      support_dependency[capKey].independent += cap.independent?.assessed_evidence_count || 0
    }
  }

  // 8.5 modality balance + unpracticed-but-available.
  const modality_counts = Object.fromEntries(MODALITIES.map((m) => [m, 0]))
  for (const it of interactions) if (it.modality in modality_counts) modality_counts[it.modality] += 1
  const available = availableModalitiesFor(capabilities)
  const modality_balance = {
    counts: modality_counts,
    available,
    unpracticed_available: available.filter((m) => modality_counts[m] === 0),
  }

  // 8.6 capability depth.
  const capability_depth = Object.fromEntries(CAPABILITIES.map((c) => [c, 0]))
  for (const it of interactions) if (it.capability in capability_depth) capability_depth[it.capability] += 1

  // 8.7 review ratio.
  const focusTypes = (result.study_focus_history || []).map((f) => f.focus_type)
  const reviewRemediate = focusTypes.filter((t) => ['review', 'remediate'].includes(t)).length
  const introduceDeepen = focusTypes.filter((t) => ['introduce', 'deepen', 'independence', 'cross_pack_progression'].includes(t)).length
  const review_ratio = {
    review_remediate: reviewRemediate,
    introduce_deepen: introduceDeepen,
    ratio: introduceDeepen ? round4(reviewRemediate / introduceDeepen) : (reviewRemediate ? Infinity : 0),
  }

  // 8.8 repetition pressure (longest consecutive runs).
  const repetition_pressure = {
    same_target: longestRun(interactions, (it) => it.target.target_id),
    same_construction: longestRun(interactions, (it) => it.activity_plan.construction_id),
    same_pack: longestRun(interactions, (it) => it.pack_after),
    same_modality: longestRun(interactions, (it) => it.modality),
    same_activity_kind: longestRun(interactions, (it) => it.activity_kind),
  }

  // 8.9 pack-switch rate + reasons.
  const switches = interactions.filter((it) => it.pack_before && it.pack_before !== it.pack_after)
  const switchReasons = {}
  for (const it of switches) {
    const code = it.pack_switch?.code || 'UNSPECIFIED'
    switchReasons[code] = (switchReasons[code] || 0) + 1
  }
  const pack_switch = { count: switches.length, reasons: switchReasons, rate: interactions.length ? round4(switches.length / interactions.length) : 0 }

  // 8.10 cross-pack transfer occurrences (reason codes).
  const cross_pack_transfer = Object.fromEntries(TRANSFER_REASON_CODES.map((c) => [c, 0]))
  for (const f of result.study_focus_history || []) {
    for (const code of f.reason_codes || []) if (code in cross_pack_transfer) cross_pack_transfer[code] += 1
  }
  cross_pack_transfer.total = Object.values(cross_pack_transfer).reduce((a, b) => a + b, 0)

  // 8.11 delayed retention per capability key.
  const delayed_retention = {}
  for (const s of states) {
    for (const [capKey, r] of Object.entries(s.retention || {})) {
      if (!delayed_retention[capKey]) delayed_retention[capKey] = { successful_delayed_retrievals: 0, failed_delayed_retrievals: 0 }
      delayed_retention[capKey].successful_delayed_retrievals += r.successful_delayed_retrievals || 0
      delayed_retention[capKey].failed_delayed_retrievals += r.failed_delayed_retrievals || 0
    }
  }

  // 8.12 lexical depth per lexeme (facts only — never a global mastery %).
  const lexical_depth = {}
  for (const pack of registry.packs) {
    lexical_depth[pack.manifest.primary_lexeme_id] = {
      pack_id: pack.manifest.pack_id,
      senses_encountered: new Set(),
      constructions_encountered: new Set(),
      functions_encountered: new Set(),
      capability_keys_with_evidence: new Set(),
    }
  }
  const lexemeOfTarget = (targetId) => {
    const hit = resolvePedagogyEntity(targetId, registry)
    if (!hit) return null
    const pack = registry.packs.find((p) => p.manifest.pack_id === hit.pack_id)
    return pack ? { lexemeId: pack.manifest.primary_lexeme_id, kind: hit.kind } : null
  }
  for (const s of states) {
    const info = lexemeOfTarget(s.target.target_id)
    if (!info || !lexical_depth[info.lexemeId]) continue
    const bucket = lexical_depth[info.lexemeId]
    if (info.kind === 'sense') bucket.senses_encountered.add(s.target.target_id)
    if (info.kind === 'construction') bucket.constructions_encountered.add(s.target.target_id)
    if (info.kind === 'communicative_function') bucket.functions_encountered.add(s.target.target_id)
    for (const capKey of Object.keys(s.capabilities || {})) bucket.capability_keys_with_evidence.add(capKey)
  }
  for (const k of Object.keys(lexical_depth)) {
    const b = lexical_depth[k]
    lexical_depth[k] = {
      pack_id: b.pack_id,
      senses_encountered: b.senses_encountered.size,
      constructions_encountered: b.constructions_encountered.size,
      functions_encountered: b.functions_encountered.size,
      capability_keys_with_evidence: [...b.capability_keys_with_evidence].sort(),
    }
  }

  // 8.13 opportunity-aware coverage (Slice V2.8) — per (capability, modality):
  // how often was the domain ELIGIBLE (a viable planner candidate existed) vs.
  // actually SELECTED. Separates "never practiced because it couldn't be" from
  // "could be practiced and never was". Diagnostic only — never a planner input.
  const opportunity_coverage = {}
  const ensureDom = (key) => {
    if (!opportunity_coverage[key]) opportunity_coverage[key] = { eligible_opportunities: 0, selected_opportunities: 0 }
    return opportunity_coverage[key]
  }
  for (const it of interactions) {
    const selKey = it.capability && it.modality ? `${it.capability}_${it.modality}` : null
    const eligible = new Set(it.eligible_domains || [])
    if (selKey) eligible.add(selKey) // the selected domain was, by definition, eligible
    for (const dom of eligible) ensureDom(dom).eligible_opportunities += 1
    if (selKey) ensureDom(selKey).selected_opportunities += 1
  }
  for (const key of Object.keys(opportunity_coverage)) {
    const o = opportunity_coverage[key]
    o.coverage_ratio = o.eligible_opportunities ? round4(o.selected_opportunities / o.eligible_opportunities) : null
  }

  return {
    target_isolation_rate,
    new_item_load,
    unaided_production_rate,
    support_dependency,
    modality_balance,
    capability_depth,
    review_ratio,
    repetition_pressure,
    pack_switch,
    cross_pack_transfer,
    delayed_retention,
    lexical_depth,
    opportunity_coverage,
  }
}

/**
 * The set of modalities that had at least one ELIGIBLE planner opportunity
 * across a result. A domain key is `${capability}_${modality}`, so the modality
 * is the last segment. Used by the analyzer to tell pedagogical starvation
 * (available + eligible + ignored) from "never a real curricular option".
 */
export function modalitiesWithOpportunityV2(result) {
  const modalities = new Set()
  for (const it of result.interactions || []) {
    for (const dom of it.eligible_domains || []) modalities.add(dom.split('_').pop())
    if (it.modality) modalities.add(it.modality)
  }
  return modalities
}
