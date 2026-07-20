// training-domain-reachability.test.js — §29 + §32 tests 30–31 (Slice V2.9).
// The static reachability audit: with the full runtime every trainable domain
// is reachable, restricted runtimes make modality domains CONDITIONAL (never
// absolutely unreachable), and a trainable domain with no candidate path is
// detected — the structural detector for the writing=0 class of bug.

import { describe, it, expect } from 'vitest'
import { auditTrainingDomainReachabilityV2, REACHABILITY_WARNING_CODES } from './training-domain-reachability.js'
import { LESSON_RECIPES } from './lesson-engine-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'

const FULL_CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const avail = (caps) => computeRecipeRuntimeAvailability(caps)
const domain = (audit, capability, modality) => audit.domains.find((d) => d.capability === capability && d.modality === modality)

describe('§29 — with the full runtime every trainable domain is reachable', () => {
  const audit = auditTrainingDomainReachabilityV2({ runtimeAvailability: avail(FULL_CAPS) })

  it.each([
    ['recognition', 'reading'], ['recognition', 'listening'],
    ['controlled_production', 'writing'], ['controlled_production', 'speaking'],
    ['free_production', 'writing'], ['free_production', 'speaking'],
  ])('%s/%s is reachable', (capability, modality) => {
    const d = domain(audit, capability, modality)
    expect(d.reachable).toBe(true)
    expect(d.status).toBe('reachable')
    expect(d.has_candidate_path).toBe(true)
    expect(d.has_engine_path).toBe(true)
    expect(d.has_assessment_path).toBe(true)
  })

  it('pronunciation stays CONDITIONAL while the acoustic assessor is false — not unreachable', () => {
    const d = domain(audit, 'pronunciation', 'speaking')
    expect(d.status).toBe('conditional')
    expect(d.has_candidate_path).toBe(true)
  })

  it('no reachability warnings with the current recipes + planner', () => {
    expect(audit.warnings).toEqual([])
  })
})

describe('§29 — restricted runtimes mark domains conditional, never unreachable', () => {
  it('no audio output → listening domains conditional', () => {
    const audit = auditTrainingDomainReachabilityV2({ runtimeAvailability: avail({ ...FULL_CAPS, audio_output: false }) })
    expect(domain(audit, 'recognition', 'listening').status).toBe('conditional')
    expect(domain(audit, 'recognition', 'reading').status).toBe('reachable')
  })
  it('no speech input → speaking domains conditional', () => {
    const audit = auditTrainingDomainReachabilityV2({ runtimeAvailability: avail({ ...FULL_CAPS, speech_input: false }) })
    expect(domain(audit, 'controlled_production', 'speaking').status).toBe('conditional')
    expect(domain(audit, 'free_production', 'speaking').status).toBe('conditional')
    expect(domain(audit, 'controlled_production', 'writing').status).toBe('reachable')
  })
})

describe('§32.31 — orphan-domain detection (the writing=0 class of bug)', () => {
  it('a trainable domain with no candidate path raises TRAINABLE_DOMAIN_WITHOUT_CANDIDATE_PATH', () => {
    // A hypothetical capability OUTSIDE the ladder with a single modality: no
    // ladder entry, no sibling gap path, not recognition → orphan.
    const recipes = [...LESSON_RECIPES, {
      recipe: 'interaction_drill', activity_kind: 'free_production',
      pairs: [['interaction', 'speaking']],
      variants: [{ lane: 'independent', features: [] }],
      needs_options: false, attribution_rule: 'assessed_only', response_type: 'produced_text',
    }]
    const audit = auditTrainingDomainReachabilityV2({ recipes })
    const d = domain(audit, 'interaction', 'speaking')
    expect(d.has_affordance).toBe(true)
    expect(d.has_candidate_path).toBe(false)
    expect(d.status).toBe('unreachable')
    expect(audit.warnings).toContainEqual({ code: 'TRAINABLE_DOMAIN_WITHOUT_CANDIDATE_PATH', capability: 'interaction', modality: 'speaking' })
    expect(REACHABILITY_WARNING_CODES).toContain('TRAINABLE_DOMAIN_WITHOUT_CANDIDATE_PATH')
  })

  it('the audit is deterministic', () => {
    const a = auditTrainingDomainReachabilityV2({})
    const b = auditTrainingDomainReachabilityV2({})
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
