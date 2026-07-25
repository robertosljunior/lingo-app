// query.js — pure, side-effect-free read API over a pedagogical_v2 pack.
// This is the surface learner_model_v2 and lesson_engine_v2 will consume in
// later slices. It is NOT connected to the V1 lesson generator.

import { stageIndex } from './contracts.js'

export function getLexeme(pack, lexemeId) {
  return (pack?.lexemes || []).find((l) => l.lexeme_id === lexemeId) || null
}

export function getSense(pack, senseId) {
  return (pack?.senses || []).find((s) => s.sense_id === senseId) || null
}

export function getConstruction(pack, constructionId) {
  return (pack?.constructions || []).find((c) => c.construction_id === constructionId) || null
}

export function getCommunicativeFunction(pack, functionId) {
  return (pack?.communicative_functions || []).find((f) => f.function_id === functionId) || null
}

export function getExemplar(pack, exemplarId) {
  return (pack?.exemplars || []).find((e) => e.exemplar_id === exemplarId) || null
}

export function getSensesForLexeme(pack, lexemeId) {
  return (pack?.senses || []).filter((s) => s.lexeme_id === lexemeId)
}

export function getConstructionsBySense(pack, senseId) {
  return (pack?.constructions || []).filter((c) => (c.sense_ids || []).includes(senseId))
}

export function getConstructionsByFunction(pack, functionId) {
  return (pack?.constructions || []).filter((c) => (c.communicative_function_ids || []).includes(functionId))
}

export function getExemplarsBySense(pack, senseId) {
  return (pack?.exemplars || []).filter((e) => (e.sense_ids || []).includes(senseId))
}

export function getExemplarsByConstruction(pack, constructionId) {
  return (pack?.exemplars || []).filter((e) => e.construction_id === constructionId)
}

export function getExemplarsByFunction(pack, functionId) {
  return (pack?.exemplars || []).filter((e) => (e.communicative_function_ids || []).includes(functionId))
}

export function getExemplarsByStage(pack, stage) {
  return (pack?.exemplars || []).filter((e) => e.exposure_stage === stage)
}

// ---- per-exemplar pedagogical declarations ----

export function getPrimaryTargets(exemplar) {
  return (exemplar?.pedagogical_targets || []).filter((t) => t.role === 'primary')
}

export function getSecondaryTargets(exemplar) {
  return (exemplar?.pedagogical_targets || []).filter((t) => t.role === 'secondary')
}

export function getPrerequisites(exemplar) {
  return exemplar?.prerequisites || []
}

// Only the V1 compatibility bridges (grammar_skill_v1); callers that integrate
// with the V1 skill registry must opt in explicitly through this accessor.
export function getV1BridgePrerequisites(exemplar) {
  return getPrerequisites(exemplar).filter((p) => p.type === 'grammar_skill_v1' && p.compat_bridge === true)
}

export function getV2Prerequisites(exemplar) {
  return getPrerequisites(exemplar).filter((p) => p.type !== 'grammar_skill_v1')
}

export function getIntendedNewItems(exemplar) {
  return exemplar?.intended_new_items || []
}

/**
 * INTRODUCTION GROUP (Slice V2.21-R2 §2/§3).
 *
 * A sense/construction remains ONE curricular item. What changes is that an item
 * may own SEVERAL equivalent realizations able to serve its first contact: in a
 * real trajectory exactly one of them actually presents the item, the others
 * stay immediately available as alternatives, and the item is never counted as
 * new again (the engine's budget already keys on the ITEM ref, not the
 * exemplar).
 *
 * Before this, every item had exactly one authored introduction, which
 * guaranteed by construction that the engine saw a single materializable
 * realization during the whole pre-consolidation phase — the measured cause of
 * "I am tired, but I am happy." repeating forever (see
 * test-evidence/v2-21r1-content-depth-review.md).
 *
 * The field is OPTIONAL: an exemplar without it behaves exactly as before (a
 * singleton group keyed by its own id), so legacy content is untouched.
 */
export function getIntroductionGroupId(exemplar) {
  if (!exemplar) return null
  if (typeof exemplar.introduction_group_id === 'string' && exemplar.introduction_group_id) {
    return exemplar.introduction_group_id
  }
  return getIntendedNewItems(exemplar).length ? `intro:solo.${exemplar.exemplar_id}` : null
}

/** Every exemplar of `pack` that can serve the first contact of `groupId`. */
export function getIntroductionGroupMembers(pack, groupId) {
  if (!groupId) return []
  return (pack?.exemplars || []).filter((e) => getIntroductionGroupId(e) === groupId)
}

// ---- progression ----

// Exemplars ordered by curricular exposure stage (stable within a stage, in
// authored order). This is the raw material for "the same word deepened over
// time": early stages first, discourse uses last.
export function exposureProgression(pack) {
  return [...(pack?.exemplars || [])]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (stageIndex(a.e.exposure_stage) - stageIndex(b.e.exposure_stage)) || (a.i - b.i))
    .map(({ e }) => e)
}
