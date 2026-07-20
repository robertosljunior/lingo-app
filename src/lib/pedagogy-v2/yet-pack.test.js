// yet-pack.test.js — §38 (Slice V2.11): the authored content of the third
// functional lexeme `yet`. No global level, qualitative frequency, the four
// use cores (temporal pending, concessive, maximal-so-far, additive
// repetition), the seven-plus constructions, translation BY SENSE (never a
// universal 'yet = ainda'), explicit prerequisites/new-items/progression and
// no mechanical noun-swap authoring.

import { describe, it, expect } from 'vitest'
import { loadPedagogyV2Registry, getPedagogyPack } from './registry.js'
import { EXPOSURE_STAGES, stageIndex, FORBIDDEN_LEXEME_LEVEL_KEYS } from './contracts.js'
import { normalizeTranslationPt } from './lesson-engine.js'

const registry = loadPedagogyV2Registry()
const pack = getPedagogyPack('pedagogy_v2_yet', registry)
const lex = pack.lexemes[0]
const byConstruction = (id) => pack.exemplars.filter((e) => e.construction_id === id)

describe('§38.1–2 — lexeme without global level, qualitative frequency', () => {
  it('1: lexeme:yet carries NO level/CEFR key at all', () => {
    for (const key of FORBIDDEN_LEXEME_LEVEL_KEYS) expect(lex).not.toHaveProperty(key)
    expect(lex.lexeme_id).toBe('lexeme:yet')
    expect(lex.lemma).toBe('yet')
  })
  it('2: frequency band is qualitative', () => {
    expect(lex.frequency_band).toBe('high_frequency_functional')
  })
})

