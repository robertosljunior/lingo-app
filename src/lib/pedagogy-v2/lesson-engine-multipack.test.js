// lesson-engine-multipack.test.js — mandatory engine tests of Slice V2.5
// (§25): the engine operates on a FORMAL scope { registry, pack_id,
// lexeme_id }, selects exemplars of the active pack only, resolves
// prerequisites across the whole registry (annotating external owners in the
// trace), and preserves determinism, budget and runtime availability.

import { describe, it, expect } from 'vitest'
import stillJson from '../../content/pedagogy-v2/still.json'
import butJson from '../../content/pedagogy-v2/but.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { createLessonSessionV2, appendActivityToSessionV2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { validateLessonDecisionV2 } from './lesson-engine-validator.js'
import { loadPedagogyV2Registry, buildPedagogyV2Registry, resolvePedagogyTarget } from './registry.js'

const registry = loadPedagogyV2Registry()
const BUT_SCOPE = { registry, pack_id: 'pedagogy_v2_but', lexeme_id: 'lexeme:but' }
const STILL_SCOPE = { registry, pack_id: 'pedagogy_v2_still', lexeme_id: 'lexeme:still' }

// ---- targets ----------------------------------------------------------------
const B_CONTRAST = { target_type: 'sense', target_id: 'sense:but.contrast' }
const B_COUNTER = { target_type: 'sense', target_id: 'sense:but.counter_expectation' }
const B_CLAUSE = { target_type: 'construction', target_id: 'construction:but.clause_but_clause' }
const B_ADJ = { target_type: 'construction', target_id: 'construction:but.adjective_but_adjective' }
const S_CONT = { target_type: 'sense', target_id: 'sense:still.continuity' }
const S_LEX = { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' }
const S_BE = { target_type: 'construction', target_id: 'construction:still.subject_be_still_complement' }
const S_COUNTER = { target_type: 'sense', target_id: 'sense:still.counter_expectation' }
const S_BUT_STILL = { target_type: 'construction', target_id: 'construction:still.clause_but_subject_still_verb' }

// ---- activities -------------------------------------------------------------
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const LISTEN_REC = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }

// ---- evidence fixtures ------------------------------------------------------
const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const iso = (minute) => new Date(T0 + minute * 60000).toISOString()
const NOW = iso(2000)

let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:mpx.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1',
  interaction_id: `interaction:${seq}`,
  target,
  exemplar_id: null,
  activity,
  attribution: 'direct',
  outcome: 'correct',
  occurred_at: iso(seq),
  source: { source_type: 'test' },
  ...over,
})

const exposureOf = (target) => [ev(target, EXPO, { attribution: 'exposure', outcome: 'observed' })]
const est = (target, activity, n = 3) => Array.from({ length: n }, () => ev(target, activity))
const recognitionEst = (t) => [...est(t, READ_REC), ...est(t, LISTEN_REC)]
const states = (events) => aggregateProfileEvidence(events)
const session = (over = {}) => createLessonSessionV2({ session_id: 'sess-mp', profile_id: 'p1', now: NOW, ...over })
const select = ({ scope = BUT_SCOPE, learnerStates = [], recentEvidence = [], policy = {}, sess = null, runtimeAvailability = null } = {}) =>
  selectNextActivityV2({ session: sess || session(), scope, learnerStates, recentEvidence, policy, runtimeAvailability })

// A learner who consolidated the basic but contrast (both recognition modalities).
const contrastKnown = () => [
  ...recognitionEst(B_CONTRAST), ...recognitionEst(B_CLAUSE),
]
// A learner who additionally consolidated the counter-expectation use.
const counterKnown = () => [
  ...contrastKnown(), ...recognitionEst(B_COUNTER),
]
// A learner with the still-side prerequisites of but...still consolidated.
const stillSideKnown = () => [
  ...recognitionEst(S_CONT), ...recognitionEst(S_LEX),
]

