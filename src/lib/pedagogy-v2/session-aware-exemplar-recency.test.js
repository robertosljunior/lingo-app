import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { createLessonSessionV2 } from './lesson-engine-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { buildRecentExemplarUsageV2, exemplarRecencyRank } from './experience-diversity.js'

const T0 = Date.UTC(2026, 7, 10, 12, 0, 0)
const iso = (n) => new Date(T0 + n * 60000).toISOString()
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const EXPO = { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }
let seq = 0

function evidence({ exemplarId, sessionId = null, target = { target_type: 'sense', target_id: 'sense:still.continuity' }, outcome = 'correct' }) {
  seq += 1
  return buildLearnerEvidenceV2({
    evidence_id: `evidence:session-recency.${seq}`,
    profile_id: 'p1',
    interaction_id: `interaction:session-recency.${seq}`,
    ...(sessionId ? { session_id: sessionId } : {}),
    target,
    exemplar_id: exemplarId,
    activity: READ_REC,
    attribution: 'indirect',
    outcome,
    occurred_at: iso(seq),
    source: { source_type: 'test' },
  })
}

function advancedStates() {
  const targets = new Map()
  for (const exemplar of stillPack.exemplars || []) {
    for (const target of exemplar.pedagogical_targets || []) {
      targets.set(`${target.target_type}:${target.target_id}`, {
        target_type: target.target_type,
        target_id: target.target_id,
      })
    }
  }
  const rows = []
  for (const target of targets.values()) {
    seq += 1
    rows.push(buildLearnerEvidenceV2({
      evidence_id: `evidence:advanced.exposure.${seq}`,
      profile_id: 'p1', interaction_id: `interaction:advanced.exposure.${seq}`,
      target, exemplar_id: null, activity: EXPO, attribution: 'exposure',
      outcome: 'observed', occurred_at: iso(1000 + seq), source: { source_type: 'test' },
    }))
    for (let i = 0; i < 4; i++) {
      seq += 1
      rows.push(buildLearnerEvidenceV2({
        evidence_id: `evidence:advanced.recognition.${seq}`,
        profile_id: 'p1', interaction_id: `interaction:advanced.recognition.${seq}`,
        target, exemplar_id: null, activity: READ_REC, attribution: 'direct',
        outcome: 'correct', occurred_at: iso(1000 + seq), source: { source_type: 'test' },
      }))
    }
  }
  return aggregateProfileEvidence(rows)
}

const STATES = advancedStates()
// Explicitly pin the high-frequency continuity sense. Unlike a generic
// comprehension focus, this has several genuinely equivalent authored
// realizations (still.001/.002/.003/.005 etc.), so an anti-repeat assertion is
// meaningful rather than demanding variety from a single-exemplar focus.
const MULTI_FOCUS = {
  target_id: 'sense:still.continuity',
  capability: 'comprehension',
  modality: 'reading',
}
const lessonSession = (id, seed = 'fixed-seed') => createLessonSessionV2({
  session_id: id,
  profile_id: 'p1',
  now: iso(9000),
  seed,
})

function pick({ id, recentEvidence = [], focus = MULTI_FOCUS }) {
  return selectNextActivityV2({
    session: lessonSession(id),
    pack: stillPack,
    learnerStates: STATES,
    recentEvidence,
    focus,
  })
}

function bandExemplars(decision) {
  return decision.trace?.experience_diversity?.pool?.band_exemplars || []
}

