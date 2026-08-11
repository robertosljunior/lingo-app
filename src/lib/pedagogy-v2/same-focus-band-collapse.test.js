// same-focus-band-collapse.test.js — P0 anti-repetition regression.
//
// Both properties here are stated over the REAL authored content, because both
// defects they pin were measured in the real learner-facing Praticar flow
// (10 consecutive sessions, every assessable activity answered correctly):
// 240 activities drew only 28 distinct EN sentences out of 85 authored ones.
//
// Property 1 — SAME-FOCUS EQUIVALENCE IS A PEDAGOGICAL FACT, NOT A FIELD ORDER.
//   Experience diversity may only compete among realizations of the anchor's
//   focus. That focus is (primary target, capability, modality, lane). Whether
//   an exemplar happens to list that target FIRST or SECOND inside its authored
//   `pedagogical_targets` array is an authoring artifact: it changes no
//   prerequisite, no evidence attribution (plannedEvidenceFor keys on
//   target_type/role, never on position) and no score. Two exemplars that both
//   declare the anchor's primary target as a PRIMARY target are therefore
//   interchangeable realizations of the same focus, and both must be able to
//   compete.
//
// Property 2 — THE LEAST-RECENT PREFERENCE MUST ACTUALLY ORDER THE POOL.
//   Cross-session recency exists so the learner does not meet the same sentence
//   again while an equally valid, staler one is available. The window is a
//   hard floor ("never repeat something seen inside it"), not the whole policy:
//   among candidates that all cleared the window and tie on pedagogical score,
//   the one seen LEAST recently must win, and one never seen at all must win
//   over every seen one. Otherwise `interactions_since_seen` is computed,
//   traced — and then discarded — and the realization is decided by a seed hash
//   that knows nothing about what the learner has already read.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { createLessonSessionV2, DEFAULT_LESSON_ENGINE_POLICY_V2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { getPrimaryTargets } from './query.js'

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const iso = (m) => new Date(T0 + m * 60000).toISOString()
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']

const CONSTRUCTION = 'construction:still.subject_still_lexical_verb'
const SENSE = 'sense:still.continuity'
// exemplar:still.001 authors [sense, construction]; still.002/003/005 author
// [construction, sense]. All four declare BOTH as role 'primary'.
const ORDER_MINORITY = 'exemplar:still.001'

let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:sfb.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1', interaction_id: `interaction:sfb.${seq}`,
  target, exemplar_id: null, activity, attribution: 'direct',
  outcome: 'correct', occurred_at: iso(seq), source: { source_type: 'test' }, ...over,
})
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }

// A learner who has every pack target exposed and recognition-consolidated, so
// a comprehension/reading focus has several eligible realizations to rotate.
function advancedStates() {
  const targets = new Set()
  for (const e of stillPack.exemplars) {
    for (const t of e.pedagogical_targets || []) {
      targets.add(JSON.stringify({ target_type: t.target_type, target_id: t.target_id }))
    }
  }
  const evs = []
  for (const s of targets) {
    const t = JSON.parse(s)
    evs.push(ev(t, EXPO, { attribution: 'exposure', outcome: 'observed' }))
    for (let k = 0; k < 4; k++) evs.push(ev(t, READ_REC))
  }
  return aggregateProfileEvidence(evs)
}
const STATES = advancedStates()

const FOCUS = { target_id: CONSTRUCTION, capability: 'comprehension', modality: 'reading' }
const decide = ({ seed, recentEvidence = [] }) => selectNextActivityV2({
  session: createLessonSessionV2({ session_id: `s-${seed}`, profile_id: 'p1', now: iso(9000), seed }),
  pack: stillPack,
  learnerStates: STATES,
  recentEvidence,
  focus: FOCUS,
  policy: { targeted_practice: { target_id: CONSTRUCTION } },
})

describe('same-focus band — authored target order is not a pedagogical fact', () => {
  it('every exemplar declaring the focus target as PRIMARY is authored as such', () => {
    // Guards the premise of this file against content drift: the four exemplars
    // below really are interchangeable realizations of the same focus.
    const interchangeable = ['exemplar:still.001', 'exemplar:still.002', 'exemplar:still.003', 'exemplar:still.005']
    for (const id of interchangeable) {
      const primaries = getPrimaryTargets(stillPack.exemplars.find((e) => e.exemplar_id === id))
        .map((t) => t.target_id)
      expect(primaries).toContain(CONSTRUCTION)
      expect(primaries).toContain(SENSE)
    }
    // …and still.001 is the one that authors them in the other order.
    const first = (id) => getPrimaryTargets(stillPack.exemplars.find((e) => e.exemplar_id === id))[0].target_id
    expect(first(ORDER_MINORITY)).toBe(SENSE)
    expect(first('exemplar:still.002')).toBe(CONSTRUCTION)
  })

  it('does not drop an interchangeable realization from the band because of field order', () => {
    const primariesOf = (id) => getPrimaryTargets(stillPack.exemplars.find((e) => e.exemplar_id === id))
      .map((t) => t.target_id)
    let sawOrderMinorityAsCandidate = false
    for (const seed of SEEDS) {
      const decision = decide({ seed })
      expect(decision.status).toBe('activity')
      const trace = decision.trace
      const anchorTarget = decision.plan.primary_target.target_id
      const scored = [...new Set(trace.candidates.map((c) => c.exemplar_id))]
      // THE PROPERTY: every scored candidate that trains the anchor's target as
      // a PRIMARY target realizes the anchor's focus and must be able to
      // compete, wherever that target sits in its authored array.
      const interchangeable = scored.filter((id) => primariesOf(id).includes(anchorTarget))
      for (const id of interchangeable) {
        expect(trace.experience_diversity.pool.band_exemplars).toContain(id)
      }
      if (interchangeable.includes(ORDER_MINORITY)) sawOrderMinorityAsCandidate = true
    }
    // Guards the test itself: the field-order odd-one-out really was in play.
    expect(sawOrderMinorityAsCandidate).toBe(true)
  })
})

