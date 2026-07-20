// modality-gap.test.js — §32 tests 1–14 (Slice V2.9). The trainable-modality
// APIs (derived from recipes + runtime, no manual pairing table) and the
// generic modality-expansion candidate generation: every real gap generates,
// no impossible/premature/duplicate gap does, and evidence never leaks
// between modalities.

import { describe, it, expect } from 'vitest'
import {
  getTrainableModalitiesForCapabilityV2, getTrainableDomainsForTargetV2, getSiblingTrainableDomainsV2,
} from './training-affordances.js'
import { buildModalityGapCandidatesV2 } from './modality-gap.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { DEFAULT_LESSON_ENGINE_POLICY_V2, LESSON_RECIPES } from './lesson-engine-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { getTrainingAffordancesV2 } from './training-affordances.js'

const FULL = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const avail = (caps) => computeRecipeRuntimeAvailability(caps)
const affFor = (caps) => getTrainingAffordancesV2({ runtimeAvailability: caps ? avail(caps) : null })
const THRESHOLDS = DEFAULT_LESSON_ENGINE_POLICY_V2.thresholds
const TARGET = { target_type: 'sense', target_id: 'sense:but.contrast' }

let seq = 0
const ev = (activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:mg.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1', interaction_id: `interaction:mg${seq}`,
  target: TARGET, exemplar_id: null, activity,
  attribution: 'direct', outcome: 'correct',
  occurred_at: new Date(Date.UTC(2026, 6, 1) + seq * 60000).toISOString(),
  source: { source_type: 'test' },
  ...over,
})
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const LISTEN_REC = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }
const SPEAK_CTRL = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'speaking' }
const WRITE_CTRL = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing' }
const SPEAK_FREE = { activity_kind: 'free_production', capability: 'free_production', modality: 'speaking' }
const WRITE_FREE = { activity_kind: 'free_production', capability: 'free_production', modality: 'writing' }
const many = (activity, n = 4) => Array.from({ length: n }, () => ev(activity))
const stateOf = (events) => aggregateProfileEvidence(events)[0]
const gaps = (state, caps = FULL) => buildModalityGapCandidatesV2({ state, affordances: affFor(caps), thresholds: THRESHOLDS })
const gapFor = (list, capability, modality) => list.find((g) => g.capability === capability && g.modality === modality)

// ---- trainable-modality API (§32 tests 1–5) ---------------------------------

describe('§32.1–3 — trainable modalities per capability derive from recipes', () => {
  it('1: recognition trains reading and listening', () => {
    expect(getTrainableModalitiesForCapabilityV2('recognition', { affordances: affFor(FULL) })).toEqual(['listening', 'reading'])
  })
  it('2: controlled production trains speaking and writing', () => {
    expect(getTrainableModalitiesForCapabilityV2('controlled_production', { affordances: affFor(FULL) })).toEqual(['speaking', 'writing'])
  })
  it('3: free production trains speaking and writing; domains cover a target generically', () => {
    expect(getTrainableModalitiesForCapabilityV2('free_production', { affordances: affFor(FULL) })).toEqual(['speaking', 'writing'])
    const domains = getTrainableDomainsForTargetV2(TARGET, { affordances: affFor(FULL) })
    expect(domains).toContainEqual({ capability: 'free_production', modality: 'writing' })
  })
})

describe('§32.4–5 — runtime filters modalities out of the API', () => {
  it('4: no audio output removes listening from recognition', () => {
    const mods = getTrainableModalitiesForCapabilityV2('recognition', { affordances: affFor({ ...FULL, audio_output: false }) })
    expect(mods).toEqual(['reading'])
  })
  it('5: no speech input removes speaking everywhere', () => {
    const noMic = affFor({ ...FULL, speech_input: false })
    expect(getTrainableModalitiesForCapabilityV2('controlled_production', { affordances: noMic })).toEqual(['writing'])
    expect(getSiblingTrainableDomainsV2({ capability: 'free_production', current_modality: 'writing', affordances: noMic })).toEqual([])
  })
})

// ---- candidate generation (§32 tests 6–14) ----------------------------------

describe('§32.6–7 — recognition modality gaps (both directions, preserved)', () => {
  it('6: reading practiced, listening absent → listening gap with LISTENING_BEHIND_READING', () => {
    const g = gapFor(gaps(stateOf(many(READ_REC))), 'recognition', 'listening')
    expect(g).toBeTruthy()
    expect(g.reason_codes).toContain('MODALITY_GAP')
    expect(g.reason_codes).toContain('PARALLEL_MODALITY_UNPRACTICED')
    expect(g.reason_codes).toContain('LISTENING_BEHIND_READING')
  })
  it('7: listening practiced, reading absent → reading gap with READING_BEHIND_LISTENING', () => {
    const g = gapFor(gaps(stateOf(many(LISTEN_REC))), 'recognition', 'reading')
    expect(g).toBeTruthy()
    expect(g.reason_codes).toContain('READING_BEHIND_LISTENING')
  })
})

