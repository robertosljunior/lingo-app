// activity-assessment.js — assessment adapter V2 (Slice V2.4). Evaluates ONE
// validated ActivityResponseV2 against its ActivityPlanV2 and returns a
// versioned AssessmentResultV2. It NEVER writes evidence and never touches
// storage; external engines (semantic pipeline, future acoustic assessor)
// arrive injected through `assessmentServices`.
//
//   evaluateActivityResponseV2({ activityPlan, response, assessmentServices, policy })
//     → { assessment_version, activity_id, interaction_id,
//         status: 'assessed'|'not_assessed'|'unable_to_assess',
//         outcome, partial_score, assessment_confidence,
//         feedback: {...}, target_assessments: [{ target_type, target_id }] }
//
// target_assessments lists the targets the assessor actually evaluated.
// Deterministic recipes assess every DIRECT planned target; semantic recipes
// (guided/free) declare the plan's primary targets when the engine could
// assess the production at all (documented policy — the exemplar's primary use
// is what the prompt elicits).

import { mapSemanticResultToOutcome, combineSpeechConfidence, DEFAULT_ASSESSMENT_POLICY_V2 } from './assessment-policy.js'
import { buildMaskedCompletion, canonicalOrderTokens } from './activity-runtime-contracts.js'
import { buildAssessmentDiagnosisV2 } from './assessment-diagnosis.js'

export const ASSESSMENT_VERSION = 1

