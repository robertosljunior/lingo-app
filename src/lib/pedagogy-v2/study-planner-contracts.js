// study-planner-contracts.js — versioned contracts of the Study Planner V2
// (Slice V2.6), the layer ABOVE the lesson engine:
//
//   Study Planner  → decides WHAT to study now (pack, lexeme, target, need)
//   Lesson Engine  → decides HOW to practice that focus (exemplar, recipe,
//                    support) — nothing of that moves up here
//   Learner Model  → the only source of learner state
//   Registry       → the only source of content and relations
//
// Contract objects defined here:
//   StudyFocusV2          — one selected pedagogical focus
//   StudyPlannerPolicyV2  — every planner heuristic, centralized + versioned
//   StudySessionV2        — the study-level session ABOVE LessonSessionV2
//   RELATION_PLANNER_POLICY — how each typed relation influences planning
//
// All numeric values are versioned pedagogical heuristics WITHOUT scientific
// validation — they encode editorial judgement, not measured cognition.

import { PEDAGOGY_V2_RELATION_TYPES } from './contracts.js'

export const STUDY_PLANNER_V2_VERSION = 1
export const STUDY_FOCUS_V2_VERSION = 1
export const STUDY_SESSION_V2_VERSION = 1
export const STUDY_PLANNER_POLICY_VERSION = 1

// Study modes offered by the lab:
//   focused  — the learner picked one pack; the session stays in it
//   adaptive — the planner chooses among all eligible packs (interleaving)
//   review   — only already-encountered content; NEVER introduces new targets
//   explore  — prioritizes eligible NEW uses (still budget- and prereq-bound)
export const STUDY_MODES = ['focused', 'adaptive', 'review', 'explore']

// Focus types (§2). `introduce` does not require a capability/modality — the
// engine decides how first contact happens.
export const STUDY_FOCUS_TYPES = [
  'introduce',
  'deepen',
  'review',
  'remediate',
  'independence',
  'cross_pack_progression',
]

// Planner reason codes (trace + focus.reason_codes). Human copy in the UI is
// derived from these — internal ids are never shown to the learner.
export const STUDY_REASON_CODES = [
  // need detection
  'RETENTION_OVERDUE',
  'DELAYED_RETRIEVAL_FAILED',
  'DECLINING_TREND',
  'LOW_STABILITY',
  'SUPPORTED_WITHOUT_INDEPENDENT',
  'MODALITY_GAP',
  // modality expansion (Slice V2.9) — generic + specific explainability codes
  'PARALLEL_MODALITY_UNPRACTICED',
  'WRITING_BEHIND_SPEAKING',
  'SPEAKING_BEHIND_WRITING',
  'LISTENING_BEHIND_READING',
  'READING_BEHIND_LISTENING',
  'RECENT_FAILURE',
  'CAPABILITY_GAP',
  'CURRICULUM_FRONTIER',
  'NEVER_EXPOSED',
  // cross-pack transfer observability (§10)
  'KNOWN_FUNCTION_NEW_CONSTRUCTION',
  'KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK',
  'KNOWN_LEXEME_CONTEXT_EXTENDED',
  'CROSS_PACK_PREREQUISITE_MET',
  'CROSS_PACK_TRANSFER_OPPORTUNITY',
  // runtime
  'FOCUS_RUNTIME_UNAVAILABLE',
  // runtime-aware capability entry (Slice V2.10) — internal, never learner-facing
  'RUNTIME_AWARE_CAPABILITY_ENTRY',
  'ENTRY_MODALITY_SELECTED',
  'PREFERRED_MODALITY_RUNTIME_UNAVAILABLE',
  'ALTERNATE_MODALITY_SELECTED',
  // interleaving (§14)
  'PACK_SWITCH_FOR_RETENTION',
  'PACK_SWITCH_FOR_REMEDIATION',
  'PACK_SWITCH_FOR_CROSS_PACK_PROGRESSION',
  'PACK_SWITCH_SUPPRESSED_FOR_COHERENCE',
]

