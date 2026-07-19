// independence-alignment.test.js — §13 (planner) + §14 (engine) + §12.13–15
// (review-queue runtime) of Slice V2.8. Proves the Planner→Engine alignment:
// independence is only ever a focus where an executable, unaided, assessed
// recipe exists; the engine never serves an independence focus as a supported
// activity and rejects an impossible one explicitly; and the runtime gates
// everything (no microphone ⇒ no speaking, no audio ⇒ no listening).

import { describe, it, expect } from 'vitest'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { loadPedagogyV2Registry } from './registry.js'
import { buildStudyCandidatesV2, selectNextStudyFocusV2, studyFocusToLessonScopeV2 } from './study-planner.js'
import { createStudySessionV2 } from './study-planner-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import { buildReviewQueueV2 } from './review-queue.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { canTrainIndependentV2 } from './training-affordances.js'

const registry = loadPedagogyV2Registry()
const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)).toISOString()
const B_CONTRAST = { target_type: 'sense', target_id: 'sense:but.contrast' }
const B_CLAUSE = { target_type: 'construction', target_id: 'construction:but.clause_but_clause' }
const FULL = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const avail = (caps) => computeRecipeRuntimeAvailability(caps)

let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:ia.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1', interaction_id: `interaction:ia${seq}`,
  target, exemplar_id: null, activity,
  attribution: 'direct', outcome: 'correct', occurred_at: NOW, source: { source_type: 'test' },
  ...over,
})
const supportedEvidence = (target, activity, n = 4) => Array.from({ length: n }, () =>
  ev(target, activity, { support: { features: ['translation'], hint_count: 0, attempt_number: 1 } }))
const states = (events) => aggregateProfileEvidence(events)
const WRITE_CTRL = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing' }
const WRITE_FREE = { activity_kind: 'free_production', capability: 'free_production', modality: 'writing' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const session = (over = {}) => createStudySessionV2({ study_session_id: 's', mode: 'adaptive', now: NOW, ...over })

// ---- §13 planner ------------------------------------------------------------

describe('§13.16 — no impossible independence focus is ever generated', () => {
  it('every independence candidate names a domain that CAN be trained independently', () => {
    const st = states([
      ...supportedEvidence(B_CONTRAST, READ_REC, 6),   // recognition established (no indep recipe)
      ...supportedEvidence(B_CLAUSE, WRITE_CTRL, 4),    // controlled writing established (indep recipe)
    ])
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: avail(FULL) })
    for (const c of cands.filter((x) => x.focus_type === 'independence')) {
      expect(canTrainIndependentV2(c.capability, c.modality, { runtimeAvailability: avail(FULL) })).toBe(true)
    }
    // Specifically: no recognition independence candidate exists.
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'recognition')).toBe(false)
  })
})

describe('§13.17 — controlled writing independence is possible', () => {
  it('generates an independence candidate for controlled_production/writing', () => {
    const st = states(supportedEvidence(B_CLAUSE, WRITE_CTRL, 4))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: avail(FULL) })
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'controlled_production' && c.modality === 'writing')).toBe(true)
  })
})

describe('§13.18 — free production independence is possible when ready', () => {
  it('generates an independence candidate for free_production/writing once supported established', () => {
    const st = states(supportedEvidence(B_CLAUSE, WRITE_FREE, 4))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: avail(FULL) })
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'free_production' && c.modality === 'writing')).toBe(true)
  })
})

describe('§13.19 — recognition advances to the next gap instead of looping', () => {
  it('established supported recognition offers a progression focus, never a recognition independence loop', () => {
    const st = states(supportedEvidence(B_CONTRAST, READ_REC, 6))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: avail(FULL) })
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'recognition')).toBe(false)
    // A real forward step exists: a modality gap (listening) or the next ladder
    // rung (comprehension) — never only recognition-reading again.
    const forward = cands.filter((c) => !(c.capability === 'recognition' && c.modality === 'reading'))
    expect(forward.length).toBeGreaterThan(0)
  })
})

describe('§13.20 — comprehension does not enter an independence loop', () => {
  it('no independence candidate for comprehension even when supported established', () => {
    const st = states(supportedEvidence(B_CONTRAST, { activity_kind: 'meaning_recognition', capability: 'comprehension', modality: 'reading' }, 6))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: avail(FULL) })
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'comprehension')).toBe(false)
  })
})

describe('§13.21 — a weak but trainable modality stays prioritized', () => {
  it('strong reading, absent listening surfaces a listening candidate (listening is executable)', () => {
    const st = states(supportedEvidence(B_CONTRAST, READ_REC, 4))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: avail(FULL) })
    expect(cands.some((c) => c.modality === 'listening')).toBe(true)
  })
})

describe('§13.22 — a runtime without audio never proposes an impossible listening focus', () => {
  it('the selected focus is never a listening focus when audio output is unavailable', () => {
    const noAudio = avail({ ...FULL, audio_output: false })
    const st = states(supportedEvidence(B_CONTRAST, READ_REC, 4))
    const d = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: [], studySession: session(), runtimeAvailability: noAudio })
    if (d.status === 'focus' && d.focus.capability) expect(d.focus.modality).not.toBe('listening')
    // And no viable listening candidate survived the runtime filter.
    const viable = (d.trace.candidates || []).filter((c) => c.adjusted_score != null)
    expect(viable.some((c) => c.modality === 'listening')).toBe(false)
  })
})

