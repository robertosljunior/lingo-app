// but-pack.test.js — content-level guarantees of the "but" pack (Slice V2.5
// §23): the curricular principles must be observable in the authored data —
// no global level, minimum sense/construction/exemplar coverage, the three
// mandatory use cores (+ correction), the explicit relation with the still
// pack's but...still construction, and the progressive exposure ordering.

import { describe, it, expect } from 'vitest'
import butPack from '../../content/pedagogy-v2/but.json'
import stillPack from '../../content/pedagogy-v2/still.json'
import { FORBIDDEN_LEXEME_LEVEL_KEYS, stageIndex } from './contracts.js'
import {
  getExemplarsByConstruction, getExemplarsBySense,
  getPrimaryTargets, getIntendedNewItems, exposureProgression,
} from './query.js'

const CONTRAST = 'sense:but.contrast'
const COUNTER = 'sense:but.counter_expectation'
const CORRECTION = 'sense:but.correction'
const EXCEPTION = 'sense:but.exception'
const C_CLAUSE = 'construction:but.clause_but_clause'
const C_ADJ = 'construction:but.adjective_but_adjective'
const C_NOT = 'construction:but.not_x_but_y'
const C_EXC = 'construction:but.universal_but_exception'
const C_POLITE = 'construction:but.polite_marker_but_clause'
const C_BUT_STILL = 'construction:still.clause_but_subject_still_verb'

describe('but pack — §23.14 lexeme without a global level', () => {
  it('declares but as a high-frequency functional word with no CEFR key', () => {
    const lex = butPack.lexemes.find((l) => l.lemma === 'but')
    expect(lex).toBeTruthy()
    for (const key of FORBIDDEN_LEXEME_LEVEL_KEYS) expect(lex).not.toHaveProperty(key)
    expect(lex.frequency_band).toBe('high_frequency_functional')
    expect(lex.language).toBe('en')
    expect(lex.part_of_speech.length).toBeGreaterThan(0)
    expect(lex.glosses_pt).toContain('mas')
  })
})

