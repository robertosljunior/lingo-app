// learner-inspector.test.js — §29. The read-only learner inspector: per-target
// and per-lexeme views, review needs in human language, planner eligibility, a
// full snapshot, deterministic (template-only, never an LLM) explainability,
// opt-in in-memory telemetry, and the privacy-safe observability export.

import { describe, it, expect, beforeAll } from 'vitest'
import {
  inspectTargetV2, inspectLexemeV2, inspectReviewNeedsV2, inspectPlannerEligibilityV2,
  buildLearnerInspectorSnapshotV2, explainStudyFocusV2, createTelemetryCollectorV2, buildObservabilityExportV2,
  independenceAvailabilityV2,
} from './learner-inspector.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
let states
let evidence
let now

beforeAll(async () => {
  const r = await runSimulationV2(buildStandardScenarioV2('new-learner', { maximum_interactions: 60 }), { registry })
  states = r.final_learner_states
  evidence = r.evidence_generated
  now = r.interactions[r.interactions.length - 1].timestamp
})

describe('§29.1 — inspectTargetV2 reads lanes and resolves ownership', () => {
  it('returns per-capability lanes and the owning pack for a real target', () => {
    const s = states.find((x) => Object.keys(x.capabilities || {}).length > 0)
    const view = inspectTargetV2(s.target.target_id, { learnerStates: states, registry })
    expect(view.resolved).toBe(true)
    expect(view.owner_pack_id).toMatch(/^pedagogy_v2_/)
    const cap = Object.values(view.capabilities)[0]
    expect(cap.overall).toHaveProperty('evidence_level')
    // No global mastery — only per-lane estimates.
    expect(view).not.toHaveProperty('mastery')
  })
})

describe('§29.2 — inspectTargetV2 is safe for an unknown target', () => {
  it('reports resolved:false with an empty exposure, no throw', () => {
    const view = inspectTargetV2('sense:ghost.nothing', { learnerStates: states, registry })
    expect(view.resolved).toBe(false)
    expect(view.exposure).toEqual({ count: 0 })
  })
})

describe('§29.3 — inspectLexemeV2 reports encountered facts, never a %', () => {
  it('lists encountered senses/constructions and a facts object', () => {
    const view = inspectLexemeV2('lexeme:still', { learnerStates: states, registry })
    expect(view.pack_id).toBe('pedagogy_v2_still')
    expect(Array.isArray(view.senses_encountered)).toBe(true)
    expect(view.facts).toBeTruthy()
    expect(view).not.toHaveProperty('mastery')
  })

  it('returns null for a lexeme with no pack', () => {
    expect(inspectLexemeV2('lexeme:missing', { learnerStates: states, registry })).toBeNull()
  })
})

describe('§29.4 — inspectReviewNeedsV2 speaks human Portuguese reasons', () => {
  it('maps each queued item to a capability label and a human reason', () => {
    const needs = inspectReviewNeedsV2({ registry, learnerStates: states, recentEvidence: evidence, now })
    for (const item of needs) {
      expect(typeof item.capability_label).toBe('string')
      expect(typeof item.human_reason).toBe('string')
      expect(item.human_reason.length).toBeGreaterThan(0)
    }
  })
})

describe('§29.5 — inspectPlannerEligibilityV2 explains the current decision', () => {
  it('reports candidate count, the selected focus and the trace', () => {
    const elig = inspectPlannerEligibilityV2({ registry, learnerStates: states, recentEvidence: evidence, now, mode: 'adaptive' })
    expect(typeof elig.candidate_count).toBe('number')
    expect(['focus', 'complete']).toContain(elig.status)
    expect(Array.isArray(elig.candidates)).toBe(true)
  })
})

describe('§29.6 — buildLearnerInspectorSnapshotV2 assembles the full view', () => {
  it('includes lexemes, targets, review queue, planner and recent evidence', () => {
    const snap = buildLearnerInspectorSnapshotV2({ registry, learnerStates: states, recentEvidence: evidence, now, mode: 'adaptive' })
    expect(snap.snapshot_version).toBe(1)
    expect(snap.lexemes.length).toBe(registry.packs.length)
    expect(snap.targets.length).toBe(states.length)
    expect(snap.planner).toBeTruthy()
    // recent_evidence carries only metadata — never learner free-text answers.
    for (const e of snap.recent_evidence) {
      expect(e).not.toHaveProperty('text')
      expect(e).not.toHaveProperty('transcript')
    }
  })
})