describe('§13.23 — same input ⇒ same decision', () => {
  it('two identical planning calls select the identical focus', () => {
    const st = states(supportedEvidence(B_CONTRAST, READ_REC, 4))
    const a = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: [], studySession: session(), runtimeAvailability: avail(FULL) })
    const b = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: [], studySession: session(), runtimeAvailability: avail(FULL) })
    expect(a.focus).toEqual(b.focus)
  })
})

// ---- §14 engine -------------------------------------------------------------

function runEngine(focusFields, over = {}) {
  const focus = { target_id: null, capability: null, modality: null, require_independent: false, ...focusFields }
  return selectNextActivityV2({
    session: createLessonSessionV2({ session_id: 'ls', profile_id: 'p1', now: NOW }),
    scope: { registry, pack_id: 'pedagogy_v2_but', lexeme_id: 'lexeme:but' },
    learnerStates: over.learnerStates || [], recentEvidence: [],
    runtimeAvailability: avail(FULL), focus,
  })
}

describe('§14.25 + §14.28 — an impossible independence focus is rejected with no supported fallback', () => {
  it('recognition independence returns FOCUS_INDEPENDENCE_NOT_EXECUTABLE and a null plan', () => {
    const d = runEngine({ capability: 'recognition', modality: 'reading', require_independent: true })
    expect(d.status).toBe('focus_not_executable')
    expect(d.reason).toBe('FOCUS_INDEPENDENCE_NOT_EXECUTABLE')
    expect(d.plan).toBeNull() // never a silent supported activity
  })

  it('comprehension independence is likewise rejected', () => {
    const d = runEngine({ capability: 'comprehension', modality: 'reading', require_independent: true })
    expect(d.status).toBe('focus_not_executable')
    expect(d.plan).toBeNull()
  })
})

describe('§14.24 + §14.26 + §14.27 — a served independence focus is unaided and on-domain', () => {
  // End-to-end over the real pipeline: every independence activity the engine
  // actually produced during a simulation trained the requested domain unaided.
  it('every independence activity in a real run is tier none and matches the focus domain', async () => {
    const { runSimulationV2 } = await import('./simulation-runner.js')
    const { buildStandardScenarioV2 } = await import('./simulation-scenarios.js')
    const r = await runSimulationV2(buildStandardScenarioV2('fast-learner', { maximum_interactions: 80 }), { registry })
    const independenceActivities = r.interactions.filter((it) => it.study_focus?.focus_type === 'independence')
    expect(independenceActivities.length).toBeGreaterThan(0) // the loop is broken → independence IS reached
    for (const it of independenceActivities) {
      expect(it.support_tier).toBe('none')                      // §14.24
      expect(it.capability).toBe(it.study_focus.capability)     // §14.26
      expect(it.modality).toBe(it.study_focus.modality)         // §14.27
    }
  })
})

describe('§14 — the scope adapter marks independence focuses require_independent', () => {
  it('studyFocusToLessonScopeV2 sets require_independent only for independence', () => {
    const indep = studyFocusToLessonScopeV2({ pack_id: 'pedagogy_v2_but', focus_type: 'independence', capability: 'controlled_production', modality: 'writing', target: B_CLAUSE }, registry)
    expect(indep.focus.require_independent).toBe(true)
    const deepen = studyFocusToLessonScopeV2({ pack_id: 'pedagogy_v2_but', focus_type: 'deepen', capability: 'recognition', modality: 'reading', target: B_CONTRAST }, registry)
    expect(deepen.focus.require_independent).toBe(false)
  })
})

// ---- §12.13–15 review queue runtime -----------------------------------------

describe('§12.13–14 — runtime availability gates SUPPORTED_WITHOUT_INDEPENDENT', () => {
  const speakingCtrl = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'speaking' }
  const st = () => states(Array.from({ length: 4 }, () =>
    ev(B_CLAUSE, speakingCtrl, { support: { features: ['translation'], hint_count: 0, attempt_number: 1 } })))
  const queueWith = (caps) => buildReviewQueueV2({ registry, learnerStates: st(), recentEvidence: [], now: NOW, runtimeAvailability: avail(caps) })

  it('13: no microphone removes the actionable independence need for speaking', () => {
    const q = queueWith({ ...FULL, speech_input: false })
    expect(q.some((i) => i.capability_key === 'speaking_controlled_production' && i.reason_codes.includes('SUPPORTED_WITHOUT_INDEPENDENT'))).toBe(false)
  })

  it('14: restoring the microphone makes the need eligible again', () => {
    const q = queueWith(FULL)
    expect(q.some((i) => i.capability_key === 'speaking_controlled_production' && i.reason_codes.includes('SUPPORTED_WITHOUT_INDEPENDENT'))).toBe(true)
  })
})

describe('§12.15 — the review queue is deterministic', () => {
  it('the same inputs yield an identical queue regardless of evidence order', () => {
    const events = supportedEvidence(B_CLAUSE, WRITE_CTRL, 4)
    const q1 = buildReviewQueueV2({ registry, learnerStates: states(events), recentEvidence: events, now: NOW, runtimeAvailability: avail(FULL) })
    const q2 = buildReviewQueueV2({ registry, learnerStates: states([...events].reverse()), recentEvidence: [...events].reverse(), now: NOW, runtimeAvailability: avail(FULL) })
    expect(q1).toEqual(q2)
  })
})
