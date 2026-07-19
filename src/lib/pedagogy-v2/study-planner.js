// study-planner.js — Study Planner V2 core (Slice V2.6): pure, deterministic
// selection of the next STUDY FOCUS (which pack, which lexeme, which target,
// which kind of need) BEFORE the lesson engine runs.
//
//   Study Planner  → decides WHAT to study now
//   Lesson Engine  → decides HOW to practice it (exemplar/recipe/support)
//
// The planner never creates activities, never re-implements engine scoring,
// never invents a global mastery per lexeme and never reads the clock or
// randomness: `now` arrives via the study session, ties are broken by a
// seeded deterministic hash (a different seed can only permute EQUAL-score
// candidates), and every iteration happens in canonical (sorted) order so the
// order of packs/states in the input can never change the result.

import { stageIndex, EXPOSURE_STAGES } from './contracts.js'
import { resolvePedagogyEntity } from './registry.js'
import { getV2Prerequisites, getIntendedNewItems, getPrimaryTargets, exposureProgression } from './query.js'
import {
  indexStatesByTargetId, getLane, laneMeets, exposureCount, assessTargetPrerequisite,
} from './lesson-engine-state-queries.js'
import { LESSON_RECIPES } from './lesson-engine-contracts.js'
import { isRecipeExecutable } from './runtime-capabilities.js'
import { getTrainingAffordancesV2, canTrainIndependentV2 } from './training-affordances.js'
import { buildReviewQueueV2, modalityGapCounterpart } from './review-queue.js'
import {
  STUDY_FOCUS_V2_VERSION, STUDY_PLANNER_V2_VERSION, RELATION_PLANNER_POLICY,
  mergeStudyPlannerPolicyV2, effectiveWeight, consecutiveSamePack, consecutiveReviews,
} from './study-planner-contracts.js'

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const round4 = (n) => +Number(n).toFixed(4)

// Deterministic tie-break hash (FNV-1a), same scheme as the lesson engine.
function tieHash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// Capability ladder + the modalities each capability trains (sorted for
// determinism). Mirrors the approved learner-model taxonomy — never restated
// per lexeme.
const CAPABILITY_LADDER = ['recognition', 'comprehension', 'controlled_production', 'free_production', 'pronunciation']
const CAPABILITY_MODALITIES = Object.freeze({
  recognition: ['listening', 'reading'],
  comprehension: ['listening', 'reading'],
  controlled_production: ['speaking', 'writing'],
  free_production: ['speaking', 'writing'],
  pronunciation: ['speaking'],
})

/** Is at least one recipe serving (capability, modality) executable here? */
export function focusRuntimeExecutable(runtimeAvailability, capability, modality) {
  if (!capability) return true // introduction: exposure is always executable
  for (const recipe of LESSON_RECIPES) {
    for (const [cap, mod] of recipe.pairs) {
      if (cap !== capability) continue
      if (modality && mod !== modality) continue
      if (isRecipeExecutable(runtimeAvailability, recipe.recipe, mod)) return true
    }
  }
  return false
}

// ---- registry-derived planning index ----------------------------------------

function buildPlanningIndex(registry) {
  const packs = [...(registry?.packs || [])].sort((a, b) => (a.manifest.pack_id < b.manifest.pack_id ? -1 : 1))
  const owner = new Map()          // entity id → pack_id
  const packsForTarget = new Map() // target id → Set(pack_id) with exemplars declaring it
  const relations = []
  for (const pack of packs) {
    const packId = pack.manifest.pack_id
    const add = (id) => { if (id && !owner.has(id)) owner.set(id, packId) }
    for (const l of pack.lexemes || []) add(l.lexeme_id)
    for (const s of pack.senses || []) add(s.sense_id)
    for (const c of pack.constructions || []) add(c.construction_id)
    for (const f of pack.communicative_functions || []) add(f.function_id)
    for (const e of pack.exemplars || []) {
      add(e.exemplar_id)
      for (const t of e.pedagogical_targets || []) {
        if (!packsForTarget.has(t.target_id)) packsForTarget.set(t.target_id, new Set())
        packsForTarget.get(t.target_id).add(packId)
      }
    }
    for (const r of pack.relations || []) relations.push({ ...r, declared_by: packId })
  }
  return { packs, owner, packsForTarget, relations }
}

