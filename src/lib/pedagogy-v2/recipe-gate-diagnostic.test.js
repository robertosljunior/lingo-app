import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import stillPack from '../../content/pedagogy-v2/still.json'
import butPack from '../../content/pedagogy-v2/but.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import {
  createLessonSessionV2, appendActivityToSessionV2, DEFAULT_LESSON_ENGINE_POLICY_V2,
} from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { indexStatesByTargetId } from './lesson-engine-state-queries.js'
import { getPrimaryTargets } from './query.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import {
  capabilityGatePredicateTraceV2,
  inspectRecognitionHarnessSourceV2,
  recipeEligibilityTraceV2,
  recipeMaterializationTraceV2,
} from './recipe-gate-diagnostic.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const T0 = Date.UTC(2026, 7, 9, 15, 0, 0)
let seq = 0
const iso = (n) => new Date(T0 + n * 60000).toISOString()

const REC_READ = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const REC_LISTEN = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }
const COMP_READ = { activity_kind: 'meaning_recognition', capability: 'comprehension', modality: 'reading' }
const COMP_LISTEN = { activity_kind: 'listening_recognition', capability: 'comprehension', modality: 'listening' }
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }

function ev(target, activity, over = {}) {
  seq += 1
  return buildLearnerEvidenceV2({
    evidence_id: `evidence:p0-gate.${seq}`,
    profile_id: 'p0-gate',
    interaction_id: `interaction:p0-gate.${seq}`,
    target,
    exemplar_id: null,
    activity,
    attribution: 'direct',
    outcome: 'correct',
    occurred_at: iso(seq),
    source: { source_type: 'test' },
    ...over,
  })
}

function exposure(target) {
  return ev(target, EXPO, { attribution: 'exposure', outcome: 'observed' })
}

function established(target, activity, n = 3) {
  return Array.from({ length: n }, () => ev(target, activity))
}

function evidenceForTargets(targets, { recognition = true, comprehension = false } = {}) {
  const out = []
  for (const target of targets) {
    out.push(exposure(target))
    if (recognition) out.push(...established(target, REC_READ), ...established(target, REC_LISTEN))
    if (comprehension) out.push(...established(target, COMP_READ), ...established(target, COMP_LISTEN))
  }
  return out
}

const runtimeAvailability = computeRecipeRuntimeAvailability({
  text_input: true,
  audio_output: true,
  speech_input: false,
  semantic_assessment: true,
  pronunciation_assessment: false,
})

function stateMap(events) {
  return indexStatesByTargetId(aggregateProfileEvidence(events))
}

describe('#106 — capability predicates expose actual and required values', () => {
  it('does not call a low state production-ready and reveals the real advancement threshold', () => {
    const exemplar = stillPack.exemplars.find((row) => row.exemplar_id === 'exemplar:still.001')
    const targets = getPrimaryTargets(exemplar).map((target) => ({ target_type: target.target_type, target_id: target.target_id }))
    const states = stateMap(targets.map(exposure))
    const trace = capabilityGatePredicateTraceV2(
      states.get(targets[0].target_id),
      'controlled_production',
      'writing',
      DEFAULT_LESSON_ENGINE_POLICY_V2.thresholds,
    )

    expect(trace.met).toBe(false)
    expect(trace.diagnostic_agrees_with_runtime).toBe(true)
    expect(trace.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: 'recognition_advancement',
        met: false,
        required: {
          min_mastery: DEFAULT_LESSON_ENGINE_POLICY_V2.thresholds.advancement.min_mastery,
          min_evidence_level: DEFAULT_LESSON_ENGINE_POLICY_V2.thresholds.advancement.min_evidence_level,
        },
      }),
    ]))
  })

  it('shows controlled production gate open once recognition actually meets the runtime predicate', () => {
    const exemplar = stillPack.exemplars.find((row) => row.exemplar_id === 'exemplar:still.001')
    const targets = getPrimaryTargets(exemplar).map((target) => ({ target_type: target.target_type, target_id: target.target_id }))
    const states = stateMap(evidenceForTargets(targets, { recognition: true }))
    for (const target of targets) {
      const trace = capabilityGatePredicateTraceV2(
        states.get(target.target_id), 'controlled_production', 'writing', DEFAULT_LESSON_ENGINE_POLICY_V2.thresholds,
      )
      expect(trace.met).toBe(true)
      expect(trace.diagnostic_agrees_with_runtime).toBe(true)
      expect(trace.predicates.every((row) => row.met)).toBe(true)
    }
  })
})

