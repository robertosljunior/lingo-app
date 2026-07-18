// lesson-engine-contracts.js — versioned contracts of the lesson engine V2
// (Slice V2.3-R). The engine plans activities over the APPROVED learner model
// V2 (learner-model-constants.js et al.): every taxonomy used here — activity
// kinds, capabilities, modalities, attributions, support features, tiers — is
// imported from those contracts, never re-enumerated.
//
// Contract objects defined here (validated in lesson-engine-validator.js):
//   LessonEnginePolicyV2   — tuning knobs, all heuristics versioned
//   LessonSessionV2        — immutable plain-data session (evolved by helpers)
//   ActivityPlanV2         — the selected activity, fully declarative
//   LessonDecisionV2       — engine output (status + plan + trace)
//   LessonEngineContextV2  — read-only snapshot built from storage APIs
//   PrerequisiteAssessmentV2 — tri-state (met / unmet / unknown) per reference
//   SelectionTraceV2       — explainability record of one selection

import {
  ACTIVITY_KINDS, SUPPORT_FEATURES,
} from './learner-model-constants.js'
import { deriveSupportTier } from './learner-evidence-contracts.js'

export const LESSON_ENGINE_V2_VERSION = 2 // 1 was the 7038d70 prototype
export const LESSON_ENGINE_POLICY_VERSION = 2
export const LESSON_SESSION_V2_VERSION = 1
export const ACTIVITY_PLAN_V2_VERSION = 1
// 2 (Slice V2.5): declares the multi-pack scope — registry_version,
// active_pack_id, active_lexeme_id, dependencies, external prerequisite targets.
export const LESSON_ENGINE_CONTEXT_V2_VERSION = 2

export const DECISION_STATUSES = ['activity', 'no_eligible_activity', 'session_complete']
export const PREREQUISITE_STATUSES = ['met', 'unmet', 'unknown']
export const PLAN_LANES = ['supported', 'independent']

// ---- recipes ----------------------------------------------------------------
// A recipe is a SAFE activity shape: it presents authored exemplar material
// only, never generates language, never fabricates distractors. Each recipe
// declares which (capability, modality) pairs it can train — all drawn from the
// approved CAPABILITY_MODALITIES matrix — and which support-feature variants it
// offers. A variant is `independent` ONLY when deriveSupportTier of its
// features is 'none' (checked by tests and the plan validator).
//
// `attribution_rule` drives planned evidence (§ planned_evidence below):
//   exposure      — every presented target gets an exposure/observed event
//   meaning_first — sense/communicative_function targets direct, others indirect
//   form_first    — construction/lexeme_usage targets direct, others indirect
//   assessed_only — direct only for targets actually assessed (conditional)
export const LESSON_RECIPES = [
  {
    recipe: 'exposure',
    activity_kind: 'exposure',
    pairs: [['recognition', 'reading']],
    variants: [{ lane: 'supported', features: ['translation'] }],
    needs_options: false,
    attribution_rule: 'exposure',
    response_type: 'acknowledge',
  },
  {
    recipe: 'meaning_recognition',
    activity_kind: 'meaning_recognition',
    pairs: [['recognition', 'reading'], ['comprehension', 'reading']],
    variants: [{ lane: 'supported', features: ['multiple_choice'] }],
    needs_options: true,
    attribution_rule: 'meaning_first',
    response_type: 'option_select',
  },
  {
    recipe: 'listening_recognition',
    activity_kind: 'listening_recognition',
    pairs: [['recognition', 'listening'], ['comprehension', 'listening']],
    variants: [{ lane: 'supported', features: ['multiple_choice', 'audio_replay'] }],
    needs_options: true,
    attribution_rule: 'meaning_first',
    response_type: 'option_select',
  },
  {
    recipe: 'fixed_element_completion',
    activity_kind: 'controlled_completion',
    pairs: [['controlled_production', 'writing']],
    variants: [
      { lane: 'supported', features: ['word_bank'] },
      { lane: 'independent', features: [] },
    ],
    needs_options: false,
    attribution_rule: 'form_first',
    response_type: 'text_input',
  },
  {
    recipe: 'word_order_reconstruction',
    activity_kind: 'controlled_transformation',
    pairs: [['controlled_production', 'writing']],
    // The full token bank is inherent to reconstruction — never independent.
    variants: [{ lane: 'supported', features: ['word_bank'] }],
    needs_options: false,
    attribution_rule: 'form_first',
    response_type: 'ordered_tokens',
  },
  {
    recipe: 'guided_production',
    activity_kind: 'guided_production',
    pairs: [['controlled_production', 'writing'], ['controlled_production', 'speaking']],
    variants: [
      { lane: 'supported', features: ['model_sentence', 'translation'] },
      { lane: 'independent', features: [] },
    ],
    needs_options: false,
    attribution_rule: 'form_first',
    response_type: 'produced_text',
  },
  {
    recipe: 'free_production',
    activity_kind: 'free_production',
    pairs: [['free_production', 'writing'], ['free_production', 'speaking']],
    variants: [
      { lane: 'supported', features: ['hint'] },
      { lane: 'independent', features: [] },
    ],
    needs_options: false,
    attribution_rule: 'assessed_only',
    response_type: 'produced_text',
  },
  {
    recipe: 'pronunciation',
    activity_kind: 'pronunciation',
    pairs: [['pronunciation', 'speaking']],
    variants: [
      { lane: 'supported', features: ['model_sentence', 'audio_replay'] },
      { lane: 'independent', features: [] },
    ],
    needs_options: false,
    attribution_rule: 'form_first',
    response_type: 'spoken_audio',
  },
]