// Curricular frontier of one pack (mirrors the engine's definition): earliest
// stage whose exemplar still has a primary target not consolidated in any
// recognition capability.
const RECOGNITION_KEYS = ['reading_recognition', 'listening_recognition', 'multimodal_recognition']
function packFrontierIdx(pack, statesById, thresholds) {
  const maxIdx = EXPOSURE_STAGES.length - 1
  let frontier = maxIdx
  let found = false
  for (const e of pack.exemplars || []) {
    const primaries = getPrimaryTargets(e).map((t) => t.target_id)
    if (!primaries.length) continue
    const consolidated = primaries.every((id) =>
      RECOGNITION_KEYS.some((k) => laneMeets(getLane(statesById.get(id), k, 'overall'), thresholds.advancement)))
    if (!consolidated) {
      const idx = stageIndex(e.exposure_stage)
      if (!found || idx < frontier) { frontier = idx; found = true }
    }
  }
  return frontier
}

// ---- candidate generation (§6) ----------------------------------------------

const ASSESSED = ['correct', 'partial', 'incorrect']

function lastAssessedByTargetCap(recentEvidence) {
  const sorted = [...(recentEvidence || [])]
    .filter((e) => ASSESSED.includes(e.outcome))
    .sort((a, b) => (Date.parse(a.occurred_at) - Date.parse(b.occurred_at)) || (a.evidence_id < b.evidence_id ? -1 : 1))
  const out = new Map()
  for (const e of sorted) {
    if (e.target?.target_id && e.activity) {
      out.set(`${e.target.target_id}|${e.activity.modality}_${e.activity.capability}`, e.outcome)
    }
  }
  return out
}

/**
 * Generate every raw focus candidate for the snapshot. Pure and canonical:
 * candidates come out in a stable order with stable keys. Filtering/scoring
 * happens in selectNextStudyFocusV2.
 */
