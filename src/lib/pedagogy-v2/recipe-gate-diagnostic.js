// recipe-gate-diagnostic.js — P0/#106 read-only diagnostics.
//
// This module does not change planner/engine behavior. It exposes the exact
// capability-gate predicates, recipe eligibility inputs and post-selection
// materialization contract so diagnostics can distinguish:
//   planner/gate exclusion -> candidate loses -> materialization fallback.

import { LESSON_RECIPES, mergeLessonEnginePolicyV2 } from './lesson-engine-contracts.js'
import {
  capabilityGateMetV2, capabilityAdvancementMetV2, exposureCount,
  getCapabilityRollup, getLane, laneMeets, PRODUCTION_CAPABILITY_KEYS,
} from './lesson-engine-state-queries.js'
import { getPrimaryTargets } from './query.js'
import { isLicensedRealization } from './licensed-realization-contracts.js'
import { isRecipeExecutable } from './runtime-capabilities.js'
import { allowedResponseTypesForPlanV2 } from './activity-runtime-contracts.js'

export const RECIPE_GATE_DIAGNOSTIC_VERSION = 1

const LEVEL_RANK = Object.freeze({ insufficient: 0, emerging: 1, established: 2 })

function laneSnapshot(lane) {
  return {
    present: !!lane,
    mastery_estimate: lane?.mastery_estimate ?? null,
    evidence_level: lane?.evidence_level ?? 'insufficient',
    assessed_evidence_count: lane?.assessed_evidence_count ?? 0,
    effective_evidence_weight: lane?.effective_evidence_weight ?? 0,
  }
}

function thresholdSnapshot(threshold) {
  return {
    min_mastery: threshold?.min_mastery ?? null,
    min_evidence_level: threshold?.min_evidence_level ?? null,
  }
}

function thresholdPredicate(name, lane, threshold, source) {
  const actual = laneSnapshot(lane)
  const required = thresholdSnapshot(threshold)
  return {
    predicate: name,
    source,
    actual,
    required,
    met: laneMeets(lane, threshold),
  }
}

function recognitionAdvancementPredicate(state, threshold) {
  const rollup = getCapabilityRollup(state, 'recognition', 'overall')
  if (rollup) return thresholdPredicate('recognition_advancement', rollup, threshold, 'capability_rollup.recognition.overall')
  const keys = ['reading_recognition', 'listening_recognition', 'multimodal_recognition']
  const lanes = keys.map((key) => ({ key, ...laneSnapshot(getLane(state, key, 'overall')) }))
  return {
    predicate: 'recognition_advancement',
    source: 'pre_rollup_modality_fallback',
    actual: { lanes },
    required: thresholdSnapshot(threshold),
    met: capabilityAdvancementMetV2(state, 'recognition', threshold),
  }
}

/**
 * Explain the exact boolean used by capabilityGateMetV2 without guessing what
 * "production ready" means. Every predicate carries actual + required values.
 */
export function capabilityGatePredicateTraceV2(state, capability, modality, thresholds) {
  const advancement = thresholds.advancement
  const predicates = []

  if (capability === 'recognition') {
    const count = exposureCount(state)
    predicates.push({
      predicate: 'has_exposure', actual: { exposure_count: count },
      required: { min_exposure_count: 1 }, met: count >= 1,
    })
  } else if (capability === 'comprehension') {
    const count = exposureCount(state)
    predicates.push({
      predicate: 'has_exposure', actual: { exposure_count: count },
      required: { min_exposure_count: 1 }, met: count >= 1,
    })
    predicates.push(recognitionAdvancementPredicate(state, advancement))
    const lane = getLane(state, `${modality}_recognition`, 'overall')
    const assessed = lane?.assessed_evidence_count ?? 0
    predicates.push({
      predicate: 'same_modality_recognition_evidence',
      actual: { capability_key: `${modality}_recognition`, assessed_evidence_count: assessed },
      required: { min_assessed_evidence_count: 1 }, met: assessed >= 1,
    })
  } else if (capability === 'controlled_production') {
    predicates.push(recognitionAdvancementPredicate(state, advancement))
  } else if (capability === 'free_production') {
    const key = `${modality}_controlled_production`
    predicates.push(thresholdPredicate(
      'same_modality_controlled_production_advancement',
      getLane(state, key, 'overall'), advancement, `capabilities.${key}.overall`,
    ))
  } else if (capability === 'pronunciation') {
    const lanes = PRODUCTION_CAPABILITY_KEYS.map((key) => ({
      key,
      ...laneSnapshot(getLane(state, key, 'overall')),
      meets_advancement: laneMeets(getLane(state, key, 'overall'), advancement),
    }))
    predicates.push({
      predicate: 'any_production_advancement',
      actual: { lanes }, required: thresholdSnapshot(advancement),
      met: lanes.some((lane) => lane.meets_advancement),
    })
  } else {
    predicates.push({ predicate: 'known_capability', actual: { capability }, required: { known: true }, met: false })
  }

  const runtimeTruth = capabilityGateMetV2(state, capability, modality, thresholds)
  const predicateTruth = predicates.every((row) => row.met)
  return {
    capability,
    modality,
    met: runtimeTruth,
    predicates,
    diagnostic_agrees_with_runtime: runtimeTruth === predicateTruth,
  }
}

/**
 * Enumerate recipe eligibility for one exemplar and one requested domain. This
 * is deliberately pre-scoring: weights cannot hide a gate failure here.
 */
