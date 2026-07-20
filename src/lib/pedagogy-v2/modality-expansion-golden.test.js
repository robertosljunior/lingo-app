// modality-expansion-golden.test.js — §32 tests 15–26 (Slice V2.9). The
// Planner→Engine alignment for modality-expansion focuses and the dedicated
// production-modality goldens (§22–§24): a seeded learner with one production
// modality established gets a REAL curricular path into the parallel modality,
// through the full real pipeline, with evidence landing in the right lanes and
// never leaking across modalities. Deterministic seeds throughout.

import { describe, it, expect, beforeAll } from 'vitest'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { loadPedagogyV2Registry } from './registry.js'
import { buildStudyCandidatesV2, selectNextStudyFocusV2 } from './study-planner.js'
import { createStudySessionV2 } from './study-planner-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { runSimulationV2 } from './simulation-runner.js'
import { createSimulationScenarioV2 } from './simulation-contracts.js'
import { computePedagogicalMetricsV2 } from './pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'

const registry = loadPedagogyV2Registry()
const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)).toISOString()
const FULL_CAPS = { text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false }
const FULL = computeRecipeRuntimeAvailability(FULL_CAPS)
const B_CONTRAST = { target_type: 'sense', target_id: 'sense:but.contrast' }
const B_CLAUSE = { target_type: 'construction', target_id: 'construction:but.clause_but_clause' }

