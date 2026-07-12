import { describe, expect, it } from 'vitest'
import { loadBuiltinContentPacks } from './content-pack-loader.js'
import { validateContentPack, contentPackChecksum } from './content-pack-validator.js'

const THEMES = ['daily_life', 'workplace', 'travel', 'food_and_restaurants', 'shopping_and_services', 'technology_and_communication']
const LEVELS = ['A1', 'A2', 'B1', 'B2']

describe('builtin content packs (28 arquivos)', () => {
  const packs = loadBuiltinContentPacks()
  const knownPacks = packs.map((p) => p.manifest.pack_id)

  it('bundles exactly 4 core packs + 6 themes × 4 levels', () => {
    expect(packs).toHaveLength(28)
    for (const level of LEVELS) expect(knownPacks).toContain(`core_${level.toLowerCase()}`)
    for (const theme of THEMES) for (const level of LEVELS) expect(knownPacks).toContain(`${theme}_${level.toLowerCase()}`)
  })

  it('every pack validates with zero errors and correct counts', () => {
    for (const pack of packs) {
      const v = validateContentPack(pack, { knownPacks })
      expect(v.errors, `${pack.manifest.pack_id}: ${JSON.stringify(v.errors)}`).toEqual([])
      expect(v.valid).toBe(true)
      const isCore = pack.manifest.theme === 'core'
      expect(v.counts.lexical_items).toBeGreaterThanOrEqual(isCore ? 18 : 12)
      expect(v.counts.template_definitions).toBeGreaterThanOrEqual(isCore ? 10 : 6)
      expect(v.counts.collocations).toBeGreaterThanOrEqual(isCore ? 8 : 6)
    }
  })

  it('IDs are globally unique across all 28 packs', () => {
    const ids = new Set()
    for (const pack of packs) {
      for (const id of [
        pack.manifest.pack_id,
        ...pack.lexical_items.map((x) => x.item_id),
        ...pack.template_definitions.map((x) => x.template_id),
        ...pack.collocations.map((x) => x.collocation_id),
      ]) {
        expect(ids.has(id), `duplicate id ${id}`).toBe(false)
        ids.add(id)
      }
    }
  })

  it('theme packs depend on the matching core pack', () => {
    for (const pack of packs) {
      if (pack.manifest.theme === 'core') { expect(pack.manifest.dependencies).toEqual([]); continue }
      expect(pack.manifest.dependencies).toEqual([`core_${pack.manifest.level.toLowerCase()}`])
    }
  })

  it('level gating: no B2-only grammar as primary content below B2', () => {
    for (const pack of packs) {
      const level = pack.manifest.level
      for (const t of pack.template_definitions) {
        if (['A1'].includes(level)) {
          expect(['present_perfect_continuous', 'passive_voice', 'reported_speech', 'second_conditional'], `${t.template_id}`).not.toContain(t.primary_skill_id)
        }
        if (['A1', 'A2', 'B1'].includes(level)) {
          expect(['passive_voice', 'reported_speech', 'second_conditional', 'modal_deduction'], `${t.template_id}`).not.toContain(t.primary_skill_id)
        }
      }
    }
  })

  it('packs contain data only — no executable content, and checksums are stable', () => {
    for (const pack of packs) {
      const json = JSON.stringify(pack)
      expect(json).not.toMatch(/"(build|resolver)":\s*"?function/)
      expect(contentPackChecksum(pack)).toBe(contentPackChecksum(JSON.parse(json)))
    }
  })

  it('validator rejects broken packs', () => {
    const good = JSON.parse(JSON.stringify(packs[0]))
    expect(validateContentPack(good).valid).toBe(true)
    const noTitle = JSON.parse(JSON.stringify(good)); delete noTitle.manifest.title
    expect(validateContentPack(noTitle).valid).toBe(false)
    const badPattern = JSON.parse(JSON.stringify(good)); badPattern.template_definitions[0].pattern_id = 'made_up_pattern'
    expect(validateContentPack(badPattern).errors.some((e) => e.code === 'TEMPLATE_PATTERN_UNKNOWN')).toBe(true)
    const badConstraint = JSON.parse(JSON.stringify(good)); badConstraint.template_definitions[0].constraints = ['nope']
    expect(validateContentPack(badConstraint).errors.some((e) => e.code === 'TEMPLATE_CONSTRAINT_UNKNOWN')).toBe(true)
    const badStrategy = JSON.parse(JSON.stringify(good)); badStrategy.template_definitions[0].distractor_strategy_ids = ['nope']
    expect(validateContentPack(badStrategy).errors.some((e) => e.code === 'TEMPLATE_STRATEGY_UNKNOWN')).toBe(true)
    const badDep = JSON.parse(JSON.stringify(good)); badDep.manifest.dependencies = ['ghost_pack']
    expect(validateContentPack(badDep, { knownPacks }).errors.some((e) => e.code === 'DEPENDENCY_UNKNOWN')).toBe(true)
    const withFn = JSON.parse(JSON.stringify(good)); withFn.template_definitions[0].build = () => {}
    expect(validateContentPack(withFn).errors.some((e) => e.code === 'EXECUTABLE_CONTENT')).toBe(true)
    // Pattern above the pack's level is rejected.
    const a1 = packs.find((p) => p.manifest.pack_id === 'core_a1')
    const leveled = JSON.parse(JSON.stringify(a1))
    leveled.template_definitions[0].pattern_id = 'passive_be_past_participle'
    leveled.template_definitions[0].slots = { subject: { source: 'lexical_items', semantic_type: 'person_subject' }, verb: { source: 'lexical_items', semantic_type: 'action_verb' } }
    expect(validateContentPack(leveled).errors.some((e) => e.code === 'TEMPLATE_PATTERN_LEVEL_VIOLATION')).toBe(true)
  })
})
