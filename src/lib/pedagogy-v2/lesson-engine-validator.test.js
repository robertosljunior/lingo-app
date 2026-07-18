import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import {
  DEFAULT_LESSON_ENGINE_POLICY_V2, mergeLessonEnginePolicyV2,
  createLessonSessionV2, LESSON_RECIPES,
} from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import {
  validateLessonEnginePolicyV2, validateLessonSessionV2, validateActivityPlanV2,
  validateLessonDecisionV2, validateSelectionTraceV2, validateLessonEngineContextV2,
} from './lesson-engine-validator.js'
import { deriveSupportTier } from './learner-evidence-contracts.js'

const NOW = new Date(Date.UTC(2026, 6, 2)).toISOString()
const decision = () => selectNextActivityV2({
  session: createLessonSessionV2({ session_id: 'sess1', profile_id: 'p1', now: NOW }),
  pack: stillPack, learnerStates: [], recentEvidence: [], policy: {},
})

describe('recipe table — safety invariants against the approved V2.2 contracts', () => {
  it('every independent variant is truly unaided; supported variants carry real features', () => {
    for (const r of LESSON_RECIPES) {
      for (const v of r.variants) {
        const tier = deriveSupportTier({ features: v.features, hint_count: 0 })
        if (v.lane === 'independent') expect(tier).toBe('none')
        else expect(tier).not.toBe('none')
        expect(v.features).not.toContain('answer_reveal')
      }
    }
  })

  it('covers the eight required plan types', () => {
    expect(LESSON_RECIPES.map((r) => r.recipe)).toEqual([
      'exposure', 'meaning_recognition', 'listening_recognition',
      'fixed_element_completion', 'word_order_reconstruction',
      'guided_production', 'free_production', 'pronunciation',
    ])
  })
})

describe('policy validator', () => {
  it('accepts the default policy and merged overrides', () => {
    expect(validateLessonEnginePolicyV2(DEFAULT_LESSON_ENGINE_POLICY_V2).valid).toBe(true)
    expect(validateLessonEnginePolicyV2(mergeLessonEnginePolicyV2({ new_item_budget_per_session: 5 })).valid).toBe(true)
  })

  it('rejects version drift, bad thresholds and negative weights', () => {
    const base = mergeLessonEnginePolicyV2({})
    expect(validateLessonEnginePolicyV2({ ...base, policy_version: 99 }).errors).toContainEqual(expect.stringContaining('POLICY_VERSION_INVALID'))
    expect(validateLessonEnginePolicyV2({ ...base, v1_bridge_mode: 'assume_met' }).errors).toContainEqual(expect.stringContaining('POLICY_V1_BRIDGE_MODE_INVALID'))
    expect(validateLessonEnginePolicyV2({ ...base, thresholds: { ...base.thresholds, prerequisite: { min_mastery: 2, min_evidence_level: 'emerging' } } }).errors)
      .toContainEqual(expect.stringContaining('POLICY_THRESHOLD_INVALID'))
    expect(validateLessonEnginePolicyV2({ ...base, weights: { ...base.weights, need: -1 } }).errors)
      .toContainEqual(expect.stringContaining('POLICY_WEIGHT_INVALID'))
  })
})

describe('session validator', () => {
  it('accepts a fresh session and one with valid history', () => {
    const s = createLessonSessionV2({ session_id: 'sess1', now: NOW })
    expect(validateLessonSessionV2(s).valid).toBe(true)
  })

  it('rejects missing ids, bad timestamps and malformed history rows', () => {
    expect(validateLessonSessionV2({ session_version: 1, session_id: '', now: 'nope', history: [{}] }).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('SESSION_ID_REQUIRED'),
      expect.stringContaining('SESSION_NOW_INVALID'),
      expect.stringContaining('SESSION_HISTORY_EXEMPLAR_INVALID'),
      expect.stringContaining('SESSION_HISTORY_RECIPE_INVALID'),
    ]))
  })
})