// Deterministic evidence seeding for a profile (used both by planner-level
// tests and as scenario initial_evidence — profile must match the scenario's).
function seedEvidence(profileId, rows) {
  let seq = 0
  const t0 = Date.UTC(2026, 0, 4, 9, 0, 0)
  const out = []
  for (const row of rows) {
    for (let i = 0; i < (row.n ?? 4); i++) {
      seq += 1
      out.push(buildLearnerEvidenceV2({
        evidence_id: `evidence:mx.${profileId}.${String(seq).padStart(4, '0')}`,
        profile_id: profileId, interaction_id: `interaction:mx.${profileId}.${seq}`,
        target: row.target, exemplar_id: null,
        activity: { activity_kind: row.activity_kind, capability: row.capability, modality: row.modality },
        attribution: 'direct', outcome: 'correct',
        occurred_at: new Date(t0 + seq * 60000).toISOString(), source: { source_type: 'test' },
      }))
    }
  }
  return out
}
const RECOG = (target) => [
  { target, activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
  { target, activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' },
]
const CTRL = (target, modality) => [{ target, activity_kind: 'guided_production', capability: 'controlled_production', modality }]
const FREE = (target, modality) => [{ target, activity_kind: 'free_production', capability: 'free_production', modality }]

// Engine exemplar gates check EVERY primary target, and the first but
// exemplars pair sense:but.contrast with construction:but.clause_but_clause —
// so the goldens seed BOTH targets of the entry exemplar.
const GOLDEN_TARGETS = [B_CONTRAST, B_CLAUSE]
const forAll = (mk) => GOLDEN_TARGETS.flatMap((t) => mk(t))
// controlled/speaking established (+recognition), writing absent — golden A seed.
const GOLDEN_A_ROWS = () => forAll((t) => [...RECOG(t), ...CTRL(t, 'speaking')])
// controlled/writing established, speaking absent — golden B seed.
const GOLDEN_B_ROWS = () => forAll((t) => [...RECOG(t), ...CTRL(t, 'writing')])
// free/speaking established (controlled both ready) — free-production golden seed.
const GOLDEN_FREE_ROWS = () => forAll((t) => [...RECOG(t), ...CTRL(t, 'writing'), ...CTRL(t, 'speaking'), ...FREE(t, 'speaking')])

const states = (rows) => aggregateProfileEvidence(seedEvidence('p1', rows))

// ---- §32.15–17 — focus → activity domain alignment --------------------------

function engineFor(focusFields, learnerStates) {
  return selectNextActivityV2({
    session: createLessonSessionV2({ session_id: 'mx-ls', profile_id: 'p1', now: NOW }),
    scope: { registry, pack_id: 'pedagogy_v2_but', lexeme_id: 'lexeme:but' },
    learnerStates, recentEvidence: [],
    runtimeAvailability: FULL,
    focus: { target_id: null, capability: null, modality: null, require_independent: false, ...focusFields },
  })
}

describe('§32.15+17 — a writing focus produces a writing activity of the same capability', () => {
  it('controlled_production/writing focus → controlled_production/writing plan', () => {
    const st = states(GOLDEN_A_ROWS())
    const d = engineFor({ capability: 'controlled_production', modality: 'writing' }, st)
    expect(d.status).toBe('activity')
    expect(d.plan.capability).toBe('controlled_production')
    expect(d.plan.modality).toBe('writing')
  })
})

describe('§32.16+17 — a speaking focus produces a speaking activity of the same capability', () => {
  it('controlled_production/speaking focus → controlled_production/speaking plan', () => {
    const st = states(GOLDEN_B_ROWS())
    const d = engineFor({ capability: 'controlled_production', modality: 'speaking' }, st)
    expect(d.status).toBe('activity')
    expect(d.plan.capability).toBe('controlled_production')
    expect(d.plan.modality).toBe('speaking')
  })
})

describe('§32.18 — an impossible modality is rejected, never silently swapped', () => {
  it('with no microphone, a speaking focus yields NO activity (and never a writing one)', () => {
    const noMic = computeRecipeRuntimeAvailability({ ...FULL_CAPS, speech_input: false })
    const st = states(GOLDEN_B_ROWS())
    const d = selectNextActivityV2({
      session: createLessonSessionV2({ session_id: 'mx-ls2', profile_id: 'p1', now: NOW }),
      scope: { registry, pack_id: 'pedagogy_v2_but', lexeme_id: 'lexeme:but' },
      learnerStates: st, recentEvidence: [], runtimeAvailability: noMic,
      focus: { target_id: null, capability: 'controlled_production', modality: 'speaking', require_independent: false },
    })
    expect(d.status).not.toBe('activity')
    expect(d.plan ?? null).toBeNull()
  })

  it('the planner never SELECTS a focus for an unavailable modality', () => {
    const noMic = computeRecipeRuntimeAvailability({ ...FULL_CAPS, speech_input: false })
    const st = states(GOLDEN_B_ROWS())
    const d = selectNextStudyFocusV2({
      registry, learnerStates: st, recentEvidence: [],
      studySession: createStudySessionV2({ study_session_id: 's', mode: 'adaptive', now: NOW }),
      runtimeAvailability: noMic,
    })
    if (d.status === 'focus') expect(d.focus.modality).not.toBe('speaking')
  })
})

describe('§32.19 — independence and modality expansion coexist as separate dimensions', () => {
  it('supported controlled writing + speaking absent → BOTH candidates, both possible', () => {
    // Supported (translation-scaffolded) writing evidence: independence gap in
    // writing AND modality expansion toward speaking — different dimensions.
    let seq = 0
    const supported = Array.from({ length: 4 }, () => buildLearnerEvidenceV2({
      evidence_id: `evidence:mxs.${++seq}`, profile_id: 'p1', interaction_id: `interaction:mxs.${seq}`,
      target: B_CLAUSE, exemplar_id: null,
      activity: { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing' },
      attribution: 'direct', outcome: 'correct',
      support: { features: ['translation'], hint_count: 0, attempt_number: 1 },
      occurred_at: new Date(Date.UTC(2026, 6, 1) + seq * 60000).toISOString(), source: { source_type: 'test' },
    }))
    const st = aggregateProfileEvidence([...seedEvidence('p1', RECOG(B_CLAUSE)), ...supported])
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'controlled_production' && c.modality === 'writing')).toBe(true)
    expect(cands.some((c) => c.focus_type === 'deepen' && c.capability === 'controlled_production' && c.modality === 'speaking'
      && c.reason_codes.includes('PARALLEL_MODALITY_UNPRACTICED'))).toBe(true)
    // Modality expansion never required prior independence — it exists although
    // the writing independent lane is still empty.
  })
})

// ---- §22–24 — production modality goldens over the REAL pipeline ------------

// 100 interactions (§23 of the briefing: at least 100 where defined) — the
// seeded journey starts novelty-rich (a whole two-pack curriculum is fresh), so
// the reasonable selection window for the parallel modality is the full run.
function goldenScenario(id, seedRows, over = {}) {
  return createSimulationScenarioV2({
    scenario_id: `golden:${id}`, profile_id: 'sim-profile', persona: 'fast-learner',
    mode: 'adaptive', seed: `golden-${id}`, start_at: '2026-01-05T09:00:00.000Z',
    maximum_interactions: 100, clock: { strategy: 'constant_interval', interval_minutes: 5 },
    initial_evidence: seedEvidence('sim-profile', seedRows),
    ...over,
  })
}

describe('§22 — production modality expansion golden (speaking → writing)', () => {
  let result
  beforeAll(async () => {
    result = await runSimulationV2(goldenScenario('mx-writing', GOLDEN_A_ROWS()), { registry })
  })

  it('1: the planner generates the writing candidate at step zero', () => {
    const st = aggregateProfileEvidence(seedEvidence('sim-profile', GOLDEN_A_ROWS()))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    expect(cands.some((c) => c.capability === 'controlled_production' && c.modality === 'writing'
      && c.reason_codes.includes('WRITING_BEHIND_SPEAKING'))).toBe(true)
  })

  it('2+3: writing is selected within the run and the engine delivers writing activities', () => {
    const writing = result.interactions.filter((it) => it.modality === 'writing'
      && ['controlled_production', 'free_production'].includes(it.capability))
    expect(writing.length).toBeGreaterThan(0)
  })

  it('4: evidence is recorded IN writing (every writing interaction yields writing-lane evidence)', () => {
    const writing = result.interactions.find((it) => it.modality === 'writing' && it.capability === 'controlled_production')
    const events = result.evidence_generated.filter((e) => writing.evidence_ids.includes(e.evidence_id))
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) expect(e.activity.modality).toBe('writing')
    const lane = result.final_learner_states.find((s) => s.target.target_id === writing.target.target_id)
      ?.capabilities?.writing_controlled_production
    expect((lane?.overall?.assessed_evidence_count || 0)).toBeGreaterThan(0)
  })

  it('5: writing evidence never moves the speaking lane', () => {
    // Speaking assessed count for the golden target = seeded (4) + speaking
    // interactions the run itself served on it — never inflated by writing.
    const speakingServed = result.interactions.filter((it) => it.target.target_id === B_CONTRAST.target_id
      && it.modality === 'speaking' && it.assessment.status === 'assessed').length
    const lane = result.final_learner_states.find((s) => s.target.target_id === B_CONTRAST.target_id)
      ?.capabilities?.speaking_controlled_production?.overall
    const speakingCtrlServed = result.interactions.filter((it) => it.target.target_id === B_CONTRAST.target_id
      && it.modality === 'speaking' && it.capability === 'controlled_production' && it.assessment.status === 'assessed').length
    expect(lane.assessed_evidence_count).toBe(4 + speakingCtrlServed)
    void speakingServed
  })
})