// How each typed registry relation influences the planner (§9). Explicit
// policy — relations are NEVER all treated as prerequisites:
//   blocking            — may block (only `prerequisite` relations)
//   priority_when_base_known — raises priority once the base (to) is known
//   transfer_priority   — raises transfer priority across packs
//   light_bonus         — small progression bonus
//   diagnostic_only     — recorded in traces, never gates or boosts
export const RELATION_PLANNER_POLICY = Object.freeze({
  prerequisite: 'blocking',
  extends_usage: 'priority_when_base_known',
  realizes_shared_function: 'transfer_priority',
  related_construction: 'light_bonus',
  contrasts_with: 'diagnostic_only',
  reuses_lexeme_context: 'diagnostic_only',
})

// Static consistency with the registry contract.
for (const t of Object.keys(RELATION_PLANNER_POLICY)) {
  if (!PEDAGOGY_V2_RELATION_TYPES.includes(t)) throw new Error(`RELATION_POLICY_UNKNOWN_TYPE:${t}`)
}
for (const t of PEDAGOGY_V2_RELATION_TYPES) {
  if (!RELATION_PLANNER_POLICY[t]) throw new Error(`RELATION_POLICY_MISSING_TYPE:${t}`)
}

// ---- policy -----------------------------------------------------------------
// Every value is a HEURISTIC (no scientific validation), centralized so tuning
// never spreads through the codebase.
export const DEFAULT_STUDY_PLANNER_POLICY_V2 = Object.freeze({
  planner_version: STUDY_PLANNER_POLICY_VERSION,

  // Scoring weights (§3, §11).
  weights: Object.freeze({
    review_weight: 3,          // retention_need
    remediation_weight: 2.5,   // recent_failure + trend_need
    progression_weight: 2,     // curriculum_frontier
    capability_gap_weight: 1.5,
    modality_gap_weight: 1.5,
    independence_gap_weight: 1.25,
    cross_pack_relation_weight: 1.5,
    novelty_weight: 1.5,
    diversity_weight: 0.75,
    recency_penalty_weight: 1,
  }),

  // Per-mode weight emphasis: MULTIPLIERS applied over the base weights
  // (absent key = ×1). review zeroes novelty; explore boosts it but keeps a
  // nonzero review/remediation weight so critical needs are never ignored.
  mode_emphasis: Object.freeze({
    focused: Object.freeze({}),
    adaptive: Object.freeze({}),
    review: Object.freeze({ review_weight: 2, remediation_weight: 1.5, novelty_weight: 0 }),
    explore: Object.freeze({ novelty_weight: 3, cross_pack_relation_weight: 2, review_weight: 0.5 }),
  }),

  // Session limits (§3, §14).
  limits: Object.freeze({
    max_new_targets_per_session: 4,
    max_pack_switches: 3,
    max_consecutive_same_pack: 6,   // after this, coherence stops suppressing a switch
    max_consecutive_review: 4,      // avoid all-review grind outside review mode
    min_activities_before_switch: 2, // coherence: prefer staying briefly
    minimum_review_spacing: 2,      // focuses between two reviews of the SAME capability key
  }),

  // Retention thresholds consumed by the review queue (heuristics, not SRS).
  retention: Object.freeze({
    default_interval_days: 2, // same default the lesson engine uses
    overdue_ratio: 1,         // elapsed/interval ≥ 1 → RETENTION_OVERDUE
    low_stability_days: 1.5,  // stability estimate below this → LOW_STABILITY
    due_cap: 3,               // saturation of the retention_need score
  }),

  // Prerequisite gate thresholds (mirrors the engine's prerequisite bar).
  thresholds: Object.freeze({
    prerequisite: Object.freeze({ min_mastery: 0.6, min_evidence_level: 'emerging' }),
    advancement: Object.freeze({ min_mastery: 0.7, min_evidence_level: 'emerging' }),
  }),

  // 'advisory' | 'strict' — strict makes unknown mandatory prerequisites block.
  prerequisite_mode: 'advisory',

  // A pack-switch is justified only by a strong enough need (score gap).
  pack_switch_min_advantage: 1,
})