describe('§29.7 — explainStudyFocusV2 is deterministic and template-only', () => {
  it('produces a stable headline and template reasons for a focus', () => {
    const focus = {
      focus_type: 'independence', pack_id: 'pedagogy_v2_still', lexeme_id: 'lexeme:still',
      target: { target_type: 'sense', target_id: 'sense:still.continuity' },
      capability: 'recognition', modality: 'reading', is_new_target: false,
      reason_codes: ['SUPPORTED_WITHOUT_INDEPENDENT'],
    }
    const a = explainStudyFocusV2(focus, { learnerStates: states, registry })
    const b = explainStudyFocusV2(focus, { learnerStates: states, registry })
    expect(a).toEqual(b) // deterministic — no LLM, no randomness
    expect(a.headline).toContain('sem apoio')
    expect(a.reasons).toContain('Você foi bem com apoio; agora sem ajuda.')
  })

  it('handles a null focus without throwing', () => {
    expect(explainStudyFocusV2(null)).toEqual({ headline: 'Nenhum foco selecionado.', reasons: [], evidence: [] })
  })
})

describe('§29.8 — telemetry is opt-in and in-memory only', () => {
  it('records nothing while disabled, records after enable, rejects bad types', () => {
    const t = createTelemetryCollectorV2({ enabled: false })
    t.record('STUDY_FOCUS_SELECTED', { a: 1 })
    expect(t.events).toHaveLength(0)
    t.enable()
    t.record('STUDY_FOCUS_SELECTED', { a: 1 })
    expect(t.events).toHaveLength(1)
    expect(() => t.record('NOT_A_REAL_EVENT')).toThrow(/TELEMETRY_EVENT_TYPE_INVALID/)
    expect(t.export()).toEqual({ telemetry_version: 1, events: [{ type: 'STUDY_FOCUS_SELECTED', payload: { a: 1 } }] })
  })
})

describe('§29.10 (Slice V2.8, test 32) — the inspector explains independence AVAILABILITY, not learner deficit', () => {
  const RT = computeRecipeRuntimeAvailability({ text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false })

  it('recognition independence is reported unavailable with a structural reason', () => {
    const a = independenceAvailabilityV2('recognition', 'reading', { runtimeAvailability: RT })
    expect(a.available).toBe(false)
    expect(a.reason).toBe('no_independent_recipe')
    // It is framed as an instrument property — never "the learner has not mastered".
    expect(a.learner_message).toBe('Ainda não é medido por este tipo de atividade.')
    expect(a.learner_message).not.toMatch(/aluno|não domina|deficit/i)
  })

  it('controlled_production/writing independence is reported available', () => {
    const a = independenceAvailabilityV2('controlled_production', 'writing', { runtimeAvailability: RT })
    expect(a.available).toBe(true)
    expect(a.reason).toBeNull()
  })

  it('per-target capability views carry the independence_availability annotation', () => {
    const s = states.find((x) => Object.keys(x.capabilities || {}).length > 0)
    const view = inspectTargetV2(s.target.target_id, { learnerStates: states, registry, runtimeAvailability: RT })
    const cap = Object.values(view.capabilities)[0]
    expect(cap.independence_availability).toBeTruthy()
    expect(typeof cap.independence_availability.available).toBe('boolean')
  })
})

describe('§29.11 (Slice V2.8, test 33) — explainability exposes the internal diagnostic reason', () => {
  it('recognition independence carries INDEPENDENCE_NOT_MEASURABLE_WITH_CURRENT_RECIPES as an internal diagnostic only', () => {
    const a = independenceAvailabilityV2('recognition', 'reading', {})
    expect(a.diagnostic).toBe('INDEPENDENCE_NOT_MEASURABLE_WITH_CURRENT_RECIPES')
    // The diagnostic is internal — the learner-facing message never leaks the code.
    expect(a.learner_message).not.toContain('INDEPENDENCE_NOT_MEASURABLE')
  })

  it('a domain with an executable independent recipe carries no diagnostic', () => {
    const a = independenceAvailabilityV2('controlled_production', 'writing', {})
    expect(a.diagnostic).toBeNull()
  })
})

describe('§29.9 — the observability export is privacy-safe by construction', () => {
  it('omits profile_id by default and only lists telemetry event types', () => {
    const t = createTelemetryCollectorV2({ enabled: true })
    t.record('PACK_SWITCHED', { from: 'x' })
    const out = buildObservabilityExportV2({
      metrics: null, trajectory: null, findings: [], telemetry: t.export(),
      policyVersions: { observability_policy: 1 }, registryVersion: registry.registry_version,
      profileId: 'p-secret',
    })
    expect(out).not.toHaveProperty('profile_id')
    expect(out.telemetry.event_types).toEqual(['PACK_SWITCHED'])
    // The export shape has no field for raw learner text/voice.
    expect(JSON.stringify(out)).not.toContain('p-secret')
  })

  it('includes profile_id only when explicitly requested', () => {
    const out = buildObservabilityExportV2({ includeProfileId: true, profileId: 'p1' })
    expect(out.profile_id).toBe('p1')
  })
})
