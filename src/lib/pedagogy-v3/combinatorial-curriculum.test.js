import { describe, expect, it } from 'vitest'
import { loadPedagogyV2Registry, resolvePedagogyTarget } from '../pedagogy-v2/registry.js'
import { createCombinatorialCurriculumPackV3, loadCombinatorialCurriculumRegistryV3 } from './combinatorial-curriculum.js'
import { materializeV3ForPack } from './combinatorial-focus-adapter.js'

describe('V3 construction curriculum', () => {
  it('adds 48 resolved construction targets behind an opt-in without altering the V2 registry', () => {
    const baseline = loadPedagogyV2Registry()
    const registry = loadCombinatorialCurriculumRegistryV3()
    const pack = createCombinatorialCurriculumPackV3()
    expect(baseline.pack_ids).not.toContain(pack.manifest.pack_id)
    expect(pack.constructions).toHaveLength(48)
    expect(pack.exemplars).toHaveLength(48)
    expect(pack.lexemes).toHaveLength(0)
    for (const exemplar of pack.exemplars) {
      expect(resolvePedagogyTarget(exemplar.pedagogical_targets[0], registry)?.pack_id).toBe(pack.manifest.pack_id)
      expect(exemplar.naturalness_status).toBe('needs_review')
    }
    const supply = materializeV3ForPack(pack)
    expect(supply).toHaveLength(3072)
    for (const exemplar of supply) {
      expect(exemplar.pedagogical_targets[0].target_id).toBe(exemplar.construction_id)
      expect(exemplar.approval_status).toBe('provisional_nonhuman')
    }
  })
})
