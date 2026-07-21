// playground-support.test.js — the pure Playground support helpers (§12, §13,
// §27–31): pack target enumeration and the isolated in-memory learner-state
// synthesis that makes a requested (capability, modality) domain materializable
// WITHOUT touching the real learner model.

import { describe, it, expect } from 'vitest'
import { loadPedagogyV2Registry, getPedagogyPack } from './registry.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import {
  packReferencedTargetsV2, prerequisiteKeysForFocusV2, synthesizeIsolatedStatesV2,
} from './playground-support.js'

const registry = loadPedagogyV2Registry()
const NOW = '2026-07-21T10:00:00.000Z'

function packWithConstructions() {
  return registry.packs.find((p) => (p.constructions || []).length && (p.senses || []).length)
}

describe('§12 — pack target enumeration', () => {
  it('lists senses, constructions and the lexeme-usage target of a pack', () => {
    const pack = packWithConstructions()
    const targets = packReferencedTargetsV2(pack)
    expect(targets.some((t) => t.target_type === 'sense')).toBe(true)
    expect(targets.some((t) => t.target_type === 'construction')).toBe(true)
    expect(targets.some((t) => t.target_type === 'lexeme_usage' && t.target_id === pack.manifest.primary_lexeme_id)).toBe(true)
    for (const t of targets) expect(typeof t.label).toBe('string')
  })

  it('an introduction focus warms nothing (exposure stays materializable)', () => {
    expect(prerequisiteKeysForFocusV2(null, null)).toEqual({ warmExposure: false, keys: [] })
  })

  it('production focuses warm the recognition/controlled rungs below them', () => {
    expect(prerequisiteKeysForFocusV2('controlled_production', 'writing').keys).toContain('reading_recognition')
    expect(prerequisiteKeysForFocusV2('free_production', 'writing').keys).toContain('writing_controlled_production')
  })
})

// §13/§27–31 — the isolated synthesis makes real authored activities without
// reading or writing the learner model; combinations with content materialize,
// impossible ones surface a structural reason (no fabricated sentence).
describe('§13/§27–31 — isolated materialization', () => {
  const pack = packWithConstructions()
  const target = pack.constructions[0].construction_id

  function materialize(capability, modality, targetId = target) {
    const { states, evidence } = synthesizeIsolatedStatesV2({
      registry, pack, capability, modality,
      externalPrerequisiteTargets: [],
    })
    const session = createLessonSessionV2({ session_id: `t-${capability}-${modality}`, now: NOW })
    const focus = capability ? { target_id: targetId, capability, modality } : { target_id: targetId }
    return selectNextActivityV2({
      session,
      scope: { registry, pack_id: pack.manifest.pack_id, lexeme_id: pack.manifest.primary_lexeme_id },
      learnerStates: states, recentEvidence: evidence, focus,
    })
  }

  it('recognition/reading materializes a real authored recognition activity', () => {
    const d = materialize('recognition', 'reading')
    expect(d.status).toBe('activity')
    expect(d.plan.recipe).toBe('meaning_recognition')
    // the exemplar is authored content, never generated
    expect(d.plan.exemplar_id).toBeTruthy()
    expect(d.plan.text_en).toBeTruthy()
  })

  it('controlled_production/writing materializes a real production activity', () => {
    const d = materialize('controlled_production', 'writing')
    expect(d.status).toBe('activity')
    expect(['fixed_element_completion', 'guided_production', 'word_order_reconstruction']).toContain(d.plan.recipe)
  })

  it('an introduction focus materializes an exposure activity', () => {
    const d = materialize(null, null)
    expect(d.status).toBe('activity')
    expect(d.plan.recipe).toBe('exposure')
  })

  it('a target the pack does not reference yields no eligible activity (structural, no fabrication)', () => {
    const d = materialize('recognition', 'reading', 'construction:does_not_exist')
    expect(d.status).not.toBe('activity')
    expect(d.plan).toBeNull()
  })

  it('synthesis never returns real profile data — evidence is sourced as playground_isolated', () => {
    const { evidence } = synthesizeIsolatedStatesV2({ registry, pack, capability: 'controlled_production', modality: 'writing', externalPrerequisiteTargets: [] })
    expect(evidence.length).toBeGreaterThan(0)
    for (const e of evidence) {
      expect(e.source.source_type).toBe('playground_isolated')
      expect(e.profile_id).toBe('playground-isolated')
    }
  })
})
