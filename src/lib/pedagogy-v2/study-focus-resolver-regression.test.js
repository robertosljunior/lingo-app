// study-focus-resolver-regression.test.js — Slice V2.16 §12/§23. Real three-pack
// (still/but/yet) resolution through the SHARED resolver: it materializes an
// activity, terminates far under the old cap of 60 (no magic constant), and the
// controller resolves the SAME focus/plan as a direct resolver call given the
// same logical snapshot (controller ↔ resolver equivalence).

import { describe, it, expect } from 'vitest'
import { loadPedagogyV2Registry } from './registry.js'
import { createStudySessionV2 } from './study-planner-contracts.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { resolveNextStudyActivityV2 } from './study-focus-resolver.js'
import { createStudySessionControllerV2 } from './study-session-controller.js'
import { studyFocusKeyV2 } from './study-planner.js'
import { detectRuntimeCapabilitiesV2, computeRecipeRuntimeAvailability } from './runtime-capabilities.js'

const registry = loadPedagogyV2Registry()
const NOW = '2026-07-21T10:00:00.000Z'
const DAY = 24 * 60 * 60 * 1000

// A learner who has practiced a couple of still uses (so the planner has review
// + progression candidates across packs to rank).
function seededStates() {
  const t0 = Date.parse(NOW) - 8 * DAY
  const ev = []
  let n = 0
  const rec = (target_type, target_id, modality, outcome = 'correct') => {
    for (let i = 0; i < 3; i++) {
      n++
      ev.push(buildLearnerEvidenceV2({
        evidence_id: `evidence:reg.${n}`, profile_id: 'p1', interaction_id: `interaction:reg.${n}`,
        session_id: 'session:reg', target: { target_type, target_id },
        exemplar_id: null,
        activity: { activity_kind: modality === 'listening' ? 'listening_recognition' : 'meaning_recognition', capability: 'recognition', modality },
        attribution: 'direct', outcome,
        occurred_at: new Date(t0 + n * 60000).toISOString(), source: { source_type: 'test' },
      }))
    }
  }
  rec('sense', 'sense:still.continuity', 'reading')
  rec('construction', 'construction:still.subject_still_lexical_verb', 'reading')
  return aggregateProfileEvidence(ev)
}

const availability = computeRecipeRuntimeAvailability(detectRuntimeCapabilitiesV2({ ttsSupported: false, sttSupported: false }))

function resolveOnce(states) {
  const counter = {}
  return resolveNextStudyActivityV2({
    registry,
    learnerStates: states,
    recentEvidence: states.length ? [] : [],
    studySession: createStudySessionV2({ study_session_id: 'reg', mode: 'adaptive', profile_id: 'p1', now: NOW, seed: 'reg' }),
    lessonSessions: {},
    runtimeAvailability: availability,
    profileId: 'p1',
    now: NOW,
    makeLessonSessionId: (pack) => { counter[pack] = (counter[pack] || 0) + 1; return `ls:${pack}:${counter[pack]}` },
  })
}

describe('§23 — three-pack resolution has no magic cap', () => {
  it('materializes an activity, attempted far under 60, unique attempts, within the candidate universe', () => {
    const r = resolveOnce(seededStates())
    expect(r.status).toBe('activity')
    expect(r.resolution_trace.attempted_count).toBeLessThan(60)
    expect(r.resolution_trace.attempted_count).toBeLessThanOrEqual(r.resolution_trace.candidate_count)
    const keys = r.resolution_trace.attempts.map((a) => a.focus_key)
    expect(new Set(keys).size).toBe(keys.length) // no duplicate attempts
    // selected focus is a real planner candidate
    expect(studyFocusKeyV2(r.focus)).toBe(r.resolution_trace.selected.focus_key)
  })

  it('a brand-new learner also resolves (planner_empty only when nothing is eligible)', () => {
    const r = resolveOnce([])
    expect(['activity', 'planner_empty', 'no_materializable_focus']).toContain(r.status)
    // a fresh learner should get an introduction activity
    expect(r.status).toBe('activity')
  })

  it('§32 — deterministic: identical resolution trace across runs', () => {
    const states = seededStates()
    const a = resolveOnce(states)
    const b = resolveOnce(states)
    expect(JSON.stringify(a.resolution_trace)).toBe(JSON.stringify(b.resolution_trace))
    expect(studyFocusKeyV2(a.focus)).toBe(studyFocusKeyV2(b.focus))
  })
})

describe('§12 — controller ↔ resolver equivalence', () => {
  it('the controller presents the SAME focus/plan the resolver selects for the same snapshot', async () => {
    const states = seededStates()
    const direct = resolveOnce(states)
    expect(direct.status).toBe('activity')

    // Drive the controller with the same fixed snapshot + deterministic ids.
    const counter = {}
    const controller = createStudySessionControllerV2({
      profileId: 'p1', registry, mode: 'adaptive',
      now: () => NOW,
      makeStudySessionId: () => 'reg',
      makeLessonSessionId: (pack) => { counter[pack] = (counter[pack] || 0) + 1; return `ls:${pack}:${counter[pack]}` },
      buildPlannerContext: async () => ({ learner_states: states, recent_evidence: [], now: NOW }),
      recordBatch: async () => ({ recorded: [], skipped: [], state_keys: [] }),
      capabilities: detectRuntimeCapabilitiesV2({ ttsSupported: false, sttSupported: false }),
    })
    await controller.start()
    const s = controller.getState()
    expect(s.status).toBe('presenting')
    expect(studyFocusKeyV2(s.focus)).toBe(studyFocusKeyV2(direct.focus))
    expect(s.plan.activity_id).toBe(direct.engine_decision.plan.activity_id)
    // and the controller surfaces the resolution trace for diagnostics
    expect(s.resolution.status).toBe('activity')
    expect(s.resolution.resolution_trace.selected.focus_key).toBe(direct.resolution_trace.selected.focus_key)
  })
})
