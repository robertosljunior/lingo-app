// registry.test.js — mandatory registry tests of Slice V2.5 (§22): multi-pack
// loading, duplicate detection, dependencies, cross-pack references, single
// ownership, order independence, freezing, still-ID stability and V1 rejection.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import butPack from '../../content/pedagogy-v2/but.json'
import { validatePedagogyV2Registry } from './validator.js'
import {
  buildPedagogyV2Registry, loadPedagogyV2Registry, getPedagogyPack,
  getAllPedagogyPacks, getLexemeAcrossRegistry, resolvePedagogyTarget,
  resolvePedagogyExemplar, resolvePedagogyConstruction,
  resolvePedagogyPrerequisite, getPacksForLexeme, getPedagogyEntityOwner,
} from './registry.js'

// ---- minimal pack fixture factory -------------------------------------------

function makePack(word, { packId = `pedagogy_v2_${word}`, deps = [], relations = [], patch = null } = {}) {
  const pack = {
    manifest: {
      schema_version: '1',
      pack_id: packId,
      pack_kind: 'pedagogical_v2',
      title: { pt: word, en: word },
      language_pair: 'pt-BR/en',
      version: 1,
      source: 'builtin',
      primary_lexeme_id: `lexeme:${word}`,
      dependencies: deps,
    },
    lexemes: [{
      lexeme_id: `lexeme:${word}`, lemma: word, language: 'en',
      part_of_speech: ['adverb'], glosses_pt: ['x'], frequency_band: 'high_frequency_functional',
    }],
    senses: [{
      sense_id: `sense:${word}.s1`, lexeme_id: `lexeme:${word}`, label: 'Sentido', meaning_pt: 'Significado',
      gloss_en: 'gloss', communicative_function_ids: [`function:${word}_f1`], first_exposure_stage: 'A1', related_sense_ids: [],
    }],
    communicative_functions: [{ function_id: `function:${word}_f1`, label_pt: 'Função', description_pt: 'Descrição' }],
    constructions: [{
      construction_id: `construction:${word}.c1`, label: 'c1', pattern: 'P', fixed_elements: [word],
      slots: [{ slot_id: 's', syntactic_role: 'r' }],
      sense_ids: [`sense:${word}.s1`], communicative_function_ids: [`function:${word}_f1`],
      prerequisite_construction_ids: [], recommended_stage: 'A1',
    }],
    exemplars: [1, 2, 3].map((i) => ({
      exemplar_id: `exemplar:${word}.00${i}`,
      text_en: `We ${word} the ${['door', 'tree', 'book'][i - 1]}.`,
      text_pt: `Nós ${word} ${['a porta', 'a árvore', 'o livro'][i - 1]}.`,
      construction_id: `construction:${word}.c1`,
      sense_ids: [`sense:${word}.s1`],
      communicative_function_ids: [`function:${word}_f1`],
      pedagogical_targets: [{ target_type: 'sense', target_id: `sense:${word}.s1`, role: 'primary' }],
      prerequisites: [],
      intended_new_items: i === 1 ? [{ type: 'sense', ref: `sense:${word}.s1` }] : [],
      context: 'Contexto.',
      naturalness_status: 'curated',
      exposure_stage: 'A1',
    })),
    relations,
  }
  return patch ? patch(structuredClone(pack)) : pack
}

const dep = (packId, version = '1') => ({ pack_id: packId, required_schema_version: version, reason: 'test dependency' })

// ---- §22.1 two valid packs --------------------------------------------------

describe('registry — two valid packs', () => {
  it('accepts two independent valid packs', () => {
    const r = validatePedagogyV2Registry([makePack('alpha'), makePack('beta')])
    expect(r.errors).toEqual([])
    expect(r.valid).toBe(true)
    expect(r.pack_ids).toEqual(['pedagogy_v2_alpha', 'pedagogy_v2_beta'])
  })

  it('the builtin registry (still + but) is valid and loads', () => {
    const registry = loadPedagogyV2Registry()
    expect(registry.pack_ids).toEqual(['pedagogy_v2_but', 'pedagogy_v2_still'])
    expect(getAllPedagogyPacks(registry)).toHaveLength(2)
  })
})