describe('§25.38–39 — a new but learner starts at exposure, then recognition', () => {
  it('38: brand-new learner gets exposure of the first but exemplar, scoped to the but pack', () => {
    const d = select({})
    expect(d.status).toBe('activity')
    expect(d.plan.recipe).toBe('exposure')
    expect(d.plan.exemplar_id).toBe('exemplar:but.001')
    expect(d.plan.text_en).toBe('I am tired, but I am happy.')
    expect(d.plan.pack_id).toBe('pedagogy_v2_but')
    expect(d.plan.lexeme_id).toBe('lexeme:but')
    expect(d.plan.lexeme_lemma).toBe('but')
    expect(validateLessonDecisionV2(d).errors).toEqual([])
  })

  it('39: after exposure, meaning recognition of the same exemplar follows', () => {
    const st = states([...exposureOf(B_CONTRAST), ...exposureOf(B_CLAUSE)])
    const d = select({ learnerStates: st })
    expect(d.plan.recipe).toBe('meaning_recognition')
    expect(d.plan.exemplar_id).toBe('exemplar:but.001')
    expect(d.plan.new_item_refs).toEqual([])
  })
})

describe('§25.40 — reading evidence never updates the listening lane', () => {
  it('reading-only recognition leaves listening capabilities empty', () => {
    const st = states([...est(B_CONTRAST, READ_REC), ...est(B_CLAUSE, READ_REC)])
    for (const s of st) {
      expect(s.capabilities.reading_recognition.overall.assessed_evidence_count).toBe(3)
      expect(s.capabilities.listening_recognition).toBeUndefined()
    }
  })
})

describe('§25.41 — contrast known, exception unknown', () => {
  it('progresses inside the but pack; exception consolidations stay blocked on their real prerequisites', () => {
    const d = select({ learnerStates: states(contrastKnown()) })
    expect(d.status).toBe('activity')
    // The next A2 rung: introduce the counter-expectation reading.
    expect(d.plan.exemplar_id).toBe('exemplar:but.005')
    expect(d.plan.new_item_refs).toEqual(['sense:but.counter_expectation'])
    // Exception consolidations require the (unknown) exception sense.
    const blocked = d.trace.excluded.find((x) => x.exemplar_id === 'exemplar:but.025')
    expect(blocked.reason).toBe('prerequisite_unknown:sense:but.exception')
    // The exception INTRODUCTION is not prerequisite-blocked (only budget/stage steer it).
    expect(d.trace.excluded.filter((x) => x.exemplar_id === 'exemplar:but.024' && x.reason.startsWith('prerequisite_')))
      .toEqual([])
  })
})

describe('§25.42 — but known, still unknown (case 1 of §11)', () => {
  it('but...still stays blocked by its real still-side prerequisites, session continues elsewhere', () => {
    const d = select({ learnerStates: states(counterKnown()) })
    expect(d.status).toBe('activity')
    const butStill = d.trace.excluded.find((x) => x.exemplar_id === 'exemplar:but.008')
    expect(butStill.reason).toBe('prerequisite_unknown:sense:still.continuity')
    // Never concludes that knowing but implies knowing still.
    expect(d.plan.exemplar_id).not.toBe('exemplar:but.008')
  })
})

describe('§25.43 — still known, but unknown (case 2 of §11)', () => {
  it('a but session for a still-only learner introduces simple contrast from scratch', () => {
    const d = select({ learnerStates: states(stillSideKnown()) })
    expect(d.plan.recipe).toBe('exposure')
    expect(d.plan.exemplar_id).toBe('exemplar:but.001')
    // Knowing still NEVER implies knowing but: but targets start unknown.
    expect(d.plan.new_item_refs).toEqual(['sense:but.contrast', 'construction:but.clause_but_clause'])
  })
})

describe('§25.44 — but...still knowledge unlocks the later related construction (case 4 of §11)', () => {
  it('a still session offers the although construction once but...still is consolidated', () => {
    const st = states([
      ...recognitionEst(S_CONT), ...recognitionEst(S_LEX), ...recognitionEst(S_BE),
      ...recognitionEst(S_COUNTER), ...recognitionEst(S_BUT_STILL),
    ])
    const d = select({ scope: STILL_SCOPE, learnerStates: st })
    expect(d.plan.exemplar_id).toBe('exemplar:still.015')
    expect(d.plan.new_item_refs).toContain('construction:still.although_clause_subject_still_verb')
    expect(d.plan.pack_id).toBe('pedagogy_v2_still')
  })
})

