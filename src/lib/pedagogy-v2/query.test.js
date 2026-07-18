import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import {
  getLexeme, getSense, getConstruction, getCommunicativeFunction, getExemplar,
  getSensesForLexeme, getConstructionsBySense, getExemplarsBySense,
  getExemplarsByConstruction, getExemplarsByStage, getPrimaryTargets,
  getSecondaryTargets, getPrerequisites, getV1BridgePrerequisites,
  getV2Prerequisites, getIntendedNewItems, exposureProgression,
} from './query.js'
import { loadPedagogyV2Registry, getPedagogyPack, getAllPedagogyPacks, __resetPedagogyV2RegistryForTests } from './registry.js'

describe('pedagogy-v2 query API', () => {
  it('resolves entities by id and returns null for unknown ids', () => {
    expect(getLexeme(stillPack, 'lexeme:still')?.lemma).toBe('still')
    expect(getSense(stillPack, 'sense:still.continuity')?.label).toContain('Continuidade')
    expect(getConstruction(stillPack, 'construction:still.discourse_still_clause')?.pattern).toBe('Still, + CLAUSE')
    expect(getCommunicativeFunction(stillPack, 'function:introduce_concession')?.label_pt).toBe('Introduzir concessão')
    expect(getExemplar(stillPack, 'exemplar:still.001')?.text_en).toBe('I still live here.')
    expect(getLexeme(stillPack, 'lexeme:ghost')).toBeNull()
    expect(getSense(stillPack, 'sense:ghost')).toBeNull()
  })

  it('lists the three senses of still for the lexeme', () => {
    const senses = getSensesForLexeme(stillPack, 'lexeme:still').map((s) => s.sense_id)
    expect(senses).toEqual([
      'sense:still.continuity',
      'sense:still.counter_expectation',
      'sense:still.discourse_reservation',
    ])
  })

  it('finds exemplars by sense and by construction', () => {
    const bySense = getExemplarsBySense(stillPack, 'sense:still.continuity')
    expect(bySense.length).toBe(10) // 5 lexical-verb + 5 be-complement
    const byConstruction = getExemplarsByConstruction(stillPack, 'construction:still.subject_be_still_complement')
    expect(byConstruction.map((e) => e.text_en)).toContain('I am still tired.')
    expect(byConstruction.every((e) => e.sense_ids.includes('sense:still.continuity'))).toBe(true)
  })

  it('filters exemplars by exposure stage', () => {
    expect(getExemplarsByStage(stillPack, 'A1').length).toBe(5)
    expect(getExemplarsByStage(stillPack, 'B1-B2').length).toBe(4)
  })

  it('separates primary and secondary targets', () => {
    const first = getExemplar(stillPack, 'exemplar:still.001')
    expect(getPrimaryTargets(first).map((t) => t.target_id)).toEqual([
      'sense:still.continuity',
      'construction:still.subject_still_lexical_verb',
    ])
    const consolidation = getExemplar(stillPack, 'exemplar:still.002')
    expect(getSecondaryTargets(consolidation).map((t) => t.target_id)).toEqual(['sense:still.continuity'])
  })

  it('separates V2 prerequisites from V1 compatibility bridges', () => {
    const e = getExemplar(stillPack, 'exemplar:still.011')
    expect(getPrerequisites(e).length).toBe(3)
    expect(getV1BridgePrerequisites(e)).toEqual([
      { type: 'grammar_skill_v1', ref: 'past_simple', compat_bridge: true },
    ])
    expect(getV2Prerequisites(e).every((p) => p.ref.includes(':'))).toBe(true)
  })

  it('exposes intended new items per exemplar', () => {
    expect(getIntendedNewItems(getExemplar(stillPack, 'exemplar:still.006'))).toEqual([
      { type: 'construction', ref: 'construction:still.subject_be_still_complement' },
    ])
    expect(getIntendedNewItems(getExemplar(stillPack, 'exemplar:still.002'))).toEqual([])
  })

  it('orders the exposure progression from A1 to B1-B2', () => {
    const progression = exposureProgression(stillPack)
    expect(progression[0].text_en).toBe('I still live here.')
    expect(progression[progression.length - 1].exposure_stage).toBe('B1-B2')
    const stages = progression.map((e) => e.exposure_stage)
    const order = ['A1', 'A1-A2', 'A2', 'A2-B1', 'B1', 'B1-B2', 'B2']
    for (let i = 1; i < stages.length; i++) {
      expect(order.indexOf(stages[i])).toBeGreaterThanOrEqual(order.indexOf(stages[i - 1]))
    }
  })
})

describe('pedagogy-v2 registry (builtin packs)', () => {
  it('loads, validates and freezes builtin packs', () => {
    __resetPedagogyV2RegistryForTests()
    const registry = loadPedagogyV2Registry()
    expect(registry.packs.length).toBeGreaterThanOrEqual(2)
    expect(Object.isFrozen(registry)).toBe(true)
    expect(Object.isFrozen(registry.packs[0])).toBe(true)
    expect(Object.isFrozen(registry.packs[0].exemplars[0])).toBe(true)
  })

  it('resolves packs by id with the still pack intact', () => {
    const still = getPedagogyPack('pedagogy_v2_still')
    expect(still?.manifest.pack_id).toBe('pedagogy_v2_still')
    expect(getPedagogyPack('nope')).toBeNull()
    expect(still.lexemes.length).toBe(1)
    expect(still.senses.length).toBe(3)
    expect(still.constructions.length).toBe(5)
    expect(still.communicative_functions.length).toBe(5)
    expect(still.exemplars.length).toBe(22)
    expect(getAllPedagogyPacks().map((p) => p.manifest.pack_id)).toContain('pedagogy_v2_but')
  })
})
