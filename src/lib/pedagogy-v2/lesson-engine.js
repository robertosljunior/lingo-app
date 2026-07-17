// lesson-engine.js — lesson engine V2: pure, deterministic next-activity
// selection over authored V2 content and learner-model V2 states.
//
// The engine NEVER generates sentences. It only selects complete, authored
// exemplars from a validated pedagogical_v2 pack and decides in which learning
// domain (capability × modality × support lane) the learner should meet them.
//
// Determinism contract: selectNextActivityV2 is a pure function of its inputs.
// It never reads the clock (time comes from session.now), never uses
// randomness, and given equal inputs returns a deeply equal decision. Ties are
// broken by authored order → capability ladder → modality order → lane order.

import { EXPOSURE_STAGES, stageIndex } from './contracts.js'
import {
  CAPABILITY_MODALITIES_V2, SUPPORT_LANES_V2, learnerDomainKey,
} from './learner-contracts.js'
import {
  indexStatesByDomain, getStatesForTarget, capabilityStrength,
  isTargetKnown, isTargetSeen, retentionStatusV2,
} from './learner-model.js'
import {
  getPrimaryTargets, getSecondaryTargets, getV2Prerequisites,
  getV1BridgePrerequisites, getIntendedNewItems,
} from './query.js'

export const LESSON_ENGINE_V2_VERSION = '1'

const DAY_MS = 24 * 60 * 60 * 1000

// What the learner is asked to do, derived from the learning domain. The UI
// layer of a later slice maps these to concrete exercise widgets; the engine
// only commits to the pedagogical shape of the task.
export const ACTIVITY_KINDS_V2 = {
  'recognition|reading': 'read_and_recognize',
  'recognition|listening': 'listen_and_recognize',
  'controlled_production|writing': 'controlled_write',
  'controlled_production|speaking': 'controlled_speak',
  'free_production|writing': 'free_write',
  'free_production|speaking': 'free_speak',
}

export const DEFAULT_LESSON_ENGINE_POLICY_V2 = Object.freeze({
  policy_version: '1',
  // Curricular budget: how many DISTINCT new items (senses/constructions/
  // functions/lexemes) a single session may introduce.
  new_item_budget_per_session: 2,
  max_activities_per_session: 12,
  // A V2 prerequisite is met when the target is known in ANY domain at this
  // threshold (producing implies knowing).
  prerequisite: Object.freeze({ min_strength: 0.55, min_attempts: 1 }),
  // First contact with unseen content always happens in the least demanding
  // domain: recognition, reading, supported.
  introduction: Object.freeze({ capability: 'recognition', modality: 'reading', support_lane: 'supported' }),
  capability_ladder: Object.freeze(['recognition', 'controlled_production', 'free_production']),
  // Threshold to unlock the next capability rung / the independent lane.
  advancement: Object.freeze({ min_strength: 0.65, min_attempts: 2 }),
  // Retention is per capability: recognition fades fastest, free production is
  // revisited on the longest cycle.
  retention_intervals_ms: Object.freeze({
    recognition: 2 * DAY_MS,
    controlled_production: 4 * DAY_MS,
    free_production: 7 * DAY_MS,
  }),
  weights: Object.freeze({
    need: 3,           // weakest-target strength gap in the candidate domain
    retention: 2,      // overdue review pressure (per capability interval)
    progression: 2,    // proximity to the curricular frontier stage
    capability_gap: 1.5, // domain lagging behind the target's best domain
    independence: 1,   // prefer the independent lane once unlocked
    novelty: 1.5,      // introduces budgeted new items
    diversity: 1,      // avoid repeating construction/modality back-to-back
    remediation: 1.5,  // recent error on a target → revisit with support
  }),
  diversity: Object.freeze({ exemplar_cooldown: 3 }),
})

export function mergeLessonEnginePolicyV2(policy = {}) {
  const d = DEFAULT_LESSON_ENGINE_POLICY_V2
  return {
    ...d, ...policy,
    prerequisite: { ...d.prerequisite, ...(policy.prerequisite || {}) },
    introduction: { ...d.introduction, ...(policy.introduction || {}) },
    advancement: { ...d.advancement, ...(policy.advancement || {}) },
    retention_intervals_ms: { ...d.retention_intervals_ms, ...(policy.retention_intervals_ms || {}) },
    weights: { ...d.weights, ...(policy.weights || {}) },
    diversity: { ...d.diversity, ...(policy.diversity || {}) },
    capability_ladder: policy.capability_ladder || d.capability_ladder,
  }
}

