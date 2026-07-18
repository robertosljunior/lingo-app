// lesson-engine-validator.js — structural validation of the lesson-engine V2
// contracts (policy, session, activity plan, decision, context). Same
// `CODE:detail` error convention as the other V2 validators.
//
// The plan validator re-derives the support tier and re-checks every taxonomy
// against the APPROVED V2.2 contracts, so a drifting engine cannot emit plans
// that the learner model would refuse to understand.

import { ID_PREFIXES, TARGET_TYPES, TARGET_TYPE_PREFIX } from './contracts.js'
import {
  ACTIVITY_KINDS, ATTRIBUTIONS, SUPPORT_FEATURES, OUTCOMES,
} from './learner-model-constants.js'
import { deriveSupportTier, deriveCapabilityKey } from './learner-evidence-contracts.js'
import {
  LESSON_ENGINE_POLICY_VERSION, LESSON_SESSION_V2_VERSION, ACTIVITY_PLAN_V2_VERSION,
  LESSON_ENGINE_CONTEXT_V2_VERSION, DECISION_STATUSES, PREREQUISITE_STATUSES, RECIPE_NAMES,
} from './lesson-engine-contracts.js'

const isTargetRef = (t) => t && TARGET_TYPES.includes(t.target_type)
  && typeof t.target_id === 'string' && t.target_id.startsWith(TARGET_TYPE_PREFIX[t.target_type])

export function validateLessonEnginePolicyV2(policy) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!policy || typeof policy !== 'object') return { valid: false, errors: ['POLICY_REQUIRED'] }
  if (policy.policy_version !== LESSON_ENGINE_POLICY_VERSION) err('POLICY_VERSION_INVALID', String(policy.policy_version))
  if (!(policy.new_item_budget_per_session >= 0)) err('POLICY_BUDGET_INVALID')
  if (!(policy.max_activities_per_session >= 1)) err('POLICY_MAX_ACTIVITIES_INVALID')
  if (!(policy.min_recognition_options >= 2)) err('POLICY_MIN_OPTIONS_INVALID')
  if (!['advisory', 'strict'].includes(policy.v1_bridge_mode)) err('POLICY_V1_BRIDGE_MODE_INVALID', policy.v1_bridge_mode)
  for (const t of ['prerequisite', 'advancement']) {
    const th = policy.thresholds?.[t]
    if (!th || !(th.min_mastery >= 0 && th.min_mastery <= 1)) err('POLICY_THRESHOLD_INVALID', t)
    else if (!['insufficient', 'emerging', 'established'].includes(th.min_evidence_level)) err('POLICY_EVIDENCE_LEVEL_INVALID', t)
  }
  for (const [k, v] of Object.entries(policy.weights || {})) {
    if (!(typeof v === 'number' && Number.isFinite(v) && v >= 0)) err('POLICY_WEIGHT_INVALID', k)
  }
  if (policy.targeted_practice != null && typeof policy.targeted_practice?.target_id !== 'string') {
    err('POLICY_TARGETED_PRACTICE_INVALID')
  }
  return { valid: errors.length === 0, errors }
}

export function validateLessonSessionV2(session) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!session || typeof session !== 'object') return { valid: false, errors: ['SESSION_REQUIRED'] }
  if (session.session_version !== LESSON_SESSION_V2_VERSION) err('SESSION_VERSION_INVALID', String(session.session_version))
  if (!session.session_id || typeof session.session_id !== 'string') err('SESSION_ID_REQUIRED')
  if (typeof session.now !== 'string' || Number.isNaN(Date.parse(session.now))) err('SESSION_NOW_INVALID', String(session.now))
  if (!Array.isArray(session.history)) err('SESSION_HISTORY_REQUIRED')
  else session.history.forEach((h, i) => {
    if (!h?.exemplar_id?.startsWith?.(ID_PREFIXES.exemplar)) err('SESSION_HISTORY_EXEMPLAR_INVALID', `history[${i}]`)
    if (!RECIPE_NAMES.includes(h?.recipe)) err('SESSION_HISTORY_RECIPE_INVALID', `history[${i}]=${h?.recipe}`)
    if (!['supported', 'independent'].includes(h?.support_lane)) err('SESSION_HISTORY_LANE_INVALID', `history[${i}]`)
  })
  return { valid: errors.length === 0, errors }
}

