import { describe, it, expect } from 'vitest'
import { validatePedagogyV2Pack, validatePedagogyV2Packs, isCompleteSentence } from './validator.js'
import { BUILTIN_PEDAGOGY_V2_PACKS } from '../../content/pedagogy-v2/index.js'
import stillPack from '../../content/pedagogy-v2/still.json'
// V1 regression guard: the existing knowledge-pack validation must keep passing
// untouched while the V2 namespace exists alongside it.
import { validateKnowledgePacks } from '../language-analysis/knowledge-pack-validator.js'
import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'

// Deep-clone the real pack so each test can mutate freely.
const clone = () => structuredClone(stillPack)

function expectError(pack, code) {
  const result = validatePedagogyV2Pack(pack)
  expect(result.valid).toBe(false)
  expect(result.errors.some((e) => e.startsWith(code)), `expected ${code}, got:\n${result.errors.join('\n')}`).toBe(true)
}

describe('pedagogy-v2 validator — valid pack', () => {
  it('accepts the builtin still pack', () => {
    const result = validatePedagogyV2Pack(stillPack)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.pack_id).toBe('pedagogy_v2_still')
  })

  it('accepts the whole builtin set with cross-pack duplicate detection', () => {
    const result = validatePedagogyV2Packs(BUILTIN_PEDAGOGY_V2_PACKS)
    expect(result.valid).toBe(true)
  })
})

describe('pedagogy-v2 validator — manifest invariants', () => {
  it('rejects a pack without pack_kind', () => {
    const p = clone()
    delete p.manifest.pack_kind
    expectError(p, 'PACK_KIND_INVALID')
  })

  it('rejects a pack without schema_version', () => {
    const p = clone()
    delete p.manifest.schema_version
    expectError(p, 'SCHEMA_VERSION_INVALID')
  })

  it('rejects a V1 pack_kind', () => {
    const p = clone()
    p.manifest.pack_kind = 'semantic_knowledge'
    expectError(p, 'PACK_KIND_INVALID')
  })
})

describe('pedagogy-v2 validator — lexeme has no global level', () => {
  it('rejects a lexeme that declares level: B1 for still', () => {
    const p = clone()
    p.lexemes[0].level = 'B1'
    expectError(p, 'LEXEME_GLOBAL_LEVEL_FORBIDDEN')
  })

  it.each(['cefr_level', 'cefr', 'cefr_start', 'levels', 'stage'])('rejects the %s key on a lexeme', (key) => {
    const p = clone()
    p.lexemes[0][key] = 'A1'
    expectError(p, 'LEXEME_GLOBAL_LEVEL_FORBIDDEN')
  })
})

describe('pedagogy-v2 validator — IDs and references', () => {
  it('rejects duplicate IDs', () => {
    const p = clone()
    p.exemplars[1].exemplar_id = p.exemplars[0].exemplar_id
    expectError(p, 'DUPLICATE_ID')
  })

  it('rejects a reference to a nonexistent sense', () => {
    const p = clone()
    p.exemplars[0].sense_ids = ['sense:still.nonexistent']
    expectError(p, 'EXEMPLAR_SENSE_UNRESOLVED')
  })

  it('rejects a reference to a nonexistent construction', () => {
    const p = clone()
    p.exemplars[0].construction_id = 'construction:still.nonexistent'
    expectError(p, 'EXEMPLAR_CONSTRUCTION_UNRESOLVED')
  })

  it('rejects a reference to a nonexistent communicative function', () => {
    const p = clone()
    p.exemplars[0].communicative_function_ids = ['function:nonexistent']
    expectError(p, 'EXEMPLAR_FUNCTION_UNRESOLVED')
  })

  it('rejects a construction whose sense does not exist', () => {
    const p = clone()
    p.constructions[0].sense_ids = ['sense:still.ghost']
    expectError(p, 'CONSTRUCTION_SENSE_UNRESOLVED')
  })

  it('rejects a sense pointing at a nonexistent lexeme', () => {
    const p = clone()
    p.senses[0].lexeme_id = 'lexeme:ghost'
    expectError(p, 'SENSE_LEXEME_UNRESOLVED')
  })
})

