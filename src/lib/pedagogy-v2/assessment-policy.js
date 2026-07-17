// assessment-policy.js — versioned policy converting the EXISTING semantic
// analysis result (language-analysis-orchestrator, ANALYSIS_VERSION '1') into
// V2 assessment outcomes and confidences. Centralized here so no verdict
// strings ever leak into the UI, and tested in isolation.
//
// The semantic engine's internal thresholds are NOT touched by this slice —
// this policy only reads its public result shape:
//   { verdict: 'valid'|'valid_with_suggestions'|'needs_revision'|'unable_to_assess',
//     confidence: number, detected_errors: [{ severity, ... }], ... }

export const ASSESSMENT_POLICY_VERSION = 1

// Documented conservative fallback confidence when an engine result carries no
// usable numeric confidence: never fabricate near-certainty for "looks right".
export const FALLBACK_SEMANTIC_CONFIDENCE = 0.5

// Default STT confidence when the Web Speech API gives none — conservative,
// documented; the combined speech confidence is capped by it.
export const DEFAULT_STT_CONFIDENCE = 0.6

// Below this combined confidence a spoken production is unable_to_assess.
export const MIN_SPEECH_ASSESSABLE_CONFIDENCE = 0.3

const severityRank = { high: 3, medium: 2, low: 1 }
const maxSeverity = (errors) => (errors || []).reduce((m, e) => Math.max(m, severityRank[e?.severity] || 0), 0)

/**
 * Map a semantic analysis result to a V2 outcome:
 *   valid                  → correct (real engine confidence)
 *   valid_with_suggestions → partial when a medium+ severity issue was
 *                            detected (real, graded shortfall), otherwise
 *                            correct with the engine's (reduced) confidence
 *   needs_revision         → incorrect when a high-severity error exists,
 *                            otherwise partial (score 0.5)
 *   unable_to_assess       → status unable_to_assess (no assessed outcome)
 * Heuristic partial scores (0.75 / 0.5) are versioned constants of this
 * policy, not learner-model math.
 */
export function mapSemanticResultToOutcome(result) {
  const confidence = (typeof result?.confidence === 'number' && result.confidence > 0)
    ? Math.min(1, result.confidence)
    : FALLBACK_SEMANTIC_CONFIDENCE
  switch (result?.verdict) {
    case 'valid':
      return { status: 'assessed', outcome: 'correct', partial_score: null, assessment_confidence: confidence }
    case 'valid_with_suggestions':
      return maxSeverity(result.detected_errors) >= severityRank.medium
        ? { status: 'assessed', outcome: 'partial', partial_score: 0.75, assessment_confidence: confidence }
        : { status: 'assessed', outcome: 'correct', partial_score: null, assessment_confidence: confidence }
    case 'needs_revision':
      return maxSeverity(result.detected_errors) >= severityRank.high
        ? { status: 'assessed', outcome: 'incorrect', partial_score: null, assessment_confidence: confidence }
        : { status: 'assessed', outcome: 'partial', partial_score: 0.5, assessment_confidence: confidence }
    case 'unable_to_assess':
    default:
      return { status: 'unable_to_assess', outcome: 'not_assessed', partial_score: null, assessment_confidence: 0 }
  }
}

/**
 * Combined confidence for spoken production: STT confidence × semantic
 * confidence (independent failure sources compose multiplicatively). Both
 * default to their documented conservative values when absent.
 */
export function combineSpeechConfidence({ sttConfidence = null, semanticConfidence = null } = {}) {
  const stt = (typeof sttConfidence === 'number') ? sttConfidence : DEFAULT_STT_CONFIDENCE
  const sem = (typeof semanticConfidence === 'number') ? semanticConfidence : FALLBACK_SEMANTIC_CONFIDENCE
  return Math.max(0, Math.min(1, stt * sem))
}

export const DEFAULT_ASSESSMENT_POLICY_V2 = Object.freeze({
  policy_version: ASSESSMENT_POLICY_VERSION,
  fallback_semantic_confidence: FALLBACK_SEMANTIC_CONFIDENCE,
  default_stt_confidence: DEFAULT_STT_CONFIDENCE,
  min_speech_assessable_confidence: MIN_SPEECH_ASSESSABLE_CONFIDENCE,
})
