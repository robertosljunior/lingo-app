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
