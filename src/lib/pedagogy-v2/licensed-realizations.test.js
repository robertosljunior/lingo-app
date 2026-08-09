import { describe, expect, it } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import unlessPack from '../../content/pedagogy-v2/unless.json'
import { BUILTIN_PEDAGOGY_V2_PACKS } from '../../content/pedagogy-v2/index.js'
import { buildPedagogyV2Registry } from './registry.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import {
  LICENSED_TIER1_ELIGIBLE_RECIPES,
  stableSignatureHash,
} from './licensed-realization-contracts.js'
import {
  enumerateLicensedPilotCandidates,
  materializeLicensedRealizationsForPack,
} from './licensed-realizations.js'
import { validateLicensedRealizationsV2 } from './licensed-realization-validator.js'

const lane = {
  mastery_estimate: 0.9,
  evidence_level: 'established',
  assessed_evidence_count: 8,
  effective_evidence_weight: 8,
}

function advancedState(targetType, targetId) {
  return {
    target: { target_type: targetType, target_id: targetId },
    exposure: { count: 3 },
    capabilities: {
      reading_recognition: { overall: lane, supported: lane, independent: lane },
      writing_controlled_production: { overall: lane, supported: lane, independent: lane },
      speaking_controlled_production: { overall: lane, supported: lane, independent: lane },
    },
    capability_rollups: {
      recognition: { overall: lane, supported: lane, independent: lane },
      controlled_production: { overall: lane, supported: lane, independent: lane },
    },
    retention: {},
  }
}

const stillStates = [
  advancedState('construction', 'construction:still.subject_still_lexical_verb'),
  advancedState('sense', 'sense:still.continuity'),
]

function session(seed = 'v224') {
  return createLessonSessionV2({
    session_id: `sess:${seed}`,
    profile_id: 'p1',
    now: '2026-08-09T12:00:00.000Z',
    seed,
  })
}

describe('V2.24 licensed realization materializer', () => {
  it('keeps the clause-frame pilot out of the shipped builtin catalogue before human/economic approval', () => {
    expect(BUILTIN_PEDAGOGY_V2_PACKS.map((pack) => pack.manifest.pack_id)).toEqual([
      'pedagogy_v2_still',
      'pedagogy_v2_but',
      'pedagogy_v2_yet',
    ])
    expect(BUILTIN_PEDAGOGY_V2_PACKS.some((pack) => pack.manifest.pack_id === 'pedagogy_v2_unless')).toBe(false)
  })

  it('enumerates deterministically while runtime ships no provisional variant by default', () => {
    expect(enumerateLicensedPilotCandidates(stillPack)).toHaveLength(16)
    expect(enumerateLicensedPilotCandidates(unlessPack)).toHaveLength(12)
    expect(materializeLicensedRealizationsForPack(stillPack)).toEqual([])
    expect(materializeLicensedRealizationsForPack(unlessPack)).toEqual([])
  })

  it('materializes exactly 12 provisional pilot realizations per strategy for technical validation', () => {
    const still = materializeLicensedRealizationsForPack(stillPack, { allowProvisional: true })
    const unless = materializeLicensedRealizationsForPack(unlessPack, { allowProvisional: true })
    expect(still).toHaveLength(12)
    expect(unless).toHaveLength(12)
    for (const rows of [still, unless]) {
      expect(new Set(rows.map((x) => x.exemplar_id)).size).toBe(12)
      expect(new Set(rows.map((x) => x.text_en)).size).toBe(12)
      for (const row of rows) {
        expect(row.realization_id).toBe(row.exemplar_id)
        expect(row.intended_new_items).toEqual([])
        expect(row.context).toBeUndefined()
        expect(row.eligible_recipes).toEqual(LICENSED_TIER1_ELIGIBLE_RECIPES)
        expect(row.provenance.approval_status).toBe('provisional_nonhuman')
        expect(row.naturalness_status).toBe('needs_review')
      }
    }
  })

  it('keeps identities AND materialized content byte-stable for identical inputs/allow-list', () => {
    const a = materializeLicensedRealizationsForPack(stillPack, { allowProvisional: true })
    const b = materializeLicensedRealizationsForPack(stillPack, { allowProvisional: true })
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    expect(b.map((x) => x.exemplar_id)).toEqual(a.map((x) => x.exemplar_id))
    for (const row of a) expect(row.exemplar_id).toContain(stableSignatureHash(row.slot_signature))
  })

  it('passes the dedicated licensed-realization validator for both pilot packs', () => {
    for (const pack of [stillPack, unlessPack]) {
      const rows = materializeLicensedRealizationsForPack(pack, { allowProvisional: true })
      expect(validateLicensedRealizationsV2(pack, rows)).toEqual({ valid: true, errors: [], count: 12 })
    }
  })

  it('explicitly rejects a licensed variant that is placed into an introduction group', () => {
    const rows = materializeLicensedRealizationsForPack(stillPack, { allowProvisional: true })
    const invalid = [{ ...rows[0], introduction_group_id: 'introduction:forbidden' }, ...rows.slice(1)]
    const result = validateLicensedRealizationsV2(stillPack, invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.startsWith('LICENSED_INTRODUCTION_GROUP_FORBIDDEN:'))).toBe(true)
  })
})