export function buildStudyCandidatesV2({
  registry, learnerStates = [], recentEvidence = [], policy = {}, allowedPackIds = null, now,
  runtimeAvailability = null,
} = {}) {
  const p = mergeStudyPlannerPolicyV2(policy)
  const index = buildPlanningIndex(registry)
  const statesById = indexStatesByTargetId(learnerStates)
  const lastOutcome = lastAssessedByTargetCap(recentEvidence)
  const allowed = allowedPackIds ? new Set(allowedPackIds) : null
  const packs = index.packs.filter((pk) => !allowed || allowed.has(pk.manifest.pack_id))
  // Single source of truth for "what can actually be trained here" (Slice V2.8).
  // Independence is only a real focus when an executable, unaided, assessed
  // recipe exists for the domain — recognition/comprehension have none.
  const affordances = getTrainingAffordancesV2({ runtimeAvailability })
  const queue = buildReviewQueueV2({ registry, learnerStates, recentEvidence, now, policy: p, runtimeAvailability })
  const queueByKey = new Map(queue.map((item) => [`${item.target.target_id}|${item.capability_key}`, item]))
  const candidates = new Map() // key → candidate
  const maxStageIdx = EXPOSURE_STAGES.length - 1

  const emptyComponents = () => ({
    retention_need: 0, recent_failure: 0, trend_need: 0,
    capability_gap: 0, modality_gap: 0, independence_gap: 0,
    curriculum_frontier: 0, cross_pack_transfer: 0,
    novelty_value: 0, diversity: 0, recency_penalty: 0,
  })

  const addCandidate = (c) => {
    const key = `${c.pack_id}|${c.focus_type}|${c.target?.target_id ?? '-'}|${c.capability ?? '-'}|${c.modality ?? '-'}`
    if (!candidates.has(key)) candidates.set(key, { ...c, key, reason_codes: [...new Set(c.reason_codes)].sort() })
  }

  // Cross-pack transfer annotation for a candidate target (§9/§10): typed
  // relations influence priority per RELATION_PLANNER_POLICY — never as
  // implicit prerequisites.
  const annotateTransfer = (candidate) => {
    const targetId = candidate.target?.target_id
    if (!targetId) return
    for (const r of index.relations) {
      const rolePolicy = RELATION_PLANNER_POLICY[r.relation_type]
      if (r.from !== targetId) continue
      if (rolePolicy === 'priority_when_base_known') {
        const base = statesById.get(r.to)
        if (base && assessTargetPrerequisite(statesById, r.to, p.thresholds.prerequisite) === 'met') {
          candidate.components.cross_pack_transfer = Math.max(candidate.components.cross_pack_transfer, 1)
          candidate.reason_codes.push('CROSS_PACK_TRANSFER_OPPORTUNITY')
          if (index.owner.get(r.to) !== index.owner.get(targetId)) {
            candidate.reason_codes.push('KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK')
          }
        }
      } else if (rolePolicy === 'transfer_priority') {
        const fn = statesById.get(r.to)
        if (fn && exposureCount(fn) > 0) {
          candidate.components.cross_pack_transfer = Math.max(candidate.components.cross_pack_transfer, 0.75)
          candidate.reason_codes.push('KNOWN_FUNCTION_NEW_CONSTRUCTION')
        }
      } else if (rolePolicy === 'light_bonus') {
        const other = statesById.get(r.to)
        if (other && exposureCount(other) > 0) {
          candidate.components.cross_pack_transfer = Math.max(candidate.components.cross_pack_transfer, 0.25)
        }
      }
      // blocking (prerequisite relations) is handled with the hard filters;
      // diagnostic_only types never gate nor boost.
    }
    // reuses_lexeme_context points AT a lexeme: candidate targets whose id IS
    // the relation's `from` were covered above; also surface the inverse
    // (extension of a known lexeme context).
    for (const r of index.relations) {
      if (RELATION_PLANNER_POLICY[r.relation_type] !== 'diagnostic_only' || r.relation_type !== 'reuses_lexeme_context') continue
      if (r.from === targetId) {
        const lexOwner = index.owner.get(r.to)
        const known = [...statesById.values()].some((s) => index.owner.get(s.target?.target_id) === lexOwner && exposureCount(s) > 0)
        if (known) candidate.reason_codes.push('KNOWN_LEXEME_CONTEXT_EXTENDED')
      }
    }
  }

  // ---- introduction / cross-pack progression candidates ----
  for (const pack of packs) {
    const packId = pack.manifest.pack_id
    const lexemeId = pack.manifest.primary_lexeme_id
    const frontierIdx = packFrontierIdx(pack, statesById, p.thresholds)
    const introducedTargets = new Set()
    for (const exemplar of exposureProgression(pack)) {
      const newRefs = getIntendedNewItems(exemplar).map((n) => n.ref)
        .filter((ref) => exposureCount(statesById.get(ref)) === 0)
      if (!newRefs.length) continue
      const primary = getPrimaryTargets(exemplar).find((t) => exposureCount(statesById.get(t.target_id)) === 0)
      const target = primary ?? { target_type: 'construction', target_id: newRefs[0] }
      if (introducedTargets.has(target.target_id)) continue
      introducedTargets.add(target.target_id)

      // Prerequisite gate (mirrors the engine: V2 prerequisites must be met).
      const prereqs = getV2Prerequisites(exemplar).map((pr) => ({
        ...pr,
        status: assessTargetPrerequisite(statesById, pr.ref, p.thresholds.prerequisite),
        owner_pack_id: index.owner.get(pr.ref) ?? null,
      }))
      const candidate = {
        focus_type: 'introduce',
        pack_id: packId,
        lexeme_id: lexemeId,
        target: { target_type: target.target_type, target_id: target.target_id },
        capability: null,
        modality: null,
        is_new_target: true,
        introducing_exemplar_id: exemplar.exemplar_id,
        prereqs,
        reason_codes: ['NEVER_EXPOSED'],
        components: emptyComponents(),
      }
      candidate.components.novelty_value = 1
      const stageIdx = stageIndex(exemplar.exposure_stage)
      candidate.components.curriculum_frontier = clamp01(1 - Math.abs(stageIdx - frontierIdx) / Math.max(1, maxStageIdx))
      if (stageIdx === frontierIdx) candidate.reason_codes.push('CURRICULUM_FRONTIER')
      const crossMet = prereqs.filter((pr) => pr.status === 'met' && pr.owner_pack_id && pr.owner_pack_id !== packId)
      if (crossMet.length) candidate.reason_codes.push('CROSS_PACK_PREREQUISITE_MET')
      annotateTransfer(candidate)
      if (candidate.components.cross_pack_transfer > 0 || crossMet.length) {
        candidate.focus_type = 'cross_pack_progression'
      }
      addCandidate(candidate)
    }
  }

  // ---- state-driven candidates (deepen / independence / remediate / review) ----
  const sortedStates = [...(learnerStates || [])]
    .filter((s) => s?.target?.target_id)
    .sort((a, b) => (a.target.target_id < b.target.target_id ? -1 : 1))
  for (const state of sortedStates) {
    const targetId = state.target.target_id
    const ownerPack = index.owner.get(targetId)
    if (!ownerPack) continue
    const eligiblePacks = [...(index.packsForTarget.get(targetId) || [])]
      .filter((id) => !allowed || allowed.has(id)).sort()
    if (!eligiblePacks.length) continue
    const packId = eligiblePacks.includes(ownerPack) ? ownerPack : eligiblePacks[0]
    const pack = index.packs.find((pk) => pk.manifest.pack_id === packId)
    const lexemeId = pack.manifest.primary_lexeme_id
    const base = {
      pack_id: packId,
      lexeme_id: lexemeId,
      target: { target_type: state.target.target_type, target_id: targetId },
      is_new_target: false,
      prereqs: [],
    }

    const capKeys = Object.keys(state.capabilities || {}).sort()
    for (const capKey of capKeys) {
      const [modality, ...rest] = capKey.split('_')
      const capability = rest.join('_')
      const cap = state.capabilities[capKey]

      // remediate — recent failure or declining trend.
      const failed = lastOutcome.get(`${targetId}|${capKey}`) === 'incorrect'
      const declining = cap.overall?.trend === 'declining'
      if (failed || declining) {
        const c = {
          ...base, focus_type: 'remediate', capability, modality,
          reason_codes: [failed ? 'RECENT_FAILURE' : null, declining ? 'DECLINING_TREND' : null].filter(Boolean),
          components: emptyComponents(),
        }
        c.components.recent_failure = failed ? 1 : 0
        c.components.trend_need = declining ? 1 : 0
        addCandidate(c)
      }

      // independence — supported established, independent absent, AND the engine
      // can actually train this domain to unaided assessed evidence (Slice V2.8:
      // recognition/comprehension have no independent recipe, so no independence
      // focus is generated for them — this breaks the V2.7 independence loop).
      if (laneMeets(getLane(state, capKey, 'supported'), p.thresholds.advancement)
        && (getLane(state, capKey, 'independent')?.assessed_evidence_count || 0) === 0
        && canTrainIndependentV2(capability, modality, { affordances })) {
        const c = {
          ...base, focus_type: 'independence', capability, modality,
          reason_codes: ['SUPPORTED_WITHOUT_INDEPENDENT'],
          components: emptyComponents(),
        }
        c.components.independence_gap = 1
        addCandidate(c)
      }

      // review — straight from the runtime review queue.
      const queued = queueByKey.get(`${targetId}|${capKey}`)
      if (queued) {
        const c = {
          ...base, focus_type: 'review', capability, modality,
          reason_codes: [...queued.reason_codes],
          components: emptyComponents(),
          queue_priority: queued.priority,
        }
        c.components.retention_need = clamp01(queued.priority / p.retention.due_cap)
        addCandidate(c)
      }

      // deepen (consolidation) — this capability key HAS assessed evidence but
      // is still below the advancement bar: keep practicing toward it. The
      // `already_consolidated` filter guarantees this disappears once met.
      if ((cap.overall?.assessed_evidence_count || 0) > 0
        && !laneMeets(cap.overall, p.thresholds.advancement)) {
        const c = {
          ...base, focus_type: 'deepen', capability, modality,
          reason_codes: ['CAPABILITY_GAP'],
          components: emptyComponents(),
        }
        c.components.capability_gap = clamp01(1 - (cap.overall?.mastery_estimate ?? 0))
        addCandidate(c)
      }

      // deepen (modality gap) — same capability, paired modality without evidence.
      const counterpart = modalityGapCounterpart(capKey)
      if (counterpart && (cap.overall?.assessed_evidence_count || 0) > 0) {
        const otherCap = state.capabilities?.[counterpart]
        if (!(otherCap && (otherCap.overall?.assessed_evidence_count || 0) > 0)) {
          const [gapModality, ...gapRest] = counterpart.split('_')
          const c = {
            ...base, focus_type: 'deepen', capability: gapRest.join('_'), modality: gapModality,
            reason_codes: ['MODALITY_GAP'],
            components: emptyComponents(),
          }
          c.components.modality_gap = 1
          addCandidate(c)
        }
      }
    }

    // deepen (first rung): exposed but never assessed at all — the natural
    // step after exposure is recognition practice (the engine picks the
    // modality/recipe).
    if (exposureCount(state) > 0 && capKeys.length === 0) {
      const c = {
        ...base, focus_type: 'deepen', capability: 'recognition', modality: null,
        reason_codes: ['CAPABILITY_GAP', 'CURRICULUM_FRONTIER'],
        components: emptyComponents(),
      }
      c.components.capability_gap = 1
      c.components.curriculum_frontier = 1
      addCandidate(c)
    }

    // deepen (capability ladder gap): previous rung met, next rung unassessed.
    for (let i = 1; i < CAPABILITY_LADDER.length; i++) {
      const prev = CAPABILITY_LADDER[i - 1]
      const next = CAPABILITY_LADDER[i]
      const prevMet = CAPABILITY_MODALITIES[prev].some((m) => laneMeets(getLane(state, `${m}_${prev}`, 'overall'), p.thresholds.advancement))
      if (!prevMet) continue
      const nextAssessed = CAPABILITY_MODALITIES[next].some((m) => (getLane(state, `${m}_${next}`, 'overall')?.assessed_evidence_count || 0) > 0)
      if (nextAssessed) continue
      const modality = CAPABILITY_MODALITIES[next][0] // sorted → deterministic
      const c = {
        ...base, focus_type: 'deepen', capability: next, modality,
        reason_codes: ['CAPABILITY_GAP'],
        components: emptyComponents(),
      }
      c.components.capability_gap = 1
      addCandidate(c)
      break // only the FIRST open rung per target
    }
  }

  return [...candidates.values()]
}

