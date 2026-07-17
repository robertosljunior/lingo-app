// activity-runtime-validator.js — structural validation of ActivityResponseV2
// against its ActivityPlanV2, BEFORE any assessment runs. Same `CODE:detail`
// error convention as the other V2 validators.

import { SUPPORT_FEATURES } from './learner-model-constants.js'
import {
  ACTIVITY_RESPONSE_VERSION, RESPONSE_TYPES, RESPONSE_TYPES_FOR_RECIPE,
  buildInteractionIdV2,
} from './activity-runtime-contracts.js'

export function validateActivityResponseV2(response, plan) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!response || typeof response !== 'object') return { valid: false, errors: ['RESPONSE_REQUIRED'] }
  if (!plan || typeof plan !== 'object') return { valid: false, errors: ['PLAN_REQUIRED'] }

  if (response.response_version !== ACTIVITY_RESPONSE_VERSION) err('RESPONSE_VERSION_INVALID', String(response.response_version))
  if (!RESPONSE_TYPES.includes(response.response_type)) err('RESPONSE_TYPE_INVALID', response.response_type)
  else if (!(RESPONSE_TYPES_FOR_RECIPE[plan.recipe] || []).includes(response.response_type)) {
    err('RESPONSE_TYPE_INCOMPATIBLE', `${plan.recipe}+${response.response_type}`)
  }
  if (response.activity_id !== plan.activity_id) err('RESPONSE_ACTIVITY_MISMATCH', `${response.activity_id} != ${plan.activity_id}`)
  if (response.session_id !== plan.session_id) err('RESPONSE_SESSION_MISMATCH', String(response.session_id))
  if (!Number.isInteger(response.attempt_number) || response.attempt_number < 1) err('RESPONSE_ATTEMPT_INVALID', String(response.attempt_number))
  if (typeof response.submitted_at !== 'string' || Number.isNaN(Date.parse(response.submitted_at))) {
    err('RESPONSE_SUBMITTED_AT_INVALID', String(response.submitted_at))
  }
  if (Number.isInteger(response.attempt_number) && response.attempt_number >= 1
    && response.interaction_id !== buildInteractionIdV2({ sessionId: plan.session_id, activityId: plan.activity_id, attemptNumber: response.attempt_number })) {
    err('RESPONSE_INTERACTION_ID_INVALID', String(response.interaction_id))
  }

  // ---- typed payload ----
  const p = response.payload
  if (!p || typeof p !== 'object') err('RESPONSE_PAYLOAD_REQUIRED')
  else {
    switch (response.response_type) {
      case 'continue':
        break
      case 'single_choice':
        if (typeof p.option_id !== 'string' || !p.option_id) err('PAYLOAD_OPTION_ID_REQUIRED')
        else if (!(plan.presentation?.options || []).some((o) => o.option_id === p.option_id)) {
          err('PAYLOAD_OPTION_UNKNOWN', p.option_id)
        }
        break
      case 'text':
        if (typeof p.text !== 'string') err('PAYLOAD_TEXT_REQUIRED')
        break
      case 'token_sequence':
        if (!Array.isArray(p.tokens) || p.tokens.some((t) => typeof t !== 'string')) err('PAYLOAD_TOKENS_REQUIRED')
        break
      case 'speech_transcript':
        if (typeof p.transcript !== 'string') err('PAYLOAD_TRANSCRIPT_REQUIRED')
        if (p.stt_confidence != null && !(typeof p.stt_confidence === 'number' && p.stt_confidence >= 0 && p.stt_confidence <= 1)) {
          err('PAYLOAD_STT_CONFIDENCE_INVALID', String(p.stt_confidence))
        }
        break
      case 'pronunciation_attempt':
        if (typeof p.transcript !== 'string' && p.transcript != null) err('PAYLOAD_TRANSCRIPT_INVALID')
        break
      default:
        break
    }
  }

  // ---- support usage ----
  const s = response.support_usage
  if (!s || typeof s !== 'object') err('RESPONSE_SUPPORT_USAGE_REQUIRED')
  else {
    for (const key of ['baseline_features', 'used_features']) {
      if (!Array.isArray(s[key])) err('SUPPORT_USAGE_FEATURES_INVALID', key)
      else for (const f of s[key]) if (!SUPPORT_FEATURES.includes(f)) err('SUPPORT_USAGE_FEATURE_UNKNOWN', f)
    }
    if (!Number.isInteger(s.hint_count) || s.hint_count < 0) err('SUPPORT_USAGE_HINT_COUNT_INVALID', String(s.hint_count))
    if (s.attempt_number !== response.attempt_number) err('SUPPORT_USAGE_ATTEMPT_MISMATCH', String(s.attempt_number))
    if (typeof s.answer_revealed !== 'boolean') err('SUPPORT_USAGE_ANSWER_REVEALED_INVALID')
  }

  return { valid: errors.length === 0, errors }
}
