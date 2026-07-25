// capability-progression-analyzer.js — Slice V2.21-R3 §3…§12 / §27.
//
// A pure, read-only ANALYSIS layer over a SimulationResultV2. It answers the
// R3 question — "why does a learner who answers correctly stay in
// recognition?" — with measurements rather than intuition, and it feeds both
// the advisory audit script and the R3 regression tests.
//
// Nothing here influences the Planner or the Engine. It only reads:
//   - the interaction trace (plan, focus, recipe, support tier, outcome);
//   - the immutable evidence stream (replayed prefix by prefix through the
//     REAL aggregation, so the per-step learner state is the real one);
//   - the registry (introduction groups, authored primary targets).
//
// The central artifact is the TARGET COMPLETION FUNNEL (§11): how many targets
// were exposed, how many reached recognition evidence, how many met the
// recognition advancement bar, how many entered comprehension, and so on up
// the ladder. The first stage where the population collapses is the only
// bottleneck worth fixing (§12).

import { aggregateProfileEvidence, getEvidenceWeight } from './learner-model.js'
import {
  indexStatesByTargetId, getLane, laneMeets, capabilityAdvancementMetV2, getCapabilityRollup,
} from './lesson-engine-state-queries.js'
import { CAPABILITY_LADDER } from './capability-entry.js'
import { CAPABILITY_MODALITIES } from './learner-model-constants.js'
import { deriveSupportTier } from './learner-evidence-contracts.js'
import { mergeStudyPlannerPolicyV2 } from './study-planner-contracts.js'
import { LESSON_RECIPES } from './lesson-engine-contracts.js'
import { getTrainingAffordancesV2 } from './training-affordances.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { isRecipeExecutable } from './runtime-capabilities.js'

export const CAPABILITY_PROGRESSION_ANALYZER_VERSION = 1

/** The R3 measurement set (§2/§25). */
export const DEFAULT_PROGRESSION_SCENARIOS = Object.freeze([
  'real-successful-60',
  'still-focused-36',
  'but-focused-36',
  'yet-focused-36',
])

const ASSESSED = new Set(['correct', 'partial', 'incorrect'])

function round(n, p = 3) { return n == null ? null : Math.round(n * 10 ** p) / 10 ** p }

function tally(values) {
  const out = {}
  for (const v of values) out[v] = (out[v] || 0) + 1
  return out
}

/** capability key of an evidence event (mirrors learner-model deriveCapabilityKey). */
function capKeyOf(activity) {
  if (!activity?.capability || !activity?.modality) return null
  if (!(CAPABILITY_MODALITIES[activity.capability] || []).includes(activity.modality)) return null
  return `${activity.modality}_${activity.capability}`
}

/** Modality lanes a capability can legitimately use. */
function modalitiesFor(capability) { return CAPABILITY_MODALITIES[capability] || [] }

/**
 * Has this capability met the bar? Uses the SAME predicate the planner and the
 * engine use, so the funnel can never drift from the runtime's own semantics.
 */
function capabilityMeets(state, capability, threshold, lane = 'overall') {
  return capabilityAdvancementMetV2(state, capability, threshold, lane)
}

/** Assessed evidence count summed over the capability's modality lanes. */
function capabilityAssessedCount(state, capability, lane = 'overall') {
  return modalitiesFor(capability).reduce(
    (sum, m) => sum + (getLane(state, `${m}_${capability}`, lane)?.assessed_evidence_count || 0), 0,
  )
}

/** Total effective weight summed over the capability's modality lanes. */
function capabilityEffectiveWeight(state, capability, lane = 'overall') {
  return round(modalitiesFor(capability).reduce(
    (sum, m) => sum + (getLane(state, `${m}_${capability}`, lane)?.effective_evidence_weight || 0), 0,
  ))
}

// ---------------------------------------------------------------------------
// §3 — per-interaction capability trace
// ---------------------------------------------------------------------------