// ---- session (plain data, evolved immutably by the caller) ----

export function createLessonSessionV2({ session_id, now, v1_mastered_skill_ids = null }) {
  return { session_id, now, v1_mastered_skill_ids, history: [] }
}

// Record an emitted decision into the session (pure — returns a new session).
export function appendActivityToSessionV2(session, decision, { now = session.now } = {}) {
  const a = decision.activity
  return {
    ...session,
    now,
    history: [...session.history, {
      exemplar_id: a.exemplar_id,
      construction_id: a.construction_id,
      capability: a.capability,
      modality: a.modality,
      support_lane: a.support_lane,
      new_item_refs: a.new_item_refs,
    }],
  }
}

export function newItemsIntroducedInSessionV2(session) {
  const refs = new Set()
  for (const h of session?.history || []) for (const r of h.new_item_refs || []) refs.add(r)
  return refs
}

// ---- selection ----

const clamp01 = (x) => Math.max(0, Math.min(1, x))

export function selectNextActivityV2({ session, pack, learnerStates, recentEvidence = [], policy = {} }) {
  const p = mergeLessonEnginePolicyV2(policy)
  const states = learnerStates || []
  const byDomain = indexStatesByDomain(states)
  const history = session?.history || []
  const now = session?.now ?? 0
  const exemplars = pack?.exemplars || []

  if (history.length >= p.max_activities_per_session) {
    return { engine_version: LESSON_ENGINE_V2_VERSION, status: 'session_complete', session_id: session.session_id }
  }

  // Session-scope aggregates.
  const introduced = newItemsIntroducedInSessionV2(session)
  const budgetRemaining = Math.max(0, p.new_item_budget_per_session - introduced.size)
  const recentExemplars = history.slice(-p.diversity.exemplar_cooldown).map((h) => h.exemplar_id)
  const lastActivity = history[history.length - 1] || null
  const modalitiesUsed = new Set(history.map((h) => h.modality))

  // Most recent outcome per target from the caller-provided recent evidence —
  // a wrong answer pulls the target back into a supported domain next time.
  const lastOutcomeByTarget = new Map()
  for (const e of [...recentEvidence].sort((a, b) =>
    (a.created_at - b.created_at) || String(a.evidence_id).localeCompare(String(b.evidence_id)))) {
    lastOutcomeByTarget.set(e.target_id, e.outcome)
  }

  // Curricular frontier: the earliest exposure stage that still has an
  // exemplar whose primary targets are not yet advanced in recognition. Stages
  // stay recommendations — they steer the progression score, they never block.
  const maxStageIdx = EXPOSURE_STAGES.length - 1
  let frontierIdx = maxStageIdx
  let frontierFound = false
  for (const e of exemplars) {
    const primaries = getPrimaryTargets(e).map((t) => t.target_id)
    const consolidated = primaries.every((t) => {
      const r = capabilityStrength(states, t, 'recognition')
      return r.strength >= p.advancement.min_strength && r.attempts >= p.advancement.min_attempts
    })
    if (!consolidated) {
      const idx = stageIndex(e.exposure_stage)
      if (!frontierFound || idx < frontierIdx) { frontierIdx = idx; frontierFound = true }
    }
  }

  const targetAdvanced = (target_id, capability) => {
    const r = capabilityStrength(states, target_id, capability)
    return r.strength >= p.advancement.min_strength && r.attempts >= p.advancement.min_attempts
  }
  // The independent lane unlocks per capability×modality: succeeding with
  // support in reading says nothing about independent listening.
  const independentUnlocked = (target_ids, capability, modality) => target_ids.every((t) => {
    const s = byDomain.get(learnerDomainKey({ target_id: t, capability, modality, support_lane: 'supported' }))
    return !!s && s.strength >= p.advancement.min_strength && s.attempts >= p.advancement.min_attempts
  })

  const excluded = []
  const buildCandidates = (skipCooldown) => {
    const out = []
    exemplars.forEach((e, authoredIndex) => {
      const primaries = getPrimaryTargets(e).map((t) => t.target_id)
      if (!primaries.length) return

      // Hard filter 1 — V2 prerequisites must be known (any domain).
      const unmet = getV2Prerequisites(e).find((pr) => !isTargetKnown(states, pr.ref, p.prerequisite))
      if (unmet) { if (!skipCooldown) excluded.push({ exemplar_id: e.exemplar_id, reason: `prerequisite_unmet:${unmet.ref}` }); return }

      // Hard filter 2 — V1 bridges: only enforceable when the caller supplies
      // the mastered V1 skill list; without it they are assumed met.
      if (Array.isArray(session?.v1_mastered_skill_ids)) {
        const missing = getV1BridgePrerequisites(e).find((pr) => !session.v1_mastered_skill_ids.includes(pr.ref))
        if (missing) { if (!skipCooldown) excluded.push({ exemplar_id: e.exemplar_id, reason: `v1_prerequisite_unmet:${missing.ref}` }); return }
      }

      // Hard filter 3 — new-item budget. Only items STILL unseen by this
      // learner count as new; re-meeting known content costs no budget.
      const newRefs = getIntendedNewItems(e).map((n) => n.ref).filter((ref) => !isTargetSeen(states, ref) && !introduced.has(ref))
      if (newRefs.length > budgetRemaining) {
        if (!skipCooldown) excluded.push({ exemplar_id: e.exemplar_id, reason: 'new_item_budget_exceeded' })
        return
      }

      // Hard filter 4 — same-exemplar cooldown inside the session (lifted in
      // the fallback pass when it would otherwise starve the session).
      if (!skipCooldown && recentExemplars.includes(e.exemplar_id)) {
        excluded.push({ exemplar_id: e.exemplar_id, reason: 'exemplar_cooldown' })
        return
      }

      // Candidate learning domains for this exemplar.
      const combos = []
      if (primaries.some((t) => !isTargetSeen(states, t))) {
        // First contact is always in the introduction domain.
        combos.push({ ...p.introduction })
      } else {
        for (let ci = 0; ci < p.capability_ladder.length; ci++) {
          const capability = p.capability_ladder[ci]
          if (ci > 0 && !primaries.every((t) => targetAdvanced(t, p.capability_ladder[ci - 1]))) continue
          for (const modality of CAPABILITY_MODALITIES_V2[capability]) {
            for (const support_lane of SUPPORT_LANES_V2) {
              if (support_lane === 'independent' && !independentUnlocked(primaries, capability, modality)) continue
              combos.push({ capability, modality, support_lane })
            }
          }
        }
      }

      for (const combo of combos) {
        out.push(scoreCandidate({ exemplar: e, authoredIndex, combo, primaries, newRefs }))
      }
    })
    return out
  }

  const scoreCandidate = ({ exemplar, authoredIndex, combo, primaries, newRefs }) => {
    const domainStates = primaries.map((t) => byDomain.get(learnerDomainKey({ target_id: t, ...combo })) || null)

    const weakest = Math.min(...domainStates.map((s) => s?.strength ?? 0))
    const need = clamp01(1 - weakest)

    let retention = 0
    for (const s of domainStates) {
      if (!s) continue
      const r = retentionStatusV2(s, { now, intervals: p.retention_intervals_ms })
      retention = Math.max(retention, clamp01(r.overdue_ratio / 2))
    }

    const progression = clamp01(1 - Math.abs(stageIndex(exemplar.exposure_stage) - frontierIdx) / Math.max(1, maxStageIdx))

    let capability_gap = 0
    primaries.forEach((t, i) => {
      const best = Math.max(0, ...getStatesForTarget(states, t).map((s) => s.strength))
      capability_gap = Math.max(capability_gap, clamp01(best - (domainStates[i]?.strength ?? 0)))
    })

    const independence = combo.support_lane === 'independent' ? 1 : 0
    const novelty = newRefs.length > 0 ? 1 : 0

    let diversity = 0.5
    if (lastActivity && lastActivity.construction_id === exemplar.construction_id) diversity -= 0.5
    if (!modalitiesUsed.has(combo.modality)) diversity += 0.5
    diversity = clamp01(diversity)

    const recentlyMissed = primaries.some((t) => lastOutcomeByTarget.get(t) === 'incorrect')
    const remediation = recentlyMissed ? (combo.support_lane === 'supported' ? 1 : 0) : 0

    const components = { need, retention, progression, capability_gap, independence, novelty, diversity, remediation }
    let score = 0
    for (const [k, v] of Object.entries(components)) score += (p.weights[k] || 0) * v
    return { exemplar, authoredIndex, combo, primaries, newRefs, components, score: Math.round(score * 1e6) / 1e6 }
  }

  let candidates = buildCandidates(false)
  if (!candidates.length && excluded.some((x) => x.reason === 'exemplar_cooldown')) {
    // Everything eligible is merely cooling down — better to repeat than to
    // stall the session.
    candidates = buildCandidates(true)
  }

  if (!candidates.length) {
    return {
      engine_version: LESSON_ENGINE_V2_VERSION,
      status: 'no_eligible_activity',
      session_id: session.session_id,
      considered: exemplars.length,
      excluded,
      budget: { limit: p.new_item_budget_per_session, introduced: [...introduced], remaining: budgetRemaining },
    }
  }

  // Deterministic pick: candidates are generated in stable order (authored
  // exemplar order × ladder × modality × lane); only a strictly higher score
  // displaces the incumbent.
  let best = candidates[0]
  for (const c of candidates) if (c.score > best.score) best = c

  const e = best.exemplar
  const reasons = describeDecision(best, p)
  return {
    engine_version: LESSON_ENGINE_V2_VERSION,
    status: 'activity',
    session_id: session.session_id,
    decision_index: history.length,
    activity: {
      activity_id: `${session.session_id}:a${history.length + 1}`,
      pack_id: pack?.manifest?.pack_id || null,
      exemplar_id: e.exemplar_id,
      text_en: e.text_en,
      text_pt: e.text_pt,
      context: e.context,
      construction_id: e.construction_id,
      sense_ids: e.sense_ids,
      communicative_function_ids: e.communicative_function_ids,
      exposure_stage: e.exposure_stage,
      capability: best.combo.capability,
      modality: best.combo.modality,
      support_lane: best.combo.support_lane,
      activity_kind: ACTIVITY_KINDS_V2[`${best.combo.capability}|${best.combo.modality}`],
      primary_target_ids: best.primaries,
      secondary_target_ids: getSecondaryTargets(e).map((t) => t.target_id),
      new_item_refs: best.newRefs,
    },
    score: best.score,
    score_breakdown: best.components,
    reasons,
    considered: candidates.length,
    excluded,
    alternatives: candidates
      .filter((c) => c !== best)
      .sort((a, b) => (b.score - a.score) || (a.authoredIndex - b.authoredIndex))
      .slice(0, 3)
      .map((c) => ({ exemplar_id: c.exemplar.exemplar_id, ...c.combo, score: c.score })),
    budget: {
      limit: p.new_item_budget_per_session,
      introduced: [...introduced],
      remaining: budgetRemaining - best.newRefs.length,
    },
  }
}

// Human-readable (pt-BR) justification: the two heaviest weighted components.
function describeDecision(candidate, policy) {
  const labels = {
    need: 'alvo ainda frágil neste domínio',
    retention: 'revisão de retenção vencida para a capacidade',
    progression: 'próximo passo da progressão curricular do pack',
    capability_gap: 'domínio defasado em relação ao melhor domínio do alvo',
    independence: 'pronto para praticar sem apoio',
    novelty: 'introduz item novo dentro do orçamento da sessão',
    diversity: 'variação de construção/modalidade na sessão',
    remediation: 'erro recente pede nova exposição com apoio',
  }
  return Object.entries(candidate.components)
    .map(([k, v]) => ({ k, contribution: (policy.weights[k] || 0) * v }))
    .filter((x) => x.contribution > 0)
    .sort((a, b) => (b.contribution - a.contribution) || a.k.localeCompare(b.k))
    .slice(0, 2)
    .map((x) => labels[x.k])
}
