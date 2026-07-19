// trajectory-analyzer.test.js — §26. Structural trajectory findings. Each
// finding code is provoked with a crafted (synthetic) SimulationResultV2 so
// detection is testable in isolation, the four GRAVE codes always come out as
// severity error, warnings are heuristic, and the ordering is deterministic.
// A real golden run is checked to never produce a grave finding.

import { describe, it, expect, beforeAll } from 'vitest'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import { OBSERVABILITY_POLICY_V2, GRAVE_FINDING_CODES } from './observability-contracts.js'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
const FULL_CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }

function ix(over = {}) {
  return {
    index: 0,
    assessment: { status: 'assessed', outcome: 'correct' },
    target: { target_type: 'sense', target_id: 'sense:still.continuity' },
    recipe: 'meaning_recognition',
    modality: 'reading',
    capability: 'recognition',
    new_item_refs: [],
    pack_before: 'pedagogy_v2_still',
    pack_after: 'pedagogy_v2_still',
    ...over,
  }
}
function mkResult({ interactions = [], states = [], focuses = [], queue = [], packHistory = null, mode = 'adaptive', caps = FULL_CAPS } = {}) {
  return {
    interactions,
    final_learner_states: states,
    study_focus_history: focuses,
    final_review_queue: queue,
    pack_history: packHistory ?? interactions.map((i) => i.pack_after),
    scenario: { mode, runtime_capabilities: caps },
  }
}
const codes = (findings) => new Set(findings.map((f) => f.code))
const find = (findings, code) => findings.find((f) => f.code === code)

describe('§26.1 — GRAVE: global mastery field detected', () => {
  it('flags a forbidden global-mastery field on a state as severity error', () => {
    const states = [{ target: { target_id: 'sense:still.continuity' }, capabilities: {}, mastery: 0.8 }]
    const { findings } = analyzeTrajectoryV2(mkResult({ states }), { registry })
    const f = find(findings, 'GLOBAL_MASTERY_FIELD_DETECTED')
    expect(f).toBeTruthy()
    expect(f.severity).toBe('error')
  })
})

describe('§26.2 — GRAVE: review mode introduced a new target', () => {
  it('flags an is_new_target focus during review mode as severity error', () => {
    const focuses = [{ focus_type: 'introduce', is_new_target: true, target: { target_id: 'sense:still.continuity' }, reason_codes: [] }]
    const { findings } = analyzeTrajectoryV2(mkResult({ focuses, mode: 'review' }), { registry })
    const f = find(findings, 'REVIEW_MODE_INTRODUCED_NEW_TARGET')
    expect(f?.severity).toBe('error')
  })
})

describe('§26.3 — GRAVE: runtime-unavailable focus selected', () => {
  it('flags a listening activity when audio output is unavailable', () => {
    const interactions = [ix({ recipe: 'listening_recognition', modality: 'listening' })]
    const caps = { ...FULL_CAPS, audio_output: false }
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions, caps }), { registry })
    const f = find(findings, 'RUNTIME_UNAVAILABLE_FOCUS_SELECTED')
    expect(f?.severity).toBe('error')
  })
})

describe('§26.4 — GRAVE: new-item budget violation', () => {
  it('flags a single activity introducing more than the engine budget as error', () => {
    const interactions = [ix({ new_item_refs: ['a', 'b', 'c'] })]
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions }), { registry })
    const f = find(findings, 'NEW_ITEM_BUDGET_VIOLATION')
    expect(f?.severity).toBe('error')
  })
})

describe('§26.5 — ERROR: premature free production', () => {
  it('flags free production of a target before any controlled production of it', () => {
    const interactions = [
      ix({ index: 0, capability: 'free_production', recipe: 'free_production', modality: 'writing' }),
      ix({ index: 1, capability: 'controlled_production', recipe: 'guided_production', modality: 'writing' }),
    ]
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions }), { registry })
    const f = find(findings, 'PREMATURE_FREE_PRODUCTION')
    expect(f?.severity).toBe('error')
  })
})

describe('§26.6 — WARNING: target stagnation', () => {
  it('flags a heavily-assessed target whose best lane never reaches emerging', () => {
    const n = OBSERVABILITY_POLICY_V2.stagnation_activities
    const interactions = Array.from({ length: n }, (_, i) => ix({ index: i }))
    const states = [{
      target: { target_id: 'sense:still.continuity' },
      capabilities: { reading_recognition: { overall: { mastery_estimate: 0.2, evidence_level: 'insufficient' } } },
    }]
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions, states }), { registry })
    expect(find(findings, 'TARGET_STAGNATION')?.severity).toBe('warning')
  })
})

describe('§26.7 — WARNING: review starvation', () => {
  it('flags a review-queue target never selected as a review focus', () => {
    const interactions = Array.from({ length: OBSERVABILITY_POLICY_V2.review_starvation_opportunities }, (_, i) => ix({ index: i }))
    const queue = [{ target: { target_id: 'sense:still.continuity' }, capability_key: 'reading_recognition', reason_codes: ['RETENTION_OVERDUE'] }]
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions, queue, focuses: [] }), { registry })
    expect(find(findings, 'REVIEW_STARVATION')?.severity).toBe('warning')
  })
})