// ---- selection (§11–§14) ----------------------------------------------------

function scoreOf(candidate, { policy, mode, session }) {
  const c = candidate.components
  const w = (key) => effectiveWeight(policy, mode, key)
  let score = 0
  score += w('review_weight') * c.retention_need
  score += w('remediation_weight') * (c.recent_failure + c.trend_need) / (c.recent_failure && c.trend_need ? 2 : 1)
  score += w('capability_gap_weight') * c.capability_gap
  score += w('modality_gap_weight') * c.modality_gap
  score += w('independence_gap_weight') * c.independence_gap
  score += w('progression_weight') * c.curriculum_frontier
  score += w('cross_pack_relation_weight') * c.cross_pack_transfer
  score += w('novelty_weight') * c.novelty_value
  score += w('diversity_weight') * c.diversity
  score -= w('recency_penalty_weight') * c.recency_penalty
  void session
  return round4(score)
}

export function scoreStudyCandidateV2(candidate, { policy = {}, mode = 'adaptive', session = null } = {}) {
  return scoreOf(candidate, { policy: mergeStudyPlannerPolicyV2(policy), mode, session })
}

/**
 * Select the next StudyFocusV2. Pure — inputs: registry, learner states,
 * recent evidence, study session (mode/seed/now/histories/budget), policy,
 * runtime availability, optional allowedPackIds (focused mode) and
 * suppressedFocusKeys (controller feedback when the engine had no activity).
 */
