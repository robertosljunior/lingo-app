// observability-contracts.js — versioned contracts of the pedagogy V2
// observability layer (Slice V2.7). This layer OBSERVES and DIAGNOSES the
// existing V2 system (learner model, review queue, study planner, lesson
// engine, assessment/evidence pipeline) WITHOUT changing any of their
// semantics. Nothing here is a pedagogical threshold: OBSERVABILITY_POLICY_V2
// only tunes DIAGNOSTIC detection and never feeds back into a planner/engine
// decision. Recalibration of pedagogical weights is explicitly out of scope
// for this slice (see docs/pedagogy-v2-observability.md).

export const OBSERVABILITY_CONTRACTS_VERSION = 1

// ---- findings ---------------------------------------------------------------

export const FINDING_SEVERITIES = ['info', 'warning', 'error']

// Trajectory / structural findings. The last three are GRAVE INVARIANT
// violations (severity error) — they signal the observed system broke a
// promise, not merely a suboptimal trajectory.
export const FINDING_CODES = [
  'PREMATURE_FREE_PRODUCTION',
  'TARGET_STAGNATION',
  'REVIEW_STARVATION',
  'NOVELTY_STARVATION',
  'SUPPORT_TRAP',
  'MODALITY_STARVATION',
  'PACK_STARVATION',
  'EXCESSIVE_PACK_SWITCHING',
  'EXCESSIVE_TARGET_REPETITION',
  'NEW_ITEM_BUDGET_VIOLATION',
  'REVIEW_MODE_INTRODUCED_NEW_TARGET',
  'RUNTIME_UNAVAILABLE_FOCUS_SELECTED',
  'GLOBAL_MASTERY_FIELD_DETECTED',
  // Slice V2.8 — a Planner→Engine contract breach: an independence focus that
  // was served by a SUPPORTED activity (the V2.7 loop, now impossible).
  'INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY',
  // Slice V2.9 — a focus naming an explicit modality for which NO executable
  // affordance can produce assessed evidence (a domain the engine cannot train).
  'FOCUS_MODALITY_HAS_NO_AFFORDANCE',
]

// The findings above that are ALWAYS severity error — a broken invariant, not a
// heuristic warning.
export const GRAVE_FINDING_CODES = [
  'NEW_ITEM_BUDGET_VIOLATION',
  'REVIEW_MODE_INTRODUCED_NEW_TARGET',
  'RUNTIME_UNAVAILABLE_FOCUS_SELECTED',
  'GLOBAL_MASTERY_FIELD_DETECTED',
  'INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY',
  'FOCUS_MODALITY_HAS_NO_AFFORDANCE',
]

/** Structured finding factory: { severity, code, target_id?, details }. */
export function makeFinding(severity, code, details = {}, target_id = null) {
  if (!FINDING_SEVERITIES.includes(severity)) throw new Error(`FINDING_SEVERITY_INVALID:${severity}`)
  if (!FINDING_CODES.includes(code)) throw new Error(`FINDING_CODE_INVALID:${code}`)
  return { severity, code, ...(target_id ? { target_id } : {}), details }
}

// ---- simulation invariants (§11) --------------------------------------------
// Every simulation must uphold these. A violation halts the run with a clear
// diagnostic. They are HARD guarantees of the observed system, distinct from
// trajectory heuristics.
export const SIMULATION_INVARIANT_CODES = [
  'REVIEW_MODE_NO_NEW_TARGET',        // 1
  'NEW_ITEM_BUDGET_RESPECTED',        // 2
  'RUNTIME_COMPATIBLE_FOCUS',         // 3
  'TARGET_IDS_RESOLVE',               // 4
  'EVIDENCE_IDS_UNIQUE',              // 5
  'INTERACTION_IDS_DETERMINISTIC',    // 6
  'EVIDENCE_PROFILE_ISOLATION',       // 7
  'INDEPENDENT_LANE_UNAIDED',         // 8
  'EXPOSURE_NEVER_MASTERY',           // 9
  'NO_GLOBAL_MASTERY',                // 10
  'ENGINE_RESPECTS_FOCUS',            // 11
  'ACTIVE_PACK_MATCHES_FOCUS',        // 12
  'AUTHORED_SENTENCE_ONLY',           // 13
  'NO_GENERATED_TEXT',                // 14
  'NO_HIDDEN_V1_SKILL',               // 15
  // Slice V2.8 — Planner→Engine domain alignment. An independence focus must
  // never be served as a supported activity, and the executed plan's
  // capability/modality must match the focus that asked for it.
  'INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY', // 16
  'FOCUS_CAPABILITY_NOT_TRAINED',                   // 17
  'FOCUS_MODALITY_NOT_TRAINED',                     // 18
  // Slice V2.9 — a focus modality must map to a real, executable, assessable
  // training domain (affordance) in the scenario's runtime.
  'FOCUS_MODALITY_HAS_NO_AFFORDANCE',               // 19
]

// ---- local telemetry (§19) --------------------------------------------------
// Opt-in, in-memory only. NEVER persisted (no store), NEVER sent over the
// network. Exportable through the inspector.
export const TELEMETRY_EVENT_TYPES = [
  'STUDY_FOCUS_SELECTED',
  'ACTIVITY_PLAN_SELECTED',
  'INTERACTION_ASSESSED',
  'EVIDENCE_RECORDED',
  'PACK_SWITCHED',
  'CROSS_PACK_TRANSFER_SELECTED',
  'REVIEW_SELECTED',
]

// ---- diagnostic policy (§9) -------------------------------------------------
// DIAGNOSTIC thresholds ONLY. Changing these changes what the observer FLAGS,
// never what the planner/engine DECIDES. Documented as non-pedagogical.
export const OBSERVABILITY_POLICY_V2 = Object.freeze({
  policy_version: 1,
  // A target gets this many assessed activities without its best lane's
  // evidence_level improving → TARGET_STAGNATION.
  stagnation_activities: 6,
  // A target clearly review-eligible (in the review queue) but never selected
  // across this many planning opportunities → REVIEW_STARVATION.
  review_starvation_opportunities: 8,
  // Consecutive review/remediate focuses while an advance was available →
  // NOVELTY_STARVATION.
  novelty_starvation_streak: 10,
  // Supported lane established, independent absent, across this many
  // opportunities without an independence focus → SUPPORT_TRAP.
  support_trap_opportunities: 8,
  // A technically-available modality unpracticed across this many
  // opportunities → MODALITY_STARVATION.
  modality_starvation_opportunities: 15,
  // A curricularly-eligible pack never visited in adaptive mode across this
  // many interactions → PACK_STARVATION.
  pack_starvation_interactions: 20,
  // Pack switches per interaction above this ratio → EXCESSIVE_PACK_SWITCHING.
  ping_pong_switch_ratio: 0.5,
  // Same primary target this many times in a row → EXCESSIVE_TARGET_REPETITION.
  excessive_target_repetition: 6,
})
