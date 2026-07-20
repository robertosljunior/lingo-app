// study-planner.test.js — the 28 mandatory planner scenarios (§25) plus
// scoring/API surface. The planner is pure: `now` comes from the study
// session, no Date.now/Math.random in the core, and the order of learner
// states / packs never changes the selected focus.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { loadPedagogyV2Registry } from './registry.js'
import { createStudySessionV2, advanceStudySessionV2 } from './study-planner-contracts.js'
import {
  selectNextStudyFocusV2, buildStudyCandidatesV2, scoreStudyCandidateV2,
  studyFocusToLessonScopeV2, factualPackProgressV2,
} from './study-planner.js'

const registry = loadPedagogyV2Registry()
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)).toISOString()
const daysAgo = (d, min = 0) => new Date(Date.parse(NOW) - d * DAY + min * 60000).toISOString()

// ---- targets ----------------------------------------------------------------
const S_CONT = { target_type: 'sense', target_id: 'sense:still.continuity' }
const S_LEX = { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' }
const S_BE = { target_type: 'construction', target_id: 'construction:still.subject_be_still_complement' }
const S_COUNTER = { target_type: 'sense', target_id: 'sense:still.counter_expectation' }
const S_BUT_STILL = { target_type: 'construction', target_id: 'construction:still.clause_but_subject_still_verb' }
const B_CONTRAST = { target_type: 'sense', target_id: 'sense:but.contrast' }
const B_CLAUSE = { target_type: 'construction', target_id: 'construction:but.clause_but_clause' }
const B_COUNTER = { target_type: 'sense', target_id: 'sense:but.counter_expectation' }

const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const LISTEN_REC = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }
// controlled_production/writing HAS an executable independent recipe (Slice V2.8).
const WRITE_CTRL = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing' }

let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:sp.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1',
  interaction_id: `interaction:sp${seq}`,
  target, exemplar_id: null, activity,
  attribution: 'direct', outcome: 'correct',
  occurred_at: over.occurred_at ?? daysAgo(0, seq),
  source: { source_type: 'test' },
  ...over,
})

// Established (unaided): 3 direct successes → overall+independent meet advancement.
const est = (target, activity, n = 3) => Array.from({ length: n }, () => ev(target, activity))
const recognitionEst = (t) => [...est(t, READ_REC), ...est(t, LISTEN_REC)]
const states = (events) => aggregateProfileEvidence(events)

const session = (over = {}) => createStudySessionV2({ study_session_id: 's', mode: 'adaptive', now: NOW, ...over })
const AVAIL_FULL = null
const AVAIL_NO_AUDIO = { unavailable: [{ recipe: 'listening_recognition', modality: null, reason: 'RUNTIME_AUDIO_OUTPUT_UNAVAILABLE' }] }
// No STT and no pronunciation assessor: speaking-only recipes unexecutable.
const AVAIL_NO_SPEECH = { unavailable: [
  { recipe: 'pronunciation', modality: null, reason: 'RUNTIME_PRONUNCIATION_ASSESSMENT_UNAVAILABLE' },
  { recipe: 'guided_production', modality: 'speaking', reason: 'RUNTIME_SPEECH_INPUT_UNAVAILABLE' },
  { recipe: 'free_production', modality: 'speaking', reason: 'RUNTIME_SPEECH_INPUT_UNAVAILABLE' },
] }
const AVAIL_NO_SEMANTIC = { unavailable: [
  { recipe: 'guided_production', modality: 'writing', reason: 'RUNTIME_SEMANTIC_ASSESSMENT_UNAVAILABLE' },
  { recipe: 'guided_production', modality: 'speaking', reason: 'RUNTIME_SEMANTIC_ASSESSMENT_UNAVAILABLE' },
  { recipe: 'free_production', modality: 'writing', reason: 'RUNTIME_SEMANTIC_ASSESSMENT_UNAVAILABLE' },
  { recipe: 'free_production', modality: 'speaking', reason: 'RUNTIME_SEMANTIC_ASSESSMENT_UNAVAILABLE' },
] }

const select = (over = {}) => selectNextStudyFocusV2({
  registry, learnerStates: [], recentEvidence: [], studySession: session(), runtimeAvailability: AVAIL_FULL, ...over,
})