function buildTrace(result, { sessionSize }) {
  const evidenceById = new Map(result.evidence_generated.map((e) => [e.evidence_id, e]))
  const seed = result.scenario.initial_evidence || []
  const stream = [...seed]
  const rows = []

  for (const it of result.interactions) {
    const events = it.evidence_ids.map((id) => evidenceById.get(id)).filter(Boolean)
    stream.push(...events)
    const states = indexStatesByTargetId(aggregateProfileEvidence(stream))
    const primaryId = it.target.target_id
    const state = states.get(primaryId)
    const direct = events.find((e) => e.target.target_id === primaryId && e.attribution === 'direct')
    const capKey = direct ? capKeyOf(direct.activity) : `${it.modality}_${it.capability}`
    const lane = getLane(state, capKey, 'overall')

    rows.push({
      index: it.index,
      session: Math.floor(it.index / sessionSize) + 1,
      pack: it.pack_after,
      exemplar: it.activity_plan.exemplar_id,
      construction: it.activity_plan.construction_id,
      focus_target: it.study_focus.target?.target_id ?? null,
      primary_target: primaryId,
      capability: it.capability,
      modality: it.modality,
      recipe: it.recipe,
      support_tier: it.support_tier,
      outcome: it.assessment.outcome,
      evidence: events.map((e) => ({
        target_id: e.target.target_id,
        target_type: e.target.target_type,
        attribution: e.attribution,
        capability: e.activity?.capability ?? null,
        modality: e.activity?.modality ?? null,
        support_tier: deriveSupportTier(e.support),
        outcome: e.outcome,
        effective_weight: ASSESSED.has(e.outcome) ? round(getEvidenceWeight(e)) : 0,
      })),
      direct_weight: direct && ASSESSED.has(direct.outcome) ? round(getEvidenceWeight(direct)) : 0,
      lane_after: {
        capability_key: capKey,
        assessed_evidence_count: lane?.assessed_evidence_count ?? 0,
        effective_weight: round(lane?.effective_evidence_weight ?? 0),
        mastery_estimate: round(lane?.mastery_estimate ?? null),
        evidence_level: lane?.evidence_level ?? 'insufficient',
        trend: lane?.trend ?? null,
      },
      eligible_domains: it.eligible_domains,
      eligible_entry_domains: it.eligible_entry_domains,
    })
  }
  return { rows, finalStream: stream }
}

// ---------------------------------------------------------------------------
// §4/§7/§8 — fragmentation audits
// ---------------------------------------------------------------------------

/**
 * How much of one knowledge unit's assessed evidence is split across axes that
 * each carry their own advancement bar. `concentration` is the largest single
 * bucket's share of the total effective weight: 1.0 = one lane carries
 * everything, 0.25 = the evidence is quartered.
 */
function splitReport(events, keyFn) {
  const weightByKey = {}
  let total = 0
  for (const e of events) {
    if (!ASSESSED.has(e.outcome)) continue
    const w = getEvidenceWeight(e)
    const k = keyFn(e)
    weightByKey[k] = round((weightByKey[k] || 0) + w)
    total += w
  }
  const best = Math.max(0, ...Object.values(weightByKey))
  return {
    buckets: weightByKey,
    total_weight: round(total),
    largest_bucket_weight: round(best),
    concentration: total ? round(best / total) : null,
  }
}

function buildFragmentation(stream, { registry }) {
  const assessed = stream.filter((e) => ASSESSED.has(e.outcome))
  const byConstruction = new Map() // construction/sense pairing, per lexeme family

  // A "knowledge family" groups the sense and construction targets that belong
  // to the same lexeme — the unit a learner subjectively feels they "know".
  const familyOf = (targetId) => {
    const m = /^(?:sense|construction|function|lexeme):([^.]+)/.exec(targetId)
    return m ? m[1] : targetId
  }
  for (const e of assessed) {
    const fam = familyOf(e.target.target_id)
    if (!byConstruction.has(fam)) byConstruction.set(fam, [])
    byConstruction.get(fam).push(e)
  }

  const families = [...byConstruction.entries()].map(([family, events]) => ({
    family,
    assessed_events: events.length,
    // A — sense vs construction (§4.A). NEVER a proposal to collapse them
    // (§6); purely a measurement of where the evidence lands.
    target_type_split: splitReport(events, (e) => e.target.target_type),
    // B — reading vs listening (§4.B / §7)
    modality_split: splitReport(events, (e) => e.activity?.modality ?? '-'),
    // C — supported vs independent (§4.C / §8)
    support_lane_split: splitReport(events, (e) => (deriveSupportTier(e.support) === 'none' ? 'independent' : 'supported')),
    // D — direct vs indirect (§4.D)
    attribution_split: splitReport(events, (e) => e.attribution),
    // E — capability keys (§4.E)
    capability_key_split: splitReport(events, (e) => capKeyOf(e.activity) ?? '-'),
  })).sort((a, b) => b.assessed_events - a.assessed_events)

  const mean = (sel) => {
    const vals = families.map(sel).filter((v) => v != null)
    return vals.length ? round(vals.reduce((a, c) => a + c, 0) / vals.length) : null
  }
  void registry
  return {
    families,
    mean_concentration: {
      target_type: mean((f) => f.target_type_split.concentration),
      modality: mean((f) => f.modality_split.concentration),
      support_lane: mean((f) => f.support_lane_split.concentration),
      attribution: mean((f) => f.attribution_split.concentration),
      capability_key: mean((f) => f.capability_key_split.concentration),
    },
  }
}

