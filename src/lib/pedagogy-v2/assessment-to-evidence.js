// assessment-to-evidence.js — pure adapter from (plan, response, assessment)
// to a LearnerEvidenceV2 batch, driven entirely by the plan's planned_evidence.
//
// Outcome policy per planned item (documented single policy):
//   attribution 'exposure'        → outcome 'observed' always.
//   'direct' (unconditional)      → the assessed interaction outcome when the
//     assessment declares this target in target_assessments; otherwise
//     'not_assessed' (kept, for diagnostic history).
//   'indirect'                    → the assessed interaction outcome when the
//     interaction was assessed at all (the recipe justifies the relation — it
//     is the same exemplar production/recognition); otherwise 'not_assessed'.
//     The reduced weight comes from the attribution itself (V2.2 model).
//   condition 'only_if_target_assessed' → the event is EMITTED only when the
//     assessment declares that target assessed; otherwise it is OMITTED
//     (chosen over emitting not_assessed: free production plans list every
//     target conditionally, and a flood of not_assessed rows has no
//     diagnostic value there).
//
// IDs are deterministic and idempotent: interaction identity comes from the
// response (session+activity+attempt); evidence ids append the target. The
// iteration order of planned_evidence can never change any id.

import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { buildEvidenceIdV2, finalizeSupportUsage } from './activity-runtime-contracts.js'

const ASSESSED = ['correct', 'partial', 'incorrect']

export function buildLearnerEvidenceBatchFromInteractionV2({ activityPlan: plan, response, assessment, profileId, sessionId }) {
  const support = finalizeSupportUsage(response.support_usage)
  const interactionAssessed = assessment.status === 'assessed' && ASSESSED.includes(assessment.outcome)
  const assessedTargets = new Set((assessment.target_assessments || []).map((t) => `${t.target_type}:${t.target_id}`))
  const events = []

  for (const pe of plan.planned_evidence || []) {
    const key = `${pe.target.target_type}:${pe.target.target_id}`
    let outcome
    let partial = null
    let confidence = null

    if (pe.attribution === 'exposure') {
      outcome = 'observed'
    } else if (pe.condition === 'only_if_target_assessed') {
      if (!(interactionAssessed && assessedTargets.has(key))) continue // omitted by policy
      outcome = assessment.outcome
      partial = assessment.partial_score
      confidence = assessment.assessment_confidence
    } else if (pe.attribution === 'direct') {
      if (interactionAssessed && assessedTargets.has(key)) {
        outcome = assessment.outcome
        partial = assessment.partial_score
        confidence = assessment.assessment_confidence
      } else {
        outcome = 'not_assessed'
      }
    } else { // indirect
      if (interactionAssessed) {
        outcome = assessment.outcome
        partial = assessment.partial_score
        confidence = assessment.assessment_confidence
      } else {
        outcome = 'not_assessed'
      }
    }

    events.push(buildLearnerEvidenceV2({
      evidence_id: buildEvidenceIdV2(response.interaction_id, pe.target),
      profile_id: profileId,
      interaction_id: response.interaction_id,
      session_id: sessionId ?? plan.session_id,
      target: { target_type: pe.target.target_type, target_id: pe.target.target_id },
      exemplar_id: plan.exemplar_id,
      activity: { ...pe.activity },
      attribution: pe.attribution,
      outcome,
      partial_score: partial,
      assessment_confidence: confidence ?? (outcome === 'observed' || outcome === 'not_assessed' ? 1 : confidence),
      support: { features: support.features, hint_count: support.hint_count, attempt_number: support.attempt_number },
      source: { source_type: 'v2_activity', engine: 'pedagogy_v2_pilot_runtime' },
      occurred_at: response.submitted_at,
    }))
  }
  return events
}