// ---- §22.2–4 duplicates -----------------------------------------------------

describe('registry — duplicates', () => {
  it('rejects a duplicated pack ID', () => {
    const r = validatePedagogyV2Registry([makePack('alpha'), makePack('beta', { packId: 'pedagogy_v2_alpha' })])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('PACK_ID_DUPLICATE'))
  })

  it('rejects a target (sense) ID defined by two packs', () => {
    const b = makePack('beta', {
      patch: (p) => {
        p.senses.push({
          sense_id: 'sense:alpha.s1', lexeme_id: 'lexeme:beta', label: 'Dup', meaning_pt: 'Dup',
          gloss_en: 'dup', communicative_function_ids: ['function:beta_f1'], first_exposure_stage: 'A1', related_sense_ids: [],
        })
        return p
      },
    })
    const r = validatePedagogyV2Registry([makePack('alpha'), b])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('GLOBAL_DUPLICATE_ID:sense:alpha.s1'))
  })

  it('rejects an exemplar ID defined by two packs', () => {
    const b = makePack('beta', {
      patch: (p) => { p.exemplars[0].exemplar_id = 'exemplar:alpha.001'; return p },
    })
    const r = validatePedagogyV2Registry([makePack('alpha'), b])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('GLOBAL_DUPLICATE_ID:exemplar:alpha.001'))
  })
})

// ---- §22.5–6 dependencies ---------------------------------------------------

describe('registry — pack dependencies', () => {
  it('rejects a dependency on a pack that is not in the registry', () => {
    const r = validatePedagogyV2Registry([makePack('alpha', { deps: [dep('pedagogy_v2_ghost')] })])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('PACK_DEPENDENCY_MISSING:pedagogy_v2_ghost'))
  })

  it('rejects circular pack dependencies', () => {
    const a = makePack('alpha', { deps: [dep('pedagogy_v2_beta')] })
    const b = makePack('beta', { deps: [dep('pedagogy_v2_alpha')] })
    const r = validatePedagogyV2Registry([a, b])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('PACK_DEPENDENCY_CYCLE'))
  })

  it('rejects an incompatible required schema version', () => {
    const r = validatePedagogyV2Registry([makePack('alpha'), makePack('beta', { deps: [dep('pedagogy_v2_alpha', '99')] })])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('PACK_DEPENDENCY_SCHEMA_INCOMPATIBLE'))
  })
})

// ---- §22.7–8 cross-pack references ------------------------------------------

describe('registry — cross-pack references', () => {
  it('accepts a valid cross-pack reference under a declared dependency', () => {
    const b = makePack('beta', {
      deps: [dep('pedagogy_v2_alpha')],
      patch: (p) => {
        p.exemplars[1].prerequisites = [{ type: 'sense', ref: 'sense:alpha.s1' }]
        return p
      },
    })
    const r = validatePedagogyV2Registry([makePack('alpha'), b])
    expect(r.errors).toEqual([])
    expect(r.valid).toBe(true)
  })

  it('rejects a cross-pack reference that resolves nowhere', () => {
    const b = makePack('beta', {
      deps: [dep('pedagogy_v2_alpha')],
      patch: (p) => {
        p.exemplars[1].prerequisites = [{ type: 'sense', ref: 'sense:alpha.ghost' }]
        return p
      },
    })
    const r = validatePedagogyV2Registry([makePack('alpha'), b])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('CROSS_PACK_REF_UNRESOLVED'))
  })

  it('rejects a cross-pack reference whose owner pack is NOT a declared dependency', () => {
    const b = makePack('beta', {
      deps: [dep('pedagogy_v2_gamma')], // declares gamma, references alpha
      patch: (p) => {
        p.exemplars[1].prerequisites = [{ type: 'sense', ref: 'sense:alpha.s1' }]
        return p
      },
    })
    const r = validatePedagogyV2Registry([makePack('alpha'), b, makePack('gamma')])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('CROSS_PACK_DEPENDENCY_UNDECLARED'))
  })

  it('a pack WITHOUT declared dependencies keeps the strict single-pack behavior', () => {
    const b = makePack('beta', {
      patch: (p) => {
        p.exemplars[1].prerequisites = [{ type: 'sense', ref: 'sense:alpha.s1' }]
        return p
      },
    })
    const r = validatePedagogyV2Registry([makePack('alpha'), b])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('PREREQ_UNRESOLVED'))
  })
})

