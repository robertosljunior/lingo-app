// still-pack.test.js — content-level guarantees of the "still" pilot pack: the
// curricular principles the schema exists to encode must be observable in the
// authored data itself.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { FORBIDDEN_LEXEME_LEVEL_KEYS, stageIndex } from './contracts.js'
import {
  getExemplarsByConstruction, getExemplarsBySense, getConstructionsBySense,
  getConstructionsByFunction, getPrimaryTargets, getIntendedNewItems,
  exposureProgression,
} from './query.js'

const CONT = 'sense:still.continuity'
const COUNTER = 'sense:still.counter_expectation'
const DISCOURSE = 'sense:still.discourse_reservation'
const C_LEX = 'construction:still.subject_still_lexical_verb'
const C_BE = 'construction:still.subject_be_still_complement'
const C_BUT = 'construction:still.clause_but_subject_still_verb'
const C_ALTHOUGH = 'construction:still.although_clause_subject_still_verb'
const C_DISCOURSE = 'construction:still.discourse_still_clause'

describe('still pack — lexeme without a global level', () => {
  it('declares still as a high-frequency functional word with no level key', () => {
    const lex = stillPack.lexemes.find((l) => l.lemma === 'still')
    expect(lex).toBeTruthy()
    for (const key of FORBIDDEN_LEXEME_LEVEL_KEYS) expect(lex).not.toHaveProperty(key)
    expect(lex.frequency_band).toBe('high_frequency_functional')
  })

  it('spreads exposure recommendations across uses instead (A1 through B1-B2)', () => {
    const stages = new Set(stillPack.exemplars.map((e) => e.exposure_stage))
    expect(stages.has('A1')).toBe(true)
    expect(stages.has('B1-B2')).toBe(true)
    expect(stages.size).toBeGreaterThanOrEqual(4)
  })
})

