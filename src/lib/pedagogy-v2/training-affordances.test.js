// training-affordances.test.js — §11 (Slice V2.8). The affordance layer is the
// single, recipe-derived source of truth for what the engine + runtime can
// train, and — critically — whether a (capability, modality) domain can be
// trained to INDEPENDENT (tier-none, assessed) evidence. These tests pin the
// structural facts of the current recipe set and prove the layer reacts to
// runtime capabilities and to new recipes without any hand-maintained enum.

import { describe, it, expect } from 'vitest'
import {
  getTrainingAffordancesV2, findTrainingAffordanceV2, canTrainIndependentV2,
  canProduceAssessedEvidenceV2, independenceUnavailabilityReasonV2,
} from './training-affordances.js'
import { LESSON_RECIPES } from './lesson-engine-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'

const FULL_CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: true }
const avail = (caps) => computeRecipeRuntimeAvailability(caps)

describe('§11.1 — recognition supported is available', () => {
  it('recognition/reading is trainable (supported) and produces assessed evidence', () => {
    const aff = getTrainingAffordancesV2({ runtimeAvailability: avail(FULL_CAPS) })
    const a = findTrainingAffordanceV2(aff, 'recognition', 'reading')
    expect(a).toBeTruthy()
    expect(a.support_tiers).toContain('high')
    expect(a.can_produce_assessed_evidence).toBe(true)
  })
})

describe('§11.2 — recognition independent is UNavailable (only multiple choice)', () => {
  it('no recognition domain can train independent with the current recipes', () => {
    expect(canTrainIndependentV2('recognition', 'reading', { runtimeAvailability: avail(FULL_CAPS) })).toBe(false)
    expect(canTrainIndependentV2('recognition', 'listening', { runtimeAvailability: avail(FULL_CAPS) })).toBe(false)
    expect(independenceUnavailabilityReasonV2('recognition', 'reading', { runtimeAvailability: avail(FULL_CAPS) })).toBe('no_independent_recipe')
  })
})

describe('§11.3 — comprehension independent is UNavailable (only scaffolded)', () => {
  it('no comprehension domain can train independent', () => {
    expect(canTrainIndependentV2('comprehension', 'reading', { runtimeAvailability: avail(FULL_CAPS) })).toBe(false)
    expect(canTrainIndependentV2('comprehension', 'listening', { runtimeAvailability: avail(FULL_CAPS) })).toBe(false)
  })
})

describe('§11.4 — controlled writing independent IS available (unaided recipe exists)', () => {
  it('controlled_production/writing can train independent', () => {
    const a = findTrainingAffordanceV2(getTrainingAffordancesV2({ runtimeAvailability: avail(FULL_CAPS) }), 'controlled_production', 'writing')
    expect(a.can_train_independent).toBe(true)
    expect(a.support_tiers).toEqual(expect.arrayContaining(['none']))
    expect(a.independent_recipes.length).toBeGreaterThan(0)
  })
})

describe('§11.5 — free writing independent IS available when semantic assessment exists', () => {
  it('free_production/writing trainable-independent with semantic assessment; blocked without', () => {
    expect(canTrainIndependentV2('free_production', 'writing', { runtimeAvailability: avail(FULL_CAPS) })).toBe(true)
    const noSem = { ...FULL_CAPS, semantic_assessment: false }
    expect(canTrainIndependentV2('free_production', 'writing', { runtimeAvailability: avail(noSem) })).toBe(false)
  })
})

describe('§11.6 — speaking is blocked without speech input', () => {
  it('no speaking domain is trainable without a microphone', () => {
    const noMic = { ...FULL_CAPS, speech_input: false }
    const aff = getTrainingAffordancesV2({ runtimeAvailability: avail(noMic) })
    expect(aff.some((a) => a.modality === 'speaking')).toBe(false)
    expect(canTrainIndependentV2('controlled_production', 'speaking', { runtimeAvailability: avail(noMic) })).toBe(false)
    expect(canTrainIndependentV2('free_production', 'speaking', { runtimeAvailability: avail(noMic) })).toBe(false)
  })
})

describe('§11.7 — free production is blocked without semantic assessment', () => {
  it('no free_production domain can produce assessed evidence without semantic assessment', () => {
    const noSem = { ...FULL_CAPS, semantic_assessment: false }
    expect(canProduceAssessedEvidenceV2('free_production', 'writing', { runtimeAvailability: avail(noSem) })).toBe(false)
    expect(canProduceAssessedEvidenceV2('free_production', 'speaking', { runtimeAvailability: avail(noSem) })).toBe(false)
  })
})

describe('§11.8 — assessed pronunciation is blocked without an acoustic assessor', () => {
  it('pronunciation is unavailable when pronunciation_assessment is false', () => {
    const noPron = { ...FULL_CAPS, pronunciation_assessment: false }
    const aff = getTrainingAffordancesV2({ runtimeAvailability: avail(noPron) })
    expect(aff.some((a) => a.capability === 'pronunciation')).toBe(false)
    expect(canTrainIndependentV2('pronunciation', 'speaking', { runtimeAvailability: avail(noPron) })).toBe(false)
    // With the assessor present it becomes independently trainable.
    expect(canTrainIndependentV2('pronunciation', 'speaking', { runtimeAvailability: avail(FULL_CAPS) })).toBe(true)
  })
})

describe('§11.9 — a new independent recipe makes a domain eligible automatically', () => {
  it('adding an unaided assessed recognition recipe flips recognition to independently trainable', () => {
    const withNewRecipe = [
      ...LESSON_RECIPES,
      {
        recipe: 'free_recall_recognition', activity_kind: 'meaning_recognition',
        pairs: [['recognition', 'reading']],
        variants: [{ lane: 'independent', features: [] }],
        needs_options: false, attribution_rule: 'meaning_first', response_type: 'text_input',
      },
    ]
    // No planner edit — purely a recipe-table change.
    expect(canTrainIndependentV2('recognition', 'reading', { recipes: withNewRecipe, runtimeAvailability: avail(FULL_CAPS) })).toBe(true)
  })
})

describe('§11.10 — the affordance layer derives from the engine recipe table (no manual enum)', () => {
  it('every affordance domain traces back to a LESSON_RECIPES pair', () => {
    const aff = getTrainingAffordancesV2({ runtimeAvailability: avail(FULL_CAPS) })
    const recipePairs = new Set()
    for (const r of LESSON_RECIPES) for (const [c, m] of r.pairs) recipePairs.add(`${c}_${m}`)
    for (const a of aff) expect(recipePairs.has(`${a.capability}_${a.modality}`)).toBe(true)
    // The module must import the engine's recipe table rather than restate it.
    // (Guards against a drifting, hand-maintained capability list.)
    expect(aff.length).toBeGreaterThan(0)
  })
})