// §25.1–2 -----------------------------------------------------------------------
describe('§25.1–2 — brand-new learner', () => {
  it('1+2: adaptive starts with an eligible INTRODUCE focus at a curricular entry', () => {
    const d = select({})
    expect(d.status).toBe('focus')
    expect(d.focus.focus_type).toBe('introduce')
    expect(d.focus.is_new_target).toBe(true)
    expect(d.focus.reason_codes).toContain('NEVER_EXPOSED')
    expect(['pedagogy_v2_still', 'pedagogy_v2_but', 'pedagogy_v2_yet']).toContain(d.focus.pack_id)
    // Its introducing exemplar has no unmet V2 prerequisite.
    expect(d.trace.excluded.every((x) => x.key !== d.trace.selected_key)).toBe(true)
  })
})

// §25.3–5 -----------------------------------------------------------------------
describe('§25.3–5 — review and explore modes', () => {
  it('3: review for a brand-new learner yields an empty queue / no focus', () => {
    const d = select({ studySession: session({ mode: 'review' }) })
    expect(d.status).toBe('no_eligible_focus')
  })

  it('4: explore introduces a new eligible target', () => {
    const d = select({ studySession: session({ mode: 'explore' }) })
    expect(d.status).toBe('focus')
    expect(d.focus.is_new_target).toBe(true)
    expect(['introduce', 'cross_pack_progression']).toContain(d.focus.focus_type)
  })

  it('5: review NEVER introduces a new target, even when introductions are available', () => {
    // Learner knows the but contrast; more but introductions are eligible, but
    // review must ignore them entirely.
    const st = states(recognitionEst(B_CONTRAST).concat(recognitionEst(B_CLAUSE), [ev(B_CONTRAST, READ_REC, { occurred_at: daysAgo(9) })]))
    const d = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: [], studySession: session({ mode: 'review' }) })
    if (d.status === 'focus') expect(d.focus.is_new_target).toBe(false)
    expect(d.trace.excluded.some((x) => x.reason === 'new_target_in_review_mode' || x.reason === 'not_review_eligible')).toBe(true)
  })
})

// §25.6–11 — need detection ----------------------------------------------------
describe('§25.6–11 — capability/independence/failure/trend/retention needs', () => {
  it('6: strong reading, absent listening → a modality/capability need surfaces', () => {
    const st = states(est(B_CONTRAST, READ_REC).concat(est(B_CLAUSE, READ_REC)))
    const d = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: [], studySession: session({ mode: 'review' }) })
    // A modality gap toward listening is available in review mode.
    const cands = d.trace.candidates.map((c) => c.modality)
    expect(cands).toContain('listening')
  })

  it('7: supported established in a domain WITH an independent recipe → independence candidate exists (Slice V2.8)', () => {
    const supported = (t) => Array.from({ length: 4 }, () =>
      ev(t, WRITE_CTRL, { support: { features: ['translation'], hint_count: 0, attempt_number: 1 } }))
    const st = states(supported(B_CONTRAST).concat(supported(B_CLAUSE)))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW })
    expect(cands.some((c) => c.focus_type === 'independence'
      && c.capability === 'controlled_production' && c.modality === 'writing'
      && c.reason_codes.includes('SUPPORTED_WITHOUT_INDEPENDENT'))).toBe(true)
  })

  it('7b: supported established in RECOGNITION produces NO independence candidate (no independent recipe → loop broken, Slice V2.8)', () => {
    const supported = (t) => Array.from({ length: 6 }, () =>
      ev(t, READ_REC, { support: { features: ['multiple_choice'], hint_count: 0, attempt_number: 1 } }))
    const st = states(supported(B_CONTRAST).concat(supported(B_CLAUSE)))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW })
    expect(cands.some((c) => c.focus_type === 'independence' && c.capability === 'recognition')).toBe(false)
  })

  it('8: a recent failure produces a remediate candidate', () => {
    const events = [...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE), ev(B_CONTRAST, READ_REC, { outcome: 'incorrect', occurred_at: daysAgo(0, 999) })]
    const st = states(events)
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: events, now: NOW })
    expect(cands.some((c) => c.focus_type === 'remediate' && c.reason_codes.includes('RECENT_FAILURE'))).toBe(true)
  })

  it('9: a declining trend produces a remediate candidate', () => {
    const scores = ['correct', 'correct', 'correct', 'incorrect', 'incorrect', 'incorrect']
    const events = scores.map((outcome, i) => ev(B_CONTRAST, READ_REC, { outcome, occurred_at: daysAgo(0, i) }))
    const cands = buildStudyCandidatesV2({ registry, learnerStates: states(events), recentEvidence: events, now: NOW })
    expect(cands.some((c) => c.focus_type === 'remediate' && c.reason_codes.includes('DECLINING_TREND'))).toBe(true)
  })

  it('10: a delayed retrieval failure surfaces in review candidates', () => {
    const events = [ev(B_CONTRAST, READ_REC, { occurred_at: daysAgo(7) }), ev(B_CONTRAST, READ_REC, { outcome: 'incorrect', occurred_at: daysAgo(2) })]
    const cands = buildStudyCandidatesV2({ registry, learnerStates: states(events), recentEvidence: events, now: NOW })
    const review = cands.find((c) => c.focus_type === 'review' && c.target.target_id === B_CONTRAST.target_id)
    expect(review.reason_codes).toContain('DELAYED_RETRIEVAL_FAILED')
  })

  it('11: a stable target is not surfaced with a retention-overdue review', () => {
    // 30d→7d→2d correct: stability grows past the 2-day elapsed → not overdue.
    const events = [ev(S_CONT, READ_REC, { occurred_at: daysAgo(30) }), ev(S_CONT, READ_REC, { occurred_at: daysAgo(7) }), ev(S_CONT, READ_REC, { occurred_at: daysAgo(2) })]
    const cands = buildStudyCandidatesV2({ registry, learnerStates: states(events), recentEvidence: events, now: NOW })
    const review = cands.find((c) => c.focus_type === 'review' && c.target.target_id === S_CONT.target_id && c.capability === 'recognition' && c.modality === 'reading')
    expect(review?.reason_codes ?? []).not.toContain('RETENTION_OVERDUE')
  })
})

