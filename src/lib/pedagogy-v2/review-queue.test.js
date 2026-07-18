// review-queue.test.js — deterministic temporal fixtures (§24 of the V2.6
// briefing: today / 2 days ago / 7 days ago / 30 days ago, never Date.now in
// the core) proving the runtime review queue: overdue detection, delayed
// failure, declining trend, modality gap, supported-without-independent and
// the anti-eager rule (a stable target is NOT reviewed early).

import { describe, it, expect } from 'vitest'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { loadPedagogyV2Registry } from './registry.js'
import { buildReviewQueueV2 } from './review-queue.js'

const registry = loadPedagogyV2Registry()
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)).toISOString()
const daysAgo = (d, minute = 0) => new Date(Date.parse(NOW) - d * DAY + minute * 60000).toISOString()

const CONT = { target_type: 'sense', target_id: 'sense:still.continuity' }
const B_CONTRAST = { target_type: 'sense', target_id: 'sense:but.contrast' }
const READ_REC = { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' }
const LISTEN_REC = { activity_kind: 'listening_recognition', capability: 'recognition', modality: 'listening' }

let seq = 0
const ev = (target, activity, at, over = {}) => buildLearnerEvidenceV2({
  evidence_id: `evidence:rq.${String(++seq).padStart(4, '0')}`,
  profile_id: 'p1',
  interaction_id: `interaction:rq${seq}`,
  target, exemplar_id: null, activity,
  attribution: 'direct', outcome: 'correct',
  occurred_at: at,
  source: { source_type: 'test' },
  ...over,
})

const queueFor = (events, over = {}) => buildReviewQueueV2({
  registry, learnerStates: aggregateProfileEvidence(events), recentEvidence: events, now: NOW, ...over,
})

describe('review queue — retention overdue (temporal fixtures)', () => {
  it('a target retrieved once 7 days ago is overdue (elapsed 7d ≫ default 2d interval); today is not', () => {
    // A single retrieval leaves stability_estimate null → the policy default
    // interval (2 days) governs. Elapsed 7 days → overdue.
    const old = queueFor([ev(CONT, READ_REC, daysAgo(7))])
    const overdue = old.find((i) => i.target.target_id === CONT.target_id && i.capability_key === 'reading_recognition')
    expect(overdue).toBeTruthy()
    expect(overdue.reason_codes).toContain('RETENTION_OVERDUE')
    expect(overdue.last_retrieval_at).toBe(daysAgo(7))

    const fresh = queueFor([ev(CONT, READ_REC, daysAgo(0, -30))])
    expect(fresh.find((i) => i.reason_codes.includes('RETENTION_OVERDUE'))).toBeFalsy()
  })

  it('a STABLE target (long successful delayed retrievals) is not reviewed early', () => {
    // 30d → 7d → 2d ago, all correct: stability grows past the elapsed 2 days.
    const events = [
      ev(CONT, READ_REC, daysAgo(30)),
      ev(CONT, READ_REC, daysAgo(7)),   // delayed success, interval 23d
      ev(CONT, READ_REC, daysAgo(2)),   // delayed success, interval 5d
    ]
    const queue = queueFor(events)
    const item = queue.find((i) => i.capability_key === 'reading_recognition' && i.target.target_id === CONT.target_id)
    // Stability ≥ elapsed → no RETENTION_OVERDUE, no LOW_STABILITY.
    expect(item?.reason_codes ?? []).not.toContain('RETENTION_OVERDUE')
    expect(item?.reason_codes ?? []).not.toContain('LOW_STABILITY')
  })

  it('a failed delayed retrieval flags DELAYED_RETRIEVAL_FAILED and RECENT_FAILURE', () => {
    const events = [
      ev(CONT, READ_REC, daysAgo(7)),
      ev(CONT, READ_REC, daysAgo(2), { outcome: 'incorrect' }), // delayed failure
    ]
    const item = queueFor(events).find((i) => i.capability_key === 'reading_recognition')
    expect(item.reason_codes).toEqual(expect.arrayContaining(['DELAYED_RETRIEVAL_FAILED', 'RECENT_FAILURE']))
    expect(item.priority).toBeGreaterThan(1)
  })
})

describe('review queue — lane-shape reasons', () => {
  it('declining trend enters the queue', () => {
    const scores = ['correct', 'correct', 'correct', 'incorrect', 'incorrect', 'incorrect']
    const events = scores.map((outcome, i) => ev(CONT, READ_REC, daysAgo(0, -60 + i), { outcome }))
    const item = queueFor(events).find((i) => i.capability_key === 'reading_recognition')
    expect(item.reason_codes).toContain('DECLINING_TREND')
  })

  it('modality gap: practiced reading with listening absent', () => {
    const events = [ev(B_CONTRAST, READ_REC, daysAgo(0, -30))]
    const item = queueFor(events).find((i) => i.capability_key === 'reading_recognition')
    expect(item.reason_codes).toContain('MODALITY_GAP')
    // The gap disappears once listening carries evidence.
    const both = queueFor([ev(B_CONTRAST, READ_REC, daysAgo(0, -30)), ev(B_CONTRAST, LISTEN_REC, daysAgo(0, -20))])
    expect(both.filter((i) => i.reason_codes.includes('MODALITY_GAP'))).toEqual([])
  })

  it('supported-without-independent requires ESTABLISHED supported mastery', () => {
    // `translation` is a MEDIUM-tier scaffold (weight 0.6 per answer).
    const supported = (n, from) => Array.from({ length: n }, (_, i) =>
      ev(CONT, READ_REC, daysAgo(0, from + i), { support: { features: ['translation'], hint_count: 0, attempt_number: 1 } }))
    // 2 supported answers (weight 1.2 < emerging bar of 2): NOT queued.
    expect(queueFor(supported(2, -50)).find((i) => i.reason_codes.includes('SUPPORTED_WITHOUT_INDEPENDENT'))).toBeFalsy()
    // 4 supported answers (weight 2.4 ≥ emerging, mastery .77 ≥ .7): queued.
    const item = queueFor(supported(4, -50)).find((i) => i.reason_codes.includes('SUPPORTED_WITHOUT_INDEPENDENT'))
    expect(item).toBeTruthy()
    expect(item.capability_key).toBe('reading_recognition')
  })
})

describe('review queue — hygiene', () => {
  it('is empty for a brand-new learner and deterministic for the same inputs', () => {
    expect(queueFor([])).toEqual([])
    const events = [ev(CONT, READ_REC, daysAgo(7)), ev(B_CONTRAST, READ_REC, daysAgo(9))]
    expect(queueFor(events)).toEqual(queueFor([...events].reverse()))
  })

  it('never queues targets that do not resolve in the registry', () => {
    const states = aggregateProfileEvidence([ev(CONT, READ_REC, daysAgo(9))])
    const ghost = structuredClone(states[0])
    ghost.target = { target_type: 'sense', target_id: 'sense:ghost.x' }
    ghost.key = 'p1:sense:sense:ghost.x'
    const queue = buildReviewQueueV2({ registry, learnerStates: [...states, ghost], recentEvidence: [], now: NOW })
    expect(queue.every((i) => i.target.target_id !== 'sense:ghost.x')).toBe(true)
  })

  it('requires an explicit now (no clock in the core)', () => {
    expect(() => buildReviewQueueV2({ registry, learnerStates: [], now: undefined })).toThrow('REVIEW_QUEUE_NOW_REQUIRED')
  })
})
