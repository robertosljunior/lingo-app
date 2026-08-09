import { describe, expect, it } from 'vitest'
import places from '../../content/lexicon/places.v1.json'
import {
  compileLexiconSlotCandidates,
  deriveSameSurface,
  renderLexiconRelation,
  selectLexiconUnits,
  validateSemanticLexicon,
} from './semantic-lexicon.js'

describe('semantic lexicon V1 contracts', () => {
  it('keeps the place registry generic while preserving the original seed and control group', () => {
    expect(validateSemanticLexicon(places)).toEqual({ valid: true, errors: [], count: 45 })
    expect(places.en_variant).toBe('en_US')
    expect(places.pt_variant).toBe('pt_BR')

    const original = selectLexiconUnits(places, { seedGroups: ['place_seed'] })
    const controls = selectLexiconUnits(places, { seedGroups: ['control_non_workplace'] })
    expect(original).toHaveLength(35)
    expect(controls).toHaveLength(10)
    expect(controls.some((unit) => unit.roles.includes('workplace'))).toBe(false)
  })

  it('uses the same selector for role, domain and relation constraints without theme-specific logic', () => {
    const workplaces = compileLexiconSlotCandidates(places, { relation: 'point', requireRoles: ['workplace'] })
    const leisure = compileLexiconSlotCandidates(places, { relation: 'point', requireDomains: ['leisure'] })
    const travelDestinations = compileLexiconSlotCandidates(places, { relation: 'destination', requireDomains: ['travel'] })
    const transit = compileLexiconSlotCandidates(places, { relation: 'point', requireRoles: ['transit'] })

    expect(workplaces).toHaveLength(35)
    expect(leisure.length).toBeGreaterThan(1)
    expect(travelDestinations.length).toBeGreaterThan(1)
    expect(transit.map((row) => row.unit_id)).toEqual(expect.arrayContaining([
      'lex:place.bus_stop',
      'lex:place.train_station',
    ]))
  })

  it('lets a frame choose an article reading without hard-coding a theme', () => {
    expect(renderLexiconRelation(places, 'lex:place.school', 'point')).toMatchObject({
      en: 'at school',
      article_profile: 'institutional',
    })
    expect(renderLexiconRelation(places, 'lex:place.school', 'point', { articleProfile: 'definite' })).toMatchObject({
      en: 'at the school',
      pt: 'na escola',
      article_profile: 'definite',
    })
  })

  it('renders regular, institutional, bare and overridden surfaces from relation + affordance', () => {
    expect(renderLexiconRelation(places, 'lex:place.office', 'point')).toMatchObject({
      en: 'at the office',
      pt: 'no escritório',
    })
    expect(renderLexiconRelation(places, 'lex:place.office', 'interior')).toMatchObject({
      en: 'in the office',
      pt: 'no escritório',
    })
    expect(renderLexiconRelation(places, 'lex:place.school', 'interior')).toMatchObject({
      en: 'in the school',
      pt: 'na escola',
    })
    expect(renderLexiconRelation(places, 'lex:place.home', 'point')).toMatchObject({
      en: 'at home',
      pt: 'em casa',
    })
    expect(renderLexiconRelation(places, 'lex:place.home', 'destination')).toMatchObject({
      en: 'home',
      pt: 'para casa',
    })
    expect(renderLexiconRelation(places, 'lex:place.doctors_office', 'point')).toMatchObject({
      en: "at the doctor's",
      pt: 'no consultório',
    })
    expect(renderLexiconRelation(places, 'lex:place.construction_site', 'surface_contact')).toMatchObject({
      en: 'on the construction site',
      pt: 'no canteiro de obras',
    })
  })

  it('refuses relations the lexical affordance did not license', () => {
    expect(() => renderLexiconRelation(places, 'lex:place.home', 'interior')).toThrow('LEXICON_RELATION_NOT_ALLOWED')
    expect(() => renderLexiconRelation(places, 'lex:place.beach', 'interior')).toThrow('LEXICON_RELATION_NOT_ALLOWED')
    expect(() => renderLexiconRelation(places, 'lex:place.bus_stop', 'interior')).toThrow('LEXICON_RELATION_NOT_ALLOWED')
  })

  it('derives same-surface metadata instead of authoring it in the registry', () => {
    expect(places.units.some((unit) => Object.hasOwn(unit.crosslingual || {}, 'same_surface'))).toBe(false)
    expect(places.units.filter(deriveSameSurface).map((unit) => unit.en).sort()).toEqual([
      'bar',
      'call center',
      'hospital',
      'hotel',
    ])
  })

  it('exposes Portuguese translation collisions only after rendering', () => {
    const point = renderLexiconRelation(places, 'lex:place.office', 'point')
    const interior = renderLexiconRelation(places, 'lex:place.office', 'interior')
    expect(point.en).not.toBe(interior.en)
    expect(point.pt).toBe(interior.pt)
  })

  it('keeps lexical stage on units and never authors projection-level stages', () => {
    for (const unit of places.units) {
      expect(unit.lexical_stage).toBeTruthy()
      expect(unit.projections).toBeUndefined()
      for (const override of Object.values(unit.surface_overrides || {})) {
        expect(override.stage).toBeUndefined()
      }
    }
  })
})
