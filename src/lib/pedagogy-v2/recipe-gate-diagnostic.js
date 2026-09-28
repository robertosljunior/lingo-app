// recipe-gate-diagnostic.js — P0/#106 read-only diagnostics.
//
// This module does not change planner/engine behavior. It consumes the gate's
// own source-of-truth trace and adds recipe/materialization diagnostics so the
// causal chain can distinguish:
//   planner/gate exclusion -> candidate loses -> materialization fallback.

import { LESSON_RECIPES, mergeLessonEnginePolicyV2 } from './lesson-engine-contracts.js'
import { capabilityGateMetV2, capabilityGateTraceV2 } from './lesson-engine-state-queries.js'
import { getPrimaryTargets } from './query.js'
import { isLicensedRealization } from './licensed-realization-contracts.js'
import { isRecipeExecutable } from './runtime-capabilities.js'
import { allowedResponseTypesForPlanV2 } from './activity-runtime-contracts.js'

export const RECIPE_GATE_DIAGNOSTIC_VERSION = 1

const LEVEL_RANK = Object.freeze({ insufficient: 0, emerging: 1, established: 2 })

/**
 * Public #106 diagnostic wrapper around the SAME trace used by runtime. The
 * agreement field is intentionally redundant: if a future edit bypasses the
 * source-of-truth helper, the diagnostic regression fails loudly.
 */
export function capabilityGatePredicateTraceV2(state, capability, modality, thresholds) {
  const trace = capabilityGateTraceV2(state, capability, modality, thresholds)
  return {
    ...trace,
    diagnostic_agrees_with_runtime: trace.met === capabilityGateMetV2(state, capability, modality, thresholds),
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
