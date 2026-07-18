// options-audit.test.js — structural audit of authored recognition
// alternatives (Slice V2.5 §21): duplicate/normalized-duplicate translations,
// self-distractors, insufficient options and foreign option sources.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import butPack from '../../content/pedagogy-v2/but.json'
import { auditRecognitionOptionsV2 } from './options-audit.js'
import { buildRecognitionOptionsV2, normalizeTranslationPt } from './lesson-engine.js'

function tinyPack(exemplars) {
  return { manifest: { pack_id: 'pedagogy_v2_x' }, exemplars }
}

const ex = (id, en, pt, senses = ['sense:x.s1']) => ({
  exemplar_id: `exemplar:x.${id}`, text_en: en, text_pt: pt, sense_ids: senses,
})

describe('normalizeTranslationPt', () => {
  it('collapses case, punctuation, accents and whitespace — nothing deeper', () => {
    expect(normalizeTranslationPt('Eu ainda moro aqui.')).toBe(normalizeTranslationPt('  eu AINDA moro aqui!! '))
    expect(normalizeTranslationPt('Ela é jovem.')).toBe(normalizeTranslationPt('ela e jovem'))
    expect(normalizeTranslationPt('Eu moro aqui.')).not.toBe(normalizeTranslationPt('Eu morava aqui.'))
  })
})

describe('audit findings', () => {
  it('detects identical and normalized-identical authored translations', () => {
    const pack = tinyPack([
      ex('001', 'We run fast today.', 'Nós corremos rápido.'),
      ex('002', 'We walk slowly today.', 'Nós corremos rápido.'),
      ex('003', 'We move quickly today.', 'nós corremos RÁPIDO!'),
      ex('004', 'We rest at home today.', 'Nós descansamos em casa.'),
    ])
    const audit = auditRecognitionOptionsV2(pack)
    expect(audit.clean).toBe(false)
    expect(audit.findings.map((f) => f.code)).toContain('DUPLICATE_TRANSLATION')
    expect(audit.findings.map((f) => f.code)).toContain('NORMALIZED_DUPLICATE_TRANSLATION')
  })

  it('flags exemplars that cannot form the minimum safe option set', () => {
    const pack = tinyPack([
      ex('001', 'We run fast today.', 'Nós corremos rápido.'),
      ex('002', 'We walk slowly today.', 'Nós corremos rápido!'), // normalized duplicate
    ])
    const audit = auditRecognitionOptionsV2(pack, { minOptions: 3 })
    expect(audit.findings.filter((f) => f.code === 'INSUFFICIENT_OPTIONS').length).toBe(2)
  })

  it('the option builder never uses the target translation (or a normalized twin) as distractor', () => {
    const pack = tinyPack([
      ex('001', 'We run fast today.', 'Nós corremos rápido.'),
      ex('002', 'We walk slowly today.', 'nós corremos rápido'), // normalized twin of 001
      ex('003', 'We rest at home today.', 'Nós descansamos em casa.'),
      ex('004', 'We eat lunch together.', 'Nós almoçamos juntos.'),
    ])
    const options = buildRecognitionOptionsV2(pack, pack.exemplars[0], 3)
    expect(options).not.toBeNull()
    const norms = options.map((o) => normalizeTranslationPt(o.text_pt))
    expect(new Set(norms).size).toBe(norms.length)
    // Audit confirms: no SELF_DISTRACTOR / FOREIGN_OPTION_SOURCE over built sets.
    const audit = auditRecognitionOptionsV2(pack)
    expect(audit.findings.filter((f) => f.code === 'SELF_DISTRACTOR')).toEqual([])
    expect(audit.findings.filter((f) => f.code === 'FOREIGN_OPTION_SOURCE')).toEqual([])
  })

  it('options are always sourced from the audited (active) pack', () => {
    for (const pack of [stillPack, butPack]) {
      const ids = new Set(pack.exemplars.map((e) => e.exemplar_id))
      for (const e of pack.exemplars) {
        const options = buildRecognitionOptionsV2(pack, e, 3)
        expect(options, e.exemplar_id).not.toBeNull()
        for (const o of options) expect(ids.has(o.source_exemplar_id), o.source_exemplar_id).toBe(true)
      }
    }
  })
})

describe('builtin packs stay clean', () => {
  it('still and but have no structural alternative hazards', () => {
    expect(auditRecognitionOptionsV2(stillPack)).toEqual({ clean: true, findings: [] })
    expect(auditRecognitionOptionsV2(butPack)).toEqual({ clean: true, findings: [] })
  })
})
