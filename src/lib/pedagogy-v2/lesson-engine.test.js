import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import stillPack from '../../content/pedagogy-v2/still.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import {
  createLessonSessionV2, appendActivityToSessionV2, DEFAULT_LESSON_ENGINE_POLICY_V2,
} from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { validateLessonDecisionV2 } from './lesson-engine-validator.js'

// ---- targets of the still pack ----------------------------------------------
const CONT = { target_type: 'sense', target_id: 'sense:still.continuity' }
const COUNTER = { target_type: 'sense', target_id: 'sense:still.counter_expectation' }
const DISC = { target_type: 'sense', target_id: 'sense:still.discourse_reservation' }
const LEX = { target_type: 'construction', target_id: 'construction:still.subject_still_lexical_verb' }
const BE = { target_type: 'construction', target_id: 'construction:still.subject_be_still_complement' }
const BUT = { target_type: 'construction', target_id: 'construction:still.clause_but_subject_still_verb' }
const ALTHOUGH = { target_type: 'construction', target_id: 'construction:still.although_clause_subject_still_verb' }
const DISC_C = { target_type: 'construction', target_id: 'construction:still.discourse_still_clause' }

// ---- activities (approved V2.2 taxonomy) ------------------------------------
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const LISTEN_REC = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }
const READ_COMP = { activity_kind: 'meaning_recognition', capability: 'comprehension', modality: 'reading' }
const LISTEN_COMP = { activity_kind: 'listening_recognition', capability: 'comprehension', modality: 'listening' }
const WRITE_CTRL = { activity_kind: 'controlled_completion', capability: 'controlled_production', modality: 'writing' }
const SPEAK_CTRL = { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'speaking' }
const WRITE_FREE = { activity_kind: 'free_production', capability: 'free_production', modality: 'writing' }
const SPEAK_FREE = { activity_kind: 'free_production', capability: 'free_production', modality: 'speaking' }
const PRON = { activity_kind: 'pronunciation', capability: 'pronunciation', modality: 'speaking' }

// ---- evidence fixtures over the APPROVED learner model ----------------------
const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const iso = (minute) => new Date(T0 + minute * 60000).toISOString()
const NOW = iso(2000)