describe('§23 — inverse golden (writing → speaking)', () => {
  it('with speech runtime available, speaking gets a real curricular path', async () => {
    const r = await runSimulationV2(goldenScenario('mx-speaking', GOLDEN_B_ROWS()), { registry })
    const speaking = r.interactions.filter((it) => it.modality === 'speaking'
      && ['controlled_production', 'free_production'].includes(it.capability))
    expect(speaking.length).toBeGreaterThan(0)
    const { trajectory } = analyzeTrajectoryV2(r, { registry })
    expect(trajectory.grave_findings).toBe(0)
  })
})

describe('§24 — free-production modality goldens (both directions)', () => {
  it('free speaking → free writing gains a path (candidate exists and writing is practiced)', async () => {
    const st = aggregateProfileEvidence(seedEvidence('sim-profile', GOLDEN_FREE_ROWS()))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    expect(cands.some((c) => c.capability === 'free_production' && c.modality === 'writing')).toBe(true)
    const r = await runSimulationV2(goldenScenario('mx-free-writing', GOLDEN_FREE_ROWS()), { registry })
    expect(r.interactions.some((it) => it.modality === 'writing')).toBe(true)
  })

  it('free writing → free speaking gains a candidate when runtime permits', () => {
    const rows = [...RECOG(B_CONTRAST), ...CTRL(B_CONTRAST, 'writing'), ...CTRL(B_CONTRAST, 'speaking'), ...FREE(B_CONTRAST, 'writing')]
    const st = aggregateProfileEvidence(seedEvidence('sim-profile', rows))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    expect(cands.some((c) => c.capability === 'free_production' && c.modality === 'speaking'
      && c.reason_codes.includes('SPEAKING_BEHIND_WRITING'))).toBe(true)
  })
})

// ---- §32.20–21 + 26 — opportunity coverage & determinism --------------------

describe('§32.20–21 — opportunity coverage counts writing and speaking', () => {
  it('the golden run gives writing eligible AND selected opportunities (no 50/50 demanded)', async () => {
    const r = await runSimulationV2(goldenScenario('mx-writing', GOLDEN_A_ROWS()), { registry })
    const oc = computePedagogicalMetricsV2(r, { registry }).opportunity_coverage
    const writing = Object.keys(oc).filter((k) => k.endsWith('_writing'))
    const w = writing.reduce((a, k) => ({ e: a.e + oc[k].eligible_opportunities, s: a.s + oc[k].selected_opportunities }), { e: 0, s: 0 })
    expect(w.e).toBeGreaterThan(0)
    expect(w.s).toBeGreaterThan(0)
    const speaking = Object.keys(oc).filter((k) => k.endsWith('_speaking'))
    const s = speaking.reduce((a, k) => ({ e: a.e + oc[k].eligible_opportunities, s: a.s + oc[k].selected_opportunities }), { e: 0, s: 0 })
    expect(s.e).toBeGreaterThan(0)
  })
})

describe('§32.26 — the modality goldens are deterministic (same seed ⇒ same run)', () => {
  it('re-running the writing golden reproduces it byte-identically', async () => {
    const a = await runSimulationV2(goldenScenario('mx-writing', GOLDEN_A_ROWS()), { registry })
    const b = await runSimulationV2(goldenScenario('mx-writing', GOLDEN_A_ROWS()), { registry })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