export const RECIPE_NAMES = LESSON_RECIPES.map((r) => r.recipe)

// Static consistency of the table with the approved taxonomies (evaluated at
// import time so a drifting recipe fails every test run immediately).
for (const r of LESSON_RECIPES) {
  if (!ACTIVITY_KINDS.includes(r.activity_kind)) throw new Error(`RECIPE_ACTIVITY_KIND_INVALID:${r.recipe}`)
  for (const v of r.variants) {
    for (const f of v.features) if (!SUPPORT_FEATURES.includes(f)) throw new Error(`RECIPE_FEATURE_INVALID:${r.recipe}:${f}`)
    const tier = deriveSupportTier({ features: v.features, hint_count: 0 })
    if (v.lane === 'independent' && tier !== 'none') throw new Error(`RECIPE_INDEPENDENT_NOT_UNAIDED:${r.recipe}`)
    if (v.lane === 'supported' && tier === 'none') throw new Error(`RECIPE_SUPPORTED_WITHOUT_FEATURES:${r.recipe}`)
    if (v.features.includes('answer_reveal')) throw new Error(`RECIPE_ANSWER_REVEAL_FORBIDDEN:${r.recipe}`)
  }
}

// ---- policy -----------------------------------------------------------------
// All numbers are versioned pedagogical heuristics (LESSON_ENGINE_POLICY_VERSION).
export const DEFAULT_LESSON_ENGINE_POLICY_V2 = Object.freeze({
  policy_version: LESSON_ENGINE_POLICY_VERSION,
  new_item_budget_per_session: 2,
  max_activities_per_session: 12,
  // Recognition options must come from authored translations; below this many
  // safe options the recipe is not constructible for that exemplar.
  min_recognition_options: 3,
  exemplar_cooldown: 3,
  thresholds: Object.freeze({
    // A prerequisite is `met` when any capability lane reaches this bar.
    prerequisite: Object.freeze({ min_mastery: 0.6, min_evidence_level: 'emerging' }),
    // Soft-ladder gates (unlock next capability rung / independent lane).
    advancement: Object.freeze({ min_mastery: 0.7, min_evidence_level: 'emerging' }),
  }),
  // grammar_skill_v1 bridges: 'advisory' records the assessment without
  // blocking; 'strict' blocks on unmet AND unknown. Never silently assumed met.
  v1_bridge_mode: 'advisory',
  retention: Object.freeze({
    // Review interval when no stability_estimate exists yet, and the overdue
    // ratio at which the retention score saturates.
    default_interval_days: 2,
    due_cap: 2,
  }),
  weights: Object.freeze({
    need: 3,
    retention: 2,
    progression: 2,
    capability_gap: 1.5,
    // Earlier rungs of the recommended progression (recognition → comprehension
    // → controlled → free → pronunciation) win among comparable gaps.
    ladder: 1,
    independence: 1,
    novelty: 1.5,
    diversity: 1,
    remediation: 1.5,
  }),
  // Optional focus: { target_id } restricts candidates to exemplars declaring
  // that pedagogical target.
  targeted_practice: null,
})

export function mergeLessonEnginePolicyV2(policy = {}) {
  const d = DEFAULT_LESSON_ENGINE_POLICY_V2
  return {
    ...d,
    ...policy,
    thresholds: {
      prerequisite: { ...d.thresholds.prerequisite, ...(policy.thresholds?.prerequisite || {}) },
      advancement: { ...d.thresholds.advancement, ...(policy.thresholds?.advancement || {}) },
    },
    retention: { ...d.retention, ...(policy.retention || {}) },
    weights: { ...d.weights, ...(policy.weights || {}) },
  }
}

// ---- session ----------------------------------------------------------------

export function createLessonSessionV2({ session_id, profile_id = null, now, seed = null }) {
  return {
    session_version: LESSON_SESSION_V2_VERSION,
    session_id,
    profile_id,
    now,
    seed: seed ?? session_id,
    history: [],
  }
}

/** Record an emitted decision into the session (pure — returns a new session). */
export function appendActivityToSessionV2(session, decision, { now = session.now } = {}) {
  const p = decision.plan
  if (!p) return { ...session, now }
  return {
    ...session,
    now,
    history: [...session.history, {
      sequence_index: p.sequence_index,
      exemplar_id: p.exemplar_id,
      construction_id: p.construction_id,
      recipe: p.recipe,
      activity_kind: p.activity_kind,
      capability: p.capability,
      modality: p.modality,
      support_lane: p.support.derived_tier === 'none' ? 'independent' : 'supported',
      new_item_refs: p.new_item_refs,
    }],
  }
}

export function newItemsIntroducedInSessionV2(session) {
  const refs = new Set()
  for (const h of session?.history || []) for (const r of h.new_item_refs || []) refs.add(r)
  return refs
}