describe('but pack — §23.15–18 minimum coverage', () => {
  it('models at least 3 senses/use cores (4 authored)', () => {
    expect(butPack.senses.length).toBeGreaterThanOrEqual(3)
  })

  it('models at least 5 communicative functions', () => {
    expect(butPack.communicative_functions.length).toBeGreaterThanOrEqual(5)
  })

  it('models at least 5 constructions (owned) plus the referenced but...still', () => {
    expect(butPack.constructions.length).toBeGreaterThanOrEqual(5)
    const referenced = new Set(butPack.exemplars.map((e) => e.construction_id))
    expect(referenced.has(C_BUT_STILL)).toBe(true)
  })

  it('has at least 22 complete bilingual exemplars', () => {
    expect(butPack.exemplars.length).toBeGreaterThanOrEqual(22)
  })

  it('has at least 4 exemplars per modeled construction (including the referenced one)', () => {
    const modeled = [...butPack.constructions.map((c) => c.construction_id), C_BUT_STILL]
    for (const id of modeled) {
      expect(getExemplarsByConstruction(butPack, id).length, id).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('but pack — §23.19–21 explicit pedagogy on every exemplar', () => {
  it('every exemplar is a complete bilingual sentence with context (never an isolated word)', () => {
    for (const e of butPack.exemplars) {
      expect(e.text_en, e.exemplar_id).toMatch(/\s.+[.?!]$/)
      expect(e.text_en.toLowerCase(), e.exemplar_id).toMatch(/\bbut\b/)
      expect(String(e.text_pt).trim().length, e.exemplar_id).toBeGreaterThan(0)
      expect(String(e.context).trim().length, e.exemplar_id).toBeGreaterThan(0)
    }
  })

  it('never repeats the same English sentence or Portuguese translation', () => {
    const en = butPack.exemplars.map((e) => e.text_en.toLowerCase())
    const pt = butPack.exemplars.map((e) => e.text_pt.toLowerCase())
    expect(new Set(en).size).toBe(en.length)
    expect(new Set(pt).size).toBe(pt.length)
  })

  it('varies subjects instead of mechanically swapping one noun frame', () => {
    const firstWords = new Set(butPack.exemplars.map((e) => e.text_en.split(/\s+/)[0].toLowerCase()))
    expect(firstWords.size).toBeGreaterThanOrEqual(5)
  })

  it('every exemplar declares primary targets, prerequisites and intended new items', () => {
    for (const e of butPack.exemplars) {
      expect(getPrimaryTargets(e).length, e.exemplar_id).toBeGreaterThanOrEqual(1)
      expect(Array.isArray(e.prerequisites), e.exemplar_id).toBe(true)
      expect(Array.isArray(e.intended_new_items), e.exemplar_id).toBe(true)
    }
  })

  it('each novelty is introduced exactly once inside the pack', () => {
    const introduced = butPack.exemplars.flatMap((e) => getIntendedNewItems(e).map((n) => n.ref))
    expect(new Set(introduced).size).toBe(introduced.length)
    for (const c of butPack.constructions) expect(introduced).toContain(c.construction_id)
    for (const s of butPack.senses) expect(introduced).toContain(s.sense_id)
  })
})

describe('but pack — §23.22–25 mandatory use cores', () => {
  it('22: simple coordinated contrast ("I am tired, but I am happy.")', () => {
    const e = butPack.exemplars.find((x) => x.text_en === 'I am tired, but I am happy.')
    expect(e).toBeTruthy()
    expect(e.construction_id).toBe(C_CLAUSE)
    expect(e.sense_ids).toEqual([CONTRAST])
  })

  it('23: counter-expectation WITHOUT still uses the same coordinated construction with its own sense', () => {
    const e = butPack.exemplars.find((x) => x.text_en === 'I was tired, but I finished the work.')
    expect(e).toBeTruthy()
    expect(e.construction_id).toBe(C_CLAUSE)
    expect(e.sense_ids).toEqual([COUNTER])
    // Documented modeling decision: own sense as conventionalized extension of
    // contrast — same shape as still's counter_expectation.
    const sense = butPack.senses.find((s) => s.sense_id === COUNTER)
    expect(sense.related_sense_ids).toContain(CONTRAST)
  })

  it('24: exception/exclusion is a DISTINCT prepositional construction, distinguished from the clause coordinator', () => {
    const e = butPack.exemplars.find((x) => x.text_en === 'Everyone but John agreed.')
    expect(e).toBeTruthy()
    expect(e.construction_id).toBe(C_EXC)
    expect(e.sense_ids).toEqual([EXCEPTION])
    const rel = butPack.relations.find((r) =>
      r.relation_type === 'contrasts_with' && r.from === C_EXC && r.to === C_CLAUSE)
    expect(rel).toBeTruthy()
  })

  it('25: not X but Y (corrective) with negation as a solidary fixed element', () => {
    const e = butPack.exemplars.find((x) => x.text_en === 'It was not luck but hard work.')
    expect(e).toBeTruthy()
    expect(e.construction_id).toBe(C_NOT)
    expect(e.sense_ids).toEqual([CORRECTION])
    const c = butPack.constructions.find((x) => x.construction_id === C_NOT)
    expect(c.fixed_elements).toEqual(expect.arrayContaining(['not', 'but']))
  })

  it('optional restriction/attenuation shares the contrast sense but has its own construction', () => {
    const e = butPack.exemplars.find((x) => x.text_en === 'The plan is simple but effective.')
    expect(e).toBeTruthy()
    expect(e.construction_id).toBe(C_ADJ)
    expect(e.sense_ids).toEqual([CONTRAST])
  })
})

describe('but pack — §23.26 explicit relation with but...still', () => {
  it('references the still-owned construction, never redefining it', () => {
    expect(butPack.constructions.map((c) => c.construction_id)).not.toContain(C_BUT_STILL)
    const referencing = getExemplarsByConstruction(butPack, C_BUT_STILL)
    expect(referencing.length).toBeGreaterThanOrEqual(4)
    // The referenced construction still exists, untouched, in the still pack.
    expect(stillPack.constructions.map((c) => c.construction_id)).toContain(C_BUT_STILL)
  })

  it('declares the formal dependency on the still pack', () => {
    expect(butPack.manifest.dependencies).toEqual([
      expect.objectContaining({ pack_id: 'pedagogy_v2_still', required_schema_version: '1' }),
    ])
    expect(butPack.manifest.dependencies[0].reason.length).toBeGreaterThan(10)
  })

  it('declares the typed, directed relation between but...still and the base contrast construction', () => {
    const rel = butPack.relations.find((r) =>
      r.relation_type === 'extends_usage' && r.from === C_BUT_STILL && r.to === C_CLAUSE)
    expect(rel).toBeTruthy()
    const shared = butPack.relations.find((r) =>
      r.relation_type === 'realizes_shared_function'
      && r.from === C_CLAUSE && r.to === 'function:express_result_despite_obstacle')
    expect(shared).toBeTruthy()
  })

  it('but...still exemplars require BOTH but-contrast and still-continuity knowledge (real prerequisites)', () => {
    const intro = butPack.exemplars.find((e) => e.exemplar_id === 'exemplar:but.008')
    const refs = intro.prerequisites.filter((p) => p.type !== 'grammar_skill_v1').map((p) => p.ref)
    expect(refs).toEqual(expect.arrayContaining([
      CONTRAST, C_CLAUSE, 'sense:still.continuity', 'construction:still.subject_still_lexical_verb',
    ]))
  })
})

describe('but pack — §23.27 progression', () => {
  it('orders exposure: contrast → counter-expectation → adjective → correction/discourse → exception', () => {
    const firstStage = (senseOrConstruction, lookup) => Math.min(
      ...lookup(butPack, senseOrConstruction).map((e) => stageIndex(e.exposure_stage)))
    expect(firstStage(CONTRAST, getExemplarsBySense)).toBeLessThan(firstStage(COUNTER, getExemplarsBySense))
    expect(firstStage(COUNTER, getExemplarsBySense)).toBeLessThan(firstStage(CORRECTION, getExemplarsBySense))
    expect(firstStage(COUNTER, getExemplarsBySense)).toBeLessThan(firstStage(EXCEPTION, getExemplarsBySense))
    expect(firstStage(C_CLAUSE, getExemplarsByConstruction)).toBeLessThan(firstStage(C_ADJ, getExemplarsByConstruction))
    expect(firstStage(C_ADJ, getExemplarsByConstruction)).toBeLessThan(firstStage(C_EXC, getExemplarsByConstruction))
    expect(firstStage(C_CLAUSE, getExemplarsByConstruction)).toBeLessThan(firstStage(C_POLITE, getExemplarsByConstruction))
  })

  it('spreads exposure recommendations from A1 to B1-B2 (no global level anywhere)', () => {
    const stages = new Set(butPack.exemplars.map((e) => e.exposure_stage))
    expect(stages.has('A1')).toBe(true)
    expect(stages.has('B1-B2')).toBe(true)
    expect(stages.size).toBeGreaterThanOrEqual(4)
  })

  it('the progression starts with the simple-contrast exemplar', () => {
    expect(exposureProgression(butPack)[0].text_en).toBe('I am tired, but I am happy.')
  })
})

describe('but pack — §23.28 exposure novelty budget', () => {
  it('the first exposure introduces at most two intended novelties', () => {
    const first = exposureProgression(butPack)[0]
    const novelties = getIntendedNewItems(first)
    expect(novelties.length).toBeGreaterThanOrEqual(1)
    expect(novelties.length).toBeLessThanOrEqual(2)
  })

  it('no exemplar ever introduces more than two novelties', () => {
    for (const e of butPack.exemplars) {
      expect(getIntendedNewItems(e).length, e.exemplar_id).toBeLessThanOrEqual(2)
    }
  })

  it('consolidation exemplars declare what they assume as prerequisites', () => {
    const consolidations = butPack.exemplars.filter((e) => getIntendedNewItems(e).length === 0)
    expect(consolidations.length).toBeGreaterThan(0)
    for (const e of consolidations) expect(e.prerequisites.length, e.exemplar_id).toBeGreaterThan(0)
  })
})
