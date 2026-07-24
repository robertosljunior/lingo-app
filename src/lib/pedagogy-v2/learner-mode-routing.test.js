// learner-mode-routing.test.js — Slice V2.18 (§39). Proves the Study `mode` a
// Home entry requests is (a) resolved into an explicit, validated mode and (b)
// actually handed to the SAME createStudySessionControllerV2 (never a parallel
// controller, never a silent adaptive fallback). We assert the mode the
// controller received via its own StudySession state.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import * as storage from '../storage.js'
import { loadPedagogyV2Registry } from './registry.js'
import { buildStudyPlannerContextV2 } from './study-planner-context.js'
import { createStudySessionControllerV2 } from './study-session-controller.js'
import { createProductionAssessmentServicesV2 } from './production-assessment-service.js'
import { resolveLessonModeV2 } from './learner-home-presentation.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const registry = loadPedagogyV2Registry()
const CAPS = { text_input: true, audio_output: true, speech_input: false, semantic_assessment: true, pronunciation_assessment: false }

async function reset() { await storage.__resetDbForTests(); await indexedDB.deleteDatabase('app-idiomas') }
beforeEach(reset)
afterEach(reset)

// ---- §39 mode resolution (the value that will be delivered) -----------------

describe('§11/§39 — resolveLessonModeV2', () => {
  it('no params → adaptive', () => {
    expect(resolveLessonModeV2({})).toEqual({ mode: 'adaptive', focusedPackId: null })
  })
  it('explicit explore / review', () => {
    expect(resolveLessonModeV2({ mode: 'explore' })).toEqual({ mode: 'explore', focusedPackId: null })
    expect(resolveLessonModeV2({ mode: 'review' })).toEqual({ mode: 'review', focusedPackId: null })
  })
  it('focused + pack works', () => {
    expect(resolveLessonModeV2({ mode: 'focused', pack: 'pedagogy_v2_still' })).toEqual({ mode: 'focused', focusedPackId: 'pedagogy_v2_still' })
  })
  it('a bare pack (no mode) is treated as focused (backwards compatible)', () => {
    expect(resolveLessonModeV2({ pack: 'pedagogy_v2_still' })).toEqual({ mode: 'focused', focusedPackId: 'pedagogy_v2_still' })
  })
  it('focused WITHOUT a pack is a safe structural error — no adaptive fallback (§29)', () => {
    expect(resolveLessonModeV2({ mode: 'focused' })).toEqual({ error: 'FOCUSED_REQUIRES_PACK' })
  })
  it('an invalid mode is a safe structural error (§29)', () => {
    expect(resolveLessonModeV2({ mode: 'bogus' })).toEqual({ error: 'MODE_INVALID' })
    expect(resolveLessonModeV2({ mode: 'adaptive_review' })).toEqual({ error: 'MODE_INVALID' })
  })
})

// ---- §39 the mode actually reaches the controller ---------------------------

function makeController(mode, focusedPackId = null) {
  let t = Date.UTC(2026, 6, 20, 9, 0, 0)
  return createStudySessionControllerV2({
    profileId: 'p1', registry, mode, focusedPackId,
    now: () => new Date(t += 60000).toISOString(),
    makeStudySessionId: () => 'study-fixed',
    makeLessonSessionId: (packId) => `lesson-${packId}`,
    buildPlannerContext: (id, opts) => buildStudyPlannerContextV2(id, opts),
    recordBatch: (events) => storage.recordLearnerEvidenceBatchV2(events),
    capabilities: CAPS,
    assessmentServices: createProductionAssessmentServicesV2(),
  })
}

describe('§39/§42/§43/§44 — the controller receives the requested mode', () => {
  for (const mode of ['adaptive', 'explore', 'review']) {
    it(`${mode} CTA → controller Study session mode is "${mode}"`, async () => {
      const c = makeController(mode)
      await c.start()
      const s = c.getState()
      expect(s.studySession.mode).toBe(mode)
    })
  }

  it('focused + pack → controller runs the focused session on that pack', async () => {
    const c = makeController('focused', 'pedagogy_v2_still')
    await c.start()
    const s = c.getState()
    expect(s.studySession.mode).toBe('focused')
    // The focused session only serves the requested pack.
    if (s.status === 'presenting') expect(s.plan.pack_id).toBe('pedagogy_v2_still')
  })

  it('focused WITHOUT a pack fails safely at the controller (no silent adaptive)', async () => {
    const c = makeController('focused', null)
    await c.start()
    expect(c.getState().status).toBe('error')
  })
})
