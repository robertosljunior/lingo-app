// capability-entry.js — runtime-aware CAPABILITY ENTRY (Slice V2.10). Pure:
// decides through which modality a NEW capability rung may enter for a target.
// Before this slice the ladder always proposed the first lexically-sorted
// modality (production → speaking, comprehension → listening) even when that
// modality was runtime-blocked — a learner without a microphone never entered
// production at all. Entry is a pedagogical choice, never an artifact of sort
// order.
//
// An entry domain is eligible when ALL hold (§1):
//   1. an affordance exists for (capability, modality);
//   2. it is executable in the CURRENT runtime (the affordances passed in are
//      runtime-derived; engine-level affordances mean "ignore the runtime");
//   3. it produces assessed evidence;
//   4. the capability gate for that modality is met on this target
//      (capabilityGateMetV2 — the same predicate the engine enforces);
//   5. target prerequisites are the caller's concern (introduction filters).
//
// Selection among multiple eligible domains is DETERMINISTIC and introduces no
// new pedagogical weight: the first modality in sorted order among the
// eligible ones (all entry candidates are equally unpracticed by definition —
// the rung has no assessed evidence yet). The planner's seeded tie-break and
// existing weights keep deciding among competing candidates.
//
// Capability progression and modality expansion stay SEPARATE axes: entry
// opens the rung through one executable modality; the parallel modalities
// arrive later via modality-gap expansion (modality-gap.js).

import { getTrainableModalitiesForCapabilityV2 } from './training-affordances.js'
import { capabilityGateMetV2, getLane, laneMeets } from './lesson-engine-state-queries.js'

// The recommended capability progression (shared vocabulary of planner/engine).
export const CAPABILITY_LADDER = ['recognition', 'comprehension', 'controlled_production', 'free_production', 'pronunciation']

/**
 * The first OPEN ladder rung for a state: previous rung met at `advancement`,
 * next rung without assessed evidence in any trainable modality. Returns the
 * capability name or null. Mirrors the planner's ladder scan (engine-level
 * modality lists derived from `engineLevelAffordances`).
 */
export function findFirstOpenCapabilityRungV2(state, { engineLevelAffordances, thresholds }) {
  const mods = (cap) => getTrainableModalitiesForCapabilityV2(cap, { affordances: engineLevelAffordances })
  for (let i = 1; i < CAPABILITY_LADDER.length; i++) {
    const prev = CAPABILITY_LADDER[i - 1]
    const next = CAPABILITY_LADDER[i]
    const prevMet = mods(prev).some((m) => laneMeets(getLane(state, `${m}_${prev}`, 'overall'), thresholds.advancement))
    if (!prevMet) continue
    const nextAssessed = mods(next).some((m) => (getLane(state, `${m}_${next}`, 'overall')?.assessed_evidence_count || 0) > 0)
    if (nextAssessed) continue
    return next
  }
  return null
}

/**
 * getEligibleEntryDomainsForCapabilityV2({ target, capability, learnerState,
 *   affordances, thresholds })
 * → [{ capability, modality, executable, curriculum_ready }] (sorted, only
 *   rows with executable && curriculum_ready are eligible entries; the full
 *   annotated list is returned for diagnostics/inspector use).
 * `affordances` carries the runtime view: pass runtime-derived affordances for
 * runtime-aware entry, engine-level ones to ignore the runtime.
 */
export function getEligibleEntryDomainsForCapabilityV2({ target, capability, learnerState, affordances, engineLevelAffordances = null, thresholds }) {
  void target // identity stays target × capability × modality; content coverage is the engine's concern
  const executable = new Set(getTrainableModalitiesForCapabilityV2(capability, { affordances }))
  // The union with the engine-level view lets diagnostics show runtime-blocked
  // modalities as executable:false rather than omitting them.
  const all = engineLevelAffordances
    ? getTrainableModalitiesForCapabilityV2(capability, { affordances: engineLevelAffordances })
    : [...executable].sort()
  return all.map((modality) => ({
    capability,
    modality,
    executable: executable.has(modality),
    curriculum_ready: capabilityGateMetV2(learnerState, capability, modality, thresholds),
  }))
}

/**
 * The deterministic entry modality for a capability on this target, or null
 * when no executable, curriculum-ready modality exists. Also reports whether a
 * PREFERRED (first engine-level) modality was skipped because the runtime
 * cannot execute it — for the RUNTIME_AWARE_CAPABILITY_ENTRY reason codes.
 */
export function selectEntryModalityV2({ target, capability, learnerState, affordances, engineLevelAffordances = null, thresholds }) {
  const domains = getEligibleEntryDomainsForCapabilityV2({ target, capability, learnerState, affordances, engineLevelAffordances, thresholds })
  const eligible = domains.filter((d) => d.executable && d.curriculum_ready)
  if (!eligible.length) {
    return {
      modality: null,
      // Distinguish "nothing executable at all" from "executable but not ready"
      // — the invariant only cares when an executable domain exists.
      any_executable: domains.some((d) => d.executable),
      preferred_unavailable: false,
      domains,
    }
  }
  const chosen = eligible[0].modality // sorted-first among eligible: deterministic, no new weight
  const preferred = domains[0]?.modality ?? chosen // first engine-level modality (the pre-V2.10 fixed choice)
  return {
    modality: chosen,
    any_executable: true,
    preferred_unavailable: chosen !== preferred && domains.some((d) => d.modality === preferred && !d.executable),
    domains,
  }
}

/**
 * Invariant helper (§11): CAPABILITY_READY_BUT_NO_EXECUTABLE_ENTRY_DOMAIN.
 * Given one target state and a capability whose PREVIOUS rung is met, the
 * planner must be able to produce SOME entry candidate whenever at least one
 * executable, curriculum-ready modality exists. Returns true when the planner
 * would be silently stuck (ready + executable entry exists + no candidate for
 * the capability was generated). Never fires when the runtime offers no
 * executable modality — that is runtime reality, not a planner defect.
 */
export function capabilityEntrySilentlyStuckV2({ target, capability, learnerState, affordances, thresholds, generatedCapabilities }) {
  const sel = selectEntryModalityV2({ target, capability, learnerState, affordances, thresholds })
  if (sel.modality == null) return false // nothing executable+ready → not a planner defect
  return !generatedCapabilities.has(capability)
}
