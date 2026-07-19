// simulation-scenarios.js — the standard named scenarios shared by the golden
// tests and the CLI (Slice V2.7). Each maps a persona to a deterministic
// SimulationScenarioV2 (clock, interactions, seeded initial evidence). Pure and
// serializable; nothing here touches the real runtime.

import { createSimulationScenarioV2 } from './simulation-contracts.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'

const T0 = '2026-01-05T09:00:00.000Z'

// Deterministic assessed recognition evidence that establishes a target in both
// modalities (3 correct each) — used to pre-seed cross-pack prerequisites.
function establishedRecognitionEvidence(profileId, targets, { startAt = '2025-12-01T09:00:00.000Z' } = {}) {
  const events = []
  let seq = 0
  const base = Date.parse(startAt)
  for (const target of targets) {
    for (const modality of ['reading', 'listening']) {
      for (let k = 0; k < 3; k++) {
        seq += 1
        events.push(buildLearnerEvidenceV2({
          evidence_id: `evidence:seed.${target.target_id}.${modality}.${k}`,
          profile_id: profileId,
          interaction_id: `interaction:seed.${target.target_id}.${modality}.${k}`,
          session_id: 'seed',
          target: { target_type: target.target_type, target_id: target.target_id },
          exemplar_id: null,
          activity: { activity_kind: modality === 'listening' ? 'listening_recognition' : 'meaning_recognition', capability: 'recognition', modality },
          attribution: 'direct',
          outcome: 'correct',
          occurred_at: new Date(base + seq * 60000).toISOString(),
          source: { source_type: 'test' },
        }))
      }
    }
  }
  return events
}

const CROSS_PACK_SEED = (profileId) => establishedRecognitionEvidence(profileId, [
  { target_type: 'sense', target_id: 'sense:but.contrast' },
  { target_type: 'construction', target_id: 'construction:but.clause_but_clause' },
  { target_type: 'sense', target_id: 'sense:still.continuity' },
  { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' },
  { target_type: 'construction', target_id: 'construction:still.subject_be_still_complement' },
])

// id → factory(overrides) → SimulationScenarioV2
const CATALOG = {
  'new-learner': (o) => createSimulationScenarioV2({
    scenario_id: 'golden:new-learner', persona: 'new-learner', mode: 'adaptive', seed: 'golden-new',
    start_at: T0, maximum_interactions: 100, clock: { strategy: 'constant_interval', interval_minutes: 5 }, ...o,
  }),
  'weak-listener': (o) => createSimulationScenarioV2({
    scenario_id: 'golden:weak-listener', persona: 'strong-reader-weak-listener', mode: 'adaptive', seed: 'golden-weak',
    start_at: T0, maximum_interactions: 80, clock: { strategy: 'constant_interval', interval_minutes: 5 }, ...o,
  }),
  'support-dependent': (o) => createSimulationScenarioV2({
    scenario_id: 'golden:support-dependent', persona: 'support-dependent', mode: 'adaptive', seed: 'golden-support',
    start_at: T0, maximum_interactions: 100, clock: { strategy: 'constant_interval', interval_minutes: 5 }, ...o,
  }),
  forgetful: (o) => createSimulationScenarioV2({
    scenario_id: 'golden:forgetful', persona: 'forgetful', mode: 'adaptive', seed: 'golden-forgetful',
    start_at: T0, maximum_interactions: 60,
    clock: { strategy: 'accelerated_days', checkpoints: [[0, 0], [10, 2], [30, 7], [60, 30]] }, ...o,
  }),
  'fast-learner': (o) => createSimulationScenarioV2({
    scenario_id: 'golden:fast-learner', persona: 'fast-learner', mode: 'adaptive', seed: 'golden-fast',
    start_at: T0, maximum_interactions: 100, clock: { strategy: 'constant_interval', interval_minutes: 5 }, ...o,
  }),
  struggling: (o) => createSimulationScenarioV2({
    scenario_id: 'golden:struggling', persona: 'struggling', mode: 'adaptive', seed: 'golden-struggling',
    start_at: T0, maximum_interactions: 100, clock: { strategy: 'constant_interval', interval_minutes: 5 }, ...o,
  }),
  'cross-pack': (o) => createSimulationScenarioV2({
    scenario_id: 'golden:cross-pack', persona: 'cross-pack-transfer', mode: 'adaptive', seed: 'golden-cross',
    start_at: T0, maximum_interactions: 100, clock: { strategy: 'constant_interval', interval_minutes: 5 },
    initial_evidence: CROSS_PACK_SEED('sim-profile'), ...o,
  }),
}

export const STANDARD_SCENARIO_IDS = Object.keys(CATALOG)

export function buildStandardScenarioV2(id, overrides = {}) {
  const factory = CATALOG[id]
  if (!factory) throw new Error(`STANDARD_SCENARIO_UNKNOWN:${id}`)
  return factory(overrides)
}
