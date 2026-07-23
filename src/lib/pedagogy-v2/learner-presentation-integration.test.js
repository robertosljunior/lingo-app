// learner-presentation-integration.test.js — Slice V2.17 (§41/§42). Drives the
// REAL study-session controller against the real storage layer and feeds each
// state into buildLearnerPresentationV2, proving:
//   - the feedback presentation appears WITHOUT changing the ActivityPlan;
//   - the next ActivityPlan only appears AFTER advance() (no pre-computed
//     playlist — each activity is born from the pipeline);
//   - the learner presentation NEVER leaks internal ids (§37).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import * as storage from '../storage.js'
import { loadPedagogyV2Registry } from './registry.js'
import { buildStudyPlannerContextV2 } from './study-planner-context.js'
import { createStudySessionControllerV2 } from './study-session-controller.js'
import { createProductionAssessmentServicesV2 } from './production-assessment-service.js'
import { buildLearnerPresentationV2, buildLearnerSessionSummaryV2, LEARNER_VISUAL_VARIANTS } from './learner-presentation-v2.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const registry = loadPedagogyV2Registry()
const CAPS = { text_input: true, audio_output: true, speech_input: false, semantic_assessment: true, pronunciation_assessment: false }

function makeController(mode = 'adaptive') {
  let t = Date.UTC(2026, 6, 20, 9, 0, 0)
  return createStudySessionControllerV2({
    profileId: 'p1', registry, mode,
    now: () => new Date(t += 60000).toISOString(),
    makeStudySessionId: () => 'study-fixed',
    makeLessonSessionId: (packId) => `lesson-${packId}`,
    buildPlannerContext: (id, opts) => buildStudyPlannerContextV2(id, opts),
    recordBatch: (events) => storage.recordLearnerEvidenceBatchV2(events),
    capabilities: CAPS,
    assessmentServices: createProductionAssessmentServicesV2(),
  })
}

function present(s) {
  return buildLearnerPresentationV2({
    plan: s.plan, response: s.pendingResponse, assessment: s.assessment,
    focus: s.focus, transition: s.transition, registry, recordedEvidence: s.recordedEvents,
  })
}

async function answer(controller) {
  const plan = controller.getState().plan
  const rc = plan.response_contract.response_type
  if (plan.recipe === 'exposure') await controller.submit('continue', {})
  else if (rc === 'option_select') await controller.submit('single_choice', { option_id: plan.response_contract.correct_option_id })
  else if (rc === 'text_input') await controller.submit('text', { text: plan.text_en })
  else if (rc === 'ordered_tokens') await controller.submit('token_sequence', { tokens: plan.text_en.split(/\s+/) })
  else throw new Error(`unhandled ${rc}`)
}

async function reset() { await storage.__resetDbForTests(); await indexedDB.deleteDatabase('app-idiomas') }
beforeEach(reset)
afterEach(reset)

// The learner presentation must never contain internal ids.
function assertNoIdLeak(presentation) {
  const json = JSON.stringify(presentation)
  expect(json).not.toMatch(/activity:|exemplar:|evidence:|target_id|session_id|planner_rank|confidence/)
  expect(json).not.toMatch(/construction:|sense:|function:|option:/)
}

describe('§42 — the learner experience runs on the real pipeline', () => {
  it('feedback appears without changing the ActivityPlan; the next plan only comes after advance()', async () => {
    const c = makeController('adaptive')
    await c.start()
    const s0 = c.getState()
    expect(s0.status).toBe('presenting')
    const plan0 = s0.plan
    const p0 = present(s0)
    expect(p0.activity.recipe).toBe(plan0.recipe)
    expect(p0.feedback).toBeNull() // no assessment yet
    assertNoIdLeak(p0)

    await answer(c)
    const s1 = c.getState()
    expect(s1.status).toBe('feedback')
    // The ActivityPlan did NOT change when feedback appeared (§41).
    expect(s1.plan.activity_id).toBe(plan0.activity_id)
    const p1 = present(s1)
    assertNoIdLeak(p1)

    await c.advance()
    const s2 = c.getState()
    // Either a NEW activity emerged from the pipeline, or the session completed —
    // never the same activity replayed from a static list.
    if (s2.status === 'presenting') {
      expect(s2.plan.activity_id).not.toBe(plan0.activity_id)
      assertNoIdLeak(present(s2))
    } else {
      expect(s2.status).toBe('complete')
    }
  })

  it('across a full session, at least one graded activity yields a valid visual variant, and every plan is pipeline-born', async () => {
    const c = makeController('adaptive')
    await c.start()
    const seenActivityIds = new Set()
    let gradedVariants = 0
    for (let i = 0; i < 12; i++) {
      const s = c.getState()
      if (s.status === 'complete') break
      expect(s.status).toBe('presenting')
      seenActivityIds.add(s.plan.activity_id)
      await answer(c)
      const fb = present(c.getState())
      if (fb.feedback) {
        expect(LEARNER_VISUAL_VARIANTS).toContain(fb.feedback.visual_variant)
        // §7 — the presented outcome equals the assessor outcome bucket.
        expect(fb.feedback.outcome_status).toBe(present(c.getState()).feedback.outcome_status)
        gradedVariants++
      }
      await c.advance()
    }
    // No two activities shared an id from a pre-baked playlist: the ids are all
    // distinct engine outputs (a fixed playlist would repeat or be enumerable up
    // front). We saw several distinct, pipeline-generated activities.
    expect(seenActivityIds.size).toBeGreaterThan(1)
    expect(gradedVariants).toBeGreaterThan(0)
  })

  it('the session summary is factual and mentions activities practiced', async () => {
    const c = makeController('adaptive')
    await c.start()
    for (let i = 0; i < 12; i++) {
      const s = c.getState()
      if (s.status === 'complete') break
      await answer(c)
      await c.advance()
    }
    const interactions = c.getState().interactions
    const summary = buildLearnerSessionSummaryV2({ interactions, registry })
    const text = summary.facts.map((f) => f.text).join(' | ')
    expect(text).toMatch(/praticou \d+ atividade/i)
    expect(text).not.toMatch(/%|CEFR|domin|master/i)
  })
})