describe('§38.3–7 — authored minimums', () => {
  it('3: at least 4 clearly-justified use cores (senses)', () => {
    expect(pack.senses.length).toBeGreaterThanOrEqual(4)
    const ids = pack.senses.map((s) => s.sense_id)
    expect(ids).toEqual(expect.arrayContaining([
      'sense:yet.temporal_pending', 'sense:yet.concessive',
      'sense:yet.maximal_so_far', 'sense:yet.additive_repetition',
    ]))
  })
  it('4: at least 6 communicative functions', () => {
    expect(pack.communicative_functions.length).toBeGreaterThanOrEqual(6)
  })
  it('5: at least 6 constructions', () => {
    expect(pack.constructions.length).toBeGreaterThanOrEqual(6)
  })
  it('6: at least 28 complete bilingual exemplars', () => {
    expect(pack.exemplars.length).toBeGreaterThanOrEqual(28)
  })
  it('7: at least 4 materialized exemplars per construction', () => {
    for (const c of pack.constructions) {
      expect(byConstruction(c.construction_id).length, c.construction_id).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('§38.8–11 — exemplar completeness', () => {
  it('8+9: complete sentences with authored pt-BR translations, all distinct', () => {
    const norms = new Set()
    for (const e of pack.exemplars) {
      expect(e.text_en.length).toBeGreaterThan(8)
      expect(/[.?!]$/.test(e.text_en.trim())).toBe(true)
      expect(e.text_pt.length).toBeGreaterThan(8)
      expect(e.text_en.toLowerCase()).toContain('yet')
      const n = normalizeTranslationPt(e.text_pt)
      expect(norms.has(n), `duplicate translation: ${e.text_pt}`).toBe(false)
      norms.add(n)
    }
  })
  it('10: intended_new_items are explicit and never exceed the engine budget of 2', () => {
    for (const e of pack.exemplars) {
      expect(Array.isArray(e.intended_new_items)).toBe(true)
      expect(e.intended_new_items.length).toBeLessThanOrEqual(2)
    }
    // Each sense and construction is introduced exactly once.
    const introduced = pack.exemplars.flatMap((e) => e.intended_new_items.map((n) => n.ref))
    expect(new Set(introduced).size).toBe(introduced.length)
    for (const s of pack.senses) expect(introduced).toContain(s.sense_id)
    for (const c of pack.constructions) expect(introduced).toContain(c.construction_id)
  })
  it('11: prerequisites are explicit; V1 bridges always opt-in', () => {
    for (const e of pack.exemplars) {
      expect(Array.isArray(e.prerequisites)).toBe(true)
      for (const p of e.prerequisites) {
        if (p.type === 'grammar_skill_v1') expect(p.compat_bridge).toBe(true)
      }
    }
  })
})

describe('§38.12–17 — the required use spaces', () => {
  const construction = (id) => pack.constructions.find((c) => c.construction_id === id)

  it('12: temporal negative with be', () => {
    const c = construction('construction:yet.subject_be_not_complement_yet')
    expect(c.sense_ids).toEqual(['sense:yet.temporal_pending'])
    expect(byConstruction(c.construction_id).some((e) => e.text_en === "I'm not ready yet.")).toBe(true)
  })
  it('13: temporal interrogative — SAME sense, its own construction (documented decision)', () => {
    const c = construction('construction:yet.interrogative_clause_yet')
    expect(c.sense_ids).toEqual(['sense:yet.temporal_pending'])
    expect(byConstruction(c.construction_id).some((e) => e.text_en === 'Is dinner ready yet?')).toBe(true)
  })
  it('14: have yet to — temporal sense reused with its own construction', () => {
    const c = construction('construction:yet.have_yet_to_infinitive')
    expect(c.sense_ids).toEqual(['sense:yet.temporal_pending'])
    expect(byConstruction(c.construction_id).some((e) => e.text_en === 'We have yet to decide.')).toBe(true)
  })
  it('15: concessive yet — a DISTINCT sense from the temporal core', () => {
    const c = construction('construction:yet.clause_yet_clause')
    expect(c.sense_ids).toEqual(['sense:yet.concessive'])
    expect(byConstruction(c.construction_id).some((e) => e.text_en === 'It was difficult, yet we continued.')).toBe(true)
  })
  it('16: and yet — own construction of the concessive sense, extending the base', () => {
    const c = construction('construction:yet.and_yet_clause')
    expect(c.sense_ids).toEqual(['sense:yet.concessive'])
    expect(c.prerequisite_construction_ids).toContain('construction:yet.clause_yet_clause')
    expect(pack.relations.some((r) => r.relation_type === 'extends_usage'
      && r.from === 'construction:yet.and_yet_clause' && r.to === 'construction:yet.clause_yet_clause')).toBe(true)
  })
  it('17: maximal-so-far as its own confirmed core', () => {
    const c = construction('construction:yet.superlative_yet')
    expect(c.sense_ids).toEqual(['sense:yet.maximal_so_far'])
    expect(byConstruction(c.construction_id).some((e) => e.text_en === 'This is our best result yet.')).toBe(true)
  })
})

describe('§38.18 — translation by sense, never a universal yet=ainda', () => {
  it('temporal negative → ainda; interrogative → já; concessive → porém/mesmo assim; maximal → até agora; additive → mais um', () => {
    const pt = (constructionId) => byConstruction(constructionId).map((e) => e.text_pt.toLowerCase())
    expect(pt('construction:yet.subject_be_not_complement_yet').every((t) => t.includes('ainda'))).toBe(true)
    expect(pt('construction:yet.interrogative_clause_yet').every((t) => t.includes('já'))).toBe(true)
    expect(pt('construction:yet.clause_yet_clause').every((t) => t.includes('porém'))).toBe(true)
    expect(pt('construction:yet.and_yet_clause').every((t) => t.includes('mesmo assim'))).toBe(true)
    expect(pt('construction:yet.superlative_yet').every((t) => t.includes('até agora'))).toBe(true)
    expect(pt('construction:yet.yet_another_np').every((t) => t.includes('mais um'))).toBe(true)
    // No single Portuguese word appears in EVERY translation (no global gloss).
    const all = pack.exemplars.map((e) => normalizeTranslationPt(e.text_pt))
    for (const word of ['ainda', 'ja', 'porem', 'mais']) {
      expect(all.every((t) => t.includes(word)), `"${word}" must not be universal`).toBe(false)
    }
  })
})

describe('§38.19 — exposure progression', () => {
  it('temporal enters at A1 and the concessive/maximal/additive cores enter at B1+', () => {
    const stageOf = (id) => pack.exemplars.find((e) => e.intended_new_items.some((n) => n.ref === id))?.exposure_stage
    expect(stageOf('sense:yet.temporal_pending')).toBe('A1')
    expect(stageIndex(stageOf('sense:yet.concessive'))).toBeGreaterThanOrEqual(stageIndex('B1'))
    expect(stageIndex(stageOf('sense:yet.maximal_so_far'))).toBeGreaterThanOrEqual(stageIndex('B1'))
    expect(stageIndex(stageOf('sense:yet.additive_repetition'))).toBeGreaterThanOrEqual(stageIndex('B1'))
    for (const e of pack.exemplars) expect(EXPOSURE_STAGES).toContain(e.exposure_stage)
    // Introduction order follows the documented progression: each construction's
    // intro stage is not earlier than its prerequisites' intro stages.
    const introStage = new Map()
    for (const e of pack.exemplars) for (const n of e.intended_new_items) introStage.set(n.ref, e.exposure_stage)
    for (const c of pack.constructions) {
      for (const pre of c.prerequisite_construction_ids || []) {
        expect(stageIndex(introStage.get(c.construction_id))).toBeGreaterThanOrEqual(stageIndex(introStage.get(pre)))
      }
    }
  })
})

describe('§38.20 — no mechanical noun-swap authoring', () => {
  it('within each construction, exemplars differ beyond a single noun', () => {
    for (const c of pack.constructions) {
      const texts = byConstruction(c.construction_id).map((e) => e.text_en.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/))
      // Any two exemplars of a construction differ in at least two token
      // positions OR in length — a single-noun swap would differ in exactly one.
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i]; const b = texts[j]
          if (a.length !== b.length) continue
          const diffs = a.filter((tok, k) => tok !== b[k]).length
          expect(diffs, `${c.construction_id}: exemplars ${i} and ${j} differ by a single token`).toBeGreaterThan(1)
        }
      }
      // And every exemplar carries its own authored context.
      const contexts = new Set(byConstruction(c.construction_id).map((e) => e.context))
      expect(contexts.size).toBe(byConstruction(c.construction_id).length)
    }
  })
})
