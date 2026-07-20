// capability-entry.test.js — §34 tests 1–6 + §12 (Slice V2.10). Runtime-aware
// capability entry: a new rung enters through any executable, curriculum-ready
// modality — never the first lexically-sorted one regardless of runtime — with
// deterministic selection, no cross-modality leakage and no false errors when
// the runtime offers nothing.

import { describe, it, expect } from 'vitest'
import {
  getEligibleEntryDomainsForCapabilityV2, selectEntryModalityV2,
  capabilityEntrySilentlyStuckV2, findFirstOpenCapabilityRungV2, CAPABILITY_LADDER,
} from './capability-entry.js'
import { getTrainingAffordancesV2 } from './training-affordances.js'
import { buildStudyCandidatesV2 } from './study-planner.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { loadPedagogyV2Registry } from './registry.js'
import { DEFAULT_LESSON_ENGINE_POLICY_V2, LESSON_RECIPES } from './lesson-engine-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'

const registry = loadPedagogyV2Registry()
const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)).toISOString()
const FULL_CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const THRESHOLDS = DEFAULT_LESSON_ENGINE_POLICY_V2.thresholds
const T = { target_type: 'sense', target_id: 'sense:but.contrast' }
const aff = (caps) => getTrainingAffordancesV2({ runtimeAvailability: caps ? computeRecipeRuntimeAvailability(caps) : null })
const ENGINE = aff(null)

let seq = 0
const ev = (activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:ce.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1', interaction_id: `interaction:ce${seq}`,
  target: T, exemplar_id: null, activity,
  attribution: 'direct', outcome: 'correct',
  occurred_at: new Date(Date.UTC(2026, 6, 1) + seq * 60000).toISOString(), source: { source_type: 'test' },
  ...over,
})
const many = (activity, n = 4) => Array.from({ length: n }, () => ev(activity))
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const LISTEN_REC = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }
const WRITE_CTRL = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing' }
const SPEAK_CTRL = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'speaking' }
const stateOf = (events) => aggregateProfileEvidence(events)[0]
// Recognition established both modalities → controlled production ready.
const recogEst = () => [...many(READ_REC), ...many(LISTEN_REC)]

describe('§34.1 — writing entry when speech is unavailable', () => {
  it('controlled production enters through writing without a microphone', () => {
    const state = stateOf(recogEst())
    const sel = selectEntryModalityV2({
      target: T, capability: 'controlled_production', learnerState: state,
      affordances: aff({ ...FULL_CAPS, speech_input: false }), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS,
    })
    expect(sel.modality).toBe('writing')
    expect(sel.preferred_unavailable).toBe(true) // speaking was the sorted-first preference
  })

  it('the planner generates the writing entry candidate with the runtime-aware reason codes', () => {
    // Recognition AND comprehension established → the first open rung is
    // controlled_production; without a microphone its entry must be writing.
    const READ_COMP = { activity_kind: 'meaning_recognition', capability: 'comprehension', modality: 'reading' }
    const LISTEN_COMP = { activity_kind: 'listening_recognition', capability: 'comprehension', modality: 'listening' }
    const st = aggregateProfileEvidence([...recogEst(), ...many(READ_COMP), ...many(LISTEN_COMP)])
    const cands = buildStudyCandidatesV2({
      registry, learnerStates: st, recentEvidence: [], now: NOW,
      runtimeAvailability: computeRecipeRuntimeAvailability({ ...FULL_CAPS, speech_input: false }),
    })
    const entry = cands.find((c) => c.focus_type === 'deepen' && c.capability === 'controlled_production'
      && c.reason_codes.includes('ENTRY_MODALITY_SELECTED'))
    expect(entry).toBeTruthy()
    expect(entry.modality).toBe('writing')
    expect(entry.reason_codes).toEqual(expect.arrayContaining(['RUNTIME_AWARE_CAPABILITY_ENTRY', 'PREFERRED_MODALITY_RUNTIME_UNAVAILABLE', 'ALTERNATE_MODALITY_SELECTED']))
  })
})

