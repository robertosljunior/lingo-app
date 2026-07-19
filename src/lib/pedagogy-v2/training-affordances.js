// training-affordances.js — the SINGLE source of truth for "what this engine +
// runtime can actually train" (Slice V2.8). It is derived entirely from the
// engine's recipe table (LESSON_RECIPES) and the runtime availability — never a
// hand-maintained `if (capability === 'recognition')` list. A domain is a
// (capability, modality) pair; each affordance says which support tiers are
// reachable there, whether that domain can produce ASSESSED (mastery-moving)
// evidence, and — the V2.8 fix — whether it can be trained INDEPENDENTLY
// (an executable recipe variant whose derived support tier is `none`).
//
// The planner and review queue consult THIS layer instead of assuming every
// capability has an independent variant. If a genuinely independent recipe is
// added later, the affected domain becomes eligible automatically, with no
// change to the planner.

import { LESSON_RECIPES } from './lesson-engine-contracts.js'
import { deriveSupportTier } from './learner-evidence-contracts.js'
import { isRecipeExecutable } from './runtime-capabilities.js'

// Recipes that move mastery. `exposure` only produces observed/not_assessed
// evidence and therefore can never satisfy an independent lane.
const ASSESSED_ATTRIBUTION_RULES = new Set(['meaning_first', 'form_first', 'assessed_only'])

function recipeProducesAssessedEvidence(recipe) {
  return ASSESSED_ATTRIBUTION_RULES.has(recipe.attribution_rule)
}

/**
 * Compute the training affordances for a runtime.
 *   getTrainingAffordancesV2({ recipes, runtimeAvailability })
 * Returns one affordance per executable (capability, modality) domain:
 *   {
 *     capability, modality,
 *     activity_kinds: [...], recipes: [...],
 *     support_tiers: ['high','none', ...],       // reachable derived tiers
 *     can_train_independent: bool,               // ∃ executable recipe with a
 *                                                //   tier-`none` variant that
 *                                                //   produces assessed evidence
 *     can_produce_assessed_evidence: bool,
 *     independent_recipes: [...],
 *   }
 * `runtimeAvailability == null` means "ignore the runtime" — every recipe is
 * treated as executable (the pure recipe-level, engine-only view).
 */
export function getTrainingAffordancesV2({ recipes = LESSON_RECIPES, runtimeAvailability = null } = {}) {
  const byDomain = new Map()
  for (const recipe of recipes) {
    const producesAssessed = recipeProducesAssessedEvidence(recipe)
    for (const [capability, modality] of recipe.pairs) {
      const executable = runtimeAvailability == null
        ? true
        : isRecipeExecutable(runtimeAvailability, recipe.recipe, modality)
      if (!executable) continue
      const key = `${capability}_${modality}`
      let dom = byDomain.get(key)
      if (!dom) {
        dom = {
          capability, modality,
          activity_kinds: new Set(), recipes: new Set(),
          tiers: new Set(), independent_recipes: new Set(),
          can_produce_assessed_evidence: false,
        }
        byDomain.set(key, dom)
      }
      dom.activity_kinds.add(recipe.activity_kind)
      dom.recipes.add(recipe.recipe)
      if (producesAssessed) dom.can_produce_assessed_evidence = true
      for (const variant of recipe.variants) {
        const tier = deriveSupportTier({ features: variant.features, hint_count: 0 })
        dom.tiers.add(tier)
        // An independent affordance requires BOTH an unaided variant AND that
        // the recipe actually yields assessed evidence.
        if (tier === 'none' && producesAssessed) dom.independent_recipes.add(recipe.recipe)
      }
    }
  }

  const affordances = [...byDomain.values()].map((dom) => ({
    capability: dom.capability,
    modality: dom.modality,
    activity_kinds: [...dom.activity_kinds].sort(),
    recipes: [...dom.recipes].sort(),
    support_tiers: [...dom.tiers].sort(),
    can_train_independent: dom.independent_recipes.size > 0,
    can_produce_assessed_evidence: dom.can_produce_assessed_evidence,
    independent_recipes: [...dom.independent_recipes].sort(),
  }))
  affordances.sort((a, b) => (a.capability < b.capability ? -1 : a.capability > b.capability ? 1
    : a.modality < b.modality ? -1 : a.modality > b.modality ? 1 : 0))
  return affordances
}

/** The affordance for a domain (modality optional → first match). */
export function findTrainingAffordanceV2(affordances, capability, modality = null) {
  return (affordances || []).find((a) => a.capability === capability
    && (modality == null || a.modality === modality)) || null
}

/**
 * Is (capability, modality) trainable to INDEPENDENT evidence in this runtime?
 * Pass precomputed `affordances` for efficiency, or a `runtimeAvailability`
 * (null ⇒ engine-only, recipe-level view). With modality omitted, true if ANY
 * modality of the capability is independently trainable.
 */
export function canTrainIndependentV2(capability, modality = null, { affordances = null, runtimeAvailability = null, recipes = LESSON_RECIPES } = {}) {
  const list = affordances || getTrainingAffordancesV2({ recipes, runtimeAvailability })
  if (modality == null) return list.some((a) => a.capability === capability && a.can_train_independent)
  const a = findTrainingAffordanceV2(list, capability, modality)
  return !!(a && a.can_train_independent)
}

/** Can (capability, modality) produce ASSESSED evidence at all in this runtime? */
export function canProduceAssessedEvidenceV2(capability, modality = null, { affordances = null, runtimeAvailability = null, recipes = LESSON_RECIPES } = {}) {
  const list = affordances || getTrainingAffordancesV2({ recipes, runtimeAvailability })
  if (modality == null) return list.some((a) => a.capability === capability && a.can_produce_assessed_evidence)
  const a = findTrainingAffordanceV2(list, capability, modality)
  return !!(a && a.can_produce_assessed_evidence)
}

// Diagnostic reasons for WHY a domain cannot be trained independently.
export const INDEPENDENCE_UNAVAILABLE_REASONS = ['no_independent_recipe', 'runtime_unavailable', 'assessment_unavailable']

/**
 * Explain (for diagnostics only) why independence is unavailable for a domain,
 * or null when it IS available. Distinguishes a structural gap (the engine has
 * no independent recipe — e.g. recognition/comprehension) from a runtime gap
 * (an independent recipe exists but the microphone / audio / assessment it needs
 * is missing). Never surfaced to the learner as a failure.
 */
export function independenceUnavailabilityReasonV2(capability, modality, { recipes = LESSON_RECIPES, runtimeAvailability = null } = {}) {
  // Recipe-level (engine-only): does an independent recipe exist at all?
  const engineOnly = getTrainingAffordancesV2({ recipes, runtimeAvailability: null })
  const engineDom = findTrainingAffordanceV2(engineOnly, capability, modality)
  if (!engineDom || !engineDom.can_train_independent) return 'no_independent_recipe'

  if (runtimeAvailability == null) return null // engine can, runtime unknown ⇒ available

  const runtimeDom = findTrainingAffordanceV2(
    getTrainingAffordancesV2({ recipes, runtimeAvailability }), capability, modality,
  )
  if (runtimeDom && runtimeDom.can_train_independent) return null

  // An independent recipe exists but is not executable here — classify by the
  // missing capability recorded in the runtime availability table.
  const blocking = (runtimeAvailability?.unavailable || [])
    .filter((u) => engineDom.independent_recipes.includes(u.recipe)
      && (u.modality == null || u.modality === modality))
    .map((u) => u.reason)
  if (blocking.some((r) => /ASSESSMENT/.test(r))) return 'assessment_unavailable'
  return 'runtime_unavailable'
}
