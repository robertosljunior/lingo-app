// independence-regression-golden.test.js — §24 / test 34 (Slice V2.8). The
// dedicated regression that pins the fix for the V2.7 independence loop. It
// seeds a learner whose RECOGNITION is supported-established but independent-
// absent, then drives a real simulation from that state and asserts the planner
// never asks for recognition independence, never emits an actionable
// SUPPORTED_WITHOUT_INDEPENDENT for recognition, chooses a legitimate other
// gap, and the run never trips INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY.

import { describe, it, expect, beforeAll } from 'vitest'
import { runSimulationV2 } from './simulation-runner.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { buildStudyCandidatesV2, selectNextStudyFocusV2 } from './study-planner.js'
import { buildReviewQueueV2 } from './review-queue.js'
import { createStudySessionV2 } from './study-planner-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import { loadPedagogyV2Registry } from './registry.js'

const registry = loadPedagogyV2Registry()
const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)).toISOString()
const FULL = computeRecipeRuntimeAvailability({ text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false })
const TARGET = { target_type: 'sense', target_id: 'sense:but.contrast' }

// recognition supported ESTABLISHED (6 aided answers), independent ABSENT.
let seq = 0
function supportedRecognitionState() {
  const events = Array.from({ length: 6 }, (_, i) => buildLearnerEvidenceV2({
    evidence_id: `evidence:reg.${String(++seq).padStart(4, '0')}`,
    profile_id: 'p1', interaction_id: `interaction:reg${seq}`,
    target: TARGET, exemplar_id: null,
    activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
    attribution: 'direct', outcome: 'correct',
    support: { features: ['multiple_choice'], hint_count: 0, attempt_number: 1 },
    occurred_at: new Date(Date.parse(NOW) - (6 - i) * 60000).toISOString(), source: { source_type: 'test' },
  }))
  return aggregateProfileEvidence(events)
}

describe('§24 / test 34 — independence mismatch regression', () => {
  let st
  beforeAll(() => { st = supportedRecognitionState() })

  it('the seeded state really is supported-established, independent-absent recognition', () => {
    const cap = st[0].capabilities.reading_recognition
    expect(cap.supported.evidence_level).not.toBe('insufficient')
    expect(cap.independent?.assessed_evidence_count || 0).toBe(0)
  })

  it('no recognition independence candidate is generated', () => {
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'recognition')).toBe(false)
  })

  it('no actionable SUPPORTED_WITHOUT_INDEPENDENT review need for recognition', () => {
    const q = buildReviewQueueV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    const recog = q.filter((i) => i.capability_key === 'reading_recognition')
    expect(recog.every((i) => !i.reason_codes.includes('SUPPORTED_WITHOUT_INDEPENDENT'))).toBe(true)
  })

  it('the planner picks another legitimate gap instead of looping on recognition', () => {
    const d = selectNextStudyFocusV2({
      registry, learnerStates: st, recentEvidence: [],
      studySession: createStudySessionV2({ study_session_id: 's', mode: 'adaptive', now: NOW }),
      runtimeAvailability: FULL,
    })
    expect(d.status).toBe('focus')
    expect(!(d.focus.focus_type === 'independence' && d.focus.capability === 'recognition')).toBe(true)
  })

  it('a full simulation from this state never trips INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY', async () => {
    // The support-dependent persona is the worst case (fails unaided); the run
    // must still never serve an independence focus as a supported activity.
    const scenario = buildStandardScenarioV2('support-dependent', {
      maximum_interactions: 100,
      initial_evidence: aggregateToEvidence(),
    })
    const r = await runSimulationV2(scenario, { registry })
    const { findings } = analyzeTrajectoryV2(r, { registry })
    expect(findings.some((f) => f.code === 'INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY')).toBe(false)
    for (const it of r.interactions) {
      if (it.study_focus?.focus_type === 'independence') expect(it.support_tier).toBe('none')
    }
  })
})

// The runner seeds from raw evidence; reproduce the same recognition-supported
// seed as evidence events for the scenario's initial_evidence.
function aggregateToEvidence() {
  let s = 0
  return Array.from({ length: 6 }, (_, i) => buildLearnerEvidenceV2({
    evidence_id: `evidence:regseed.${String(++s).padStart(4, '0')}`,
    profile_id: 'sim-profile', interaction_id: `interaction:regseed${s}`,
    target: TARGET, exemplar_id: null,
    activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
    attribution: 'direct', outcome: 'correct',
    support: { features: ['multiple_choice'], hint_count: 0, attempt_number: 1 },
    occurred_at: new Date(Date.UTC(2026, 0, 4, 9, 0, 0) + i * 60000).toISOString(), source: { source_type: 'test' },
  }))
}