let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:fixture.${String(++seq).padStart(4, '0')}`,
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

// 1 pure exposure encounter (never updates mastery).
const exposureOf = (target) => [ev(target, EXPO, { attribution: 'exposure', outcome: 'observed' })]
// Unaided direct successes: overall AND independent lanes reach
// evidence_level=emerging + mastery .8 (meets prerequisite and advancement).
const est = (target, activity, n = 3) => Array.from({ length: n }, () => ev(target, activity))
// Supported-only successes (translation): overall+supported reach mastery ~.77,
// the independent lane stays empty.
const estSupported = (target, activity, n = 4) => Array.from({ length: n }, () =>
  ev(target, activity, { support: { features: ['translation'], hint_count: 0, attempt_number: 1 } }))

const recognitionEst = (t) => [...est(t, READ_REC), ...est(t, LISTEN_REC)]
const comprehensionEst = (t) => [...est(t, READ_COMP), ...est(t, LISTEN_COMP)]

const states = (events) => aggregateProfileEvidence(events)
const session = (over = {}) => createLessonSessionV2({ session_id: 'sess1', profile_id: 'p1', now: NOW, ...over })
const select = ({ learnerStates = [], recentEvidence = [], policy = {}, sess = null, pack = stillPack, resolveV1Skill = null } = {}) =>
  selectNextActivityV2({ session: sess || session(), pack, learnerStates, recentEvidence, policy, resolveV1Skill })

describe('scenario 1 — brand-new learner starts with exposure to the first authored exemplar', () => {
  const d = select({})

  it('selects exposure of exemplar 001 with translation support', () => {
    expect(d.status).toBe('activity')
    expect(d.plan.recipe).toBe('exposure')
    expect(d.plan.exemplar_id).toBe('exemplar:still.001')
    expect(d.plan.text_en).toBe('I still live here.')
    expect(d.plan.support.features).toEqual(['translation'])
    expect(d.plan.support.derived_tier).toBe('medium')
    expect(d.plan.new_item_refs).toEqual([
      'sense:still.continuity',
      'construction:still.subject_still_lexical_verb',
    ])
    expect(d.trace.budget.remaining_after).toBe(0)
  })

  it('plans ONLY exposure evidence (observed) for the presented targets', () => {
    expect(d.plan.planned_evidence).toHaveLength(2)
    for (const pe of d.plan.planned_evidence) {
      expect(pe.attribution).toBe('exposure')
      expect(pe.possible_outcomes).toEqual(['observed'])
      expect(pe.activity.activity_kind).toBe('exposure')
    }
  })

  it('emits a structurally valid decision', () => {
    const v = validateLessonDecisionV2(d)
    expect(v.errors).toEqual([])
    expect(v.valid).toBe(true)
  })
})

describe('scenario 2 — exposure without mastery moves to meaning recognition', () => {
  const st = states([...exposureOf(CONT), ...exposureOf(LEX)])
  const d = select({ learnerStates: st })

  it('selects meaning_recognition (recognition/reading) of exemplar 001', () => {
    expect(d.plan.recipe).toBe('meaning_recognition')
    expect(d.plan.capability).toBe('recognition')
    expect(d.plan.modality).toBe('reading')
    expect(d.plan.exemplar_id).toBe('exemplar:still.001')
    expect(d.plan.new_item_refs).toEqual([]) // exposure consumed the novelty
  })

  it('options come only from authored translations, each with source_exemplar_id', () => {
    const options = d.plan.presentation.options
    expect(options.length).toBeGreaterThanOrEqual(DEFAULT_LESSON_ENGINE_POLICY_V2.min_recognition_options)
    const authoredPt = new Set(stillPack.exemplars.map((e) => e.text_pt))
    for (const o of options) {
      expect(authoredPt.has(o.text_pt)).toBe(true)
      expect(o.source_exemplar_id).toMatch(/^exemplar:/)
    }
    const target = options.find((o) => o.is_target)
    expect(target.text_pt).toBe('Eu ainda moro aqui.')
    expect(d.plan.response_contract.correct_option_id).toBe(target.option_id)
  })
})

describe('scenario 3 — strong reading recognition, listening absent → listening gap wins', () => {
  const st = states([
    ...exposureOf(CONT), ...exposureOf(LEX),
    ...est(CONT, READ_REC), ...est(LEX, READ_REC),
  ])
  const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 0 } })

  it('selects listening recognition', () => {
    expect(d.plan.recipe).toBe('listening_recognition')
    expect(d.plan.capability).toBe('recognition')
    expect(d.plan.modality).toBe('listening')
    expect(d.plan.presentation.audio_reference.type).toBe('authored_exemplar_audio')
  })
})

describe('scenario 4 — strong recognition (both modalities), comprehension absent → comprehension wins', () => {
  const st = states([...recognitionEst(CONT), ...recognitionEst(LEX)])
  const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 0 } })

  it('selects a comprehension activity', () => {
    expect(d.plan.capability).toBe('comprehension')
    expect(['meaning_recognition', 'listening_recognition']).toContain(d.plan.recipe)
  })
})

describe('scenario 5 — strong supported production, independent absent → independent lane practice', () => {
  const st = states([
    ...recognitionEst(CONT), ...recognitionEst(LEX),
    ...comprehensionEst(CONT), ...comprehensionEst(LEX),
    ...estSupported(CONT, WRITE_CTRL), ...estSupported(LEX, WRITE_CTRL),
    ...estSupported(CONT, SPEAK_CTRL), ...estSupported(LEX, SPEAK_CTRL),
  ])
  const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 0 } })

  it('selects controlled production WITHOUT support features (derived tier none)', () => {
    expect(d.plan.capability).toBe('controlled_production')
    expect(d.plan.support.features).toEqual([])
    expect(d.plan.support.derived_tier).toBe('none')
    expect(d.trace.score_breakdown.independence).toBe(1)
  })
})

describe('scenario 6 — strong controlled production (incl. independent), free absent → free production', () => {
  const st = states([
    ...recognitionEst(CONT), ...recognitionEst(LEX),
    ...comprehensionEst(CONT), ...comprehensionEst(LEX),
    ...est(CONT, WRITE_CTRL), ...est(LEX, WRITE_CTRL),
    ...est(CONT, SPEAK_CTRL), ...est(LEX, SPEAK_CTRL),
  ])
  const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 0 } })

  it('selects free production', () => {
    expect(d.plan.capability).toBe('free_production')
    expect(d.plan.recipe).toBe('free_production')
  })
})

describe('scenario 7 — everything strong except pronunciation → pronunciation', () => {
  const st = states([
    ...recognitionEst(CONT), ...recognitionEst(LEX),
    ...comprehensionEst(CONT), ...comprehensionEst(LEX),
    ...est(CONT, WRITE_CTRL), ...est(LEX, WRITE_CTRL),
    ...est(CONT, SPEAK_CTRL), ...est(LEX, SPEAK_CTRL),
    ...est(CONT, WRITE_FREE), ...est(LEX, WRITE_FREE),
    ...est(CONT, SPEAK_FREE), ...est(LEX, SPEAK_FREE),
  ])
  const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 0 } })

  it('selects the pronunciation recipe (speaking)', () => {
    expect(d.plan.recipe).toBe('pronunciation')
    expect(d.plan.capability).toBe('pronunciation')
    expect(d.plan.modality).toBe('speaking')
  })
})

describe('scenarios 8–10 — progression across the still constructions', () => {
  it('8: lexical construction known, be-construction unknown → exposure of exemplar 006', () => {
    const st = states([...recognitionEst(CONT), ...recognitionEst(LEX)])
    const d = select({ learnerStates: st })
    expect(d.plan.exemplar_id).toBe('exemplar:still.006')
    expect(d.plan.recipe).toBe('exposure')
    expect(d.plan.new_item_refs).toEqual(['construction:still.subject_be_still_complement'])
  })

  it('9: but…still known, although…still unknown → exposure of exemplar 015', () => {
    const st = states([
      ...recognitionEst(CONT), ...recognitionEst(LEX), ...recognitionEst(BE),
      ...recognitionEst(COUNTER), ...recognitionEst(BUT),
    ])
    const d = select({ learnerStates: st })
    expect(d.plan.exemplar_id).toBe('exemplar:still.015')
    expect(d.plan.new_item_refs).toContain('construction:still.although_clause_subject_still_verb')
  })

  it('10: intra-sentence uses known, discourse marker unknown → exposure of exemplar 019', () => {
    const st = states([
      ...recognitionEst(CONT), ...recognitionEst(LEX), ...recognitionEst(BE),
      ...recognitionEst(COUNTER), ...recognitionEst(BUT), ...recognitionEst(ALTHOUGH),
      ...comprehensionEst(CONT), ...comprehensionEst(LEX), ...comprehensionEst(BE),
      ...comprehensionEst(COUNTER), ...comprehensionEst(BUT), ...comprehensionEst(ALTHOUGH),
    ])
    const d = select({ learnerStates: st })
    expect(d.plan.exemplar_id).toBe('exemplar:still.019')
    expect(d.plan.new_item_refs).toEqual([
      'sense:still.discourse_reservation',
      'construction:still.discourse_still_clause',
    ])
  })
})

describe('scenario 11 — targeted practice restricts candidates to the focused target', () => {
  const st = states([
    ...exposureOf(CONT), ...exposureOf(LEX),
    ...est(CONT, READ_REC), ...est(LEX, READ_REC),
  ])
  const d = select({ learnerStates: st, policy: { targeted_practice: { target_id: LEX.target_id } } })

  it('practices only exemplars declaring the focused target', () => {
    const planTargets = [d.plan.primary_target, ...d.plan.secondary_targets].map((t) => t.target_id)
    expect(planTargets).toContain(LEX.target_id)
    expect(d.trace.excluded.some((x) => x.reason === 'not_targeted')).toBe(true)
    // be/but/although/discourse exemplars never declare the lexical construction
    expect(['exemplar:still.001', 'exemplar:still.002', 'exemplar:still.003', 'exemplar:still.004', 'exemplar:still.005'])
      .toContain(d.plan.exemplar_id)
  })
})

describe('scenario 12 — retention review resurfaces long-unpracticed capabilities', () => {
  const st = states([
    ...recognitionEst(CONT), ...recognitionEst(LEX),
    ...comprehensionEst(CONT), ...comprehensionEst(LEX),
    ...est(CONT, WRITE_CTRL), ...est(LEX, WRITE_CTRL),
    ...est(CONT, SPEAK_CTRL), ...est(LEX, SPEAK_CTRL),
    ...est(CONT, WRITE_FREE), ...est(LEX, WRITE_FREE),
    ...est(CONT, SPEAK_FREE), ...est(LEX, SPEAK_FREE),
    ...est(CONT, PRON), ...est(LEX, PRON),
  ])
  const d = select({ learnerStates: st, sess: session({ now: iso(60 * 24 * 30) }), policy: { new_item_budget_per_session: 0 } })

  it('selects a review driven by retention pressure', () => {
    expect(d.status).toBe('activity')
    expect(d.trace.score_breakdown.retention).toBeGreaterThan(0)
  })
})

describe('scenario 13 — new-item budget', () => {
  it('a zero budget blocks the introduction and reports no_eligible_activity', () => {
    const d = select({ policy: { new_item_budget_per_session: 0 } })
    expect(d.status).toBe('no_eligible_activity')
    expect(d.trace.excluded).toContainEqual({ exemplar_id: 'exemplar:still.001', reason: 'new_item_budget_exceeded' })
  })

  it('an exemplar introducing two new items does not fit one remaining slot', () => {
    const st = states([...recognitionEst(CONT), ...recognitionEst(LEX)])
    const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 1 } })
    expect(d.trace.excluded).toContainEqual({ exemplar_id: 'exemplar:still.011', reason: 'new_item_budget_exceeded' })
    expect(d.plan.exemplar_id).toBe('exemplar:still.006') // 1 new item fits
  })
})

describe('scenario 14 — exemplar cooldown inside the session', () => {
  it('does not repeat the same exemplar back-to-back when alternatives exist', () => {
    const st = states([
      ...exposureOf(CONT), ...exposureOf(LEX),
      ...est(CONT, READ_REC), ...est(LEX, READ_REC),
    ])
    let sess = session()
    const first = select({ learnerStates: st, sess })
    sess = appendActivityToSessionV2(sess, first)
    const second = select({ learnerStates: st, sess })
    expect(second.plan.exemplar_id).not.toBe(first.plan.exemplar_id)
  })
})

describe('scenario 15 — no safe alternatives', () => {
  it('a pack without enough authored translations yields no_eligible_activity, never fabricated options', () => {
    const tinyPack = { ...stillPack, exemplars: stillPack.exemplars.slice(0, 1) }
    const st = states([...exposureOf(CONT), ...exposureOf(LEX)])
    const d = select({ learnerStates: st, pack: tinyPack })
    expect(d.status).toBe('no_eligible_activity')
    expect(d.trace.excluded).toContainEqual({ exemplar_id: 'exemplar:still.001', recipe: 'meaning_recognition', reason: 'no_safe_options' })
  })
})

describe('scenarios 16–18 — determinism, input order, seed', () => {
  const fixture = () => states([
    ...exposureOf(CONT), ...exposureOf(LEX),
    ...est(CONT, READ_REC), ...est(LEX, READ_REC),
  ])

  it('16: identical inputs produce a deeply equal decision', () => {
    const st = fixture()
    expect(select({ learnerStates: st })).toEqual(select({ learnerStates: st }))
  })

  it('17: the order of learner states and recent evidence never changes the decision', () => {
    const st = fixture()
    const shuffled = [st[st.length - 1], ...st.slice(0, -1)]
    const evidence = [ev(CONT, READ_REC, { outcome: 'incorrect' }), ev(LEX, READ_REC)]
    const d1 = select({ learnerStates: st, recentEvidence: evidence })
    const d2 = select({ learnerStates: shuffled, recentEvidence: [...evidence].reverse() })
    expect(d2).toEqual(d1)
  })

  it('18: a different seed can only permute equal-score candidates', () => {
    const st = fixture()
    const dA1 = select({ learnerStates: st, sess: session({ seed: 'seed-A' }) })
    const dA2 = select({ learnerStates: st, sess: session({ seed: 'seed-A' }) })
    expect(dA2).toEqual(dA1)
    const dB = select({ learnerStates: st, sess: session({ seed: 'seed-B' }) })
    // Same top score whatever the seed; the seed never promotes a weaker candidate.
    expect(dB.trace.score_breakdown).toBeDefined()
    const bestOf = (d) => Math.max(...d.trace.candidates.map((c) => c.score))
    expect(bestOf(dB)).toBe(bestOf(dA1))
    const scoreOf = (d) => d.trace.candidates.find((c) =>
      c.exemplar_id === d.plan.exemplar_id && c.recipe === d.plan.recipe
      && c.modality === d.plan.modality && c.lane === (d.plan.support.derived_tier === 'none' ? 'independent' : 'supported')).score
    expect(scoreOf(dB)).toBe(scoreOf(dA1))
  })
})

describe('scenario 19 — planned evidence for multi-target exemplars', () => {
  it('meaning recognition: senses and functions direct, constructions indirect', () => {
    const st = states([
      ...recognitionEst(CONT), ...recognitionEst(LEX),
      ...exposureOf(COUNTER), ...exposureOf(BUT),
      ...est(COUNTER, READ_REC, 1), ...est(BUT, READ_REC, 1),
    ])
    // Target exemplar 011 explicitly (sense + construction + function targets).
    const d = select({ learnerStates: st, policy: { targeted_practice: { target_id: COUNTER.target_id } } })
    expect(d.plan.exemplar_id).toMatch(/exemplar:still.01[1-4]/)
    if (d.plan.recipe === 'meaning_recognition' || d.plan.recipe === 'listening_recognition') {
      const byId = Object.fromEntries(d.plan.planned_evidence.map((pe) => [pe.target.target_id, pe.attribution]))
      expect(byId[COUNTER.target_id]).toBe('direct')
      expect(byId[BUT.target_id]).toBe('indirect')
    }
    expect(d.plan.planned_evidence.length).toBeGreaterThanOrEqual(2)
  })

  it('form recipes invert attribution: construction direct, sense indirect', () => {
    const st = states([
      ...recognitionEst(CONT), ...recognitionEst(LEX),
      ...comprehensionEst(CONT), ...comprehensionEst(LEX),
      ...estSupported(CONT, WRITE_CTRL), ...estSupported(LEX, WRITE_CTRL),
      ...estSupported(CONT, SPEAK_CTRL), ...estSupported(LEX, SPEAK_CTRL),
    ])
    const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 0 } })
    expect(['fixed_element_completion', 'word_order_reconstruction', 'guided_production']).toContain(d.plan.recipe)
    const byId = Object.fromEntries(d.plan.planned_evidence.map((pe) => [pe.target.target_id, pe.attribution]))
    expect(byId[LEX.target_id] ?? byId[d.plan.construction_id]).toBe('direct')
    expect(byId[CONT.target_id]).toBe('indirect')
  })
})

describe('scenario 20 — independent lane gate is per target × capability × modality', () => {
  const st = states([
    ...recognitionEst(CONT), ...recognitionEst(LEX),
    ...comprehensionEst(CONT), ...comprehensionEst(LEX),
    // Supported success in WRITING only; speaking controlled production absent.
    ...estSupported(CONT, WRITE_CTRL), ...estSupported(LEX, WRITE_CTRL),
  ])
  const d = select({ learnerStates: st, policy: { new_item_budget_per_session: 0 } })

  it('offers independent practice in writing but NEVER in speaking', () => {
    const independents = d.trace.candidates.filter((c) => c.lane === 'independent')
    expect(independents.length).toBeGreaterThan(0)
    expect(independents.every((c) => c.modality === 'writing')).toBe(true)
    expect(d.trace.candidates.some((c) => c.lane === 'independent' && c.modality === 'speaking')).toBe(false)
  })
})

describe('tri-state prerequisites and the V1 bridge', () => {
  it('V2 prerequisites: unknown blocks and is reported as unknown, not unmet', () => {
    const d = select({})
    const gated = d.trace.excluded.find((x) => x.exemplar_id === 'exemplar:still.002')
    expect(gated.reason).toBe('prerequisite_unknown:sense:still.continuity')
  })

  it('V2 prerequisites: assessed-but-weak reports unmet', () => {
    const st = states([
      ...exposureOf(CONT), ...exposureOf(LEX),
      ...est(CONT, READ_REC), ...est(LEX, READ_REC),
      ...est(BE, READ_REC, 1).map((e) => ({ ...e, outcome: 'incorrect' })),
    ])
    const d = select({ learnerStates: st })
    const gated = d.trace.excluded.find((x) => x.exemplar_id === 'exemplar:still.007')
    expect(gated.reason).toBe('prerequisite_unmet:construction:still.subject_be_still_complement')
  })

  it('V1 bridges stay advisory by default (recorded, never silently met)', () => {
    const d = select({})
    const v1 = d.trace.prerequisite_assessments.find((a) => a.kind === 'grammar_skill_v1')
    expect(v1).toEqual({
      kind: 'grammar_skill_v1', type: 'grammar_skill_v1', ref: 'simple_present',
      status: 'unknown', blocking: false, advisory: true,
    })
  })

  it('strict policy blocks on unknown V1 bridges; a resolver can satisfy them', () => {
    const strict = select({ policy: { v1_bridge_mode: 'strict' } })
    expect(strict.status).toBe('no_eligible_activity')
    expect(strict.trace.excluded).toContainEqual({ exemplar_id: 'exemplar:still.001', reason: 'prerequisite_unknown:simple_present' })
    const resolved = select({ policy: { v1_bridge_mode: 'strict' }, resolveV1Skill: () => true })
    expect(resolved.status).toBe('activity')
    expect(resolved.plan.exemplar_id).toBe('exemplar:still.001')
  })
})

describe('remediation — a recent error pulls the target back into supported practice', () => {
  it('prefers a supported variant for the recently missed target', () => {
    const st = states([
      ...recognitionEst(CONT), ...recognitionEst(LEX), ...recognitionEst(BE),
      ...comprehensionEst(CONT), ...comprehensionEst(LEX), ...comprehensionEst(BE),
    ])
    const miss = ev(BE, READ_REC, { outcome: 'incorrect', occurred_at: iso(1999) })
    const d = select({ learnerStates: st, recentEvidence: [miss] })
    const planTargets = [d.plan.primary_target, ...d.plan.secondary_targets].map((t) => t.target_id)
    expect(planTargets).toContain(BE.target_id)
    expect(d.plan.support.derived_tier).not.toBe('none')
    expect(d.trace.score_breakdown.remediation).toBe(1)
  })
})

describe('session lifecycle and engine hygiene', () => {
  it('reports session_complete at the activity cap', () => {
    const sess = {
      ...session(),
      history: Array.from({ length: DEFAULT_LESSON_ENGINE_POLICY_V2.max_activities_per_session }, (_, i) => ({
        sequence_index: i, exemplar_id: 'exemplar:still.001', construction_id: LEX.target_id,
        recipe: 'exposure', activity_kind: 'exposure', capability: 'recognition', modality: 'reading',
        support_lane: 'supported', new_item_refs: [],
      })),
    }
    expect(select({ sess }).status).toBe('session_complete')
  })

  it('appendActivityToSessionV2 is pure and tracks introduced new items', () => {
    const sess = session()
    const d = select({ sess })
    const next = appendActivityToSessionV2(sess, d)
    expect(sess.history).toHaveLength(0)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].new_item_refs).toEqual(d.plan.new_item_refs)
    expect(next.history[0].support_lane).toBe('supported')
  })

  it('only presents authored sentences — never generated text', () => {
    const d = select({})
    const authored = stillPack.exemplars.find((e) => e.exemplar_id === d.plan.exemplar_id)
    expect(d.plan.text_en).toBe(authored.text_en)
    expect(d.plan.text_pt).toBe(authored.text_pt)
  })

  it('the engine core contains no Math.random and no Date.now', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    for (const f of ['lesson-engine.js', 'lesson-engine-contracts.js', 'lesson-engine-state-queries.js', 'lesson-engine-validator.js']) {
      const src = readFileSync(join(dir, f), 'utf8')
      expect(/Math\.random\s*\(/.test(src), `${f} calls Math.random`).toBe(false)
      expect(/Date\.now\s*\(/.test(src), `${f} calls Date.now`).toBe(false)
    }
  })
})
