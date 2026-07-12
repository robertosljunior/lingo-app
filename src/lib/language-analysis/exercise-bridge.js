// exercise-bridge.js — maps question types to assessment modes and adapts the
// language-analysis result into the shape the Exercise screen + submitAnswer
// expect. For free/guided it guarantees the model answer is never surfaced.

const TYPE_TO_MODE = {
  fill_blank: 'exact',
  choose_best: 'exact',
  build_sentence: 'exact',
  listen_type: 'exact',
  speak_sentence: 'exact',
  translate: 'equivalent',
  translate_natural: 'equivalent',
  rewrite: 'equivalent',
  rewrite_natural: 'equivalent',
  guided_write: 'guided',
  guided_speak: 'guided',
  free_write: 'free',
  free_speak: 'free',
  answer_question: 'free',
}

/** Resolve the assessment mode for a question. Explicit `assessment_mode` wins. */
export function resolveAssessmentMode(q) {
  if (q?.assessment_mode && ['exact', 'equivalent', 'guided', 'free'].includes(q.assessment_mode)) return q.assessment_mode
  return TYPE_TO_MODE[q?.type] || 'exact'
}

// Legacy generator question types. The deterministic lesson generator already
// stamps these with assessment_mode ('equivalent' for translate/rewrite, 'guided'
// for speak_sentence), but they were designed around the legacy engine +
// model-answer comparison UI. Keep them on that engine so generated lessons are
// unchanged; only NEW authored free/guided (and opt-in equivalent) types route
// through the semantic tutor pipeline.
const LEGACY_ENGINE_TYPES = new Set([
  'translate_natural', 'rewrite_natural', 'speak_sentence',
  'fill_blank', 'choose_best', 'build_sentence', 'listen_type',
])

/**
 * Whether this question should be routed through the semantic tutor pipeline.
 * Free and guided always route (the new capability). Equivalent routes only when
 * a question OPTS IN via an explicit `assessment_mode: 'equivalent'` on a
 * non-legacy type.
 */
export function usesSemanticPipeline(q) {
  if (LEGACY_ENGINE_TYPES.has(q?.type)) return false
  const mode = resolveAssessmentMode(q)
  if (mode === 'free' || mode === 'guided') return true
  if (mode === 'equivalent' && q?.assessment_mode === 'equivalent') return true
  return false
}

const STOP = new Set([
  'a', 'an', 'the', 'to', 'of', 'is', 'are', 'am', 'be', 'been', 'being', 'was', 'were',
  'and', 'or', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as', 'so',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should',
  'not', 'no', 'yes', 'here', 'there', 'now', 'then',
])
/**
 * Essential CONTENT words of the model answer for equivalent-mode meaning checks.
 * Contractions (i've, don't, she's) are dropped — they are function words and the
 * structural tokenizer splits their clitics, so they must never count as
 * "essential meaning" tokens.
 */
export function essentialWords(text) {
  return [...new Set(
    (text || '').toLowerCase()
      .replace(/[^a-z0-9' ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !w.includes("'") && !STOP.has(w)),
  )]
}

const VERDICT_MAP = {
  valid: 'correct',
  valid_with_suggestions: 'correct',
  needs_revision: 'incorrect',
  unable_to_assess: 'partial',
}

function primaryFeedbackText(result) {
  const err = result.detected_errors?.[0]
  if (result.verdict === 'valid') return 'Sua frase está correta.'
  if (result.verdict === 'valid_with_suggestions') return 'Sua frase está correta e é compreensível.'
  if (err?.category === 'meaning') return 'A frase está correta, mas o significado não corresponde ao que foi pedido.'
  return err?.explanation_pt?.summary || err?.message || 'Vamos ajustar uma coisa.'
}

/**
 * Adapt a pipeline result to the analysis object consumed by submitAnswer and
 * FeedbackSheet. `hide_model_answer` is true for free/guided so no expected/diff
 * is ever shown.
 */
export function toExerciseAnalysis(result, { question, mode }) {
  const verdict = VERDICT_MAP[result.verdict] || 'incorrect'
  const score = verdict === 'correct' ? 1 : verdict === 'partial' ? 0.6 : 0.4
  const hideModel = mode === 'free' || mode === 'guided'
  const primary = result.detected_errors?.[0] || null
  const feedbackErrors = (result.detected_errors || []).map((e) => ({
    ...e,
    role: e === primary ? 'primary' : 'secondary',
    feedback: e.explanation_pt?.summary || e.message || '',
    rule_id: e.error_id,
  }))

  return {
    analysis_version: result.analysis_version,
    assessment_mode: mode,
    verdict,
    is_probably_correct: verdict === 'correct',
    score,
    similarity_score: score,
    // For free/guided the "target" must NOT be the hidden model answer.
    target: hideModel ? (result.corrected_version || null) : (question?.expected_answer || null),
    target_answer: hideModel ? (result.corrected_version || null) : (question?.expected_answer || null),
    normalized_user_answer: null,
    normalized_expected_answer: null,
    detected_errors: feedbackErrors,
    primary_error: feedbackErrors[0] || null,
    possible_mistake_type: primary?.category || null,
    detected_intents: result.detected_intents || [],
    matched_concepts: result.matched_concepts || [],
    corrected_version: result.corrected_version || null,
    natural_alternatives: result.natural_alternatives || [],
    feedback: primaryFeedbackText(result),
    // Rich block the semantic FeedbackSheet renders; carries the hide flag so the
    // UI never shows Expected / diff / model answer in free & guided.
    semantic_feedback: {
      mode,
      hide_model_answer: hideModel,
      verdict: result.verdict,
      headline: primaryFeedbackText(result),
      corrected_version: result.corrected_version || null,
      natural_alternatives: (result.natural_alternatives || []).map((a) => a.text),
      explanation_pt: primary?.explanation_pt || null,
    },
    engines: result.engines,
    fallback_events: result.fallback_events,
    knowledge_pack_versions: result.knowledge_pack_versions,
    assessed_skills: null,
  }
}