// ---------------------------------------------------------------------------
// §5 — introduction-group primary-target attribution
// ---------------------------------------------------------------------------

function buildIntroductionGroupReport(result, { registry, stream }) {
  const usedExemplars = new Set(result.interactions.map((it) => it.activity_plan.exemplar_id))
  const directByExemplar = new Map()
  for (const e of stream) {
    if (e.attribution !== 'direct' || !e.exemplar_id) continue
    if (!directByExemplar.has(e.exemplar_id)) directByExemplar.set(e.exemplar_id, new Set())
    directByExemplar.get(e.exemplar_id).add(e.target.target_id)
  }

  const groups = new Map()
  for (const pack of registry.packs) {
    for (const ex of pack.exemplars || []) {
      const gid = ex.introduction_group_id
      if (!gid) continue
      if (!groups.has(gid)) groups.set(gid, [])
      const ordered = (ex.pedagogical_targets || [])
        .filter((t) => t.role === 'primary')
        .map((t) => `${t.target_type}:${t.target_id}`)
      groups.get(gid).push({
        exemplar_id: ex.exemplar_id,
        used_in_run: usedExemplars.has(ex.exemplar_id),
        ordered_primary_targets: ordered,
        effective_plan_primary_target: ordered[0] ?? null,
        direct_evidence_targets: [...(directByExemplar.get(ex.exemplar_id) || [])].sort(),
      })
    }
  }

  const rows = [...groups.entries()].map(([group_id, members]) => {
    const effective = members.map((m) => m.effective_plan_primary_target).filter(Boolean)
    const distinct = [...new Set(effective)].sort()
    return {
      group_id,
      member_count: members.length,
      used_member_count: members.filter((m) => m.used_in_run).length,
      distinct_effective_primary_targets: distinct,
      splits_evidence_across_targets: distinct.length > 1,
      members,
    }
  }).sort((a, b) => (a.group_id < b.group_id ? -1 : 1))

  return {
    groups: rows,
    groups_splitting_primary_target: rows.filter((r) => r.splits_evidence_across_targets).map((r) => r.group_id),
  }
}

// ---------------------------------------------------------------------------
// §11/§12 — target completion funnel
// ---------------------------------------------------------------------------

const FUNNEL_STAGES = (() => {
  const stages = [{ key: 'exposed', label: 'targets exposed' }]
  for (const cap of CAPABILITY_LADDER.slice(0, 4)) {
    stages.push({ key: `${cap}_evidence`, label: `${cap} evidence`, capability: cap, kind: 'entered' })
    stages.push({ key: `${cap}_advancement`, label: `${cap} advancement met`, capability: cap, kind: 'met' })
  }
  return stages
})()

function buildFunnel(finalStates, thresholds) {
  const per = {}
  for (const stage of FUNNEL_STAGES) per[stage.key] = []

  for (const state of finalStates) {
    const id = state.target.target_id
    if ((state.exposure?.count || 0) > 0) per.exposed.push(id)
    for (const cap of CAPABILITY_LADDER.slice(0, 4)) {
      if (capabilityAssessedCount(state, cap) > 0) per[`${cap}_evidence`].push(id)
      if (capabilityMeets(state, cap, thresholds.advancement)) per[`${cap}_advancement`].push(id)
    }
  }

  return FUNNEL_STAGES.map((stage) => ({
    stage: stage.key,
    label: stage.label,
    count: per[stage.key].length,
    target_ids: per[stage.key].sort(),
  }))
}