describe('§25.45–47 — external prerequisites are assessed tri-state and annotated in the trace', () => {
  it('45: met — with both sides consolidated, but.008 is selectable and its external prereqs are marked met', () => {
    const st = states([...counterKnown(), ...stillSideKnown()])
    const d = select({ learnerStates: st })
    expect(d.plan.exemplar_id).toBe('exemplar:but.008')
    const externals = d.trace.prerequisite_assessments.filter((a) => a.external)
    expect(externals.length).toBeGreaterThanOrEqual(2)
    for (const a of externals) {
      expect(a.owner_pack_id).toBe('pedagogy_v2_still')
      expect(a.status).toBe('met')
    }
  })

  it('46: unmet — weak assessed still knowledge blocks with prerequisite_unmet', () => {
    const st = states([
      ...counterKnown(),
      ...est(S_CONT, READ_REC, 1).map((e) => ({ ...e, outcome: 'incorrect' })),
      ...recognitionEst(S_LEX),
    ])
    const d = select({ learnerStates: st })
    const blocked = d.trace.excluded.find((x) => x.exemplar_id === 'exemplar:but.008')
    expect(blocked.reason).toBe('prerequisite_unmet:sense:still.continuity')
  })

  it('47: unknown — no still evidence at all reports prerequisite_unknown, never unmet', () => {
    const d = select({ learnerStates: states(counterKnown()) })
    const blocked = d.trace.excluded.find((x) => x.exemplar_id === 'exemplar:but.008')
    expect(blocked.reason).toBe('prerequisite_unknown:sense:still.continuity')
  })
})

describe('§25.48 — an active session never mixes packs', () => {
  it('every candidate, exclusion and plan of a but session belongs to the but pack', () => {
    const st = states([...counterKnown(), ...stillSideKnown()])
    const d = select({ learnerStates: st })
    const butExemplars = new Set(butJson.exemplars.map((e) => e.exemplar_id))
    for (const c of d.trace.candidates) expect(butExemplars.has(c.exemplar_id), c.exemplar_id).toBe(true)
    for (const x of d.trace.excluded) expect(butExemplars.has(x.exemplar_id), x.exemplar_id).toBe(true)
    expect(butExemplars.has(d.plan.exemplar_id)).toBe(true)
  })

  it('an unknown pack id in the scope throws instead of silently mixing', () => {
    expect(() => select({ scope: { registry, pack_id: 'pedagogy_v2_ghost', lexeme_id: 'lexeme:but' } }))
      .toThrow(/SCOPE_PACK_UNKNOWN/)
    expect(() => selectNextActivityV2({ session: session(), scope: { registry } }))
      .toThrow(/SCOPE_INVALID/)
  })
})

describe('§25.49 — targeted practice across packs', () => {
  it('focusing the still-owned but...still construction inside a but session selects only but exemplars declaring it', () => {
    const st = states([...counterKnown(), ...stillSideKnown(), ...recognitionEst(S_COUNTER), ...recognitionEst(S_BUT_STILL)])
    const d = select({
      learnerStates: st,
      policy: { targeted_practice: { target_id: S_BUT_STILL.target_id } },
    })
    expect(['exemplar:but.008', 'exemplar:but.009', 'exemplar:but.010', 'exemplar:but.011'])
      .toContain(d.plan.exemplar_id)
    expect(d.trace.excluded.some((x) => x.reason === 'not_targeted')).toBe(true)
  })
})

describe('§25.50 — determinism', () => {
  it('identical inputs produce deeply equal decisions; input order never matters', () => {
    const st = states([...contrastKnown()])
    expect(select({ learnerStates: st })).toEqual(select({ learnerStates: st }))
    const shuffled = [st[st.length - 1], ...st.slice(0, -1)]
    expect(select({ learnerStates: shuffled })).toEqual(select({ learnerStates: st }))
  })
})

