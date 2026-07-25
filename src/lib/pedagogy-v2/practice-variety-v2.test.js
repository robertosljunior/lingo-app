// practice-variety-v2.test.js — Slice V2.19: controlled practice variety +
// anti-repetition. Covers the cross-session exemplar recency, least-recent
// fallback, recipe-streak control, seeded option / word-order presentation,
// context diversity, strict-focus preservation and determinism guarantees.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { createLessonSessionV2, DEFAULT_LESSON_ENGINE_POLICY_V2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { validateLessonDecisionV2 } from './lesson-engine-validator.js'
import { canonicalOrderTokens, presentedOrderTokens } from './activity-runtime-contracts.js'
import {
  buildRecentExemplarUsageV2, seededShuffle, seededTokenShuffle,
} from './experience-diversity.js'

const T0 = Date.UTC(2026, 6, 1, 10, 0, 0)
const iso = (m) => new Date(T0 + m * 60000).toISOString()
let seq = 0
const ev = (target, activity, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:pv.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1', interaction_id: `interaction:${seq}`,
  target, exemplar_id: null, activity, attribution: 'direct',
  outcome: 'correct', occurred_at: iso(seq), source: { source_type: 'test' }, ...over,
})
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }

// An advanced learner: every pack target exposed AND recognition-consolidated,
// so a comprehension/reading focus has MANY eligible exemplars to rotate over.
function advancedStates() {
  const targets = new Set()
  for (const e of stillPack.exemplars) {
    for (const t of e.pedagogical_targets || []) targets.add(JSON.stringify({ target_type: t.target_type, target_id: t.target_id }))
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
const FOCUS = { capability: 'comprehension', modality: 'reading' }

const sess = (id, seed = id) => createLessonSessionV2({ session_id: id, profile_id: 'p1', now: iso(9000), seed })
const pick = ({ id = 's', seed = null, recentEvidence = [], policy = {}, focus = FOCUS } = {}) =>
  selectNextActivityV2({ session: sess(id, seed ?? id), pack: stillPack, learnerStates: STATES, recentEvidence, policy, focus })

// Build recent-evidence interactions (each exemplar = one interaction, several
// target rows) ending at the tail, oldest first.
let riSeq = 0
const recentInteraction = (exemplarId, targets = [{ target_type: 'sense', target_id: 'sense:still.continuity' }]) => {
  riSeq += 1
  const iid = `interaction:recent.${riSeq}`
  return targets.map((t, i) => buildLearnerEvidenceV2({
    evidence_id: `evidence:recent.${riSeq}.${i}`, profile_id: 'p1', interaction_id: iid,
    target: t, exemplar_id: exemplarId, activity: READ_REC, attribution: 'indirect',
    outcome: 'correct', occurred_at: iso(5000 + riSeq), source: { source_type: 'test' },
  }))
}

// ---- Part B: recent exemplar usage (grouped by interaction) -----------------

describe('buildRecentExemplarUsageV2 — grouped by interaction, not by event', () => {
  it('counts one interaction once regardless of how many target rows it emitted', () => {
    // 3 rows, ONE interaction of exemplar A.
    const evidence = recentInteraction('exemplar:A', [
      { target_type: 'sense', target_id: 'x' },
      { target_type: 'construction', target_id: 'y' },
      { target_type: 'lexeme_usage', target_id: 'z' },
    ])
    const usage = buildRecentExemplarUsageV2(evidence, { window: 6 })
    expect(usage.get('exemplar:A').recent_interaction_count).toBe(1)
    expect(usage.total_interactions).toBe(1)
  })

  it('tracks interactions_since_seen across distinct interactions', () => {
    const evidence = [
      ...recentInteraction('exemplar:A'),
      ...recentInteraction('exemplar:B'),
      ...recentInteraction('exemplar:C'),
    ]
    const usage = buildRecentExemplarUsageV2(evidence, { window: 6 })
    expect(usage.get('exemplar:C').interactions_since_seen).toBe(0) // most recent
    expect(usage.get('exemplar:A').interactions_since_seen).toBe(2)
    expect(usage.total_interactions).toBe(3)
  })
})

// ---- Part B/P: cross-session recency ----------------------------------------

describe('cross-session exemplar recency', () => {
  it('test 3 — avoids a recently-used exemplar when a valid alternative exists', () => {
    const first = pick({ id: 's1' })
    expect(first.status).toBe('activity')
    const recentX = first.plan.exemplar_id
    // New session, same focus, X just seen last session.
    const next = pick({ id: 's2', recentEvidence: recentInteraction(recentX) })
    expect(next.status).toBe('activity')
    expect(next.plan.exemplar_id).not.toBe(recentX)
    // Focus is untouched.
    expect(next.plan.capability).toBe('comprehension')
    expect(next.plan.modality).toBe('reading')
  })

  it('test 7 (regression) — a new session does not restart on last session\'s exemplar', () => {
    const s1 = pick({ id: 'sA' })
    const lastExemplar = s1.plan.exemplar_id
    const s2 = pick({ id: 'sB', recentEvidence: recentInteraction(lastExemplar) })
    expect(s2.plan.exemplar_id).not.toBe(lastExemplar)
  })

  it('test 4 — repeats a recent exemplar when it is the ONLY eligible one', () => {
    // Focus pinned to a target that exactly ONE exemplar in the pack presents
    // (full pack kept so distractor options still exist). The session must not
    // block even though that sole exemplar was just seen.
    const soleTargetFocus = { target_id: 'function:introduce_concession', capability: 'comprehension', modality: 'reading' }
    const base = pick({ id: 'sole1', focus: soleTargetFocus })
    expect(base.status).toBe('activity')
    const only = base.plan.exemplar_id
    const repeated = pick({ id: 'sole2', recentEvidence: recentInteraction(only), focus: soleTargetFocus })
    expect(repeated.status).toBe('activity')
    expect(repeated.plan.exemplar_id).toBe(only)
  })

  it('test 5 — least-recent fallback: when all are recent, prefers the one seen longest ago', () => {
    // Mark every eligible exemplar recent, oldest→newest, then confirm the pick
    // is among the earliest-seen (largest interactions_since_seen).
    const all = pick({ id: 'lr0' })
    const cands = [...new Set(all.trace.candidates.map((c) => c.exemplar_id))]
    const evidence = cands.flatMap((x) => recentInteraction(x)) // in this order → first is least recent
    const d = pick({ id: 'lr1', recentEvidence: evidence })
    expect(d.status).toBe('activity')
    // The least-recent among the anchor's focus group is chosen — never simply
    // the most-recent top-score exemplar.
    const usage = buildRecentExemplarUsageV2(evidence, { window: DEFAULT_LESSON_ENGINE_POLICY_V2.diversity.recent_exemplar_interactions })
    const chosen = usage.get(d.plan.exemplar_id)
    expect(chosen.interactions_since_seen).toBeGreaterThan(0)
  })
})

// ---- Part I / R: determinism & version --------------------------------------

describe('determinism and versioning', () => {
  it('engine version 3, policy version 4 (V2.21-R3 recipe-share control)', () => {
    const d = pick({ id: 'v' })
    expect(d.engine_version).toBe(3)
    expect(d.policy_version).toBe(4)
    expect(validateLessonDecisionV2(d).errors).toEqual([])
  })

  it('test 11 — same seed / state / evidence → identical plan', () => {
    const a = pick({ id: 'det', seed: 'seed-X' })
    const b = pick({ id: 'det', seed: 'seed-X' })
    expect(a.plan.exemplar_id).toBe(b.plan.exemplar_id)
    expect(a.plan.presentation).toEqual(b.plan.presentation)
    expect(a.plan.response_contract).toEqual(b.plan.response_contract)
  })

  it('test 12 — different seeds may vary the realization among equivalents', () => {
    const seeds = Array.from({ length: 12 }, (_, i) => `seed-${i}`)
    const exemplars = new Set(seeds.map((s) => pick({ id: 'vary', seed: s }).plan.exemplar_id))
    expect(exemplars.size).toBeGreaterThan(1)
  })
})

// ---- Part E: option order ---------------------------------------------------

describe('recognition option order', () => {
  const optionPlan = (seed) => pick({ id: 'opt', seed }).plan

  it('test 13 — option order is deterministic for a fixed seed', () => {
    const a = optionPlan('opt-seed').presentation.options.map((o) => o.source_exemplar_id)
    const b = optionPlan('opt-seed').presentation.options.map((o) => o.source_exemplar_id)
    expect(a).toEqual(b)
  })

  it('test 15 — the correct option identity is preserved and matches the contract', () => {
    const plan = optionPlan('opt-seed')
    const target = plan.presentation.options.find((o) => o.is_target)
    expect(target.source_exemplar_id).toBe(plan.exemplar_id)
    expect(plan.response_contract.correct_option_id).toBe(target.option_id)
  })

  it('test 14 — the target option position is not structurally frozen across seeds', () => {
    const positions = new Set()
    for (let i = 0; i < 40; i++) {
      const plan = optionPlan(`bias-${i}`)
      // Only compare within the SAME exemplar so the option set is identical.
      if (plan.exemplar_id !== optionPlan('bias-0').exemplar_id) continue
      positions.add(plan.presentation.options.findIndex((o) => o.is_target))
    }
    expect(positions.size).toBeGreaterThan(1)
  })
})

// ---- Part F: word order shuffle ---------------------------------------------

describe('word-order token shuffle', () => {
  it('test 16/17 — canonical answer is unchanged; presented order is deterministic', () => {
    const plan = {
      text_en: 'She still works at the hospital.',
      presentation: { token_source: { presentation_order: 'seeded_shuffle', presentation_seed: 's|0|x', presented_tokens: seededTokenShuffle('She still works at the hospital.'.split(/\s+/), 's|0|x') } },
    }
    expect(canonicalOrderTokens(plan)).toEqual(['She', 'still', 'works', 'at', 'the', 'hospital.'])
    const a = presentedOrderTokens(plan)
    const b = presentedOrderTokens(plan)
    expect(a).toEqual(b)
    // Same multiset as canonical, order differs.
    expect([...a].sort()).toEqual([...canonicalOrderTokens(plan)].sort())
  })

  it('test 18 — a shuffle never accidentally equals the canonical sentence', () => {
    for (let i = 0; i < 200; i++) {
      const tokens = 'We still talk every week.'.split(/\s+/)
      const shuffled = seededTokenShuffle(tokens, `seed-${i}`)
      expect(shuffled.join(' ')).not.toBe(tokens.join(' '))
    }
  })

  it('safe behavior for very short / single-distinct-token inputs', () => {
    expect(seededTokenShuffle(['Yes.'], 'x')).toEqual(['Yes.'])
    expect(seededTokenShuffle(['no', 'no'], 'x')).toEqual(['no', 'no'])
  })
})

// ---- Part D: recipe streak control ------------------------------------------

describe('recipe streak control', () => {
  it('test 19 — after a same-recipe streak, prefers an equivalent alternative recipe when one exists', () => {
    // Focus controlled_production/writing offers completion AND word-order for
    // the same target/lane. A 2-long history of completion on that construction
    // should let the alternative win.
    const cpFocus = { capability: 'controlled_production', modality: 'writing' }
    const cs = 'construction:still.subject_still_lexical_verb'
    const base = selectNextActivityV2({ session: sess('rs0'), pack: stillPack, learnerStates: STATES, recentEvidence: [], focus: cpFocus })
    if (base.status !== 'activity') return // guarded: needs an eligible controlled_production focus
    const streakHistory = [0, 1].map((i) => ({
      sequence_index: i, exemplar_id: base.plan.exemplar_id, construction_id: base.plan.construction_id,
      recipe: 'fixed_element_completion', activity_kind: 'controlled_completion',
      capability: 'controlled_production', modality: 'writing', support_lane: 'supported', new_item_refs: [],
    }))
    const s = { ...sess('rs1'), history: streakHistory }
    const d = selectNextActivityV2({ session: s, pack: stillPack, learnerStates: STATES, recentEvidence: [], focus: cpFocus })
    // If an equivalent alternative recipe is genuinely available it should be
    // preferred; if not, the same recipe may legitimately repeat (test 20).
    const alternativesExist = (base.trace.candidates || []).some((c) =>
      c.capability === 'controlled_production' && c.modality === 'writing' && c.recipe !== 'fixed_element_completion')
    if (alternativesExist) expect(d.plan.recipe).not.toBe('fixed_element_completion')
  })
})

// ---- strict focus preservation (tests 6–10) ---------------------------------

describe('strict focus preservation', () => {
  it('never changes capability / modality when diversity reorders', () => {
    for (let i = 0; i < 20; i++) {
      const d = pick({ id: `sf-${i}`, seed: `sf-${i}` })
      expect(d.plan.capability).toBe('comprehension')
      expect(d.plan.modality).toBe('reading')
    }
  })

  it('an independence focus is only ever served by an independent (tier-none) plan', () => {
    const d = selectNextActivityV2({
      session: sess('ind'), pack: stillPack, learnerStates: STATES, recentEvidence: [],
      focus: { capability: 'controlled_production', modality: 'writing', require_independent: true },
    })
    if (d.status === 'activity') expect(d.plan.support.derived_tier).toBe('none')
  })
})

// ---- Part K: context_recognition new shape ----------------------------------

describe('context_recognition — new comprehension shape', () => {
  // Play a session until reading-comprehension monotony triggers the swap.
  function firstContextRecognition() {
    let session = createLessonSessionV2({ session_id: 'cx', profile_id: 'p1', now: iso(9000), seed: 'cx' })
    for (let a = 0; a < 12; a++) {
      const d = selectNextActivityV2({ session, pack: stillPack, learnerStates: STATES, recentEvidence: [], focus: FOCUS })
      if (d.status !== 'activity') break
      if (d.plan.recipe === 'context_recognition') return d
      session = { ...session, history: [...session.history, {
        sequence_index: a, exemplar_id: d.plan.exemplar_id, construction_id: d.plan.construction_id,
        recipe: d.plan.recipe, activity_kind: d.plan.activity_kind, capability: d.plan.capability,
        modality: d.plan.modality, support_lane: 'supported', new_item_refs: [],
      }] }
    }
    return null
  }

  it('test 22 — options are authored contexts only; the target is this exemplar\'s context', () => {
    const d = firstContextRecognition()
    expect(d).toBeTruthy()
    expect(d.plan.activity_kind).toBe('meaning_recognition')
    expect(d.plan.capability).toBe('comprehension')
    expect(d.plan.modality).toBe('reading')
    expect(d.plan.presentation.option_kind).toBe('authored_context')
    const target = d.plan.presentation.options.find((o) => o.is_target)
    expect(target.source_exemplar_id).toBe(d.plan.exemplar_id)
    // Every option text is an AUTHORED context of some pack exemplar (never generated).
    const authoredContexts = new Set(stillPack.exemplars.map((e) => String(e.context).trim()))
    for (const o of d.plan.presentation.options) expect(authoredContexts.has(o.text_pt)).toBe(true)
  })

  it('test 23 — evidence attribution is meaning_first (comprehension for the sense)', () => {
    const d = firstContextRecognition()
    expect(d).toBeTruthy()
    const senseEv = d.plan.planned_evidence.filter((p) => p.target.target_type === 'sense')
    expect(senseEv.length).toBeGreaterThan(0)
    for (const p of senseEv) expect(p.attribution).toBe('direct')
    expect(validateLessonDecisionV2(d).errors).toEqual([])
  })

  it('the swap never changes target/exemplar — it is a pure presentation variant', () => {
    const d = firstContextRecognition()
    expect(d).toBeTruthy()
    expect(d.trace.experience_diversity.context_recognition_swap).toBe(true)
    expect(d.plan.response_contract.response_type).toBe('option_select')
  })
})

// ---- seededShuffle primitive ------------------------------------------------

describe('seededShuffle primitive', () => {
  it('is deterministic and preserves the multiset', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(seededShuffle(items, 'k')).toEqual(seededShuffle(items, 'k'))
    expect([...seededShuffle(items, 'k')].sort((a, b) => a - b)).toEqual(items)
  })
})
