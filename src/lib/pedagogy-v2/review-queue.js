// review-queue.js — runtime-computed review queue (Slice V2.6).
//
// THIS IS NOT AN SRS. There is no persisted `next_review_at`, no SM-2/FSRS/
// Leitner scheduling, no new store and no DB change: the queue is a
// DETERMINISTIC PRIORITIZATION derived, on demand, from the already-persisted
// LearnerTargetStateV2 records (retention, stability_estimate,
// last_retrieval_at, delayed retrievals, capability lanes, trend) and the
// recent evidence. Two calls with the same inputs yield the same queue.
//
// "Review" never means "repeat a word": each item is the recovery of ONE
// specific use (target) in ONE capability and modality (capability_key).

import { entityKindOfId } from './contracts.js'
import { resolvePedagogyEntity } from './registry.js'
import { laneMeets } from './lesson-engine-state-queries.js'
import { mergeStudyPlannerPolicyV2 } from './study-planner-contracts.js'
import { getTrainingAffordancesV2, canTrainIndependentV2, getSiblingTrainableDomainsV2 } from './training-affordances.js'

const DAY_MS = 24 * 60 * 60 * 1000
const round4 = (n) => +Number(n).toFixed(4)

const ASSESSED = ['correct', 'partial', 'incorrect']