export function recipeEligibilityTraceV2({
  exemplar,
  learnerStatesByTargetId,
  capability,
  modality,
  policy = {},
  runtimeAvailability = null,
} = {}) {
  const p = mergeLessonEnginePolicyV2(policy)
  const primaryTargets = getPrimaryTargets(exemplar)
  const primaryIds = primaryTargets.map((target) => target.target_id)
  const licensed = isLicensedRealization(exemplar)

  return LESSON_RECIPES.map((recipe) => {
    const pairMatches = recipe.pairs.some(([cap, mod]) => cap === capability && mod === modality)
    const presentationVariantOnly = !!recipe.presentation_variant_of
    const licensedContractAllows = !licensed || (exemplar.eligible_recipes || []).includes(recipe.recipe)
    const runtimeExecutable = pairMatches && isRecipeExecutable(runtimeAvailability, recipe.recipe, modality)
    const gates = primaryIds.map((targetId) => ({
      target_id: targetId,
      ...capabilityGatePredicateTraceV2(learnerStatesByTargetId.get(targetId), capability, modality, p.thresholds),
    }))
    const gateMet = pairMatches && gates.every((gate) => gate.met)
    const eligible = pairMatches && !presentationVariantOnly && licensedContractAllows && runtimeExecutable && gateMet
    const reasons = []
    if (!pairMatches) reasons.push('recipe_domain_mismatch')
    if (presentationVariantOnly) reasons.push('presentation_variant_only')
    if (!licensedContractAllows) reasons.push('recipe_requires_context')
    if (pairMatches && !runtimeExecutable) reasons.push('runtime_unavailable')
    if (pairMatches && !gateMet) reasons.push('capability_gate_not_met')
    return {
      recipe: recipe.recipe,
      capability,
      modality,
      exemplar_id: exemplar.exemplar_id,
      provenance: licensed ? 'licensed_variant' : 'curated_authored',
      has_authored_context: !!String(exemplar.context || '').trim(),
      pair_matches: pairMatches,
      licensed_contract_allows: licensedContractAllows,
      runtime_executable: runtimeExecutable,
      capability_gate_met: gateMet,
      eligible_before_scoring: eligible,
      exclusion_reasons: reasons,
      gate_targets: gates,
    }
  })
}

const EXPECTED_RESPONSE_TYPE = Object.freeze({
  exposure: 'continue',
  meaning_recognition: 'single_choice',
  context_recognition: 'single_choice',
  listening_recognition: 'single_choice',
  fixed_element_completion: 'text',
  word_order_reconstruction: 'token_sequence',
  guided_production: null,
  free_production: null,
  pronunciation: 'pronunciation_attempt',
})

/**
 * Post-selection materialization check. A diagnostic caller supplies the recipe
 * that won selection (when known); the plan and renderer recipe must preserve it
 * except for the engine's explicit meaning->context presentation variant.
 */
export function recipeMaterializationTraceV2({ selectedRecipe = null, plan = null, rendererRecipe = null } = {}) {
  const planRecipe = plan?.recipe ?? null
  const accepted = plan ? allowedResponseTypesForPlanV2(plan) : []
  const expectedResponse = planRecipe ? EXPECTED_RESPONSE_TYPE[planRecipe] : null
  const approvedPresentationVariant = selectedRecipe === 'meaning_recognition' && planRecipe === 'context_recognition'
  const selectedToPlanConsistent = selectedRecipe == null || selectedRecipe === planRecipe || approvedPresentationVariant
  const planToRendererConsistent = rendererRecipe == null || rendererRecipe === planRecipe
  const responseContractConsistent = expectedResponse == null || accepted.includes(expectedResponse)
  const wordOrderContract = planRecipe !== 'word_order_reconstruction' || (
    !!plan?.presentation?.token_source
    && plan.presentation.token_source.exemplar_id === plan.exemplar_id
    && accepted.includes('token_sequence')
  )

  return {
    selected_recipe: selectedRecipe,
    materialized_recipe: planRecipe,
    renderer_recipe: rendererRecipe,
    accepted_response_types: accepted,
    approved_presentation_variant: approvedPresentationVariant,
    selected_to_plan_consistent: selectedToPlanConsistent,
    plan_to_renderer_consistent: planToRendererConsistent,
    response_contract_consistent: responseContractConsistent,
    word_order_contract_valid: wordOrderContract,
    fallback_detected: !(selectedToPlanConsistent && planToRendererConsistent && responseContractConsistent && wordOrderContract),
  }
}

/** Static audit helper for the E2E harness used in PRs #104/#105. */
export function inspectRecognitionHarnessSourceV2(source) {
  const text = String(source || '')
  const clicksFirstOption = /v2lx-option-[^\n]*?\)\.first\(\)\.click\(\)/s.test(text)
    || /locator\([^\n]*v2lx-option-[^\n]*\)\.first\(\)\.click\(\)/s.test(text)
  const usesCorrectOptionId = /correct_option_id/.test(text)
  return {
    recognition_answer_strategy: clicksFirstOption ? 'first_option' : usesCorrectOptionId ? 'correct_option_id' : 'unknown',
    guarantees_correct_recognition_answer: usesCorrectOptionId && !clicksFirstOption,
  }
}

export function evidenceLevelMeetsV2(actual, required) {
  return (LEVEL_RANK[actual] ?? 0) >= (LEVEL_RANK[required] ?? 0)
}