export function validateActivityPlanV2(plan) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!plan || typeof plan !== 'object') return { valid: false, errors: ['PLAN_REQUIRED'] }
  const where = plan.activity_id || 'plan'

  if (plan.plan_version !== ACTIVITY_PLAN_V2_VERSION) err('PLAN_VERSION_INVALID', String(plan.plan_version))
  if (plan.policy_version !== LESSON_ENGINE_POLICY_VERSION) err('PLAN_POLICY_VERSION_INVALID', String(plan.policy_version))
  if (typeof plan.activity_id !== 'string' || !plan.activity_id.startsWith('activity:')) err('PLAN_ACTIVITY_ID_INVALID', String(plan.activity_id))
  if (!plan.session_id) err('PLAN_SESSION_ID_REQUIRED', where)
  if (!Number.isInteger(plan.sequence_index) || plan.sequence_index < 0) err('PLAN_SEQUENCE_INDEX_INVALID', where)
  if (!RECIPE_NAMES.includes(plan.recipe)) err('PLAN_RECIPE_INVALID', `${where}=${plan.recipe}`)
  if (!ACTIVITY_KINDS.includes(plan.activity_kind)) err('PLAN_ACTIVITY_KIND_INVALID', `${where}=${plan.activity_kind}`)
  if (!deriveCapabilityKey({ capability: plan.capability, modality: plan.modality })) {
    err('PLAN_CAPABILITY_MODALITY_INCOMPATIBLE', `${where}=${plan.capability}+${plan.modality}`)
  }
  if (!plan.exemplar_id?.startsWith?.(ID_PREFIXES.exemplar)) err('PLAN_EXEMPLAR_INVALID', `${where}=${plan.exemplar_id}`)
  if (!plan.construction_id?.startsWith?.(ID_PREFIXES.construction)) err('PLAN_CONSTRUCTION_INVALID', `${where}=${plan.construction_id}`)
  if (!Array.isArray(plan.sense_ids)) err('PLAN_SENSE_IDS_REQUIRED', where)
  if (!Array.isArray(plan.communicative_function_ids)) err('PLAN_FUNCTION_IDS_REQUIRED', where)
  if (!isTargetRef(plan.primary_target)) err('PLAN_PRIMARY_TARGET_INVALID', where)
  if (!Array.isArray(plan.secondary_targets)) err('PLAN_SECONDARY_TARGETS_REQUIRED', where)
  else plan.secondary_targets.forEach((t, i) => { if (!isTargetRef(t)) err('PLAN_SECONDARY_TARGET_INVALID', `${where}[${i}]`) })

  // Support: structured features, derived tier recomputed, independence rule.
  const s = plan.support
  if (!s || !Array.isArray(s.features)) err('PLAN_SUPPORT_REQUIRED', where)
  else {
    for (const f of s.features) if (!SUPPORT_FEATURES.includes(f)) err('PLAN_SUPPORT_FEATURE_INVALID', `${where}=${f}`)
    if (s.features.includes('answer_reveal')) err('PLAN_ANSWER_REVEAL_FORBIDDEN', where)
    const derived = deriveSupportTier({ features: s.features, hint_count: 0 })
    if (s.derived_tier !== derived) err('PLAN_SUPPORT_TIER_MISMATCH', `${where}: ${s.derived_tier} != ${derived}`)
  }

  if (!plan.presentation || typeof plan.presentation !== 'object') err('PLAN_PRESENTATION_REQUIRED', where)
  else if (Array.isArray(plan.presentation.options)) {
    plan.presentation.options.forEach((o, i) => {
      if (!o.source_exemplar_id?.startsWith?.(ID_PREFIXES.exemplar)) err('PLAN_OPTION_SOURCE_REQUIRED', `${where}.options[${i}]`)
      if (typeof o.text_pt !== 'string' || !o.text_pt) err('PLAN_OPTION_TEXT_REQUIRED', `${where}.options[${i}]`)
    })
    if (!plan.presentation.options.some((o) => o.is_target)) err('PLAN_OPTION_TARGET_REQUIRED', where)
  }
  if (!plan.response_contract?.response_type) err('PLAN_RESPONSE_CONTRACT_REQUIRED', where)

  if (!Array.isArray(plan.planned_evidence)) err('PLAN_PLANNED_EVIDENCE_REQUIRED', where)
  else plan.planned_evidence.forEach((pe, i) => {
    const w = `${where}.planned_evidence[${i}]`
    if (!isTargetRef(pe.target)) err('PLANNED_EVIDENCE_TARGET_INVALID', w)
    if (!ATTRIBUTIONS.includes(pe.attribution)) err('PLANNED_EVIDENCE_ATTRIBUTION_INVALID', `${w}=${pe.attribution}`)
    if (!ACTIVITY_KINDS.includes(pe.activity?.activity_kind)) err('PLANNED_EVIDENCE_KIND_INVALID', w)
    if (!deriveCapabilityKey(pe.activity || {})) err('PLANNED_EVIDENCE_DOMAIN_INVALID', w)
    if (!Array.isArray(pe.possible_outcomes) || !pe.possible_outcomes.length
      || pe.possible_outcomes.some((o) => !OUTCOMES.includes(o))) err('PLANNED_EVIDENCE_OUTCOMES_INVALID', w)
    if (pe.attribution === 'exposure' && pe.possible_outcomes.some((o) => ['correct', 'partial', 'incorrect'].includes(o))) {
      err('PLANNED_EVIDENCE_EXPOSURE_ASSESSED', w)
    }
  })

  if (!plan.selection_trace || typeof plan.selection_trace !== 'object') err('PLAN_TRACE_REQUIRED', where)

  return { valid: errors.length === 0, errors }
}

