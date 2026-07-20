// modality-gap.js — generic MODALITY-EXPANSION candidate generation
// (Slice V2.9). Pure: given one learner target state, the training affordances
// and the curriculum thresholds, it emits the domain gaps the Study Planner
// should offer as `deepen` candidates.
//
// Two different axes, never conflated:
//   capability progression — recognition → comprehension → controlled → free
//   modality expansion     — the SAME capability in a parallel trainable
//                            modality (speaking→writing, reading→listening, …)
// Modality is NOT a level: expansion candidates never reorder the ladder.
//
// A gap exists for (target, capability, missing modality) when ALL hold:
//   1. the capability has ASSESSED evidence in some practiced sibling modality
//      (the target is exposed and the capability demonstrably unlocked there);
//   2. the missing modality is a trainable sibling — an executable affordance
//      producing assessed evidence (recipe + runtime derived, no manual table);
//   3. the missing modality has NO assessed evidence yet (a started-but-weak
//      lane is consolidation work; a deteriorated one is review — not a gap);
//   4. the capability gate for the missing modality is met on this target
//      (capabilityGateMetV2 — the SAME predicate the engine enforces, e.g.
//      free/writing needs controlled/writing first);
// Evidence NEVER leaks between modalities: practicing speaking makes writing
// curricularly interesting, it never updates the writing lane.

import { getSiblingTrainableDomainsV2 } from './training-affordances.js'
import { getLane, capabilityGateMetV2 } from './lesson-engine-state-queries.js'

// Specific explainability codes for the known modality pairings. Generation is
// generic — these only annotate WHY (for diagnostics); an unknown pairing still
// generates with the generic code alone.
const SPECIFIC_BEHIND_CODES = new Set([
  'WRITING_BEHIND_SPEAKING',
  'SPEAKING_BEHIND_WRITING',
  'LISTENING_BEHIND_READING',
  'READING_BEHIND_LISTENING',
])

/**
 * buildModalityGapCandidatesV2({ state, affordances, thresholds })
 * → [{ capability, modality, source_modalities, reason_codes }]
 * Deterministic: sorted capabilities/modalities, deduplicated per domain.
 */
export function buildModalityGapCandidatesV2({ state, affordances, thresholds }) {
  const byDomain = new Map() // `${capability}|${modality}` → candidate
  const capKeys = Object.keys(state?.capabilities || {}).sort()

  for (const capKey of capKeys) {
    const [practicedModality, ...rest] = capKey.split('_')
    const capability = rest.join('_')
    const practiced = getLane(state, capKey, 'overall')
    if ((practiced?.assessed_evidence_count || 0) === 0) continue // 1

    for (const sibling of getSiblingTrainableDomainsV2({ capability, current_modality: practicedModality, affordances })) { // 2
      const siblingKey = `${sibling.modality}_${capability}`
      if ((getLane(state, siblingKey, 'overall')?.assessed_evidence_count || 0) > 0) continue // 3
      if (!capabilityGateMetV2(state, capability, sibling.modality, thresholds)) continue // 4

      const key = `${capability}|${sibling.modality}`
      let candidate = byDomain.get(key)
      if (!candidate) {
        candidate = {
          capability,
          modality: sibling.modality,
          source_modalities: [],
          reason_codes: ['MODALITY_GAP', 'PARALLEL_MODALITY_UNPRACTICED'],
        }
        byDomain.set(key, candidate)
      }
      if (!candidate.source_modalities.includes(practicedModality)) {
        candidate.source_modalities.push(practicedModality)
        const specific = `${sibling.modality.toUpperCase()}_BEHIND_${practicedModality.toUpperCase()}`
        if (SPECIFIC_BEHIND_CODES.has(specific) && !candidate.reason_codes.includes(specific)) {
          candidate.reason_codes.push(specific)
        }
      }
    }
  }

  const out = [...byDomain.values()]
  for (const c of out) {
    c.source_modalities.sort()
    c.reason_codes.sort()
  }
  out.sort((a, b) => (a.capability < b.capability ? -1 : a.capability > b.capability ? 1
    : a.modality < b.modality ? -1 : 1))
  return out
}