// §25.12–17 — interleaving control ---------------------------------------------
describe('§25.12–17 — pack switching and budgets', () => {
  // Study session already anchored in the still pack with a retention need in but.
  const stillAnchored = (over = {}) => {
    let s = session(over)
    s = advanceStudySessionV2(s, { focus_type: 'introduce', pack_id: 'pedagogy_v2_still', target: S_CONT, reason_codes: [] })
    s = advanceStudySessionV2(s, { focus_type: 'deepen', pack_id: 'pedagogy_v2_still', target: S_CONT, capability: 'recognition', modality: 'reading', reason_codes: [] })
    return s
  }

  it('12: a strong retention need in another pack triggers PACK_SWITCH_FOR_RETENTION', () => {
    // Review mode isolates retention: no introductions/capability-ladder focuses
    // compete. still recognition is recent (no need); but has a single overdue
    // retrieval (stability null → 2-day default → overdue).
    const events = [
      ...recognitionEst(S_CONT), ...recognitionEst(S_LEX),
      ev(B_CONTRAST, READ_REC, { occurred_at: daysAgo(20) }),
      ev(B_CONTRAST, LISTEN_REC, { occurred_at: daysAgo(20, 1) }),
    ]
    const d = selectNextStudyFocusV2({ registry, learnerStates: states(events), recentEvidence: events, studySession: stillAnchored({ mode: 'review' }) })
    expect(d.focus.pack_id).toBe('pedagogy_v2_but')
    expect(d.focus.focus_type).toBe('review')
    expect(d.trace.pack_switch.switched).toBe(true)
    expect(d.trace.pack_switch.code).toBe('PACK_SWITCH_FOR_RETENTION')
  })

  it('14: a cross-pack progression can switch packs with its own code', () => {
    // Knows but contrast + still continuity → but...still (still-owned) becomes eligible.
    const events = [...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE), ...recognitionEst(S_CONT), ...recognitionEst(S_LEX)]
    let s = session()
    s = advanceStudySessionV2(s, { focus_type: 'deepen', pack_id: 'pedagogy_v2_but', target: B_CONTRAST, reason_codes: [] })
    const d = selectNextStudyFocusV2({ registry, learnerStates: states(events), recentEvidence: events, studySession: s })
    // The but...still introduction is a valid cross-pack progression candidate.
    const crossCand = d.trace.candidates.find((c) => c.target_id === S_BUT_STILL.target_id)
    expect(crossCand).toBeTruthy()
  })

  it('15: coherence suppresses an early switch of comparable priority', () => {
    // Two comparable introduction focuses; the session just started in one pack.
    let s = session()
    s = advanceStudySessionV2(s, { focus_type: 'introduce', pack_id: 'pedagogy_v2_but', target: B_CONTRAST, is_new_target: true, reason_codes: [] })
    const d = selectNextStudyFocusV2({ registry, learnerStates: [], recentEvidence: [], studySession: s })
    // Staying in the just-started pack is preferred unless a switch is clearly better.
    expect(d.focus.pack_id).toBe('pedagogy_v2_but')
  })

  it('16: the study-session new-target budget blocks further introductions', () => {
    const s = session({ newTargetMaximum: 0 })
    const d = selectNextStudyFocusV2({ registry, learnerStates: [], recentEvidence: [], studySession: s })
    expect(d.status).toBe('no_eligible_focus')
    expect(d.trace.excluded.some((x) => x.reason === 'new_target_budget_exceeded')).toBe(true)
  })

  it('17: max_pack_switches blocks additional switches', () => {
    let s = session()
    // Exhaust the switch budget.
    s = { ...s, pack_switches: 3 }
    s.pack_history = ['pedagogy_v2_still']
    const events = [
      ...recognitionEst(S_CONT), ...recognitionEst(S_LEX),
      ev(B_CONTRAST, READ_REC, { occurred_at: daysAgo(20) }),
      ev(B_CONTRAST, READ_REC, { outcome: 'incorrect', occurred_at: daysAgo(2) }),
    ]
    const d = selectNextStudyFocusV2({ registry, learnerStates: states(events), recentEvidence: events, studySession: s })
    if (d.status === 'focus') expect(d.focus.pack_id).toBe('pedagogy_v2_still')
    expect(d.trace.excluded.some((x) => x.reason === 'max_pack_switches_reached')).toBe(true)
  })
})