describe('pedagogy-v2 validator — exemplar pedagogical declarations', () => {
  it('rejects an exemplar without an English sentence', () => {
    const p = clone()
    delete p.exemplars[0].text_en
    expectError(p, 'EXEMPLAR_TEXT_EN_REQUIRED')
  })

  it('rejects an exemplar without a pt-BR translation', () => {
    const p = clone()
    p.exemplars[0].text_pt = ''
    expectError(p, 'EXEMPLAR_TEXT_PT_REQUIRED')
  })

  it('rejects an exemplar without pedagogical targets', () => {
    const p = clone()
    p.exemplars[0].pedagogical_targets = []
    expectError(p, 'EXEMPLAR_TARGETS_REQUIRED')
  })

  it('rejects an exemplar whose targets have no primary', () => {
    const p = clone()
    p.exemplars[0].pedagogical_targets = p.exemplars[0].pedagogical_targets.map((t) => ({ ...t, role: 'secondary' }))
    expectError(p, 'EXEMPLAR_PRIMARY_TARGET_REQUIRED')
  })

  it('rejects an exemplar without a construction', () => {
    const p = clone()
    delete p.exemplars[0].construction_id
    expectError(p, 'EXEMPLAR_CONSTRUCTION_REQUIRED')
  })

  it('rejects an exemplar that does not declare prerequisites', () => {
    const p = clone()
    delete p.exemplars[0].prerequisites
    expectError(p, 'EXEMPLAR_PREREQUISITES_REQUIRED')
  })

  it('rejects an exemplar that does not declare intended new items', () => {
    const p = clone()
    delete p.exemplars[0].intended_new_items
    expectError(p, 'EXEMPLAR_NEW_ITEMS_REQUIRED')
  })

  it('rejects an invalid target type', () => {
    const p = clone()
    p.exemplars[0].pedagogical_targets[0].target_type = 'theme'
    expectError(p, 'TARGET_TYPE_INVALID')
  })

  it('rejects a target whose id prefix does not match its type', () => {
    const p = clone()
    p.exemplars[0].pedagogical_targets[0] = { target_type: 'construction', target_id: 'sense:still.continuity', role: 'primary' }
    expectError(p, 'TARGET_ID_PREFIX_MISMATCH')
  })
})

describe('pedagogy-v2 validator — construction invariants', () => {
  it('rejects a construction without an associated sense', () => {
    const p = clone()
    p.constructions[0].sense_ids = []
    expectError(p, 'CONSTRUCTION_WITHOUT_SENSE')
  })

  it('rejects a construction without a communicative function', () => {
    const p = clone()
    p.constructions[0].communicative_function_ids = []
    expectError(p, 'CONSTRUCTION_WITHOUT_FUNCTION')
  })

  it('rejects circular construction prerequisites', () => {
    const p = clone()
    // subject_still_lexical_verb ← subject_be_still_complement already exists;
    // close the loop the other way round.
    p.constructions[0].prerequisite_construction_ids = ['construction:still.subject_be_still_complement']
    expectError(p, 'CONSTRUCTION_PREREQ_CYCLE')
  })

  it('rejects a stage outside the allowed enumeration', () => {
    const p = clone()
    p.constructions[0].recommended_stage = 'C1'
    expectError(p, 'STAGE_INVALID')
  })

  it('rejects an exemplar stage outside the allowed enumeration', () => {
    const p = clone()
    p.exemplars[0].exposure_stage = 'beginner'
    expectError(p, 'STAGE_INVALID')
  })
})

describe('pedagogy-v2 validator — sentence integrity', () => {
  it('classifies complete sentences vs fragments', () => {
    expect(isCompleteSentence('I still live here.')).toBe(true)
    expect(isCompleteSentence('Are you still hungry?')).toBe(true)
    expect(isCompleteSentence('still')).toBe(false)
    expect(isCompleteSentence('Still here')).toBe(false)
    expect(isCompleteSentence('the train station.')).toBe(false)
  })

  it('rejects an exemplar stored as an isolated word', () => {
    const p = clone()
    p.exemplars[0].text_en = 'still'
    expectError(p, 'EXEMPLAR_NOT_FULL_SENTENCE')
  })

  it('rejects an exemplar whose declared still-sense has no "still" in the text', () => {
    const p = clone()
    p.exemplars[0].text_en = 'I live here now.'
    expectError(p, 'EXEMPLAR_LEXEME_MISSING_FROM_TEXT')
  })

  it('rejects an although-construction exemplar missing one fixed element', () => {
    const p = clone()
    const ex = p.exemplars.find((e) => e.construction_id === 'construction:still.although_clause_subject_still_verb')
    ex.text_en = 'It was hard, and I still tried.' // "although" dropped
    expectError(p, 'EXEMPLAR_FIXED_ELEMENT_MISSING')
  })

  it('rejects a but-construction exemplar missing "still"', () => {
    const p = clone()
    const ex = p.exemplars.find((e) => e.construction_id === 'construction:still.clause_but_subject_still_verb')
    ex.text_en = 'It was difficult, but I tried anyway.'
    const result = validatePedagogyV2Pack(p)
    expect(result.valid).toBe(false)
    // Both the fixed element and the declared lexeme use are gone.
    expect(result.errors.some((e) => e.startsWith('EXEMPLAR_FIXED_ELEMENT_MISSING'))).toBe(true)
  })
})