describe('session-aware exemplar recency — P0 anti-loop', () => {
  it('keeps the latest session opener recent even after it falls outside the interaction window', () => {
    const rows = [
      evidence({ exemplarId: 'exemplar:A', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:B', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:C', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:D', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:E', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:F', sessionId: 'lesson:previous' }),
    ]
    const usage = buildRecentExemplarUsageV2(rows, { window: 4 })
    const opener = usage.get('exemplar:A')

    expect(opener.interactions_since_seen).toBe(5)
    expect(opener.in_latest_session).toBe(true)
    expect(opener.is_latest_session_opener).toBe(true)
    expect(opener.within_window).toBe(true)
    expect(usage.latest_session_id).toBe('lesson:previous')
    expect(usage.latest_session_opener_exemplar_id).toBe('exemplar:A')

    const rank = exemplarRecencyRank(usage, 'exemplar:A', 4)
    expect(rank.within_window).toBe(true)
    expect(rank.interactions_since_seen).toBe(-1)
    expect(rank.session_opener_protected).toBe(true)
  })

  it('keeps every exemplar from the latest lesson session recent, not only the last four interactions', () => {
    const rows = Array.from({ length: 9 }, (_, i) => evidence({
      exemplarId: `exemplar:${i + 1}`,
      sessionId: 'lesson:long',
    }))
    const usage = buildRecentExemplarUsageV2(rows, { window: 4 })

    expect(usage.get('exemplar:1').interactions_since_seen).toBe(8)
    expect(usage.get('exemplar:1').within_window).toBe(true)
    expect(usage.get('exemplar:5').within_window).toBe(true)
    expect(usage.get('exemplar:9').within_window).toBe(true)
    expect(usage.latest_session_exemplar_ids).toHaveLength(9)
  })

  it('uses a fresh same-focus exemplar before replaying one already used in the current lesson session', () => {
    const first = pick({ id: 'lesson:current' })
    expect(first.status).toBe('activity')
    expect(bandExemplars(first).length).toBeGreaterThan(1)

    const recent = [evidence({ exemplarId: first.plan.exemplar_id, sessionId: 'lesson:current' })]
    const second = pick({ id: 'lesson:current', recentEvidence: recent })

    expect(second.status).toBe('activity')
    expect(second.plan.exemplar_id).not.toBe(first.plan.exemplar_id)
    expect(second.plan.primary_target.target_id).toBe(first.plan.primary_target.target_id)
    expect(second.plan.capability).toBe(first.plan.capability)
    expect(second.plan.modality).toBe(first.plan.modality)
  })

  it('prevents the previous session opener from immediately winning again after >4 later interactions when a real in-band alternative exists', () => {
    const baseline = pick({ id: 'lesson:baseline' })
    expect(baseline.status).toBe('activity')
    const opener = baseline.plan.exemplar_id
    const alternatives = bandExemplars(baseline).filter((x) => x !== opener)
    expect(alternatives.length).toBeGreaterThan(0)

    // The previous opener is deliberately >4 interactions behind. Before this
    // hotfix it became "fresh" again and the fixed seed could restart on it.
    // The filler interactions use non-candidate IDs: they advance interaction
    // distance without falsely claiming that the real alternative was already
    // consumed by this lesson session.
    const recent = [
      evidence({ exemplarId: opener, sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:outside.1', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:outside.2', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:outside.3', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:outside.4', sessionId: 'lesson:previous' }),
      evidence({ exemplarId: 'exemplar:outside.5', sessionId: 'lesson:previous' }),
    ]
    const next = pick({ id: 'lesson:next', recentEvidence: recent })

    expect(next.status).toBe('activity')
    expect(next.plan.exemplar_id).not.toBe(opener)
    expect(next.plan.primary_target.target_id).toBe(baseline.plan.primary_target.target_id)
    expect(next.plan.capability).toBe(baseline.plan.capability)
    expect(next.plan.modality).toBe(baseline.plan.modality)
  })

  it('does not fake variety when the planner focus has only one eligible exemplar', () => {
    const soleFocus = {
      target_id: 'function:introduce_concession',
      capability: 'comprehension',
      modality: 'reading',
    }
    const first = pick({ id: 'lesson:sole.1', focus: soleFocus })
    expect(first.status).toBe('activity')
    const repeated = pick({
      id: 'lesson:sole.2',
      focus: soleFocus,
      recentEvidence: [evidence({ exemplarId: first.plan.exemplar_id, sessionId: 'lesson:sole.previous' })],
    })
    expect(repeated.status).toBe('activity')
    expect(repeated.plan.exemplar_id).toBe(first.plan.exemplar_id)
  })

  it('falls back to the original interaction-only behavior for legacy evidence with no session_id', () => {
    const rows = [
      evidence({ exemplarId: 'exemplar:legacyA' }),
      evidence({ exemplarId: 'exemplar:legacyB' }),
      evidence({ exemplarId: 'exemplar:legacyC' }),
      evidence({ exemplarId: 'exemplar:legacyD' }),
      evidence({ exemplarId: 'exemplar:legacyE' }),
      evidence({ exemplarId: 'exemplar:legacyF' }),
    ]
    const usage = buildRecentExemplarUsageV2(rows, { window: 4 })

    expect(usage.latest_session_id).toBe(null)
    expect(usage.get('exemplar:legacyA').interactions_since_seen).toBe(5)
    expect(usage.get('exemplar:legacyA').within_window).toBe(false)
    expect(exemplarRecencyRank(usage, 'exemplar:legacyA', 4).interactions_since_seen).toBe(5)
  })
})
