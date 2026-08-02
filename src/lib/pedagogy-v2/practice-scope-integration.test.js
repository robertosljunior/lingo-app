// practice-scope-integration.test.js — Slice V2.22-UX2 §28 (Scope + Scramble).
//
// The unit tests prove the scope OBJECT is well formed. This proves the whole
// pipeline honours it: Planner → Focus → Engine, with a learner model built from
// REAL evidence, no injected ActivityPlan and no relaxed threshold.
//
// The two claims that matter:
//   1. a scoped session can only ever materialize authored content (§29);
//   2. "Montar frases" reaches word_order_reconstruction when the ladder allows
//      it, and changes NOTHING when it does not (§13) — a preference must never
//      buy a rung the learner has not earned.

import { describe, it, expect } from 'vitest'
import { loadPedagogyV2Registry } from './registry.js'
import { buildStudyScopeFromCollectionV2 } from './study-scope.js'
import { selectNextStudyFocusV2, studyFocusToLessonScopeV2 } from './study-planner.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { loadPracticeCollectionsV2 } from './practice-collections.js'

const registry = loadPedagogyV2Registry()
const NOW = '2026-08-02T10:00:00.000Z'
const COLLECTIONS = loadPracticeCollectionsV2().collections

let seq = 0
function evidenceFor(targetId, modality, n, capability = 'recognition') {
  return Array.from({ length: n }, () => {
    seq++
    return {
      schema_version: 1, learner_model_version: 1, evidence_id: `evidence:t.${seq}`, profile_id: 'p',
      interaction_id: `interaction:t.${seq}`, session_id: 'sess',
      target: { target_type: targetId.startsWith('sense:') ? 'sense' : 'construction', target_id: targetId },
      exemplar_id: null,
      activity: {
        activity_kind: capability === 'recognition'
          ? (modality === 'listening' ? 'listening_recognition' : 'meaning_recognition')
          : 'context_recognition',
        capability,
        modality,
      },
      attribution: 'direct', outcome: 'correct', partial_score: null, assessment_confidence: 1,
      support: { features: [], hint_count: 0, attempt_number: 1 }, source: { source_type: 'test' },
      occurred_at: new Date(Date.parse('2026-07-01T10:00:00Z') + seq * 60000).toISOString(),
    }
  })
}

/** A learner seeded up to `rung`. Evidence only — no hand-written lane state. */
function learnerAt(scope, rung) {
  const events = scope.allowed_target_ids.flatMap((t) => {
    const rows = [...evidenceFor(t, 'reading', 10), ...evidenceFor(t, 'listening', 10)]
    if (rung !== 'recognition') {
      rows.push(...evidenceFor(t, 'reading', 10, 'comprehension'), ...evidenceFor(t, 'listening', 10, 'comprehension'))
    }
    if (rung === 'controlled_production') {
      rows.push(...evidenceFor(t, 'writing', 10, 'controlled_production'))
    }
    return rows
  })
  return { events, states: aggregateProfileEvidence(events) }
}

/** One real planning + materialization round. No plan is ever injected. */
function planOnce(scope, { states, events }, recipePreference = null) {
  const studySession = {
    study_session_id: 's', mode: 'adaptive', profile_id: 'p',
    started_at: NOW, now: NOW, history: [], interactions: [],
  }
  const focus = selectNextStudyFocusV2({
    registry, learnerStates: states, recentEvidence: events, studySession, studyScope: scope,
  })?.focus
  if (!focus) return { focus: null, plan: null }
  const { scope: lessonScope, focus: engineFocus, policyOverride } = studyFocusToLessonScopeV2(focus, registry, scope)
  const decision = selectNextActivityV2({
    session: createLessonSessionV2({ session_id: 'l', profile_id: 'p', now: NOW }),
    scope: lessonScope, focus: engineFocus, learnerStates: states, recentEvidence: events,
    policy: { ...policyOverride, ...(recipePreference ? { recipe_preference: { recipe: recipePreference } } : {}) },
  })
  return { focus, plan: decision?.plan ?? null }
}