describe('V2.24 lesson-engine boundary', () => {
  it('is baseline-off by default: no licensed candidates are materialized', () => {
    const d = selectNextActivityV2({
      session: session('off'),
      pack: stillPack,
      learnerStates: stillStates,
      focus: {
        target_id: 'construction:still.subject_still_lexical_verb',
        capability: 'controlled_production',
        modality: 'writing',
      },
    })
    expect(d.status).toBe('activity')
    expect((d.trace.candidates || []).some((c) => c.exemplar_id.startsWith('exemplar:licensed.'))).toBe(false)
  })

  it('filters tier-1 licensed variants per recipe with recipe_requires_context in trace', () => {
    const d = selectNextActivityV2({
      session: session('on'),
      pack: stillPack,
      learnerStates: stillStates,
      focus: {
        target_id: 'construction:still.subject_still_lexical_verb',
        capability: 'controlled_production',
        modality: 'writing',
      },
      licensedRealizations: { enabled: true, allow_provisional: true },
    })
    const licensedCandidates = (d.trace.candidates || []).filter((c) => c.exemplar_id.startsWith('exemplar:licensed.'))
    expect(new Set(licensedCandidates.map((c) => c.exemplar_id)).size).toBe(12)
    expect(new Set(licensedCandidates.map((c) => c.recipe))).toEqual(new Set(['word_order_reconstruction']))
    const excluded = (d.trace.excluded || []).filter((x) => x.exemplar_id.startsWith('exemplar:licensed.'))
    expect(excluded.some((x) => x.recipe === 'fixed_element_completion' && x.reason === 'recipe_requires_context')).toBe(true)
    expect(excluded.some((x) => x.recipe === 'guided_production' && x.reason === 'recipe_requires_context')).toBe(true)
    expect(d.trace.licensed_realizations.materialized).toBe(12)
  })

  it('derives scoped variants only from a parent already admitted by allowed_exemplar_ids', () => {
    const registry = buildPedagogyV2Registry([stillPack])
    const common = {
      session: session('scope'),
      learnerStates: stillStates,
      focus: {
        target_id: 'construction:still.subject_still_lexical_verb',
        capability: 'controlled_production',
        modality: 'writing',
      },
      licensedRealizations: { enabled: true, allow_provisional: true },
    }
    const admitted = selectNextActivityV2({
      ...common,
      scope: { registry, pack_id: 'pedagogy_v2_still', allowed_exemplar_ids: ['exemplar:still.002'] },
    })
    expect(admitted.trace.licensed_realizations.materialized).toBe(12)

    const excludedParent = selectNextActivityV2({
      ...common,
      scope: { registry, pack_id: 'pedagogy_v2_still', allowed_exemplar_ids: ['exemplar:still.003'] },
    })
    expect(excludedParent.trace.licensed_realizations.materialized).toBe(0)
  })
})