describe('#106 — recipe eligibility distinguishes curated from licensed tier-1', () => {
  it('keeps fixed completion eligible for a curated but exemplar with authored context', () => {
    const exemplar = butPack.exemplars.find((row) => row.exemplar_id === 'exemplar:but.001')
    const targets = getPrimaryTargets(exemplar).map((target) => ({ target_type: target.target_type, target_id: target.target_id }))
    const states = stateMap(evidenceForTargets(targets, { recognition: true }))
    const rows = recipeEligibilityTraceV2({
      exemplar,
      learnerStatesByTargetId: states,
      capability: 'controlled_production',
      modality: 'writing',
      runtimeAvailability,
    })
    const completion = rows.find((row) => row.recipe === 'fixed_element_completion')
    const wordOrder = rows.find((row) => row.recipe === 'word_order_reconstruction')

    expect(completion.provenance).toBe('curated_authored')
    expect(completion.has_authored_context).toBe(true)
    expect(completion.licensed_contract_allows).toBe(true)
    expect(completion.eligible_before_scoring).toBe(true)
    expect(wordOrder.eligible_before_scoring).toBe(true)
  })

  it('keeps completion out of licensed tier-1 while word order remains eligible', () => {
    const parent = stillPack.exemplars.find((row) => row.exemplar_id === 'exemplar:still.001')
    const exemplar = {
      ...parent,
      exemplar_id: 'realization:test.tier1',
      context: null,
      eligible_recipes: ['meaning_recognition', 'listening_recognition', 'word_order_reconstruction', 'pronunciation'],
      provenance: { kind: 'licensed_variant', parent_exemplar_id: parent.exemplar_id },
    }
    const targets = getPrimaryTargets(exemplar).map((target) => ({ target_type: target.target_type, target_id: target.target_id }))
    const states = stateMap(evidenceForTargets(targets, { recognition: true }))
    const rows = recipeEligibilityTraceV2({
      exemplar,
      learnerStatesByTargetId: states,
      capability: 'controlled_production',
      modality: 'writing',
      runtimeAvailability,
    })

    const completion = rows.find((row) => row.recipe === 'fixed_element_completion')
    const wordOrder = rows.find((row) => row.recipe === 'word_order_reconstruction')
    expect(completion.eligible_before_scoring).toBe(false)
    expect(completion.exclusion_reasons).toContain('recipe_requires_context')
    expect(wordOrder.eligible_before_scoring).toBe(true)
  })
})

describe('#106 — selected word order survives selection, materialization and renderer dispatch', () => {
  it('materializes a real ordered-token plan under explicit high recognition mastery', () => {
    const exemplar = stillPack.exemplars.find((row) => row.exemplar_id === 'exemplar:still.001')
    const targets = getPrimaryTargets(exemplar).map((target) => ({ target_type: target.target_type, target_id: target.target_id }))
    const learnerStates = aggregateProfileEvidence(evidenceForTargets(targets, { recognition: true, comprehension: true }))
    const focusTarget = targets.find((target) => target.target_type === 'construction') ?? targets[0]
    const session = createLessonSessionV2({
      session_id: 'session:p0-gate', profile_id: 'p0-gate', now: iso(500), seed: 'p0-gate',
    })
    const decision = selectNextActivityV2({
      session,
      pack: stillPack,
      learnerStates,
      recentEvidence: [],
      runtimeAvailability,
      focus: { target_id: focusTarget.target_id, capability: 'controlled_production', modality: 'writing' },
      policy: {
        new_item_budget_per_session: 0,
        targeted_practice: { target_id: focusTarget.target_id },
        recipe_preference: { recipe: 'word_order_reconstruction' },
      },
    })

    expect(decision.status).toBe('activity')
    expect(decision.plan.recipe).toBe('word_order_reconstruction')
    const trace = recipeMaterializationTraceV2({
      selectedRecipe: 'word_order_reconstruction',
      plan: decision.plan,
      rendererRecipe: 'word_order_reconstruction',
    })
    expect(trace.fallback_detected).toBe(false)
    expect(trace.word_order_contract_valid).toBe(true)
    expect(trace.accepted_response_types).toContain('token_sequence')
  })

  it('word order wins at least one baseline selector slot without recipe preference', () => {
    const exemplar = stillPack.exemplars.find((row) => row.exemplar_id === 'exemplar:still.001')
    const targets = getPrimaryTargets(exemplar).map((target) => ({ target_type: target.target_type, target_id: target.target_id }))
    const learnerStates = aggregateProfileEvidence(evidenceForTargets(targets, { recognition: true, comprehension: true }))
    const focusTarget = targets.find((target) => target.target_type === 'construction') ?? targets[0]
    let session = createLessonSessionV2({
      session_id: 'session:p0-baseline-selector', profile_id: 'p0-gate', now: iso(600), seed: 'p0-baseline-selector',
    })
    const recipes = []

    for (let i = 0; i < 12; i++) {
      const decision = selectNextActivityV2({
        session,
        pack: stillPack,
        learnerStates,
        recentEvidence: [],
        runtimeAvailability,
        focus: { target_id: focusTarget.target_id, capability: 'controlled_production', modality: 'writing' },
        policy: {
          new_item_budget_per_session: 0,
          targeted_practice: { target_id: focusTarget.target_id },
        },
      })
      expect(decision.status).toBe('activity')
      recipes.push(decision.plan.recipe)
      const materialization = recipeMaterializationTraceV2({
        selectedRecipe: decision.plan.recipe,
        plan: decision.plan,
        rendererRecipe: decision.plan.recipe,
      })
      expect(materialization.fallback_detected).toBe(false)
      session = appendActivityToSessionV2(session, decision)
    }

    expect(recipes).toContain('word_order_reconstruction')
  })

  it('the learner renderer maps word order explicitly and has no option-select fallback', () => {
    const source = readFileSync(join(__dirname, '../../components/pedagogy-v2-learner/V2LearnerActivity.jsx'), 'utf8')
    expect(source).toMatch(/word_order_reconstruction:\s*WordOrderActivity/)
    expect(source).toMatch(/if \(!Renderer\) return <div data-testid="v2lx-unknown-recipe"/)
    expect(source).not.toMatch(/if \(!Renderer\).*RecognitionActivity/s)
  })
})

describe('#106 — the 10-round harness does not guarantee correct recognition evidence', () => {
  it('documents that generic recognition answers click the first option, not the correct option id', () => {
    const source = readFileSync(join(__dirname, '../../../e2e/v2-helpers.js'), 'utf8')
    const audit = inspectRecognitionHarnessSourceV2(source)
    expect(audit.recognition_answer_strategy).toBe('first_option')
    expect(audit.guarantees_correct_recognition_answer).toBe(false)
  })
})