export function selectNextStudyFocusV2({
  registry, learnerStates = [], recentEvidence = [], studySession, policy = {},
  runtimeAvailability = null, allowedPackIds = null, suppressedFocusKeys = [],
} = {}) {
  const p = mergeStudyPlannerPolicyV2(policy)
  const mode = studySession?.mode ?? 'adaptive'
  const now = studySession?.now
  const statesById = indexStatesByTargetId(learnerStates)
  const suppressed = new Set(suppressedFocusKeys)

  const base = {
    planner_version: STUDY_PLANNER_V2_VERSION,
    study_session_id: studySession?.study_session_id ?? null,
    mode,
  }

  const raw = buildStudyCandidatesV2({ registry, learnerStates, recentEvidence, policy: p, allowedPackIds, now, runtimeAvailability })
  const excluded = []
  const exclude = (candidate, reason) => excluded.push({ key: candidate.key, target_id: candidate.target?.target_id ?? null, reason })

  const currentPack = studySession?.pack_history?.[studySession.pack_history.length - 1] ?? null
  const samePackRun = consecutiveSamePack(studySession)
  const reviewRun = consecutiveReviews(studySession)
  const budget = studySession?.new_target_budget ?? { maximum: Infinity, used: 0 }
  const recentFocuses = (studySession?.focus_history ?? []).slice(-p.limits.minimum_review_spacing)

  // ---- hard filters (§11) ----
  const eligible = []
  const reviewLimited = []
  for (const candidate of raw) {
    if (suppressed.has(candidate.key)) { exclude(candidate, 'engine_no_activity'); continue }
    // target must resolve (defensive — candidates come from the registry).
    if (candidate.target && !resolvePedagogyEntity(candidate.target.target_id, registry)) {
      exclude(candidate, 'target_unknown'); continue
    }
    // mandatory prerequisites (introduction candidates carry them).
    const unmet = (candidate.prereqs || []).find((pr) => pr.status === 'unmet')
    if (unmet) { exclude(candidate, `prerequisite_unmet:${unmet.ref}`); continue }
    const unknown = (candidate.prereqs || []).find((pr) => pr.status === 'unknown')
    if (unknown) {
      // Unknown blocks introduction (mirrors the engine) — strict or not.
      exclude(candidate, `prerequisite_unknown:${unknown.ref}`); continue
    }
    // review mode: NEVER a new target, never progression-type focuses (§23).
    if (mode === 'review') {
      if (candidate.is_new_target) { exclude(candidate, 'new_target_in_review_mode'); continue }
      if (['introduce', 'cross_pack_progression'].includes(candidate.focus_type)
        || (candidate.focus_type === 'deepen' && candidate.components.capability_gap > 0)) {
        exclude(candidate, 'not_review_eligible'); continue
      }
    }
    // novelty budget of the STUDY session (§3/§23).
    if (candidate.is_new_target && budget.used >= budget.maximum) {
      exclude(candidate, 'new_target_budget_exceeded'); continue
    }
    // already consolidated without a retention/remediation need.
    if (!candidate.is_new_target && candidate.capability && candidate.focus_type === 'deepen') {
      const key = `${candidate.modality}_${candidate.capability}`
      if (laneMeets(getLane(statesById.get(candidate.target.target_id), key, 'overall'), p.thresholds.advancement)) {
        exclude(candidate, 'already_consolidated'); continue
      }
    }
    // technically unexecutable focus (§22) — never first choice, state untouched.
    if (!focusRuntimeExecutable(runtimeAvailability, candidate.capability, candidate.modality)) {
      candidate.reason_codes = [...candidate.reason_codes, 'FOCUS_RUNTIME_UNAVAILABLE'].sort()
      exclude(candidate, 'FOCUS_RUNTIME_UNAVAILABLE'); continue
    }
    // review spacing: the same (target, capability) reviewed moments ago.
    if (candidate.focus_type === 'review'
      && recentFocuses.some((f) => f.target_id === candidate.target?.target_id && f.capability === candidate.capability && f.modality === candidate.modality)) {
      exclude(candidate, 'review_spacing'); continue
    }
    // consecutive-review cap (outside review mode) — collected for fallback.
    if (mode !== 'review' && ['review', 'remediate'].includes(candidate.focus_type)
      && reviewRun >= p.limits.max_consecutive_review) {
      reviewLimited.push(candidate)
      exclude(candidate, 'max_consecutive_review_reached'); continue
    }
    eligible.push(candidate)
  }
  // Fallback: if the review cap starved the session, reviewing again beats stalling.
  const pool = eligible.length ? eligible : reviewLimited

  // ---- scoring + interleaving control (§14) ----
  const seed = String(studySession?.seed ?? '')
  const scored = pool.map((candidate) => {
    // diversity: vary capability vs. the previous focus, avoid the same target.
    const lastFocus = studySession?.focus_history?.[studySession.focus_history.length - 1] ?? null
    let diversity = 0.5
    if (lastFocus && candidate.capability && lastFocus.capability === candidate.capability) diversity -= 0.25
    if (lastFocus && candidate.target?.target_id === lastFocus.target_id) diversity -= 0.5
    // recency: how often this target appeared in the recent focus history.
    const appearances = (studySession?.focus_history ?? []).slice(-3)
      .filter((f) => f.target_id === candidate.target?.target_id).length
    candidate.components.diversity = clamp01(diversity)
    candidate.components.recency_penalty = clamp01(appearances / 3)
    const score = scoreOf(candidate, { policy: p, mode, session: studySession })
    const isSwitch = currentPack != null && candidate.pack_id !== currentPack
    let adjusted = score
    let coherencePenalized = false
    if (isSwitch) {
      if ((studySession?.pack_switches ?? 0) >= p.limits.max_pack_switches) {
        return { candidate, score, adjusted: -Infinity, isSwitch, blocked: 'max_pack_switches_reached' }
      }
      if (samePackRun < p.limits.min_activities_before_switch && samePackRun < p.limits.max_consecutive_same_pack) {
        adjusted = score - p.pack_switch_min_advantage
        coherencePenalized = true
      }
      // After too long in one pack, coherence stops suppressing the switch.
      if (samePackRun >= p.limits.max_consecutive_same_pack) { adjusted = score; coherencePenalized = false }
    }
    return { candidate, score, adjusted: round4(adjusted), isSwitch, coherencePenalized }
  })

  const viable = scored.filter((s) => s.adjusted !== -Infinity)
  for (const s of scored) if (s.blocked) exclude(s.candidate, s.blocked)

  const traceBase = {
    trace_version: 1,
    planner_version: STUDY_PLANNER_V2_VERSION,
    mode,
    considered: viable.length,
    excluded,
    candidates: scored.map((s) => ({
      key: s.candidate.key,
      focus_type: s.candidate.focus_type,
      pack_id: s.candidate.pack_id,
      target_id: s.candidate.target?.target_id ?? null,
      capability: s.candidate.capability,
      modality: s.candidate.modality,
      score: s.score,
      adjusted_score: s.adjusted === -Infinity ? null : s.adjusted,
      is_pack_switch: s.isSwitch,
    })),
  }

  if (!viable.length) {
    return { ...base, status: 'no_eligible_focus', focus: null, trace: traceBase }
  }

  // Deterministic pick over ADJUSTED score; seed permutes exact ties only.
  const bestAdjusted = viable.reduce((m, s) => Math.max(m, s.adjusted), -Infinity)
  const tied = viable.filter((s) => s.adjusted === bestAdjusted)
  let best = tied[0]
  if (tied.length > 1) {
    let bestHash = Infinity
    for (const s of [...tied].sort((a, b) => (a.candidate.key < b.candidate.key ? -1 : 1))) {
      const h = tieHash(`${seed}|${s.candidate.key}`)
      if (h < bestHash) { bestHash = h; best = s }
    }
  }

  // Pack-switch trace codes (§14): was a switch chosen, or suppressed?
  const packSwitch = { switched: false, code: null, suppressed: false }
  if (best.isSwitch) {
    packSwitch.switched = true
    packSwitch.code = best.candidate.focus_type === 'review' ? 'PACK_SWITCH_FOR_RETENTION'
      : best.candidate.focus_type === 'remediate' ? 'PACK_SWITCH_FOR_REMEDIATION'
      : best.candidate.focus_type === 'cross_pack_progression' ? 'PACK_SWITCH_FOR_CROSS_PACK_PROGRESSION'
      : null
  } else {
    const bestRaw = viable.reduce((m, s) => (s.score > m.score ? s : m), viable[0])
    if (bestRaw.isSwitch && bestRaw.coherencePenalized && bestRaw !== best) {
      packSwitch.suppressed = true
      packSwitch.code = 'PACK_SWITCH_SUPPRESSED_FOR_COHERENCE'
    }
  }

  const reasonCodes = [...new Set([
    ...best.candidate.reason_codes,
    ...(packSwitch.code && packSwitch.switched ? [packSwitch.code] : []),
  ])].sort()

  const focus = {
    study_focus_version: STUDY_FOCUS_V2_VERSION,
    planner_version: STUDY_PLANNER_V2_VERSION,
    pack_id: best.candidate.pack_id,
    lexeme_id: best.candidate.lexeme_id,
    focus_type: best.candidate.focus_type,
    target: best.candidate.target ? { ...best.candidate.target } : null,
    capability: best.candidate.capability ?? null,
    modality: best.candidate.modality ?? null,
    is_new_target: !!best.candidate.is_new_target,
    reason_codes: reasonCodes,
    priority: { score: best.score, adjusted_score: best.adjusted, components: { ...best.candidate.components } },
  }

  return {
    ...base,
    status: 'focus',
    focus,
    trace: {
      ...traceBase,
      pack_switch: packSwitch,
      tie_break: { tied: tied.length, seed },
      selected_key: best.candidate.key,
      score_breakdown: { ...best.candidate.components },
    },
  }
}