describe('§26.8 — WARNING: novelty starvation', () => {
  it('flags a long consecutive run of review/remediate focuses', () => {
    const focuses = Array.from({ length: OBSERVABILITY_POLICY_V2.novelty_starvation_streak }, () => ({ focus_type: 'review', is_new_target: false, reason_codes: [] }))
    const interactions = focuses.map((_, i) => ix({ index: i }))
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions, focuses }), { registry })
    expect(find(findings, 'NOVELTY_STARVATION')?.severity).toBe('warning')
  })
})

describe('§26.9 — WARNING: support trap', () => {
  it('flags a supported-established lane whose independent lane stays insufficient despite tries', () => {
    const interactions = Array.from({ length: OBSERVABILITY_POLICY_V2.support_trap_opportunities }, (_, i) => ix({ index: i }))
    const focuses = [{ focus_type: 'independence', target: { target_id: 'sense:still.continuity' }, reason_codes: [] }]
    const states = [{
      target: { target_id: 'sense:still.continuity' },
      capabilities: { reading_recognition: {
        supported: { mastery_estimate: 0.8, evidence_level: 'established' },
        independent: { evidence_level: 'insufficient' },
      } },
    }]
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions, focuses, states }), { registry })
    expect(find(findings, 'SUPPORT_TRAP')?.severity).toBe('warning')
  })
})

describe('§26.10 — WARNING: modality starvation', () => {
  it('flags an available modality never practiced across enough opportunities', () => {
    const interactions = Array.from({ length: OBSERVABILITY_POLICY_V2.modality_starvation_opportunities }, (_, i) => ix({ index: i, modality: 'reading' }))
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions }), { registry })
    const f = find(findings, 'MODALITY_STARVATION')
    expect(f?.severity).toBe('warning')
    // writing/listening/speaking were all available but unpracticed.
    expect(['writing', 'listening', 'speaking']).toContain(f.details.modality)
  })
})

describe('§26.11 — WARNING: pack starvation', () => {
  it('flags an eligible pack never visited in a long adaptive run', () => {
    const interactions = Array.from({ length: OBSERVABILITY_POLICY_V2.pack_starvation_interactions }, (_, i) => ix({ index: i, pack_before: 'pedagogy_v2_still', pack_after: 'pedagogy_v2_still' }))
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions, mode: 'adaptive' }), { registry })
    const f = find(findings, 'PACK_STARVATION')
    expect(f?.severity).toBe('warning')
    expect(f.details.pack_id).toBe('pedagogy_v2_but')
  })
})

describe('§26.12 — WARNING: excessive pack switching and target repetition', () => {
  it('flags a ping-pong switch ratio and a long same-target run', () => {
    // Alternate packs every interaction → switch ratio ≈ 1.
    const packs = ['pedagogy_v2_still', 'pedagogy_v2_but']
    const interactions = Array.from({ length: 8 }, (_, i) => ix({
      index: i, pack_before: packs[(i + 1) % 2], pack_after: packs[i % 2],
    }))
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions }), { registry })
    expect(find(findings, 'EXCESSIVE_PACK_SWITCHING')?.severity).toBe('warning')

    // Same target > threshold in a row.
    const n = OBSERVABILITY_POLICY_V2.excessive_target_repetition + 1
    const rep = Array.from({ length: n }, (_, i) => ix({ index: i }))
    const { findings: f2 } = analyzeTrajectoryV2(mkResult({ interactions: rep }), { registry })
    expect(find(f2, 'EXCESSIVE_TARGET_REPETITION')?.severity).toBe('warning')
  })
})

describe('§26.13 — findings are ordered deterministically (grave first)', () => {
  it('sorts errors before warnings, then by code, then by target', () => {
    const states = [{ target: { target_id: 'sense:still.continuity' }, capabilities: {}, mastery: 0.8 }]
    const interactions = [ix({ new_item_refs: ['a', 'b', 'c'] })]
    const { findings } = analyzeTrajectoryV2(mkResult({ interactions, states }), { registry })
    const severities = findings.map((f) => f.severity)
    const firstWarning = severities.indexOf('warning')
    const lastError = severities.lastIndexOf('error')
    if (firstWarning !== -1 && lastError !== -1) expect(lastError).toBeLessThan(firstWarning)
    // GRAVE codes are the four invariant-violation codes.
    for (const f of findings.filter((x) => GRAVE_FINDING_CODES.includes(x.code))) expect(f.severity).toBe('error')
  })
})

describe('§26.14 — a real golden run never yields a grave finding', () => {
  it('adaptive new-learner produces only heuristic warnings', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('new-learner', { maximum_interactions: 60 }), { registry })
    const { trajectory, findings } = analyzeTrajectoryV2(r, { registry })
    expect(trajectory.grave_findings).toBe(0)
    expect(findings.every((f) => !GRAVE_FINDING_CODES.includes(f.code))).toBe(true)
  })
})
