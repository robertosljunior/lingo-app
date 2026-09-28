import { describe, expect, it } from 'vitest'
import { loadPedagogyV2Registry, resolvePedagogyTarget } from '../pedagogy-v2/registry.js'
import { createCombinatorialCurriculumPackV3, loadCombinatorialCurriculumRegistryV3 } from './combinatorial-curriculum.js'
import { materializeV3ForPack } from './combinatorial-focus-adapter.js'
import { selectNextStudyFocusV2 } from '../pedagogy-v2/study-planner.js'
import { createStudySessionV2 } from '../pedagogy-v2/study-planner-contracts.js'

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
  it('offers an unseen, executable grammar focus to the real planner only with V3 enabled', () => {
    const args = {
      registry: loadCombinatorialCurriculumRegistryV3(), learnerStates: [], recentEvidence: [],
      studySession: createStudySessionV2({ study_session_id: 'v3-priority', mode: 'adaptive', now: '2026-09-27T12:00:00Z' }),
    }
    const baseline = selectNextStudyFocusV2(args)
    const enabled = selectNextStudyFocusV2({ ...args, combinatorialSupplyV3: { enabled: true, strict_unseen: true } })
    expect(enabled.focus.pack_id).toBe('pedagogy_v3_constructions')
    expect(enabled.trace.candidates.find(c => c.key === enabled.trace.selected_key).fresh_supply_opportunity).toBe(true)
    expect(baseline.trace.candidates.some(c => c.fresh_supply_opportunity)).toBe(false)
  })
})