describe('pedagogy-v2 validator — no silent V1/V2 mixing', () => {
  it('rejects entity IDs without a typed V2 prefix (a bare V1-style id)', () => {
    const p = clone()
    p.senses[0].sense_id = 'still_continuity' // looks like a V1 skill_id
    expectError(p, 'ID_PREFIX_INVALID')
  })

  it('rejects a grammar_skill_v1 prerequisite without the compat_bridge flag', () => {
    const p = clone()
    const ex = p.exemplars[0]
    ex.prerequisites = [{ type: 'grammar_skill_v1', ref: 'simple_present' }]
    expectError(p, 'PREREQ_V1_BRIDGE_FLAG_REQUIRED')
  })

  it('rejects a grammar_skill_v1 prerequisite whose ref carries a V2 prefix', () => {
    const p = clone()
    p.exemplars[0].prerequisites = [{ type: 'grammar_skill_v1', ref: 'sense:still.continuity', compat_bridge: true }]
    expectError(p, 'PREREQ_V1_REF_INVALID')
  })

  it('rejects a V2 prerequisite written with a bare V1-style ref', () => {
    const p = clone()
    p.exemplars[0].prerequisites = [{ type: 'sense', ref: 'still_continuity' }]
    expectError(p, 'PREREQ_V2_REF_PREFIX_INVALID')
  })

  it('rejects an unresolved V2 prerequisite', () => {
    const p = clone()
    p.exemplars[0].prerequisites = [{ type: 'construction', ref: 'construction:still.ghost' }]
    expectError(p, 'PREREQ_UNRESOLVED')
  })
})

describe('V1 compatibility — frozen validators keep passing', () => {
  it('builtin knowledge packs still validate with the existing V1 validator', () => {
    const result = validateKnowledgePacks(BUILTIN_KNOWLEDGE_PACKS)
    expect(result.valid).toBe(true)
  })
})

// ---- Slice V2.14 — authored semantic-assessment metadata validation (§25) ----
describe('pedagogy-v2 validator — semantic_assessment metadata', () => {
  const clone = () => structuredClone(stillPack)
  const withExemplarMeta = (meta) => { const p = clone(); p.exemplars[0].semantic_assessment = meta; return p }

  it('accepts a valid equivalent_meaning target (essential word in the reference)', () => {
    const p = clone()
    const w = p.exemplars[0].text_en.split(/\W+/).filter(Boolean)[1] // a real word from the sentence
    p.exemplars[0].semantic_assessment = { strategy: 'equivalent_meaning', essential_words: [w] }
    const r = validatePedagogyV2Pack(p)
    expect(r.errors.filter((e) => /SEMANTIC|EQUIVALENT|INTENT/.test(e))).toEqual([])
  })

  it('rejects an invalid strategy', () => {
    expectError(withExemplarMeta({ strategy: 'nonsense' }), 'INVALID_SEMANTIC_ASSESSMENT_STRATEGY')
  })
  it('rejects equivalent_meaning without essential words', () => {
    expectError(withExemplarMeta({ strategy: 'equivalent_meaning', essential_words: [] }), 'EQUIVALENT_TARGET_WITHOUT_ESSENTIAL_WORDS')
  })
  it('rejects an essential word absent from the reference sentence', () => {
    expectError(withExemplarMeta({ strategy: 'equivalent_meaning', essential_words: ['zzytemplate'] }), 'SEMANTIC_TARGET_REFERENCES_NON_AUTHORED_TEXT')
  })
  it('rejects an invented requested_intent for guided_intent', () => {
    expectError(withExemplarMeta({ strategy: 'guided_intent', requested_intent: 'made_up_intent' }), 'INVALID_REQUESTED_INTENT')
  })
  it('rejects equivalent_meaning at the construction level (no authored reference text)', () => {
    const p = clone()
    p.constructions[0].semantic_assessment = { strategy: 'equivalent_meaning', essential_words: ['x'] }
    expectError(p, 'EQUIVALENT_TARGET_WITHOUT_TEXT')
  })
})

// ---- Slice V2.15 — authored polarity (§27) ----------------------------------
describe('pedagogy-v2 validator — semantic polarity', () => {
  const clone = () => structuredClone(stillPack)
  it('accepts affirmative/negative polarity on an equivalent target', () => {
    const p = clone()
    const w = p.exemplars[0].text_en.split(/\W+/).filter(Boolean)[1]
    p.exemplars[0].semantic_assessment = { strategy: 'equivalent_meaning', essential_words: [w], polarity: 'negative' }
    expect(validatePedagogyV2Pack(p).errors.filter((e) => /POLARITY/.test(e))).toEqual([])
  })
  it('rejects an invalid polarity value', () => {
    const p = clone()
    const w = p.exemplars[0].text_en.split(/\W+/).filter(Boolean)[1]
    p.exemplars[0].semantic_assessment = { strategy: 'equivalent_meaning', essential_words: [w], polarity: 'maybe' }
    expectError(p, 'INVALID_SEMANTIC_POLARITY')
  })
})