// ---- §22.9 single ownership -------------------------------------------------

describe('registry — entity ownership', () => {
  it('every entity has exactly one owner pack, resolvable through the registry', () => {
    expect(getPedagogyEntityOwner('sense:still.continuity')).toBe('pedagogy_v2_still')
    expect(getPedagogyEntityOwner('construction:still.clause_but_subject_still_verb')).toBe('pedagogy_v2_still')
    expect(getPedagogyEntityOwner('sense:but.contrast')).toBe('pedagogy_v2_but')
    expect(getPedagogyEntityOwner('lexeme:but')).toBe('pedagogy_v2_but')
    expect(getPedagogyEntityOwner('sense:nowhere.s1')).toBeNull()
  })

  it('the but pack references but NEVER redefines the still construction', () => {
    const but = getPedagogyPack('pedagogy_v2_but')
    expect(but.constructions.map((c) => c.construction_id))
      .not.toContain('construction:still.clause_but_subject_still_verb')
    const owner = resolvePedagogyConstruction('construction:still.clause_but_subject_still_verb')
    expect(owner.pack_id).toBe('pedagogy_v2_still')
  })

  it('rejects two packs claiming the same canonical lexeme (alias ambiguity included)', () => {
    // Same lexeme id → global duplicate.
    const sameId = makePack('beta', {
      patch: (p) => { p.lexemes[0].lexeme_id = 'lexeme:alpha'; p.manifest.primary_lexeme_id = 'lexeme:alpha'; p.senses[0].lexeme_id = 'lexeme:alpha'; return p },
    })
    expect(validatePedagogyV2Registry([makePack('alpha'), sameId]).errors)
      .toContainEqual(expect.stringContaining('GLOBAL_DUPLICATE_ID:lexeme:alpha'))
    // Different ids for the same (lemma, language) → ambiguous alias.
    const alias = makePack('beta', {
      patch: (p) => { p.lexemes[0].lemma = 'alpha'; return p },
    })
    expect(validatePedagogyV2Registry([makePack('alpha'), alias]).errors)
      .toContainEqual(expect.stringContaining('LEXEME_ALIAS_AMBIGUOUS'))
  })
})

// ---- §22.10 order independence ----------------------------------------------

describe('registry — import order independence', () => {
  it('the registry is identical whatever the pack import order', () => {
    const r1 = buildPedagogyV2Registry([stillPack, butPack])
    const r2 = buildPedagogyV2Registry([butPack, stillPack])
    expect(r2).toEqual(r1)
    expect(r2.pack_ids).toEqual(r1.pack_ids)
  })

  it('validation errors are identical whatever the input order', () => {
    const a = makePack('alpha')
    const bad = makePack('beta', { packId: 'pedagogy_v2_alpha' })
    expect(validatePedagogyV2Registry([a, bad]).errors).toEqual(validatePedagogyV2Registry([bad, a]).errors)
  })
})

// ---- §22.11 frozen registry -------------------------------------------------

describe('registry — immutability', () => {
  it('registry and every pack are deep-frozen after validation', () => {
    const registry = loadPedagogyV2Registry()
    expect(Object.isFrozen(registry)).toBe(true)
    for (const p of registry.packs) {
      expect(Object.isFrozen(p)).toBe(true)
      expect(Object.isFrozen(p.manifest)).toBe(true)
      expect(Object.isFrozen(p.exemplars[0])).toBe(true)
      expect(Object.isFrozen(p.exemplars[0].pedagogical_targets[0])).toBe(true)
    }
  })

  it('mutation attempts by consumers throw (strict mode)', () => {
    const registry = loadPedagogyV2Registry()
    const pack = getPedagogyPack('pedagogy_v2_still', registry)
    expect(() => { pack.exemplars[0].text_en = 'hacked' }).toThrow()
    expect(() => { registry.packs.push({}) }).toThrow()
  })
})