/** Most recent assessed outcome per (target_id, capability_key). */
function lastOutcomes(recentEvidence) {
  const sorted = [...(recentEvidence || [])]
    .filter((e) => ASSESSED.includes(e.outcome))
    .sort((a, b) => (Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
      || (a.evidence_id < b.evidence_id ? -1 : 1))
  const out = new Map()
  for (const e of sorted) {
    if (!e.target?.target_id || !e.activity) continue
    out.set(`${e.target.target_id}|${e.activity.modality}_${e.activity.capability}`, e.outcome)
  }
  return out
}

/**
 * Build the review queue for one profile snapshot.
 * Inputs: { registry, learnerStates, recentEvidence, now (ISO), policy }.
 * Output: deterministic array of
 *   { target, capability_key, priority, reason_codes, last_retrieval_at,
 *     stability_estimate }
 * sorted by priority DESC then (target_id, capability_key) ASC.
 * Only targets that STILL resolve in the registry are queued.
 */
export function buildReviewQueueV2({ registry, learnerStates, recentEvidence = [], now, policy = {}, runtimeAvailability = null } = {}) {
  const p = mergeStudyPlannerPolicyV2(policy)
  const nowMs = Date.parse(now)
  if (Number.isNaN(nowMs)) throw new Error('REVIEW_QUEUE_NOW_REQUIRED')
  const failures = lastOutcomes(recentEvidence)
  // Slice V2.8: SUPPORTED_WITHOUT_INDEPENDENT is only an ACTIONABLE review need
  // when the engine can actually train this domain to unaided evidence. For
  // recognition/comprehension (no independent recipe) it was a false need.
  const affordances = getTrainingAffordancesV2({ runtimeAvailability })
  const items = []

  for (const state of learnerStates || []) {
    const targetId = state?.target?.target_id
    if (!targetId || !entityKindOfId(targetId)) continue
    if (registry && !resolvePedagogyEntity(targetId, registry)) continue

    for (const capKey of Object.keys(state.capabilities || {}).sort()) {
      const cap = state.capabilities[capKey]
      const retention = state.retention?.[capKey] || null
      const reasons = []
      let score = 0

      // RETENTION_OVERDUE — elapsed since last retrieval ≥ interval
      // (stability when known, policy default otherwise).
      if (retention?.last_retrieval_at) {
        const intervalDays = retention.stability_estimate ?? p.retention.default_interval_days
        const elapsedDays = Math.max(0, nowMs - Date.parse(retention.last_retrieval_at)) / DAY_MS
        const ratio = intervalDays > 0 ? elapsedDays / intervalDays : 0
        if (ratio >= p.retention.overdue_ratio) {
          reasons.push('RETENTION_OVERDUE')
          score += Math.min(ratio, p.retention.due_cap)
        }
        if (retention.failed_delayed_retrievals > 0
          && retention.failed_delayed_retrievals >= retention.successful_delayed_retrievals) {
          reasons.push('DELAYED_RETRIEVAL_FAILED')
          score += 1.5
        }
        if (retention.stability_estimate != null && retention.stability_estimate < p.retention.low_stability_days) {
          reasons.push('LOW_STABILITY')
          score += 0.75
        }
      }

      // DECLINING_TREND on the overall lane.
      if (cap.overall?.trend === 'declining') {
        reasons.push('DECLINING_TREND')
        score += 1
      }

      // SUPPORTED_WITHOUT_INDEPENDENT — supported mastery is ESTABLISHED at
      // the advancement bar while the independent lane has no evidence. Only
      // actionable when an executable independent affordance exists for this
      // (capability, modality) — otherwise there is no way to satisfy it and it
      // would be a false, permanent review item (Slice V2.8).
      const [capModality, ...capRest] = capKey.split('_')
      const capName = capRest.join('_')
      if (laneMeets(cap.supported, p.thresholds.advancement)
        && (cap.independent?.assessed_evidence_count || 0) === 0
        && canTrainIndependentV2(capName, capModality, { affordances })) {
        reasons.push('SUPPORTED_WITHOUT_INDEPENDENT')
        score += 0.5
      }

      // RECENT_FAILURE — the most recent assessed outcome for this key failed.
      if (failures.get(`${targetId}|${capKey}`) === 'incorrect') {
        reasons.push('RECENT_FAILURE')
        score += 1.25
      }

      // MODALITY_GAP — a parallel TRAINABLE modality of the same capability has
      // no assessed evidence while this one is practiced. Slice V2.9: the
      // sibling is derived from the affordances (recipes × runtime), not from a
      // manual reading↔listening table — production pairs count too. The gap
      // marks the PRACTICED key as having asymmetric coverage; introducing the
      // missing modality itself is the planner's deepen/modality-expansion
      // candidate, never a review item (§11).
      if ((cap.overall?.assessed_evidence_count || 0) > 0) {
        const [capModality2, ...capRest2] = capKey.split('_')
        const hasUnpracticedSibling = getSiblingTrainableDomainsV2({
          capability: capRest2.join('_'), current_modality: capModality2, affordances,
        }).some((sib) => ((state.capabilities?.[`${sib.modality}_${capRest2.join('_')}`]?.overall?.assessed_evidence_count) || 0) === 0)
        if (hasUnpracticedSibling) {
          reasons.push('MODALITY_GAP')
          score += 0.5
        }
      }

      if (!reasons.length) continue
      items.push({
        target: { target_type: state.target.target_type, target_id: targetId },
        capability_key: capKey,
        priority: round4(score),
        reason_codes: reasons.sort(),
        last_retrieval_at: retention?.last_retrieval_at ?? null,
        stability_estimate: retention?.stability_estimate ?? null,
      })
    }
  }

  items.sort((a, b) => (b.priority - a.priority)
    || (a.target.target_id < b.target.target_id ? -1 : a.target.target_id > b.target.target_id ? 1 : 0)
    || (a.capability_key < b.capability_key ? -1 : 1))
  return items
}

/**
 * The first parallel trainable capability key of the same capability, if any.
 * Derived from the engine's recipes (Slice V2.9) — reading_recognition →
 * listening_recognition, writing_controlled_production →
 * speaking_controlled_production, …; null for single-modality capabilities.
 */
export function modalityGapCounterpart(capabilityKey) {
  const [modality, ...rest] = capabilityKey.split('_')
  const capability = rest.join('_')
  const sibling = getSiblingTrainableDomainsV2({ capability, current_modality: modality })[0]
  return sibling ? `${sibling.modality}_${capability}` : null
}