export function validateSelectionTraceV2(trace) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!trace || typeof trace !== 'object') return { valid: false, errors: ['TRACE_REQUIRED'] }
  if (trace.trace_version !== 1) err('TRACE_VERSION_INVALID', String(trace.trace_version))
  if (!Number.isInteger(trace.considered) || trace.considered < 0) err('TRACE_CONSIDERED_INVALID')
  if (!Array.isArray(trace.excluded)) err('TRACE_EXCLUDED_REQUIRED')
  if (!Array.isArray(trace.candidates)) err('TRACE_CANDIDATES_REQUIRED')
  for (const a of trace.prerequisite_assessments || []) {
    if (!PREREQUISITE_STATUSES.includes(a.status)) err('TRACE_PREREQ_STATUS_INVALID', `${a.ref}=${a.status}`)
  }
  return { valid: errors.length === 0, errors }
}

export function validateLessonDecisionV2(decision) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!decision || typeof decision !== 'object') return { valid: false, errors: ['DECISION_REQUIRED'] }
  if (!DECISION_STATUSES.includes(decision.status)) err('DECISION_STATUS_INVALID', decision.status)
  if (!decision.session_id) err('DECISION_SESSION_ID_REQUIRED')
  if (decision.status === 'activity') {
    const plan = validateActivityPlanV2(decision.plan)
    errors.push(...plan.errors)
    const trace = validateSelectionTraceV2(decision.trace)
    errors.push(...trace.errors)
  } else if (decision.plan != null) {
    err('DECISION_PLAN_FORBIDDEN', decision.status)
  }
  return { valid: errors.length === 0, errors }
}

export function validateLessonEngineContextV2(context) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!context || typeof context !== 'object') return { valid: false, errors: ['CONTEXT_REQUIRED'] }
  if (context.context_version !== LESSON_ENGINE_CONTEXT_V2_VERSION) err('CONTEXT_VERSION_INVALID', String(context.context_version))
  if (!context.profile_id) err('CONTEXT_PROFILE_REQUIRED')
  if (typeof context.now !== 'string' || Number.isNaN(Date.parse(context.now))) err('CONTEXT_NOW_INVALID', String(context.now))
  if (!Array.isArray(context.learner_states)) err('CONTEXT_STATES_REQUIRED')
  if (!Array.isArray(context.recent_evidence)) err('CONTEXT_EVIDENCE_REQUIRED')
  // Multi-pack scope declaration (context_version 2).
  if (!Array.isArray(context.dependencies)) err('CONTEXT_DEPENDENCIES_REQUIRED')
  if (!Array.isArray(context.external_prerequisite_targets)) err('CONTEXT_EXTERNAL_TARGETS_REQUIRED')
  if (context.active_pack_id != null && typeof context.active_pack_id !== 'string') err('CONTEXT_ACTIVE_PACK_INVALID')
  if (context.active_lexeme_id != null && !String(context.active_lexeme_id).startsWith(ID_PREFIXES.lexeme)) {
    err('CONTEXT_ACTIVE_LEXEME_INVALID', String(context.active_lexeme_id))
  }
  return { valid: errors.length === 0, errors }
}
