// training-domain-reachability.js — static reachability audit of every
// training domain (capability × modality), Slice V2.9. Pure: derives everything
// from the recipe table, the affordances and (optionally) a runtime
// availability snapshot. This is the audit that would have caught the
// writing-production bug structurally: a domain the engine could train but for
// which the planner had NO candidate-generation path.
//
// Vocabulary the audit distinguishes (per the slice):
//   trainable    — an affordance exists (recipe pair), engine-level
//   executable   — trainable AND executable under the given runtime
//   candidate    — the planner has a structural path to propose the domain
//   conditional  — trainable engine-level but blocked by THIS runtime
//   unreachable  — trainable but with no structural path at all

import { LESSON_RECIPES } from './lesson-engine-contracts.js'
import {
  getTrainingAffordancesV2, findTrainingAffordanceV2, getTrainableModalitiesForCapabilityV2,
} from './training-affordances.js'
import { CAPABILITY_LADDER } from './capability-entry.js'

export const REACHABILITY_WARNING_CODES = [
  'TRAINABLE_DOMAIN_WITHOUT_CANDIDATE_PATH',
  'CANDIDATE_DOMAIN_WITHOUT_ENGINE_PATH',
  'ENGINE_DOMAIN_WITHOUT_ASSESSMENT_PATH',
  // Slice V2.10 — entry/expansion path analysis
  'CAPABILITY_WITHOUT_EXECUTABLE_ENTRY_PATH',
  'TRAINABLE_DOMAIN_ONLY_REACHABLE_BY_UNAVAILABLE_SIBLING',
]

/**
 * auditTrainingDomainReachabilityV2({ recipes, runtimeAvailability })
 * → { domains: [...], warnings: [...] }
 * One row per engine-level trainable domain:
 *   { capability, modality, has_affordance, has_candidate_path,
 *     has_engine_path, has_assessment_path, reachable, status }
 * status: 'reachable' | 'conditional' (runtime-blocked, not absolutely
 * unreachable) | 'unreachable' (no structural path even engine-level).
 */
export function auditTrainingDomainReachabilityV2({ recipes = LESSON_RECIPES, runtimeAvailability = null } = {}) {
  const engineLevel = getTrainingAffordancesV2({ recipes, runtimeAvailability: null })
  const runtimeLevel = runtimeAvailability == null ? engineLevel : getTrainingAffordancesV2({ recipes, runtimeAvailability })

  const domains = []
  const warnings = []

  for (const aff of engineLevel) {
    const { capability, modality } = aff
    // Planner candidate paths for this domain (structural, state-independent):
    //   entry  — the deterministic capability-ladder entry modality (first
    //            sorted trainable modality of the capability);
    //   gap    — a sibling trainable modality exists, so the generic
    //            modality-expansion generator can reach it once any sibling is
    //            practiced (Slice V2.9);
    //   free   — recognition focuses may omit the modality (first rung /
    //            introduction), letting the engine pick any recognition recipe.
    const trainableModalities = getTrainableModalitiesForCapabilityV2(capability, { affordances: engineLevel })
    const runtimeModalities = getTrainableModalitiesForCapabilityV2(capability, { affordances: runtimeLevel })
    // Slice V2.10: the ladder entry is RUNTIME-AWARE — any executable,
    // curriculum-permitting modality can open the rung, not just the first
    // sorted one. Statically, a domain has an entry path when its capability is
    // a ladder rung and the domain itself is executable + assessed.
    const hasSiblingGapPath = trainableModalities.length >= 2
    const engineFreeChoice = capability === 'recognition'
    const has_candidate_path = CAPABILITY_LADDER.includes(capability) || hasSiblingGapPath || engineFreeChoice

    const runtimeAff = findTrainingAffordanceV2(runtimeLevel, capability, modality)
    const has_engine_path = !!runtimeAff
    const has_assessment_path = !!(runtimeAff ?? aff).can_produce_assessed_evidence
    const has_capability_entry_path = CAPABILITY_LADDER.includes(capability) && has_engine_path && has_assessment_path
    // Expansion needs an executable sibling in THIS runtime to have been
    // practiced first: with the domain itself executable but every sibling
    // blocked, expansion cannot start here (entry still can).
    const executableSiblings = runtimeModalities.filter((m) => m !== modality)
    const has_modality_expansion_path = has_engine_path && has_assessment_path && executableSiblings.length > 0

    const reachable = has_candidate_path && has_engine_path && has_assessment_path
    const status = reachable
      ? 'reachable'
      : (has_candidate_path && aff.can_produce_assessed_evidence && !has_engine_path)
        ? 'conditional' // runtime-dependent, not absolutely unreachable
        : 'unreachable'

    domains.push({
      capability, modality,
      has_affordance: true,
      has_candidate_path,
      has_capability_entry_path,
      has_modality_expansion_path,
      has_engine_path,
      has_assessment_path,
      reachable,
      status,
    })

    if (!has_candidate_path && aff.can_produce_assessed_evidence) {
      warnings.push({ code: 'TRAINABLE_DOMAIN_WITHOUT_CANDIDATE_PATH', capability, modality })
    }
    if (has_candidate_path && runtimeAvailability == null && !has_engine_path) {
      warnings.push({ code: 'CANDIDATE_DOMAIN_WITHOUT_ENGINE_PATH', capability, modality })
    }
    if (has_engine_path && !has_assessment_path) {
      warnings.push({ code: 'ENGINE_DOMAIN_WITHOUT_ASSESSMENT_PATH', capability, modality })
    }
    // Executable domain whose ONLY structural path is expansion from siblings
    // that are all runtime-blocked (entry impossible: capability not a ladder
    // rung) — reachable in theory, unreachable with this runtime's siblings.
    if (has_engine_path && has_assessment_path && !has_capability_entry_path
      && trainableModalities.length >= 2 && executableSiblings.length === 0) {
      warnings.push({ code: 'TRAINABLE_DOMAIN_ONLY_REACHABLE_BY_UNAVAILABLE_SIBLING', capability, modality })
    }
  }

  // Slice V2.10 — per-CAPABILITY entry coverage under a PROVIDED runtime: a
  // ladder capability with assessed affordances but zero executable modalities
  // cannot be entered here (conditional runtime reality, surfaced explicitly).
  if (runtimeAvailability != null) {
    for (const capability of CAPABILITY_LADDER) {
      const engineMods = getTrainableModalitiesForCapabilityV2(capability, { affordances: engineLevel })
      if (!engineMods.length) continue
      const runtimeMods = getTrainableModalitiesForCapabilityV2(capability, { affordances: runtimeLevel })
      if (!runtimeMods.length) warnings.push({ code: 'CAPABILITY_WITHOUT_EXECUTABLE_ENTRY_PATH', capability, modality: null })
    }
  }

  domains.sort((a, b) => (a.capability < b.capability ? -1 : a.capability > b.capability ? 1
    : a.modality < b.modality ? -1 : 1))
  warnings.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1
    : a.capability < b.capability ? -1 : a.capability > b.capability ? 1
      : a.modality < b.modality ? -1 : 1))
  return { domains, warnings }
}