describe('still pack — size and bilingual quality gates', () => {
  it('has at least 20 exemplars, all complete bilingual sentences with context', () => {
    expect(stillPack.exemplars.length).toBeGreaterThanOrEqual(20)
    for (const e of stillPack.exemplars) {
      expect(e.text_en, e.exemplar_id).toMatch(/\s.+[.?!]$/)
      expect(String(e.text_pt).trim().length, e.exemplar_id).toBeGreaterThan(0)
      expect(String(e.context).trim().length, e.exemplar_id).toBeGreaterThan(0)
    }
  })

  it('has at least 4 exemplars per construction', () => {
    for (const c of stillPack.constructions) {
      expect(getExemplarsByConstruction(stillPack, c.construction_id).length, c.construction_id).toBeGreaterThanOrEqual(4)
    }
  })

  it('never repeats the same English sentence', () => {
    const texts = stillPack.exemplars.map((e) => e.text_en.toLowerCase())
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('varies subjects instead of cloning one frame', () => {
    const firstWords = new Set(stillPack.exemplars.map((e) => e.text_en.split(/\s+/)[0].toLowerCase()))
    expect(firstWords.size).toBeGreaterThanOrEqual(5)
  })

  it('includes questions where the construction allows them', () => {
    expect(stillPack.exemplars.some((e) => e.text_en.endsWith('?'))).toBe(true)
  })
})

describe('still pack — sense vs construction are different entities', () => {
  it('"I still live here." and "I am still tired." share the continuity sense but use different constructions', () => {
    const live = stillPack.exemplars.find((e) => e.text_en === 'I still live here.')
    const tired = stillPack.exemplars.find((e) => e.text_en === 'I am still tired.')
    expect(live).toBeTruthy()
    expect(tired).toBeTruthy()
    expect(live.sense_ids).toContain(CONT)
    expect(tired.sense_ids).toContain(CONT)
    expect(live.construction_id).toBe(C_LEX)
    expect(tired.construction_id).toBe(C_BE)
    expect(live.construction_id).not.toBe(tired.construction_id)
  })

  it('the continuity sense is realized by more than one construction (many-to-many, sense side)', () => {
    const constructions = getConstructionsBySense(stillPack, CONT).map((c) => c.construction_id)
    expect(constructions).toContain(C_LEX)
    expect(constructions).toContain(C_BE)
  })

  it('the although construction combines two communicative functions (many-to-many, construction side)', () => {
    const although = stillPack.constructions.find((c) => c.construction_id === C_ALTHOUGH)
    expect(although.communicative_function_ids).toContain('function:introduce_concession')
    expect(although.communicative_function_ids).toContain('function:express_result_despite_obstacle')
  })

  it('"but ... still" and "although ... still" share a communicative function across different constructions', () => {
    const but = stillPack.exemplars.find((e) => e.text_en === 'It was difficult, but I still tried.')
    const although = stillPack.exemplars.find((e) => e.text_en === 'Although it was hard, I still tried.')
    expect(but).toBeTruthy()
    expect(although).toBeTruthy()
    expect(but.construction_id).toBe(C_BUT)
    expect(although.construction_id).toBe(C_ALTHOUGH)
    expect(but.construction_id).not.toBe(although.construction_id)
    expect(but.communicative_function_ids).toContain('function:express_result_despite_obstacle')
    expect(although.communicative_function_ids).toContain('function:express_result_despite_obstacle')
    // Both constructions declare the shared function at the model level too.
    const byFunction = getConstructionsByFunction(stillPack, 'function:express_result_despite_obstacle').map((c) => c.construction_id)
    expect(byFunction).toContain(C_BUT)
    expect(byFunction).toContain(C_ALTHOUGH)
  })
})

describe('still pack — although…still is a real construction, not two loose words', () => {
  it('declares both fixed elements and the obstacle→result relation', () => {
    const c = stillPack.constructions.find((x) => x.construction_id === C_ALTHOUGH)
    expect(c.fixed_elements).toEqual(expect.arrayContaining(['although', 'still']))
    expect(c.semantic_relation).toMatchObject({ relation: 'result_despite_obstacle' })
    expect(c.slots.map((s) => s.slot_id)).toContain('obstacle_clause')
  })

  it('every although exemplar contains both fixed elements', () => {
    for (const e of getExemplarsByConstruction(stillPack, C_ALTHOUGH)) {
      expect(e.text_en.toLowerCase()).toMatch(/\balthough\b/)
      expect(e.text_en.toLowerCase()).toMatch(/\bstill\b/)
    }
  })
})

describe('still pack — discourse marker is distinguishable', () => {
  it('discourse exemplars are clause-initial "Still," and carry the discourse sense only', () => {
    const exemplars = getExemplarsByConstruction(stillPack, C_DISCOURSE)
    expect(exemplars.length).toBeGreaterThanOrEqual(4)
    for (const e of exemplars) {
      expect(e.text_en.startsWith('Still,'), e.exemplar_id).toBe(true)
      expect(e.sense_ids).toEqual([DISCOURSE])
    }
  })

  it('no clause-internal adverb exemplar starts with "Still,"', () => {
    for (const e of stillPack.exemplars.filter((x) => x.construction_id !== C_DISCOURSE)) {
      expect(e.text_en.startsWith('Still,'), e.exemplar_id).toBe(false)
    }
  })
})

describe('still pack — progressive exposure and novelty budget', () => {
  it('every exemplar declares primary targets, prerequisites and intended new items', () => {
    for (const e of stillPack.exemplars) {
      expect(getPrimaryTargets(e).length, e.exemplar_id).toBeGreaterThanOrEqual(1)
      expect(Array.isArray(e.prerequisites), e.exemplar_id).toBe(true)
      expect(Array.isArray(e.intended_new_items), e.exemplar_id).toBe(true)
    }
  })

  it('the first exposure introduces at most two intended novelties', () => {
    const first = exposureProgression(stillPack)[0]
    expect(first.text_en).toBe('I still live here.')
    const novelties = getIntendedNewItems(first)
    expect(novelties.length).toBeGreaterThanOrEqual(1)
    expect(novelties.length).toBeLessThanOrEqual(2)
  })

  it('no exemplar ever introduces more than two novelties', () => {
    for (const e of stillPack.exemplars) {
      expect(getIntendedNewItems(e).length, e.exemplar_id).toBeLessThanOrEqual(2)
    }
  })

  it('later senses are introduced at later stages than continuity', () => {
    const firstStage = (senseId) => Math.min(...getExemplarsBySense(stillPack, senseId).map((e) => stageIndex(e.exposure_stage)))
    expect(firstStage(CONT)).toBeLessThan(firstStage(COUNTER))
    expect(firstStage(COUNTER)).toBeLessThan(firstStage(DISCOURSE))
  })

  it('each new sense/construction is introduced exactly once as an intended new item', () => {
    const introduced = stillPack.exemplars.flatMap((e) => getIntendedNewItems(e).map((n) => n.ref))
    expect(new Set(introduced).size).toBe(introduced.length)
    for (const c of stillPack.constructions) expect(introduced).toContain(c.construction_id)
    for (const s of stillPack.senses) expect(introduced).toContain(s.sense_id)
  })

  it('consolidation exemplars declare what they assume as prerequisites', () => {
    const consolidations = stillPack.exemplars.filter((e) => getIntendedNewItems(e).length === 0)
    expect(consolidations.length).toBeGreaterThan(0)
    for (const e of consolidations) expect(e.prerequisites.length, e.exemplar_id).toBeGreaterThan(0)
  })
})