describe('§32.8–9 — controlled production expansion (the V2.8 writing bug, both directions)', () => {
  // Recognition established unlocks controlled production (shared gate).
  const recogEst = [...many(READ_REC), ...many(LISTEN_REC)]

  it('8: speaking practiced, writing absent → writing gap with WRITING_BEHIND_SPEAKING', () => {
    const g = gapFor(gaps(stateOf([...recogEst, ...many(SPEAK_CTRL, 3)])), 'controlled_production', 'writing')
    expect(g).toBeTruthy()
    expect(g.reason_codes).toContain('WRITING_BEHIND_SPEAKING')
    expect(g.source_modalities).toContain('speaking')
  })
  it('9: writing practiced, speaking absent (mic available) → speaking gap with SPEAKING_BEHIND_WRITING', () => {
    const g = gapFor(gaps(stateOf([...recogEst, ...many(WRITE_CTRL, 3)])), 'controlled_production', 'speaking')
    expect(g).toBeTruthy()
    expect(g.reason_codes).toContain('SPEAKING_BEHIND_WRITING')
  })
})

describe('§32.10–11 — free production expansion (both directions)', () => {
  const recogEst = [...many(READ_REC), ...many(LISTEN_REC)]

  it('10: free speaking practiced, free writing absent (controlled writing ready) → free writing gap', () => {
    const st = stateOf([...recogEst, ...many(WRITE_CTRL), ...many(SPEAK_CTRL), ...many(SPEAK_FREE, 3)])
    const g = gapFor(gaps(st), 'free_production', 'writing')
    expect(g).toBeTruthy()
    expect(g.reason_codes).toContain('WRITING_BEHIND_SPEAKING')
  })
  it('11: free writing practiced, free speaking absent (controlled speaking ready) → free speaking gap', () => {
    const st = stateOf([...recogEst, ...many(WRITE_CTRL), ...many(SPEAK_CTRL), ...many(WRITE_FREE, 3)])
    const g = gapFor(gaps(st), 'free_production', 'speaking')
    expect(g).toBeTruthy()
    expect(g.reason_codes).toContain('SPEAKING_BEHIND_WRITING')
  })

  it('free writing gap is NOT generated before controlled writing is established (readiness = the engine gate)', () => {
    // Free speaking practiced but writing controlled absent → the engine could
    // not serve free/writing, so no candidate may exist (documented policy: the
    // parallel modality enters at the SAME capability only when its own
    // capability gate is met; it never re-runs recognition, and never skips
    // the same-modality controlled prerequisite of free production).
    const st = stateOf([...recogEst, ...many(SPEAK_CTRL), ...many(SPEAK_FREE, 3)])
    expect(gapFor(gaps(st), 'free_production', 'writing')).toBeUndefined()
  })
})

describe('§32.12 — an unavailable modality never generates a candidate', () => {
  it('speech_input=false suppresses the speaking gaps (controlled and free)', () => {
    const recogEst = [...many(READ_REC), ...many(LISTEN_REC)]
    const noMic = { ...FULL, speech_input: false }
    const st = stateOf([...recogEst, ...many(WRITE_CTRL, 3)])
    expect(gapFor(gaps(st, noMic), 'controlled_production', 'speaking')).toBeUndefined()
    // audio_output=false suppresses the listening gap (§9 behavior preserved).
    const st2 = stateOf(many(READ_REC))
    expect(gapFor(gaps(st2, { ...FULL, audio_output: false }), 'recognition', 'listening')).toBeUndefined()
  })
})

describe('§32.13 — an established modality does not generate a gap', () => {
  it('both recognition modalities practiced → no recognition gap at all', () => {
    const st = stateOf([...many(READ_REC), ...many(LISTEN_REC)])
    const list = gaps(st)
    expect(gapFor(list, 'recognition', 'reading')).toBeUndefined()
    expect(gapFor(list, 'recognition', 'listening')).toBeUndefined()
  })
})

describe('§32.14 — evidence never leaks across modalities', () => {
  it('writing evidence updates only writing lanes; the speaking lane stays untouched', () => {
    const before = stateOf([...many(READ_REC), ...many(SPEAK_CTRL, 3)])
    const speakingBefore = before.capabilities.speaking_controlled_production.overall
    const after = stateOf([...many(READ_REC), ...many(SPEAK_CTRL, 3), ...many(WRITE_CTRL, 2)])
    const speakingAfter = after.capabilities.speaking_controlled_production.overall
    expect(speakingAfter.assessed_evidence_count).toBe(speakingBefore.assessed_evidence_count)
    expect(speakingAfter.mastery_estimate).toBe(speakingBefore.mastery_estimate)
    expect(after.capabilities.writing_controlled_production.overall.assessed_evidence_count).toBe(2)
  })
})

describe('the modality-gap module never hardcodes a pairing table', () => {
  it('a hypothetical third production modality would be generated automatically', () => {
    // Add a fake recipe training controlled_production in a "typing" modality:
    // the gap generator must propose it with no code change (only the generic
    // PARALLEL_MODALITY_UNPRACTICED code; no specific *_BEHIND_* pairing).
    const recipes = [...LESSON_RECIPES, {
      recipe: 'typing_drill', activity_kind: 'controlled_completion',
      pairs: [['controlled_production', 'typing']],
      variants: [{ lane: 'independent', features: [] }],
      needs_options: false, attribution_rule: 'form_first', response_type: 'text_input',
    }]
    const affordances = getTrainingAffordancesV2({ recipes, runtimeAvailability: null })
    const st = stateOf([...many(READ_REC), ...many(LISTEN_REC), ...many(SPEAK_CTRL, 3)])
    const list = buildModalityGapCandidatesV2({ state: st, affordances, thresholds: THRESHOLDS })
    const typing = gapFor(list, 'controlled_production', 'typing')
    expect(typing).toBeTruthy()
    expect(typing.reason_codes).toContain('PARALLEL_MODALITY_UNPRACTICED')
  })
})