describe('cross-session recency — least-recent wins among equivalent realizations', () => {
  // One interaction = one exemplar, several target rows. Oldest first, exactly
  // as storage returns the evidence tail.
  let riSeq = 0
  const interaction = (exemplarId, sessionId) => {
    riSeq += 1
    const iid = `interaction:recent.${riSeq}`
    return [
      { target_type: 'construction', target_id: CONSTRUCTION },
      { target_type: 'sense', target_id: SENSE },
    ].map((t, i) => buildLearnerEvidenceV2({
      evidence_id: `evidence:recent.${String(riSeq).padStart(3, '0')}.${i}`,
      profile_id: 'p1', interaction_id: iid, session_id: sessionId,
      target: t, exemplar_id: exemplarId, activity: READ_REC, attribution: 'indirect',
      outcome: 'correct', occurred_at: iso(5000 + riSeq), source: { source_type: 'test' },
    }))
  }
  // `earlier` are exemplars met in an OLDER lesson session; `latest` are the
  // ones the most recent persisted lesson session used (which #110 keeps
  // protected). Oldest first, exactly as storage returns the evidence tail.
  const history = (earlier, latest) => [
    ...earlier.flatMap((id) => interaction(id, 'lesson:older')),
    ...latest.flatMap((id) => interaction(id, 'lesson:previous')),
  ]
  const PADDING = ['exemplar:still.019', 'exemplar:still.020', 'exemplar:still.021', 'exemplar:still.022']

  const WINDOW = DEFAULT_LESSON_ENGINE_POLICY_V2.diversity.recent_exemplar_interactions

  it('the window is a floor, not the whole policy (premise)', () => {
    // The padding below must push every band member OUT of the window, so the
    // choice is genuinely between "fresh" candidates of different staleness.
    expect(WINDOW).toBeLessThanOrEqual(5)
  })

  it('presents the exemplar seen LEAST recently, for every seed', () => {
    // still.005 is the stalest band member; the padding session keeps every
    // band member outside the recency window AND out of the latest session.
    const recentEvidence = history(
      ['exemplar:still.005', 'exemplar:still.004', 'exemplar:still.003', 'exemplar:still.002', 'exemplar:still.001'],
      PADDING,
    )
    for (const seed of SEEDS) {
      const decision = decide({ seed, recentEvidence })
      expect(decision.status).toBe('activity')
      const ed = decision.trace.experience_diversity
      // Nothing is inside the recency window: this is NOT the least-recent
      // fallback path, it is the ordinary "several fresh candidates" path.
      expect(ed.pool.fresh_candidates).toBe(ed.pool.band_size)
      expect(decision.plan.exemplar_id).toBe('exemplar:still.005')
    }
  })

  it('an exemplar the learner has never seen beats every exemplar already seen', () => {
    // still.005 is the only band member absent from the whole tail.
    const recentEvidence = history(
      ['exemplar:still.004', 'exemplar:still.003', 'exemplar:still.002', 'exemplar:still.001'],
      PADDING,
    )
    for (const seed of SEEDS) {
      const decision = decide({ seed, recentEvidence })
      expect(decision.status).toBe('activity')
      expect(decision.plan.exemplar_id).toBe('exemplar:still.005')
    }
  })

  it('recency never outranks the pedagogical score inside the band', () => {
    // Determinism guard: the same (state, evidence, seed) still yields the same
    // plan, and the chosen candidate is still a best-score candidate.
    const recentEvidence = history(['exemplar:still.005', 'exemplar:still.003'], ['exemplar:still.002'])
    const a = decide({ seed: 'fixed', recentEvidence })
    const b = decide({ seed: 'fixed', recentEvidence })
    expect(a.plan.exemplar_id).toBe(b.plan.exemplar_id)
    expect(a.trace.experience_diversity.score_delta).toBe(0)
  })
})
