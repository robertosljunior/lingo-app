// simulation-runner.test.js — §30. Integration of the harness core with the
// REAL pipeline: planner → focus → engine → simulated response → assessment →
// evidence adapter → learner model → next context. The runner owns only the
// in-memory evidence store and the simulated clock; it enforces the §11
// invariants and halts on any breach.

import { describe, it, expect, beforeAll } from 'vitest'
import { runSimulationV2, SimulationInvariantError } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { createSimulationScenarioV2 } from './simulation-contracts.js'
import { SIMULATION_INVARIANT_CODES } from './observability-contracts.js'
import { validateLearnerEvidenceV2 } from './learner-evidence-validator.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
let result

beforeAll(async () => {
  result = await runSimulationV2(buildStandardScenarioV2('new-learner', { maximum_interactions: 60 }), { registry })
})

describe('§30.1 — the run threads REAL learner evidence', () => {
  it('every generated evidence event validates against the V2 evidence contract', () => {
    expect(result.evidence_generated.length).toBeGreaterThan(0)
    for (const e of result.evidence_generated) {
      expect(validateLearnerEvidenceV2(e).valid).toBe(true)
      expect(e.profile_id).toBe('sim-profile')
    }
  })
})

describe('§30.2 — assessment is real and outcome follows the recipe', () => {
  it('exposure never yields an assessed/mastery-moving outcome; recognition does', () => {
    for (const it of result.interactions) {
      if (it.recipe === 'exposure') {
        expect(it.assessment.status).not.toBe('assessed')
      }
    }
    const recog = result.interactions.filter((it) => it.recipe === 'meaning_recognition' || it.recipe === 'listening_recognition')
    expect(recog.length).toBeGreaterThan(0)
    expect(recog.every((it) => it.assessment.status === 'assessed')).toBe(true)
  })
})

describe('§30.3 — StudySession and LessonSession never collapse', () => {
  it('evidence ids are namespaced by per-pack lesson sessions and stay unique', () => {
    const ids = result.evidence_generated.map((e) => e.evidence_id)
    expect(new Set(ids).size).toBe(ids.length) // EVIDENCE_IDS_UNIQUE
    // The runner mints deterministic per-pack lesson session ids.
    expect(result.evidence_generated.some((e) => String(e.session_id).startsWith('sim-lesson:'))).toBe(true)
  })
})

describe('§30.4 — interaction ids are deterministic across runs', () => {
  it('a re-run reproduces the exact evidence and interaction id sequence', async () => {
    const again = await runSimulationV2(buildStandardScenarioV2('new-learner', { maximum_interactions: 60 }), { registry })
    expect(again.evidence_generated.map((e) => e.interaction_id)).toEqual(result.evidence_generated.map((e) => e.interaction_id))
  })
})

describe('§30.5 — the new-item budget holds end to end', () => {
  it('no single activity introduces more than the engine budget', () => {
    for (const it of result.interactions) expect(it.new_item_refs.length).toBeLessThanOrEqual(2)
  })
})

describe('§30.6 — the focus is re-evaluated every interaction (no fixed playlist)', () => {
  it('each interaction carries a planner trace that considered candidates', () => {
    for (const it of result.interactions) {
      expect(it.planner_trace).toBeTruthy()
      expect(it.planner_trace.considered).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('§30.7 — review mode upholds invariant 1 (no new target)', () => {
  it('a cold-start review journey never introduces a new target', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('new-learner', { mode: 'review', maximum_interactions: 30 }), { registry })
    for (const f of r.study_focus_history) expect(f.is_new_target).toBe(false)
  })
})

describe('§30.8 — invalid scenarios are rejected and the error type is explicit', () => {
  it('runSimulationV2 throws on an invalid scenario', async () => {
    const bad = createSimulationScenarioV2({ scenario_id: 'bad', persona: 'nobody', seed: null })
    await expect(runSimulationV2(bad, { registry })).rejects.toThrow(/SIMULATION_SCENARIO_INVALID/)
  })

  it('SimulationInvariantError carries the code and interaction index; the runner records the full invariant set', () => {
    const err = new SimulationInvariantError('EVIDENCE_IDS_UNIQUE', 7, { evidence_id: 'x' })
    expect(err.name).toBe('SimulationInvariantError')
    expect(err.code).toBe('EVIDENCE_IDS_UNIQUE')
    expect(err.interaction_index).toBe(7)
    expect(result.invariants.checked).toEqual([...SIMULATION_INVARIANT_CODES])
    expect(result.invariants.violations).toEqual([])
  })
})