// ---- §22.12 still IDs preserved ---------------------------------------------

describe('registry — still IDs are stable (V2.1 compatibility)', () => {
  it('preserves every persisted still entity ID exactly', () => {
    const still = getPedagogyPack('pedagogy_v2_still')
    expect(still.lexemes.map((l) => l.lexeme_id)).toEqual(['lexeme:still'])
    expect(still.senses.map((s) => s.sense_id)).toEqual([
      'sense:still.continuity',
      'sense:still.counter_expectation',
      'sense:still.discourse_reservation',
    ])
    expect(still.constructions.map((c) => c.construction_id)).toEqual([
      'construction:still.subject_still_lexical_verb',
      'construction:still.subject_be_still_complement',
      'construction:still.clause_but_subject_still_verb',
      'construction:still.although_clause_subject_still_verb',
      'construction:still.discourse_still_clause',
    ])
    expect(still.communicative_functions.map((f) => f.function_id)).toEqual([
      'function:express_continuation',
      'function:express_persistent_state',
      'function:express_result_despite_obstacle',
      'function:introduce_concession',
      'function:introduce_discourse_reservation',
    ])
    expect(still.exemplars.map((e) => e.exemplar_id)).toEqual(
      Array.from({ length: 22 }, (_, i) => `exemplar:still.${String(i + 1).padStart(3, '0')}`))
  })
})

// ---- §22.13 V1 mixing rejected ----------------------------------------------

describe('registry — V1 mixing is rejected', () => {
  it('rejects an unbridged V1 skill_id used as a V2 prerequisite', () => {
    const a = makePack('alpha', {
      patch: (p) => {
        p.exemplars[0].prerequisites = [{ type: 'sense', ref: 'simple_present' }]
        return p
      },
    })
    const r = validatePedagogyV2Registry([a])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('PREREQ_V2_REF_PREFIX_INVALID'))
  })

  it('rejects V1-looking relation endpoints', () => {
    const a = makePack('alpha', {
      relations: [{ relation_type: 'related_construction', from: 'construction:alpha.c1', to: 'question_structure' }],
    })
    const r = validatePedagogyV2Registry([a])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('RELATION_ENDPOINT_INVALID'))
  })

  it('rejects an untyped (loose string) relation', () => {
    const a = makePack('alpha', {
      relations: [{ relation_type: 'sounds_like', from: 'construction:alpha.c1', to: 'sense:alpha.s1' }],
    })
    const r = validatePedagogyV2Registry([a])
    expect(r.valid).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('RELATION_TYPE_INVALID'))
  })
})

// ---- resolution API ---------------------------------------------------------

describe('registry — resolution API', () => {
  it('resolves lexemes, targets, exemplars, constructions and prerequisites across packs', () => {
    expect(getLexemeAcrossRegistry('lexeme:still')).toMatchObject({ pack_id: 'pedagogy_v2_still' })
    expect(getLexemeAcrossRegistry('lexeme:but').lexeme.lemma).toBe('but')
    expect(resolvePedagogyTarget({ target_type: 'sense', target_id: 'sense:but.exception' }).pack_id).toBe('pedagogy_v2_but')
    expect(resolvePedagogyTarget({ target_type: 'construction', target_id: 'sense:but.exception' })).toBeNull() // kind mismatch
    expect(resolvePedagogyExemplar('exemplar:but.008').entity.construction_id)
      .toBe('construction:still.clause_but_subject_still_verb')
    expect(resolvePedagogyPrerequisite({ type: 'construction', ref: 'construction:still.subject_still_lexical_verb' }).pack_id)
      .toBe('pedagogy_v2_still')
    expect(resolvePedagogyPrerequisite({ type: 'grammar_skill_v1', ref: 'past_simple' }))
      .toMatchObject({ kind: 'grammar_skill_v1', compat_bridge: true })
    expect(getPacksForLexeme('lexeme:but').map((p) => p.manifest.pack_id)).toEqual(['pedagogy_v2_but'])
    expect(getPacksForLexeme('lexeme:still').map((p) => p.manifest.pack_id)).toEqual(['pedagogy_v2_still'])
  })
})
