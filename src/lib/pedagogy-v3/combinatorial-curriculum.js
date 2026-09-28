// Explicit construction curriculum for the experimental frame/slot supply.
// IDs are structural and stable. No grammatical focus is represented as a
// fictitious lexeme or attributed to an unrelated V2 sense.
import { COMBINATORIAL_FRAMES_V3 } from '../../content/pedagogy-v3/combinatorial-catalog.js'
import { materializeCombinatorialCorpusV3 } from './combinatorial-supply.js'
import { buildPedagogyV2Registry, loadPedagogyV2Registry } from '../pedagogy-v2/registry.js'

export const V3_CURRICULUM_PACK_ID = 'pedagogy_v3_constructions'
export const V3_CURRICULUM_BINDINGS = Object.freeze(COMBINATORIAL_FRAMES_V3.map(frame => Object.freeze({
  focus_id: frame.focus_id,
  construction_id: `construction:${frame.focus_id}`,
  parent_id: `exemplar:${frame.focus_id}.intro`,
})))

export function createCombinatorialCurriculumPackV3() {
  const first = new Map()
  for (const row of materializeCombinatorialCorpusV3()) if (!first.has(row.focus_id)) first.set(row.focus_id, row)
  return {
    manifest: {
      schema_version: '1', pack_id: V3_CURRICULUM_PACK_ID,
      pack_kind: 'combinatorial_v3', version: 1, source: 'experimental',
      title: { pt: 'Novas construções', en: 'New constructions' },
      language_pair: 'pt-BR/en', catalog_order: 100,
      short_description_pt: 'Construções do cotidiano com frases combinadas.',
    },
    lexemes: [], senses: [], communicative_functions: [], relations: [],
    constructions: V3_CURRICULUM_BINDINGS.map(binding => {
      const frame = COMBINATORIAL_FRAMES_V3.find(f => f.focus_id === binding.focus_id)
      return {
        construction_id: binding.construction_id, label: frame.category,
        pattern: frame.template_en, fixed_elements: [],
        slots: ['a', 'b'].map(slot_id => ({ slot_id, syntactic_role: 'compatible_frame_slot' })),
        sense_ids: [], communicative_function_ids: [],
        prerequisite_construction_ids: [], recommended_stage: frame.stage,
      }
    }),
    exemplars: V3_CURRICULUM_BINDINGS.map(binding => {
      const row = first.get(binding.focus_id)
      return {
        exemplar_id: binding.parent_id, text_en: row.text_en, text_pt: row.text_pt,
        construction_id: binding.construction_id, sense_ids: [], communicative_function_ids: [],
        pedagogical_targets: [{ target_type: 'construction', target_id: binding.construction_id, role: 'primary' }],
        prerequisites: [], intended_new_items: [{ type: 'construction', ref: binding.construction_id }],
        context: 'Observe a construção nesta frase.', context_items: [],
        usage_notes: 'Introdução experimental da construção.',
        naturalness_status: 'needs_review', exposure_stage: row.stage,
      }
    }),
  }
}

let cached
export function loadCombinatorialCurriculumRegistryV3() {
  cached ??= buildPedagogyV2Registry([...loadPedagogyV2Registry().packs, createCombinatorialCurriculumPackV3()])
  return cached
}