describe('§25.51 — new-item budget', () => {
  it('a zero budget blocks the first but introduction', () => {
    const d = select({ policy: { new_item_budget_per_session: 0 } })
    expect(d.status).toBe('no_eligible_activity')
    expect(d.trace.excluded).toContainEqual({ exemplar_id: 'exemplar:but.001', reason: 'new_item_budget_exceeded' })
  })

  it('a two-novelty exemplar does not fit one remaining budget slot', () => {
    const st = states(contrastKnown())
    const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 1 } })
    // but.016/020/024 introduce two novelties each — all excluded on budget.
    expect(d.trace.excluded).toContainEqual({ exemplar_id: 'exemplar:but.016', reason: 'new_item_budget_exceeded' })
    expect(d.plan.exemplar_id).toBe('exemplar:but.005') // 1 novelty fits
  })
})

describe('§25.52 — runtime availability is preserved per pack session', () => {
  it('missing audio output excludes listening recipes with the runtime reason in the trace', () => {
    const st = states([...exposureOf(B_CONTRAST), ...exposureOf(B_CLAUSE)])
    const d = select({
      learnerStates: st,
      runtimeAvailability: { unavailable: [{ recipe: 'listening_recognition', modality: null, reason: 'RUNTIME_AUDIO_OUTPUT_UNAVAILABLE' }] },
    })
    expect(d.trace.excluded.some((x) => x.reason === 'RUNTIME_AUDIO_OUTPUT_UNAVAILABLE')).toBe(true)
    expect(d.plan.recipe).not.toBe('listening_recognition')
  })
})

describe('§25.53–54 — recognition alternatives', () => {
  it('53: options come only from authored but-pack translations', () => {
    const st = states([...exposureOf(B_CONTRAST), ...exposureOf(B_CLAUSE)])
    const d = select({ learnerStates: st })
    expect(d.plan.recipe).toBe('meaning_recognition')
    const authoredPt = new Map(butJson.exemplars.map((e) => [e.exemplar_id, e.text_pt]))
    for (const o of d.plan.presentation.options) {
      expect(authoredPt.get(o.source_exemplar_id)).toBe(o.text_pt)
    }
    const target = d.plan.presentation.options.find((o) => o.is_target)
    expect(target.text_pt).toBe('Estou cansado, mas estou feliz.')
  })

  it('54: without safe alternatives the recipe is excluded and the session degrades to no_eligible_activity', () => {
    const tinyBut = structuredClone(butJson)
    tinyBut.exemplars = tinyBut.exemplars.slice(0, 1)
    const tinyRegistry = buildPedagogyV2Registry([stillJson, tinyBut])
    const st = states([...exposureOf(B_CONTRAST), ...exposureOf(B_CLAUSE)])
    const d = select({
      scope: { registry: tinyRegistry, pack_id: 'pedagogy_v2_but', lexeme_id: 'lexeme:but' },
      learnerStates: st,
    })
    expect(d.status).toBe('no_eligible_activity')
    expect(d.trace.excluded).toContainEqual({ exemplar_id: 'exemplar:but.001', recipe: 'meaning_recognition', reason: 'no_safe_options' })
  })
})

describe('§25.55 — planned evidence keeps the correct target ownership', () => {
  it('a but.008 plan declares evidence for still-owned targets that resolve to the still pack', () => {
    const st = states([...counterKnown(), ...stillSideKnown()])
    const d = select({ learnerStates: st })
    expect(d.plan.exemplar_id).toBe('exemplar:but.008')
    expect(d.plan.planned_evidence.length).toBeGreaterThanOrEqual(2)
    const owners = d.plan.planned_evidence.map((pe) => ({
      id: pe.target.target_id,
      owner: resolvePedagogyTarget(pe.target, registry)?.pack_id ?? null,
    }))
    for (const { id, owner } of owners) {
      expect(owner, id).toBe(id.includes(':still.') ? 'pedagogy_v2_still' : 'pedagogy_v2_but')
    }
    // The cross-pack construction resolves for presentation (fixed elements).
    expect(owners.map((o) => o.id)).toContain('construction:still.clause_but_subject_still_verb')
  })

  it('a session history keeps working through appendActivityToSessionV2 (pure)', () => {
    const d = select({})
    const sess = session()
    const next = appendActivityToSessionV2(sess, d)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].exemplar_id).toBe('exemplar:but.001')
  })
})