describe('a contextual scope drives the REAL pipeline (§28 Scope)', () => {
  it('every collection plans a real activity, and NEVER outside its authored content', () => {
    for (const c of COLLECTIONS) {
      const scope = buildStudyScopeFromCollectionV2(c.collection_id, registry)
      const learner = learnerAt(scope, 'controlled_production')
      const { focus, plan } = planOnce(scope, learner)
      expect(focus, `${c.collection_id} produced no focus`).toBeTruthy()
      expect(plan, `${c.collection_id} materialized nothing`).toBeTruthy()
      // §29 hard rule: the sentence came from the collection the learner chose.
      expect(scope.allowed_exemplar_ids).toContain(plan.exemplar_id)
      // …and the focus stayed inside the packs the collection spans.
      expect(scope.allowed_pack_ids).toContain(focus.pack_id)
    }
  })

  it('a collection genuinely crosses several internal packs (§28.1)', () => {
    for (const c of COLLECTIONS) {
      const scope = buildStudyScopeFromCollectionV2(c.collection_id, registry)
      expect(scope.allowed_pack_ids.length).toBeGreaterThan(1)
    }
  })

  it('a scoped session does not stall — it plans at every rung of the ladder (§28.3)', () => {
    const scope = buildStudyScopeFromCollectionV2('collection:work_and_study', registry)
    for (const rung of ['recognition', 'comprehension', 'controlled_production']) {
      const { plan } = planOnce(scope, learnerAt(scope, rung))
      expect(plan, `stalled at ${rung}`).toBeTruthy()
      expect(scope.allowed_exemplar_ids).toContain(plan.exemplar_id)
    }
  })

  it('is deterministic — the same learner plans the same activity twice (§28.5)', () => {
    const scope = buildStudyScopeFromCollectionV2('collection:ideas_and_opinions', registry)
    const learner = learnerAt(scope, 'controlled_production')
    const a = planOnce(scope, learner, 'word_order_reconstruction')
    const b = planOnce(scope, learner, 'word_order_reconstruction')
    expect(b.plan.exemplar_id).toBe(a.plan.exemplar_id)
    expect(b.plan.recipe).toBe(a.plan.recipe)
    expect(b.focus.pack_id).toBe(a.focus.pack_id)
  })
})

describe('"Montar frases" is honest (§13 / §28 Scramble)', () => {
  it('reaches word_order_reconstruction in EVERY collection once the rung is open', () => {
    for (const c of COLLECTIONS) {
      const scope = buildStudyScopeFromCollectionV2(c.collection_id, registry)
      const learner = learnerAt(scope, 'controlled_production')
      const { focus, plan } = planOnce(scope, learner, 'word_order_reconstruction')
      expect(focus.capability).toBe('controlled_production')
      expect(plan.recipe, `${c.collection_id} never served the scramble`).toBe('word_order_reconstruction')
      expect(scope.allowed_exemplar_ids).toContain(plan.exemplar_id)
      // The rail's own contract, so the UX1 interaction really is what appears.
      expect(plan.presentation?.token_source).toBeTruthy()
      expect(plan.response_contract?.response_type).toBe('ordered_tokens')
    }
  })

  it('changes the recipe but NOT the target, the capability or the sentence pool', () => {
    const scope = buildStudyScopeFromCollectionV2('collection:everyday_conversation', registry)
    const learner = learnerAt(scope, 'controlled_production')
    const plain = planOnce(scope, learner)
    const scramble = planOnce(scope, learner, 'word_order_reconstruction')
    expect(plain.plan.recipe).not.toBe('word_order_reconstruction') // the control
    expect(scramble.plan.recipe).toBe('word_order_reconstruction')
    // The PLANNER's decision is untouched — a preference is an engine-level
    // tie-break, never a way to choose what is trained.
    expect(scramble.focus.capability).toBe(plain.focus.capability)
    expect(scramble.focus.target?.target_id).toBe(plain.focus.target?.target_id)
    expect(scope.allowed_exemplar_ids).toContain(scramble.plan.exemplar_id)
  })

  it('buys NO rung: below controlled production the preference is inert (§13/§30)', () => {
    const scope = buildStudyScopeFromCollectionV2('collection:work_and_study', registry)
    for (const rung of ['recognition', 'comprehension']) {
      const learner = learnerAt(scope, rung)
      const plain = planOnce(scope, learner)
      const scramble = planOnce(scope, learner, 'word_order_reconstruction')
      // Identical decision: asking for a scramble the learner has not unlocked
      // does nothing at all — it never forces the recipe, never skips a
      // prerequisite and never grants evidence.
      expect(scramble.plan.recipe).toBe(plain.plan.recipe)
      expect(scramble.plan.recipe).not.toBe('word_order_reconstruction')
      expect(scramble.focus.capability).toBe(plain.focus.capability)
    }
  })
})