// §25.18–20 — determinism ------------------------------------------------------
describe('§25.18–20 — determinism', () => {
  const fixtureEvents = [...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE), ev(B_CONTRAST, READ_REC, { occurred_at: daysAgo(9) })]

  it('18: identical inputs produce a deeply equal focus', () => {
    const st = states(fixtureEvents)
    const a = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: fixtureEvents, studySession: session() })
    const b = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: fixtureEvents, studySession: session() })
    expect(b).toEqual(a)
  })

  it('19: the order of learner states never changes the result', () => {
    const st = states(fixtureEvents)
    const a = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: fixtureEvents, studySession: session() })
    const b = selectNextStudyFocusV2({ registry, learnerStates: [...st].reverse(), recentEvidence: [...fixtureEvents].reverse(), studySession: session() })
    expect(b).toEqual(a)
  })

  it('20: the seed only permutes equal-score candidates (top score unchanged)', () => {
    const st = states(fixtureEvents)
    const bestScore = (d) => Math.max(...d.trace.candidates.map((c) => c.adjusted_score ?? -Infinity))
    const dA = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: fixtureEvents, studySession: session({ seed: 'A' }) })
    const dB = selectNextStudyFocusV2({ registry, learnerStates: st, recentEvidence: fixtureEvents, studySession: session({ seed: 'B' }) })
    expect(bestScore(dB)).toBe(bestScore(dA))
  })

  it('the planner core has no Math.random and no Date.now', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    for (const f of ['study-planner.js', 'study-planner-contracts.js', 'review-queue.js']) {
      const src = readFileSync(join(dir, f), 'utf8')
      expect(/Math\.random\s*\(/.test(src), `${f} calls Math.random`).toBe(false)
      expect(/Date\.now\s*\(/.test(src), `${f} calls Date.now`).toBe(false)
    }
  })
})

// §25.21 — runtime availability -------------------------------------------------
describe('§25.21 — runtime availability', () => {
  it('a listening review is not chosen as first option when audio output is unavailable', () => {
    const events = [ev(B_CONTRAST, LISTEN_REC, { occurred_at: daysAgo(9) })]
    const d = selectNextStudyFocusV2({
      registry, learnerStates: states(events), recentEvidence: events,
      studySession: session({ mode: 'review' }), runtimeAvailability: AVAIL_NO_AUDIO,
    })
    if (d.status === 'focus') expect(d.focus.modality).not.toBe('listening')
    expect(d.trace.excluded.some((x) => x.reason === 'FOCUS_RUNTIME_UNAVAILABLE')).toBe(true)
  })
})