describe('§34.2 — speaking entry when text input is unavailable', () => {
  it('a hypothetical no-text runtime enters production through speaking', () => {
    const noText = { text_input: false, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
    const sel = selectEntryModalityV2({
      target: T, capability: 'controlled_production', learnerState: stateOf(recogEst()),
      affordances: aff(noText), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS,
    })
    expect(sel.modality).toBe('speaking')
  })
})

describe('§34.3 — with both modalities available, entry is deterministic', () => {
  it('the same inputs always select the same modality (sorted-first among eligible, no new weight)', () => {
    const state = stateOf(recogEst())
    const a = selectEntryModalityV2({ target: T, capability: 'controlled_production', learnerState: state, affordances: aff(FULL_CAPS), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })
    const b = selectEntryModalityV2({ target: T, capability: 'controlled_production', learnerState: state, affordances: aff(FULL_CAPS), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })
    expect(a.modality).toBe(b.modality)
    expect(a.modality).toBe('speaking') // full runtime keeps the pre-V2.10 choice
    expect(a.preferred_unavailable).toBe(false)
  })
})

describe('§34.4 — recognition/comprehension entry without audio', () => {
  it('comprehension enters through reading when audio output is unavailable', () => {
    const sel = selectEntryModalityV2({
      target: T, capability: 'comprehension', learnerState: stateOf(recogEst()),
      affordances: aff({ ...FULL_CAPS, audio_output: false }), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS,
    })
    expect(sel.modality).toBe('reading')
  })

  it('§12.5: available listening is NOT required — comprehension enters through the READY modality', () => {
    // Only reading recognition established → comprehension gate open only in
    // reading; listening stays annotated not-ready, never a blocker.
    const state = stateOf(many(READ_REC))
    const domains = getEligibleEntryDomainsForCapabilityV2({ target: T, capability: 'comprehension', learnerState: state, affordances: aff(FULL_CAPS), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })
    expect(domains.find((d) => d.modality === 'listening').curriculum_ready).toBe(false)
    const sel = selectEntryModalityV2({ target: T, capability: 'comprehension', learnerState: state, affordances: aff(FULL_CAPS), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })
    expect(sel.modality).toBe('reading')
  })
})

describe('§34.5–6 — free-production entry respects per-modality gates', () => {
  it('free writing entry when controlled WRITING is ready (speaking absent, despite sort order)', () => {
    const state = stateOf([...recogEst(), ...many(WRITE_CTRL)])
    const sel = selectEntryModalityV2({ target: T, capability: 'free_production', learnerState: state, affordances: aff(FULL_CAPS), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })
    expect(sel.modality).toBe('writing') // speaking sorts first but is not curriculum-ready
  })
  it('free speaking entry when controlled SPEAKING is ready', () => {
    const state = stateOf([...recogEst(), ...many(SPEAK_CTRL)])
    const sel = selectEntryModalityV2({ target: T, capability: 'free_production', learnerState: state, affordances: aff(FULL_CAPS), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })
    expect(sel.modality).toBe('speaking')
  })
})

describe('§12.8–9 — expansion still follows entry; evidence never leaks', () => {
  it('after a writing entry, the speaking sibling arrives via modality expansion (separate axis)', () => {
    const st = aggregateProfileEvidence([...recogEst(), ...many(WRITE_CTRL, 3)])
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: computeRecipeRuntimeAvailability(FULL_CAPS) })
    expect(cands.some((c) => c.capability === 'controlled_production' && c.modality === 'speaking'
      && c.reason_codes.includes('PARALLEL_MODALITY_UNPRACTICED'))).toBe(true)
  })
  it('entry evidence in writing leaves the speaking lane untouched', () => {
    const st = stateOf([...recogEst(), ...many(WRITE_CTRL, 3)])
    expect(st.capabilities.writing_controlled_production.overall.assessed_evidence_count).toBe(3)
    expect(st.capabilities.speaking_controlled_production).toBeUndefined()
  })
})

describe('§12.10 — a capability with no executable runtime never yields a false error', () => {
  it('text-only free production... nothing executable+ready → null entry, not "stuck"', () => {
    // Pronunciation: no acoustic assessor → zero executable modalities.
    const state = stateOf(recogEst())
    const sel = selectEntryModalityV2({ target: T, capability: 'pronunciation', learnerState: state, affordances: aff(FULL_CAPS), engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })
    expect(sel.modality).toBeNull()
    expect(sel.any_executable).toBe(false)
    // The invariant helper never reports "stuck" without an executable domain.
    expect(capabilityEntrySilentlyStuckV2({
      target: T, capability: 'pronunciation', learnerState: state,
      affordances: aff(FULL_CAPS), thresholds: THRESHOLDS, generatedCapabilities: new Set(),
    })).toBe(false)
  })

  it('the invariant DOES fire when an executable, ready entry received no candidate at all', () => {
    const state = stateOf(recogEst()) // controlled production ready + executable
    expect(capabilityEntrySilentlyStuckV2({
      target: T, capability: 'controlled_production', learnerState: state,
      affordances: aff(FULL_CAPS), thresholds: THRESHOLDS, generatedCapabilities: new Set(),
    })).toBe(true)
    expect(capabilityEntrySilentlyStuckV2({
      target: T, capability: 'controlled_production', learnerState: state,
      affordances: aff(FULL_CAPS), thresholds: THRESHOLDS, generatedCapabilities: new Set(['controlled_production']),
    })).toBe(false)
  })
})

describe('§12.11 — a future modality joins entry with no planner change', () => {
  it('a hypothetical typing recipe becomes an entry option automatically', () => {
    const recipes = [...LESSON_RECIPES, {
      recipe: 'typing_drill', activity_kind: 'controlled_completion',
      pairs: [['controlled_production', 'typing']],
      variants: [{ lane: 'independent', features: [] }],
      needs_options: false, attribution_rule: 'form_first', response_type: 'text_input',
    }]
    const custom = getTrainingAffordancesV2({ recipes, runtimeAvailability: null })
    const domains = getEligibleEntryDomainsForCapabilityV2({
      target: T, capability: 'controlled_production', learnerState: stateOf(recogEst()),
      affordances: custom, engineLevelAffordances: custom, thresholds: THRESHOLDS,
    })
    expect(domains.map((d) => d.modality)).toContain('typing')
  })
})

describe('findFirstOpenCapabilityRungV2 — the shared rung scan', () => {
  it('finds comprehension for a recognition-established learner, null with no evidence', () => {
    expect(findFirstOpenCapabilityRungV2(stateOf(recogEst()), { engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })).toBe('comprehension')
    expect(findFirstOpenCapabilityRungV2({ target: T, capabilities: {} }, { engineLevelAffordances: ENGINE, thresholds: THRESHOLDS })).toBeNull()
    expect(CAPABILITY_LADDER[0]).toBe('recognition')
  })
})