describe('activity plan validator', () => {
  it('accepts the plan the engine emits', () => {
    const d = decision()
    const v = validateActivityPlanV2(d.plan)
    expect(v.errors).toEqual([])
    expect(v.valid).toBe(true)
  })

  it('rejects a derived tier that does not match the features', () => {
    const d = decision()
    const bad = { ...d.plan, support: { ...d.plan.support, derived_tier: 'none' } }
    expect(validateActivityPlanV2(bad).errors).toContainEqual(expect.stringContaining('PLAN_SUPPORT_TIER_MISMATCH'))
  })

  it('rejects answer_reveal in planned support', () => {
    const d = decision()
    const bad = { ...d.plan, support: { features: ['answer_reveal'], derived_tier: 'answer_revealed' } }
    expect(validateActivityPlanV2(bad).errors).toContainEqual(expect.stringContaining('PLAN_ANSWER_REVEAL_FORBIDDEN'))
  })

  it('rejects incompatible capability × modality pairs', () => {
    const d = decision()
    const bad = { ...d.plan, capability: 'recognition', modality: 'writing' }
    expect(validateActivityPlanV2(bad).errors).toContainEqual(expect.stringContaining('PLAN_CAPABILITY_MODALITY_INCOMPATIBLE'))
  })

  it('rejects recognition options without an authored source exemplar', () => {
    const d = decision()
    const bad = {
      ...d.plan,
      presentation: { ...d.plan.presentation, options: [{ option_id: 'option:1', text_pt: 'inventada', is_target: true }] },
    }
    expect(validateActivityPlanV2(bad).errors).toContainEqual(expect.stringContaining('PLAN_OPTION_SOURCE_REQUIRED'))
  })

  it('rejects planned exposure evidence carrying assessed outcomes', () => {
    const d = decision()
    const bad = {
      ...d.plan,
      planned_evidence: [{
        target: { target_type: 'sense', target_id: 'sense:still.continuity' },
        attribution: 'exposure',
        activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' },
        possible_outcomes: ['correct'],
      }],
    }
    expect(validateActivityPlanV2(bad).errors).toContainEqual(expect.stringContaining('PLANNED_EVIDENCE_EXPOSURE_ASSESSED'))
  })

  it('rejects invalid planned-evidence attributions (only direct/indirect/exposure exist)', () => {
    const d = decision()
    const bad = {
      ...d.plan,
      planned_evidence: [{
        target: { target_type: 'sense', target_id: 'sense:still.continuity' },
        attribution: 'assumed',
        activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' },
        possible_outcomes: ['observed'],
      }],
    }
    expect(validateActivityPlanV2(bad).errors).toContainEqual(expect.stringContaining('PLANNED_EVIDENCE_ATTRIBUTION_INVALID'))
  })
})

describe('decision and trace validators', () => {
  it('accepts activity, no_eligible_activity and session_complete decisions', () => {
    const d = decision()
    expect(validateLessonDecisionV2(d).valid).toBe(true)
    const blocked = selectNextActivityV2({
      session: createLessonSessionV2({ session_id: 'sess1', now: NOW }),
      pack: stillPack, learnerStates: [], recentEvidence: [],
      policy: { new_item_budget_per_session: 0 },
    })
    expect(blocked.status).toBe('no_eligible_activity')
    expect(validateLessonDecisionV2(blocked).valid).toBe(true)
  })

  it('rejects a non-activity decision that still carries a plan', () => {
    const d = decision()
    expect(validateLessonDecisionV2({ ...d, status: 'no_eligible_activity' }).errors)
      .toContainEqual(expect.stringContaining('DECISION_PLAN_FORBIDDEN'))
  })

  it('rejects invalid tri-state statuses in the trace', () => {
    const d = decision()
    const bad = { ...d.trace, prerequisite_assessments: [{ ref: 'x', status: 'assumed_met' }] }
    expect(validateSelectionTraceV2(bad).errors).toContainEqual(expect.stringContaining('TRACE_PREREQ_STATUS_INVALID'))
  })
})

describe('context validator', () => {
  it('validates the context contract shape (v2: declares the multi-pack scope)', () => {
    expect(validateLessonEngineContextV2({
      context_version: 2, profile_id: 'p1', now: NOW, learner_states: [], recent_evidence: [],
      dependencies: [], external_prerequisite_targets: [],
      active_pack_id: 'pedagogy_v2_still', active_lexeme_id: 'lexeme:still',
    }).valid).toBe(true)
    expect(validateLessonEngineContextV2({ context_version: 2, profile_id: 'p1', now: 'x', learner_states: null, recent_evidence: [] }).errors)
      .toEqual(expect.arrayContaining([
        expect.stringContaining('CONTEXT_NOW_INVALID'),
        expect.stringContaining('CONTEXT_STATES_REQUIRED'),
        expect.stringContaining('CONTEXT_DEPENDENCIES_REQUIRED'),
        expect.stringContaining('CONTEXT_EXTERNAL_TARGETS_REQUIRED'),
      ]))
    expect(validateLessonEngineContextV2({
      context_version: 1, profile_id: 'p1', now: NOW, learner_states: [], recent_evidence: [],
      dependencies: [], external_prerequisite_targets: [],
    }).errors).toContainEqual(expect.stringContaining('CONTEXT_VERSION_INVALID'))
  })
})
