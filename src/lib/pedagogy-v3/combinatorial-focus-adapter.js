// Explicit V2 entity bindings. Unmapped V3 grammar is NOT attributed to an
// unrelated V2 target. Context-dependent recipes stay unsupported in this pilot.
import { materializeCombinatorialCorpusV3 } from './combinatorial-supply.js'
import { LICENSED_TIER1_ELIGIBLE_RECIPES } from '../pedagogy-v2/licensed-realization-contracts.js'

export const V3_FOCUS_BINDINGS = Object.freeze([
  { focus_id: 'v3.still.continuity_general', parent_id: 'exemplar:still.001', construction_id: 'construction:still.subject_still_lexical_verb' },
  { focus_id: 'v3.but.simple_contrast', parent_id: 'exemplar:but.001', construction_id: 'construction:but.clause_but_clause' },
  { focus_id: 'v3.yet.question', parent_id: 'exemplar:yet.008', construction_id: 'construction:yet.interrogative_clause_yet' },
  { focus_id: 'v3.first_conditional.unless', parent_id: 'exemplar:unless.001', construction_id: 'construction:unless.condition_result' },
])
export const V3_ELIGIBLE_RECIPES = LICENSED_TIER1_ELIGIBLE_RECIPES
let corpus
export function materializeV3ForPack(pack, allowedParentIds = null) {
  const bindings = V3_FOCUS_BINDINGS.filter(b => pack.exemplars.some(e => e.exemplar_id === b.parent_id)
    && (!allowedParentIds || allowedParentIds.has(b.parent_id)))
  if (!bindings.length) return []
  corpus ??= materializeCombinatorialCorpusV3()
  return bindings.flatMap(binding => {
    const parent = pack.exemplars.find(e => e.exemplar_id === binding.parent_id)
    if (parent.construction_id !== binding.construction_id) throw new Error('V3_BINDING_CONSTRUCTION_DRIFT')
    return corpus.filter(row => row.focus_id === binding.focus_id).map(row => ({
      ...row,
      exemplar_id: `exemplar:${row.realization_id}`,
      construction_id: binding.construction_id,
      pedagogical_targets: parent.pedagogical_targets.map(t => ({ ...t })),
      sense_ids: [...parent.sense_ids],
      communicative_function_ids: [...parent.communicative_function_ids],
      prerequisites: parent.prerequisites.map(p => ({ ...p })),
      intended_new_items: parent.intended_new_items.map(p => ({ ...p })),
      // Parent determines the existing pedagogical stage; corpus stage remains
      // visible separately. No new curriculum or progression is introduced.
      exposure_stage: parent.exposure_stage,
      context_items: [],
      eligible_recipes: [...V3_ELIGIBLE_RECIPES],
      provenance: { kind: 'combinatorial_v3', parent_exemplar_id: parent.exemplar_id, approval_status: 'provisional_nonhuman' },
    }))
  })
}
export function isV3(exemplar) { return exemplar?.source === 'combinatorial_v3' }
export function assertNoAvoidableLiteralRepeatV3({ selected, seenTexts, candidates, focus }) {
  const unseen = candidates.filter(c => !seenTexts.has(c.exemplar.text_en))
  if (seenTexts.has(selected.exemplar.text_en) && unseen.length) {
    const detail = {
      repeated_realization_id: selected.exemplar.realization_id ?? selected.exemplar.exemplar_id,
      selected_focus: focus, recipe: selected.recipe.recipe,
      capability: selected.capability, modality: selected.modality,
      unseen_candidates_available: unseen.length,
      candidate_ids: [...new Set(unseen.map(c => c.exemplar.realization_id ?? c.exemplar.exemplar_id))],
    }
    const error = new Error(`V3_AVOIDABLE_LITERAL_REPEAT:${JSON.stringify(detail)}`)
    error.code = 'V3_AVOIDABLE_LITERAL_REPEAT'; error.trace = detail
    throw error
  }
}