// Limited normalization for completion answers (documented heuristic): Unicode
// NFC, whitespace collapse, case-fold, and stripping PERIPHERAL punctuation
// only. No expansive linguistic corrections.
export function normalizeCompletionToken(s) {
  return String(s ?? '')
    .normalize('NFC')
    .trim()
    .replace(/^[.,!?;:"'“”‘’]+|[.,!?;:"'“”‘’]+$/g, '')
    .toLowerCase()
}

const base = (plan, response, fields) => ({
  assessment_version: ASSESSMENT_VERSION,
  activity_id: plan.activity_id,
  interaction_id: response.interaction_id,
  partial_score: null,
  feedback: {},
  target_assessments: [],
  ...fields,
})

const directPlannedTargets = (plan) => (plan.planned_evidence || [])
  .filter((pe) => pe.attribution === 'direct' && !pe.condition)
  .map((pe) => ({ target_type: pe.target.target_type, target_id: pe.target.target_id }))

const primaryTargets = (plan) => [
  plan.primary_target,
  ...(plan.secondary_targets || []).filter((t) => t.role === 'primary'),
].map((t) => ({ target_type: t.target_type, target_id: t.target_id }))

async function assessSemantics({ plan, text, mode, services }) {
  if (typeof services?.analyzeSemantics !== 'function') return null
  return services.analyzeSemantics({
    text,
    assessmentMode: mode,
    equivalentTarget: plan.text_en,
    context: { text_pt: plan.text_pt, situation: plan.context },
  })
}

/**
 * Public entry: evaluate a response and attach a typed AssessmentDiagnosisV2
 * (Slice V2.13). The diagnosis explains WHY the outcome happened, from
 * structured evidence only. The raw semantic result is attached (in memory) for
 * production recipes so the Playground can show raw → diagnosis → feedback; it
 * is NEVER read by the evidence adapter and NEVER persisted.
 */
export async function evaluateActivityResponseV2(args) {
  const assessment = await evaluateActivityResponseCoreV2(args)
  const semanticResult = assessment.__semantic_result ?? null
  if ('__semantic_result' in assessment) delete assessment.__semantic_result
  assessment.diagnosis = buildAssessmentDiagnosisV2({
    activityPlan: args.activityPlan,
    response: args.response,
    semanticResult,
    assessmentOutcome: assessment.outcome,
    assessmentStatus: assessment.status,
    feedback: assessment.feedback,
  })
  // In-memory only (Playground diagnostics). Not persisted, not in evidence.
  if (semanticResult) assessment.semantic_result = semanticResult
  return assessment
}

async function evaluateActivityResponseCoreV2({ activityPlan: plan, response, assessmentServices = {}, policy = DEFAULT_ASSESSMENT_POLICY_V2 }) {
  switch (plan.recipe) {
    // ---- exposure: no right or wrong exists -------------------------------
    case 'exposure':
      return base(plan, response, {
        status: 'not_assessed', outcome: 'observed', assessment_confidence: null,
        feedback: { kind: 'exposure' },
      })

    // ---- recognition: exact option_id comparison, deterministic -----------
    case 'meaning_recognition':
    case 'listening_recognition': {
      const correctId = plan.response_contract.correct_option_id
      const chosen = response.payload.option_id
      const correct = chosen === correctId
      return base(plan, response, {
        status: 'assessed',
        outcome: correct ? 'correct' : 'incorrect',
        assessment_confidence: 1,
        feedback: { kind: 'choice', chosen_option_id: chosen, correct_option_id: correctId },
        target_assessments: directPlannedTargets(plan),
      })
    }

    // ---- completion: masked fixed elements, limited normalization ---------
    case 'fixed_element_completion': {
      const { expected_tokens } = buildMaskedCompletion(plan)
      const given = String(response.payload.text || '').trim().split(/\s+/)
      const matches = expected_tokens.filter((t, i) => normalizeCompletionToken(given[i]) === normalizeCompletionToken(t)).length
      const extra = given.filter((g) => g !== '').length > expected_tokens.length
      const allCorrect = matches === expected_tokens.length && !extra
      // Heuristic (documented): partial_score is the exact proportion of
      // correct tokens when several elements are masked.
      const ratio = expected_tokens.length ? matches / expected_tokens.length : 0
      const outcome = allCorrect ? 'correct' : (matches > 0 && expected_tokens.length > 1 ? 'partial' : 'incorrect')
      return base(plan, response, {
        status: 'assessed', outcome,
        partial_score: outcome === 'partial' ? ratio : null,
        assessment_confidence: 1,
        feedback: { kind: 'completion', expected_tokens, given },
        target_assessments: directPlannedTargets(plan),
      })
    }

    // ---- word order: canonical sequence, binary in this slice -------------
    case 'word_order_reconstruction': {
      const expected = canonicalOrderTokens(plan)
      const got = response.payload.tokens || []
      const correct = got.length === expected.length && expected.every((t, i) => got[i] === t)
      return base(plan, response, {
        status: 'assessed', outcome: correct ? 'correct' : 'incorrect',
        assessment_confidence: 1,
        feedback: { kind: 'word_order', expected_tokens: expected, given_tokens: got },
        target_assessments: directPlannedTargets(plan),
      })
    }

    // ---- guided / free production: existing semantic pipeline -------------
    case 'guided_production':
    case 'free_production': {
      const mode = plan.recipe === 'guided_production' ? 'guided' : 'free'
      const spoken = response.response_type === 'speech_transcript'
      const text = spoken ? response.payload.transcript : response.payload.text
      if (spoken && !String(text || '').trim()) {
        return base(plan, response, {
          status: 'unable_to_assess', outcome: 'not_assessed', assessment_confidence: 0,
          feedback: { kind: 'speech', reason: 'no_transcript' },
        })
      }
      let result = null
      try { result = await assessSemantics({ plan, text, mode, services: assessmentServices }) } catch { result = null }
      if (!result) {
        return base(plan, response, {
          status: 'unable_to_assess', outcome: 'not_assessed', assessment_confidence: 0,
          feedback: { kind: 'semantic', reason: 'engine_unavailable' },
        })
      }
      const mapped = mapSemanticResultToOutcome(result)
      let confidence = mapped.assessment_confidence
      if (spoken && mapped.status === 'assessed') {
        confidence = combineSpeechConfidence({
          sttConfidence: response.payload.stt_confidence ?? null,
          semanticConfidence: mapped.assessment_confidence,
        })
        if (confidence < policy.min_speech_assessable_confidence) {
          return base(plan, response, {
            status: 'unable_to_assess', outcome: 'not_assessed', assessment_confidence: 0,
            feedback: { kind: 'speech', reason: 'low_confidence' },
          })
        }
      }
      return base(plan, response, {
        status: mapped.status,
        outcome: mapped.outcome,
        partial_score: mapped.partial_score,
        assessment_confidence: mapped.status === 'assessed' ? confidence : 0,
        feedback: {
          kind: 'semantic',
          verdict: result.verdict,
          corrected_version: result.corrected_version || null,
          detected_errors: (result.detected_errors || []).slice(0, 3),
          natural_alternatives: (result.natural_alternatives || []).slice(0, 2),
        },
        target_assessments: mapped.status === 'assessed' ? primaryTargets(plan) : [],
        // Full raw result carried to the diagnosis layer (in memory only).
        __semantic_result: result,
      })
    }

    // ---- pronunciation: §8 — never `correct` from a transcript ------------
    case 'pronunciation': {
      const services = assessmentServices
      if (typeof services?.assessPronunciation === 'function') {
        // A real acoustic assessor would plug in here (none exists in V2.4;
        // kept as the extension seam, exercised only by tests).
        const r = await services.assessPronunciation({ plan, response })
        if (r && ['correct', 'partial', 'incorrect'].includes(r.outcome)) {
          return base(plan, response, {
            status: 'assessed', outcome: r.outcome, partial_score: r.partial_score ?? null,
            assessment_confidence: r.confidence ?? 0.5,
            feedback: { kind: 'pronunciation', ...r.feedback },
            target_assessments: directPlannedTargets(plan),
          })
        }
      }
      // No acoustic assessor: repetition counts as practice, observed only.
      return base(plan, response, {
        status: 'not_assessed', outcome: 'observed', assessment_confidence: null,
        feedback: { kind: 'pronunciation', reason: 'no_acoustic_assessor' },
      })
    }

    default:
      return base(plan, response, {
        status: 'unable_to_assess', outcome: 'not_assessed', assessment_confidence: 0,
        feedback: { kind: 'unknown_recipe' },
      })
  }
}