export function mergeStudyPlannerPolicyV2(policy = {}) {
  const d = DEFAULT_STUDY_PLANNER_POLICY_V2
  return {
    ...d,
    ...policy,
    weights: { ...d.weights, ...(policy.weights || {}) },
    mode_emphasis: {
      focused: { ...d.mode_emphasis.focused, ...(policy.mode_emphasis?.focused || {}) },
      adaptive: { ...d.mode_emphasis.adaptive, ...(policy.mode_emphasis?.adaptive || {}) },
      review: { ...d.mode_emphasis.review, ...(policy.mode_emphasis?.review || {}) },
      explore: { ...d.mode_emphasis.explore, ...(policy.mode_emphasis?.explore || {}) },
    },
    limits: { ...d.limits, ...(policy.limits || {}) },
    retention: { ...d.retention, ...(policy.retention || {}) },
    thresholds: {
      prerequisite: { ...d.thresholds.prerequisite, ...(policy.thresholds?.prerequisite || {}) },
      advancement: { ...d.thresholds.advancement, ...(policy.thresholds?.advancement || {}) },
    },
  }
}

/** Effective weight of a component under a mode (base × mode multiplier). */
export function effectiveWeight(policy, mode, key) {
  const base = policy.weights[key] ?? 0
  const multiplier = policy.mode_emphasis?.[mode]?.[key]
  return multiplier == null ? base : base * multiplier
}

// ---- study session ----------------------------------------------------------
// The study session sits ABOVE LessonSessionV2 and never collapses into it:
// the study session tracks focus/pack history and budgets; each focus starts
// or updates the LessonSessionV2 of its pack (activity history lives there).

export function createStudySessionV2({ study_session_id, mode, profile_id = null, now, seed = null, newTargetMaximum = DEFAULT_STUDY_PLANNER_POLICY_V2.limits.max_new_targets_per_session }) {
  if (!STUDY_MODES.includes(mode)) throw new Error(`STUDY_MODE_INVALID:${mode}`)
  return {
    study_session_version: STUDY_SESSION_V2_VERSION,
    study_session_id,
    mode,
    profile_id,
    seed: seed ?? study_session_id,
    started_at: now,
    now,
    focus_history: [],
    pack_history: [],
    new_target_budget: { maximum: newTargetMaximum, used: 0 },
    pack_switches: 0,
  }
}

/** Record a selected focus into the study session (pure — returns a new one). */
export function advanceStudySessionV2(session, focus, { now = session.now, newTargetsIntroduced = 0 } = {}) {
  const lastPack = session.pack_history[session.pack_history.length - 1] ?? null
  const switched = lastPack != null && focus.pack_id !== lastPack
  return {
    ...session,
    now,
    focus_history: [...session.focus_history, {
      focus_type: focus.focus_type,
      pack_id: focus.pack_id,
      target_id: focus.target?.target_id ?? null,
      capability: focus.capability ?? null,
      modality: focus.modality ?? null,
      reason_codes: [...(focus.reason_codes || [])],
    }],
    pack_history: [...session.pack_history, focus.pack_id],
    new_target_budget: {
      ...session.new_target_budget,
      used: session.new_target_budget.used + newTargetsIntroduced,
    },
    pack_switches: session.pack_switches + (switched ? 1 : 0),
  }
}

/** Consecutive trailing focuses in the same pack (coherence rule input). */
export function consecutiveSamePack(session) {
  const h = session?.pack_history || []
  if (!h.length) return 0
  const last = h[h.length - 1]
  let n = 0
  for (let i = h.length - 1; i >= 0 && h[i] === last; i--) n++
  return n
}

/** Consecutive trailing review-type focuses. */
export function consecutiveReviews(session) {
  const h = session?.focus_history || []
  let n = 0
  for (let i = h.length - 1; i >= 0 && ['review', 'remediate'].includes(h[i].focus_type); i--) n++
  return n
}