/** Canonical key of a focus — same format as candidate keys (suppression). */
export function studyFocusKeyV2(focus) {
  return `${focus.pack_id}|${focus.focus_type}|${focus.target?.target_id ?? '-'}|${focus.capability ?? '-'}|${focus.modality ?? '-'}`
}

// ---- adapter to the lesson engine (§15/§16) ---------------------------------

/**
 * Translate a StudyFocus into the lesson-engine inputs: the formal scope, the
 * engine-level focus restriction and the policy override for target-focused
 * practice. The activity choice itself stays entirely in the engine.
 */
export function studyFocusToLessonScopeV2(focus, registry) {
  if (!focus?.pack_id) throw new Error('STUDY_FOCUS_REQUIRED')
  return {
    scope: { registry, pack_id: focus.pack_id, lexeme_id: focus.lexeme_id },
    focus: {
      target_id: focus.target?.target_id ?? null,
      capability: focus.capability ?? null,
      modality: focus.modality ?? null,
      // Slice V2.8: an independence focus demands UNAIDED (tier-none) evidence.
      // The engine must honor this and never silently fall back to a supported
      // activity — it rejects the focus instead (FOCUS_INDEPENDENCE_NOT_EXECUTABLE).
      require_independent: focus.focus_type === 'independence',
    },
    policyOverride: focus.target ? { targeted_practice: { target_id: focus.target.target_id } } : {},
  }
}

// ---- factual progress (§5/§20): facts only, never a global mastery ----------

export function factualPackProgressV2(pack, learnerStates = [], reviewQueue = []) {
  const statesById = indexStatesByTargetId(learnerStates)
  const seen = (id) => exposureCount(statesById.get(id)) > 0
  const constructions = (pack.constructions || []).map((c) => c.construction_id).filter(seen).length
  const senses = (pack.senses || []).map((s) => s.sense_id).filter(seen).length
  const packEntityIds = new Set([
    ...(pack.constructions || []).map((c) => c.construction_id),
    ...(pack.senses || []).map((s) => s.sense_id),
    ...(pack.communicative_functions || []).map((f) => f.function_id),
  ])
  const reviews = reviewQueue.filter((item) => packEntityIds.has(item.target.target_id)).length
  return {
    constructions_seen: constructions,
    senses_seen: senses,
    reviews_available: reviews,
  }
}
