import { describe, it, expect } from 'vitest'
import { BUILTIN_CONTENT_PACKS } from './content-pack-loader.js'
import {
  isPortuguesePlaceholder, hasRealTranslationSource, semanticEquivalenceIssues,
  bilingualPackReport, validateBilingualPack,
} from './bilingual-content.js'

const THEME_PACKS = BUILTIN_CONTENT_PACKS.filter((p) => p.manifest.theme !== 'core')
// English grammar words that must never appear inside a Portuguese source
// (borrowed nouns like "hotel", "notebook", "online" are legitimately used).
const ENGLISH_LEAK = /\b(the|is|are|was|were|will|would|have|has|been|they|you|we|she|he|check|every day|yesterday|tomorrow|review)\b/i

describe('bilingual content — placeholders', () => {
  it('no active pack contains a Portuguese placeholder source', () => {
    for (const p of BUILTIN_CONTENT_PACKS) {
      for (const t of p.template_definitions) {
        expect(isPortuguesePlaceholder(t.source_text_pt), `${p.manifest.pack_id}/${t.template_id}: "${t.source_text_pt}"`).toBe(false)
      }
    }
  })
  it('no Portuguese source contains English grammar words', () => {
    for (const p of BUILTIN_CONTENT_PACKS) {
      for (const t of p.template_definitions) {
        expect(ENGLISH_LEAK.test(t.source_text_pt), `${p.manifest.pack_id}/${t.template_id}: "${t.source_text_pt}"`).toBe(false)
      }
    }
  })
})

describe('bilingual content — contract', () => {
  it('every template carries the explicit bilingual contract', () => {
    for (const p of BUILTIN_CONTENT_PACKS) {
      for (const t of p.template_definitions) {
        expect(t.source_locale).toBe('pt-BR')
        expect(t.target_locale).toBe('en')
        expect(t.source_text_pt?.length).toBeGreaterThan(0)
        expect(Array.isArray(t.expected_answers_en) && t.expected_answers_en.length).toBeTruthy()
        expect(t.explanation_pt?.length).toBeGreaterThan(0)
        expect(hasRealTranslationSource(t)).toBe(true)
      }
    }
  })
})

describe('bilingual content — coverage (all 24 theme packs)', () => {
  it('each theme pack meets the minimum exercise coverage', () => {
    expect(THEME_PACKS).toHaveLength(24)
    for (const p of THEME_PACKS) {
      const { valid, errors, report } = validateBilingualPack(p)
      expect(valid, `${p.manifest.pack_id}: ${errors.join(', ')}`).toBe(true)
      expect(report.coverage.translation).toBeGreaterThanOrEqual(5)
      expect(report.coverage.ordering).toBeGreaterThanOrEqual(4)
      expect(report.coverage.listening).toBeGreaterThanOrEqual(4)
      expect(report.coverage.production).toBeGreaterThanOrEqual(4)
      expect(report.coverage.recognition).toBeGreaterThanOrEqual(4)
      expect(report.placeholder_count).toBe(0)
    }
  })
})

describe('semantic equivalence', () => {
  it('accepts the authored PT↔EN pairs', () => {
    for (const p of BUILTIN_CONTENT_PACKS) {
      for (const t of p.template_definitions) {
        const eq = semanticEquivalenceIssues(t.source_text_pt, t.expected_answers_en[0])
        expect(eq, `${t.template_id}: ${t.source_text_pt} / ${t.expected_answers_en[0]}`).toEqual([])
      }
    }
  })

  it('rejects a negation mismatch (negative golden)', () => {
    expect(semanticEquivalenceIssues('Eu não trabalho aos domingos.', 'I work on Sundays.')).toContain('NEGATION_MISMATCH')
  })

  it('rejects a quantity mismatch (negative golden)', () => {
    expect(semanticEquivalenceIssues('Ela comprou dois ingressos.', 'She bought a ticket.')).toContain('QUANTITY_MISMATCH')
  })

  it('accepts a preserved quantity', () => {
    expect(semanticEquivalenceIssues('Eles estão revisando o projeto há duas horas.', 'They have been reviewing the project for two hours.')).toEqual([])
  })

  it('accepts a preserved negation', () => {
    expect(semanticEquivalenceIssues('Eu não trabalho aos domingos.', "I don't work on Sundays.")).toEqual([])
  })
})

describe('per-pack report shape', () => {
  it('produces the required report fields', () => {
    const r = bilingualPackReport(THEME_PACKS[0])
    expect(r).toHaveProperty('total_templates')
    expect(r).toHaveProperty('by_type')
    expect(r).toHaveProperty('by_family')
    expect(r).toHaveProperty('missing_types')
    expect(r).toHaveProperty('translation_real_count')
    expect(r).toHaveProperty('placeholder_count')
  })
})