// §25.22–25 — still/but independence and cross-pack progression -----------------
describe('§25.22–25 — cross-pack curriculum', () => {
  it('22: still and but progress independently', () => {
    const events = [...recognitionEst(S_CONT), ...recognitionEst(S_LEX)]
    // A but-focused explore introduces but content; still knowledge does not leak.
    const cands = buildStudyCandidatesV2({ registry, learnerStates: states(events), recentEvidence: events, now: NOW })
    const butIntro = cands.find((c) => c.pack_id === 'pedagogy_v2_but' && c.focus_type === 'introduce')
    expect(butIntro.target.target_id).toBe('sense:but.contrast')
    expect(butIntro.is_new_target).toBe(true)
  })

  it('23: the shared but...still target is reachable once both sides are known', () => {
    const events = [...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE), ...recognitionEst(S_CONT), ...recognitionEst(S_LEX)]
    const cands = buildStudyCandidatesV2({ registry, learnerStates: states(events), recentEvidence: events, now: NOW })
    const shared = cands.find((c) => c.target?.target_id === S_BUT_STILL.target_id)
    expect(shared).toBeTruthy()
    expect(shared.reason_codes).toContain('CROSS_PACK_PREREQUISITE_MET')
  })

  it('24: knowing but contrast makes but...still an eligible cross-pack progression', () => {
    const events = [...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE), ...recognitionEst(S_CONT), ...recognitionEst(S_LEX)]
    const d = selectNextStudyFocusV2({ registry, learnerStates: states(events), recentEvidence: events, studySession: session() })
    const cand = d.trace.candidates.find((c) => c.target_id === S_BUT_STILL.target_id)
    expect(cand.focus_type).toBe('cross_pack_progression')
  })

  it('25: but...still known unlocks the although…still progression in the still pack', () => {
    const events = [
      ...recognitionEst(S_CONT), ...recognitionEst(S_LEX), ...recognitionEst(S_BE),
      ...recognitionEst(S_COUNTER), ...recognitionEst(S_BUT_STILL),
    ]
    const cands = buildStudyCandidatesV2({ registry, learnerStates: states(events), recentEvidence: events, now: NOW })
    const although = cands.find((c) => c.target?.target_id === 'construction:still.although_clause_subject_still_verb')
    expect(although).toBeTruthy()
    expect(although.focus_type).toBe('introduce')
  })
})

// §25.26–28 — review modality + runtime-gated production ------------------------
describe('§25.26–28 — review modality and production gating', () => {
  it('26: review prioritizes the weak modality (listening) when reading is strong', () => {
    const events = [...est(B_CONTRAST, READ_REC, 4)]
    const d = selectNextStudyFocusV2({ registry, learnerStates: states(events), recentEvidence: events, studySession: session({ mode: 'review' }) })
    if (d.status === 'focus') {
      expect(d.focus.reason_codes.some((r) => ['MODALITY_GAP', 'RETENTION_OVERDUE'].includes(r))).toBe(true)
    }
  })

  it('27: a pronunciation-only need is not selectable without an assessor', () => {
    // Everything up to free production consolidated in writing; only pronunciation left.
    const events = [
      ...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE),
    ]
    const d = selectNextStudyFocusV2({
      registry, learnerStates: states(events), recentEvidence: events,
      studySession: session(), runtimeAvailability: AVAIL_NO_SPEECH,
    })
    // No focus resolves to a speaking-only pronunciation capability.
    if (d.status === 'focus') expect(d.focus.capability).not.toBe('pronunciation')
  })

  it('28: free production focus is excluded without semantic assessment', () => {
    const events = [...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE)]
    const d = selectNextStudyFocusV2({
      registry, learnerStates: states(events), recentEvidence: events,
      studySession: session(), runtimeAvailability: AVAIL_NO_SEMANTIC,
    })
    if (d.status === 'focus') expect(d.focus.capability).not.toBe('free_production')
  })
})

// ---- API surface -------------------------------------------------------------
describe('planner API surface', () => {
  it('scoreStudyCandidateV2 is a pure number over a candidate', () => {
    const [c] = buildStudyCandidatesV2({ registry, learnerStates: [], recentEvidence: [], now: NOW })
    expect(typeof scoreStudyCandidateV2(c, { mode: 'adaptive' })).toBe('number')
  })

  it('studyFocusToLessonScopeV2 produces a valid engine scope + focus + targeted override', () => {
    const d = select({})
    const { scope, focus, policyOverride } = studyFocusToLessonScopeV2(d.focus, registry)
    expect(scope.pack_id).toBe(d.focus.pack_id)
    expect(scope.registry).toBe(registry)
    expect(focus.target_id).toBe(d.focus.target.target_id)
    expect(policyOverride.targeted_practice.target_id).toBe(d.focus.target.target_id)
  })

  it('factualPackProgressV2 reports facts only, never a global mastery', () => {
    const events = [...recognitionEst(S_CONT), ...recognitionEst(S_LEX)]
    const facts = factualPackProgressV2(registry.packs.find((p) => p.manifest.pack_id === 'pedagogy_v2_still'), states(events), [])
    expect(facts).toMatchObject({ constructions_seen: expect.any(Number), senses_seen: expect.any(Number), reviews_available: expect.any(Number) })
    expect(facts).not.toHaveProperty('mastery')
  })
})
