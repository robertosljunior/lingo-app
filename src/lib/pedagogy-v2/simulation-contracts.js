// simulation-contracts.js — versioned contracts of the pedagogy V2 simulation
// harness (Slice V2.7). A SimulationScenarioV2 is a fully serializable,
// reproducible description of an artificial learner journey; a
// SimulationResultV2 is its deterministic output. Time and randomness are
// EXPLICIT: the scenario carries the start time, the clock strategy and the
// seed — the harness core never reads Date.now and never calls Math.random.
//
// The harness lives OUTSIDE the pedagogical algorithms: nothing here (or in the
// runner/personas/response model) is imported by the study planner, lesson
// engine, learner model or the real runtime.

import { STUDY_MODES } from './study-planner-contracts.js'
import { PERSONA_IDS } from './simulation-personas.js'

export const SIMULATION_SCENARIO_VERSION = 1
export const SIMULATION_RESULT_VERSION = 1

// Simulated-clock strategies (§6). All advance time as a pure function of the
// interaction index — never the wall clock.
export const CLOCK_STRATEGIES = ['constant_interval', 'accelerated_days', 'custom_schedule']

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Build the ISO timestamp of interaction `i` (0-based) under a clock config.
 *   constant_interval: { interval_minutes }         — i × interval
 *   accelerated_days:  { checkpoints: [[i, day], …] }— piecewise-linear day map
 *   custom_schedule:   { offsets_ms: [ms, …] }        — explicit per-interaction
 * Pure: depends only on start_at, the config and i.
 */
export function simulatedTimestamp(startAtMs, clock, i) {
  switch (clock?.strategy) {
    case 'constant_interval': {
      const interval = (clock.interval_minutes ?? 5) * 60 * 1000
      return new Date(startAtMs + i * interval).toISOString()
    }
    case 'accelerated_days': {
      // Piecewise-linear interpolation over [interaction → day] checkpoints
      // (sorted). Days are converted to ms offsets from start.
      const pts = [...(clock.checkpoints || [[0, 0]])].sort((a, b) => a[0] - b[0])
      let day
      if (i <= pts[0][0]) day = pts[0][1]
      else if (i >= pts[pts.length - 1][0]) day = pts[pts.length - 1][1]
      else {
        let a = pts[0]; let b = pts[pts.length - 1]
        for (let k = 0; k < pts.length - 1; k++) {
          if (i >= pts[k][0] && i <= pts[k + 1][0]) { a = pts[k]; b = pts[k + 1]; break }
        }
        const span = b[0] - a[0]
        day = span === 0 ? a[1] : a[1] + (b[1] - a[1]) * ((i - a[0]) / span)
      }
      return new Date(startAtMs + Math.round(day * DAY_MS)).toISOString()
    }
    case 'custom_schedule': {
      const offsets = clock.offsets_ms || []
      const off = i < offsets.length ? offsets[i] : (offsets[offsets.length - 1] ?? 0)
      return new Date(startAtMs + off).toISOString()
    }
    default:
      return new Date(startAtMs + i * 5 * 60 * 1000).toISOString()
  }
}

/** Convenience factory filling defaults; validation stays in the validator. */
export function createSimulationScenarioV2(fields) {
  return {
    scenario_version: SIMULATION_SCENARIO_VERSION,
    scenario_id: 'scenario:unnamed',
    profile_id: 'sim-profile',
    mode: 'adaptive',
    seed: 'seed',
    start_at: '2026-01-01T09:00:00.000Z',
    maximum_interactions: 50,
    clock: { strategy: 'constant_interval', interval_minutes: 5 },
    runtime_capabilities: { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false },
    persona: null,
    initial_evidence: [],
    policy_overrides: {},
    focused_pack_id: null,
    ...fields,
  }
}

/**
 * Validate a scenario. Same `CODE:detail` convention as the other V2
 * validators. Enforces: version, explicit seed, explicit time, known persona,
 * explicit (object) policy overrides, sane bounds.
 */
export function validateSimulationScenarioV2(scenario) {
  const errors = []
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)
  if (!scenario || typeof scenario !== 'object') return { valid: false, errors: ['SCENARIO_REQUIRED'] }

  if (scenario.scenario_version !== SIMULATION_SCENARIO_VERSION) err('SCENARIO_VERSION_INVALID', String(scenario.scenario_version))
  if (!scenario.scenario_id || typeof scenario.scenario_id !== 'string') err('SCENARIO_ID_REQUIRED')
  if (!scenario.profile_id || typeof scenario.profile_id !== 'string') err('PROFILE_ID_REQUIRED')
  if (!STUDY_MODES.includes(scenario.mode)) err('MODE_INVALID', String(scenario.mode))
  if (scenario.mode === 'focused' && !scenario.focused_pack_id) err('FOCUSED_PACK_REQUIRED')

  // Explicit seed (§3) — never defaulted to randomness.
  if (scenario.seed == null || (typeof scenario.seed !== 'string' && typeof scenario.seed !== 'number')) err('SEED_REQUIRED')

  // Explicit time (§3).
  if (typeof scenario.start_at !== 'string' || Number.isNaN(Date.parse(scenario.start_at))) err('START_AT_INVALID', String(scenario.start_at))
  if (!scenario.clock || !CLOCK_STRATEGIES.includes(scenario.clock.strategy)) err('CLOCK_STRATEGY_INVALID', String(scenario.clock?.strategy))

  if (!Number.isInteger(scenario.maximum_interactions) || scenario.maximum_interactions < 1) err('MAX_INTERACTIONS_INVALID', String(scenario.maximum_interactions))

  // Persona must be one of the known artificial personas.
  const personaId = typeof scenario.persona === 'string' ? scenario.persona : scenario.persona?.id
  if (!personaId || !PERSONA_IDS.includes(personaId)) err('PERSONA_INVALID', String(personaId))

  // Policy overrides must be an EXPLICIT object (never a silent side channel).
  if (scenario.policy_overrides != null && typeof scenario.policy_overrides !== 'object') err('POLICY_OVERRIDES_INVALID')
  if (scenario.runtime_capabilities != null && typeof scenario.runtime_capabilities !== 'object') err('RUNTIME_CAPABILITIES_INVALID')
  if (scenario.initial_evidence != null && !Array.isArray(scenario.initial_evidence)) err('INITIAL_EVIDENCE_INVALID')

  return { valid: errors.length === 0, errors }
}

/**
 * Canonical, deterministic serialization of a scenario: keys sorted recursively
 * so two structurally-equal scenarios serialize byte-identically (reproducible
 * output, §3).
 */
export function serializeScenarioV2(scenario) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === 'object') {
      const out = {}
      for (const k of Object.keys(v).sort()) out[k] = sort(v[k])
      return out
    }
    return v
  }
  return JSON.stringify(sort(scenario))
}