function firstBlockingStage(funnel) {
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1]
    const cur = funnel[i]
    if (prev.count > 0 && cur.count === 0) {
      return { stage: cur.stage, label: cur.label, upstream_count: prev.count, upstream_stage: prev.stage, drop: 1 }
    }
    if (prev.count > 0 && cur.count / prev.count < 0.5) {
      return {
        stage: cur.stage, label: cur.label, upstream_count: prev.count, upstream_stage: prev.stage,
        drop: round(1 - cur.count / prev.count),
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// §9/§10 — opportunity trace and cause classification
// ---------------------------------------------------------------------------

/**
 * For each target that carries recognition evidence but never advanced, decide
 * WHY, using only measured facts. The categories are §10's; "looks like a
 * threshold" is never an accepted answer — EVIDENCE_TOO_WEAK is only emitted
 * when the target actually accumulated enough CORRECT assessed events and the
 * weighting is what kept it under the bar.
 */
function classifyStuckTargets({ finalStates, stream, thresholds, trace, affordances }) {
  const eventsByTarget = new Map()
  for (const e of stream) {
    if (!eventsByTarget.has(e.target.target_id)) eventsByTarget.set(e.target.target_id, [])
    eventsByTarget.get(e.target.target_id).push(e)
  }
  const domainSeen = new Set()
  for (const row of trace) for (const d of row.eligible_domains || []) domainSeen.add(d)

  const causes = []
  for (const state of finalStates) {
    const id = state.target.target_id
    const events = eventsByTarget.get(id) || []
    const assessed = events.filter((e) => ASSESSED.has(e.outcome))
    if (!assessed.length) continue

    // Where on the ladder is this target stuck?
    let stuckAt = null
    for (const cap of CAPABILITY_LADDER.slice(0, 4)) {
      if (capabilityMeets(state, cap, thresholds.advancement)) continue
      stuckAt = cap
      break
    }
    if (!stuckAt) continue // fully advanced through the audited ladder

    const capAssessed = capabilityAssessedCount(state, stuckAt)
    const capWeight = capabilityEffectiveWeight(state, stuckAt)
    const correct = assessed.filter((e) => e.outcome === 'correct').length

    // The bar as the lanes see it: the BEST single lane vs the aggregate.
    const laneRows = modalitiesFor(stuckAt).map((m) => {
      const lane = getLane(state, `${m}_${stuckAt}`, 'overall')
      return {
        capability_key: `${m}_${stuckAt}`,
        assessed_evidence_count: lane?.assessed_evidence_count || 0,
        effective_weight: round(lane?.effective_evidence_weight || 0),
        mastery_estimate: round(lane?.mastery_estimate ?? null),
        evidence_level: lane?.evidence_level ?? 'insufficient',
        meets: laneMeets(lane, thresholds.advancement),
      }
    }).filter((l) => l.assessed_evidence_count > 0)

    const bestLaneWeight = Math.max(0, ...laneRows.map((l) => l.effective_weight))
    const aggregateMeetsButNoLane = capWeight >= 2 && bestLaneWeight < 2 && laneRows.length > 1

    // Would this capability even be reachable if the bar were met?
    const entryExists = modalitiesFor(stuckAt).some((m) => affordances.some(
      (a) => a.capability === stuckAt && a.modality === m && a.can_produce_assessed_evidence,
    ))

    let cause
    if (capAssessed === 0) {
      cause = entryExists ? 'CAPABILITY_ENTRY_BLOCKED' : 'CONTENT_PREREQUISITE_BLOCK'
    } else if (aggregateMeetsButNoLane) {
      cause = 'MODALITY_FRAGMENTATION'
    } else if (correct >= 5 && capWeight < 2) {
      cause = 'EVIDENCE_TOO_WEAK'
    } else if (capAssessed < 5) {
      cause = 'PLANNER_BREADTH_STARVATION'
    } else {
      cause = 'EVIDENCE_TOO_WEAK'
    }

    causes.push({
      target_id: id,
      target_type: state.target.target_type,
      stuck_at: stuckAt,
      cause,
      assessed_events_total: assessed.length,
      correct_events_total: correct,
      capability_assessed_count: capAssessed,
      capability_effective_weight: capWeight,
      best_lane_effective_weight: round(bestLaneWeight),
      required_effective_weight: 2, // EVIDENCE_LEVEL_THRESHOLDS.emerging
      lanes: laneRows,
      capability_domain_ever_eligible: modalitiesFor(stuckAt).some((m) => domainSeen.has(`${stuckAt}_${m}`)),
    })
  }
  return causes.sort((a, b) => b.assessed_events_total - a.assessed_events_total)
}

function summarizeOpportunities(trace, finalStates, thresholds) {
  // For every target, from the interaction AFTER its first assessed recognition
  // evidence onwards: was a deepen candidate eligible, and was it selected?
  const firstEvidenceIndex = new Map()
  for (const row of trace) {
    for (const e of row.evidence) {
      if (!ASSESSED.has(e.outcome)) continue
      if (!firstEvidenceIndex.has(e.target_id)) firstEvidenceIndex.set(e.target_id, row.index)
    }
  }
  const statesById = indexStatesByTargetId(finalStates)
  const rows = []
  for (const [targetId, firstIndex] of firstEvidenceIndex) {
    const after = trace.filter((r) => r.index > firstIndex)
    const revisits = after.filter((r) => r.primary_target === targetId).length
    const state = statesById.get(targetId)
    rows.push({
      target_id: targetId,
      first_evidence_at: firstIndex,
      interactions_after: after.length,
      direct_revisits_after: revisits,
      next_rung: CAPABILITY_LADDER.slice(0, 4).find((c) => !capabilityMeets(state, c, thresholds.advancement)) ?? null,
      // Was a candidate for the next rung ever eligible after the first hit?
      next_rung_ever_eligible: after.some((r) => (r.eligible_domains || []).some((d) => d.startsWith(
        `${CAPABILITY_LADDER.slice(0, 4).find((c) => !capabilityMeets(state, c, thresholds.advancement)) ?? '~none~'}_`,
      ))),
    })
  }
  rows.sort((a, b) => b.direct_revisits_after - a.direct_revisits_after)
  return {
    targets: rows,
    mean_direct_revisits_after_first_evidence: rows.length
      ? round(rows.reduce((a, c) => a + c.direct_revisits_after, 0) / rows.length) : null,
    targets_never_revisited: rows.filter((r) => r.direct_revisits_after === 0).map((r) => r.target_id),
  }
}

// ---------------------------------------------------------------------------
// §27 — recipe reachability matrix
// ---------------------------------------------------------------------------

function buildRecipeMatrix(result, { registry, trace }) {
  const availability = computeRecipeRuntimeAvailability(result.scenario.runtime_capabilities)
  const selected = tally(result.interactions.map((it) => it.recipe))
  const eligibleDomainCount = {}
  for (const row of trace) for (const d of row.eligible_domains || []) eligibleDomainCount[d] = (eligibleDomainCount[d] || 0) + 1

  // Content eligibility: does ANY exemplar in the registry carry what the
  // recipe needs? Approximated structurally — a recipe needing a construction
  // needs an exemplar with one; every recipe needs an exemplar at all.
  const exemplarCount = registry.packs.reduce((n, p) => n + (p.exemplars?.length || 0), 0)

  return LESSON_RECIPES.map((recipe) => {
    const domains = recipe.pairs.map(([c, m]) => `${c}_${m}`)
    const plannerOpportunities = domains.reduce((n, d) => n + (eligibleDomainCount[d] || 0), 0)
    return {
      recipe: recipe.recipe,
      capability: [...new Set(recipe.pairs.map(([c]) => c))].join('|'),
      modality: [...new Set(recipe.pairs.map(([, m]) => m))].join('|'),
      runtime_executable: recipe.pairs.some(([, m]) => isRecipeExecutable(availability, recipe.recipe, m)),
      content_eligible: exemplarCount > 0,
      planner_opportunity_count: plannerOpportunities,
      selected_count: selected[recipe.recipe] || 0,
    }
  })
}

/**
 * §28 — RECIPE_REACHABLE_BUT_STARVED. A recipe that is runtime executable,
 * content eligible and whose capability domain WAS an eligible planner domain
 * at least `minOpportunities` times, yet was never selected.
 */
export const RECIPE_STARVATION_MIN_OPPORTUNITIES = 5

function buildFindings(matrix, funnel) {
  const findings = []
  for (const row of matrix) {
    if (!row.runtime_executable || !row.content_eligible) continue
    if (row.planner_opportunity_count >= RECIPE_STARVATION_MIN_OPPORTUNITIES && row.selected_count === 0) {
      findings.push({
        code: 'RECIPE_REACHABLE_BUT_STARVED',
        severity: 'major',
        recipe: row.recipe,
        capability: row.capability,
        planner_opportunity_count: row.planner_opportunity_count,
        detail: `runtime-executable and content-eligible; the planner had ${row.planner_opportunity_count}`
          + ' opportunities in this capability domain and never selected it',
      })
    }
  }
  const block = firstBlockingStage(funnel)
  if (block) {
    findings.push({
      code: 'CAPABILITY_LADDER_BLOCKED',
      severity: block.drop === 1 ? 'critical' : 'major',
      stage: block.stage,
      detail: `${block.upstream_count} targets reached ${block.upstream_stage}; ${round((1 - block.drop) * 100, 1)}%`
        + ` of them reached ${block.stage}`,
    })
  }
  return findings
}

// ---------------------------------------------------------------------------

/**
 * analyzeCapabilityProgressionV2(simulationResult, { registry, policy })
 * → the full R3 diagnostic report for one scenario. Pure; never mutates.
 */
export function analyzeCapabilityProgressionV2(result, { registry, policy = {}, sessionSize = 12 } = {}) {
  const thresholds = mergeStudyPlannerPolicyV2(policy).thresholds
  const affordances = getTrainingAffordancesV2({
    runtimeAvailability: computeRecipeRuntimeAvailability(result.scenario.runtime_capabilities),
  })
  const { rows: trace, finalStream } = buildTrace(result, { sessionSize })
  const finalStates = result.final_learner_states
  const funnel = buildFunnel(finalStates, thresholds)
  const recipeMatrix = buildRecipeMatrix(result, { registry, trace })

  // §8 — which lane does advancement actually wait for, per capability domain?
  const supportFragmentation = affordances.map((a) => {
    const key = `${a.modality}_${a.capability}`
    const withIndependentEvidence = finalStates.filter((s) => (getLane(s, key, 'independent')?.assessed_evidence_count || 0) > 0).length
    const withSupportedEvidence = finalStates.filter((s) => (getLane(s, key, 'supported')?.assessed_evidence_count || 0) > 0).length
    return {
      capability_key: key,
      can_train_independent: a.can_train_independent,
      independent_recipes: a.independent_recipes,
      targets_with_supported_evidence: withSupportedEvidence,
      targets_with_independent_evidence: withIndependentEvidence,
      // The V2.7 loop shape: advancement waits on a lane the affordances can
      // never materialize.
      advancement_waits_on_unreachable_lane: !a.can_train_independent && withIndependentEvidence === 0
        && withSupportedEvidence > 0,
    }
  })

  const modalityFragmentation = CAPABILITY_LADDER.slice(0, 4).map((cap) => {
    const rows = finalStates.map((s) => ({
      target_id: s.target.target_id,
      aggregate_weight: capabilityEffectiveWeight(s, cap),
      best_lane_weight: round(Math.max(0, ...modalitiesFor(cap).map(
        (m) => getLane(s, `${m}_${cap}`, 'overall')?.effective_evidence_weight || 0,
      ))),
    })).filter((r) => r.aggregate_weight > 0)
    return {
      capability: cap,
      targets_with_evidence: rows.length,
      // The §7 question, measured: aggregate over the bar, no single lane over it.
      targets_aggregate_over_bar_no_lane_over_bar: rows.filter((r) => r.aggregate_weight >= 2 && r.best_lane_weight < 2).length,
      examples: rows.filter((r) => r.aggregate_weight >= 2 && r.best_lane_weight < 2).slice(0, 8),
    }
  })

  return {
    analyzer_version: CAPABILITY_PROGRESSION_ANALYZER_VERSION,
    scenario_id: result.scenario.scenario_id,
    interaction_count: result.interactions.length,
    thresholds,
    trace,
    funnel,
    first_block: firstBlockingStage(funnel),
    fragmentation: buildFragmentation(finalStream, { registry }),
    introduction_groups: buildIntroductionGroupReport(result, { registry, stream: finalStream }),
    modality_fragmentation: modalityFragmentation,
    support_fragmentation: supportFragmentation,
    opportunity_summary: summarizeOpportunities(trace, finalStates, thresholds),
    causes: classifyStuckTargets({ finalStates, stream: finalStream, thresholds, trace, affordances }),
    recipe_matrix: recipeMatrix,
    findings: buildFindings(recipeMatrix, funnel),
    capability_distribution: tally(result.interactions.map((it) => it.capability)),
    recipe_distribution: tally(result.interactions.map((it) => it.recipe)),
  }
}

/** Convenience for tests: the funnel stage counts as a plain object. */
export function funnelCountsV2(report) {
  return Object.fromEntries(report.funnel.map((s) => [s.stage, s.count]))
}
