// feedback-view-model.js — PURE adapter that turns the structured V2 pipeline
// output (ActivityPlanV2 + ActivityResponseV2 + AssessmentResultV2 + planned /
// recorded evidence) into the presentation view model the Playground renders.
//
// It is the single guardian of the Slice V2.12 honesty rules:
//
//   §7  A textual mismatch between the response and the reference form NEVER,
//       by itself, becomes a linguistic error. This adapter never diffs text
//       and never derives an error from the plan's target/skill. Every issue
//       comes from a `detected_error` the assessor actually reported.
//   §8  Four concepts stay DISTINCT: linguistic correctness (issues),
//       naturalness (suggestions), target form (target_form — informational),
//       and meaning/context (semantic verdict, surfaced only factually).
//   §9  If the assessor returns only a coarse outcome (e.g. `partial`) with no
//       structured cause, we say so plainly and add a diagnostics note — we do
//       NOT fabricate a grammar / lexical / naturalness / semantic issue.
//   §18 The function is pure: input → output, no new linguistic analysis, no
//       storage, no clock, no randomness.
//   §19 V1 skill_ids / grammar-skill categories are never a source of feedback
//       here.
//
// Output shape (§17/§18):
//   {
//     status: 'correct'|'partial'|'incorrect'|'not_assessed',
//     headline, correct_points: [], issues: [], suggestions: [],
//     target_form: { text_en, text_pt } | null,
//     diagnostics: { provenance, assessment_outcome, assessment_status,
//                    assessment_confidence, semantic_verdict, note, ... },
//   }

export const FEEDBACK_VIEW_MODEL_VERSION = 1

// A detected_error belongs to NATURALNESS (a suggestion) — not to linguistic
// correctness — when the assessor itself labelled it so. Everything else the
// assessor flagged as an error is a genuine linguistic issue. We read the
// assessor's OWN labels; we never re-classify from the target or the text.
function isNaturalnessError(err) {
  return err?.category === 'naturalness'
    || err?.subtype === 'context_preference'
    || err?.from_naturalness === true
}

function issueText(err) {
  const exp = err?.explanation_pt
  if (exp?.title && exp?.summary) return { title: exp.title, summary: exp.summary }
  if (exp?.summary) return { title: null, summary: exp.summary }
  if (err?.message) return { title: null, summary: err.message }
  return { title: null, summary: 'Problema identificado pelo avaliador.' }
}

// Which real mechanism produced this assessment (§11). Derived ONLY from the
// recipe, the submitted response type and the assessment feedback kind — all
// factual pipeline data, never inferred from the target.
export function assessmentProvenanceV2(plan, response, assessment) {
  const kind = assessment?.feedback?.kind
  const recipe = plan?.recipe
  const spoken = response?.response_type === 'speech_transcript'
  if (kind === 'exposure' || recipe === 'exposure') {
    return { code: 'observed_exposure', label: 'Exposição (sem avaliação de acerto)' }
  }
  if (kind === 'choice' || recipe === 'meaning_recognition' || recipe === 'listening_recognition') {
    return { code: 'exact_option_comparison', label: 'Comparação exata da opção escolhida' }
  }
  if (kind === 'completion' || recipe === 'fixed_element_completion') {
    return { code: 'exact_token_comparison', label: 'Comparação exata do preenchimento' }
  }
  if (kind === 'word_order' || recipe === 'word_order_reconstruction') {
    return { code: 'exact_sequence_comparison', label: 'Comparação exata da ordem das palavras' }
  }
  if (kind === 'pronunciation' || recipe === 'pronunciation') {
    return assessment?.status === 'assessed'
      ? { code: 'acoustic_assessment', label: 'Avaliação acústica da pronúncia' }
      : { code: 'observed_pronunciation', label: 'Repetição observada (sem avaliador acústico)' }
  }
  if (kind === 'speech' || (spoken && (recipe === 'guided_production' || recipe === 'free_production'))) {
    return { code: 'speech_semantic', label: 'Transcrição de fala (STT) + avaliação semântica' }
  }
  if (kind === 'semantic' || recipe === 'guided_production' || recipe === 'free_production') {
    return { code: 'semantic_assessment', label: 'Avaliação semântica da produção' }
  }
  return { code: 'unknown', label: 'Mecanismo de avaliação não identificado' }
}

// The learner's raw answer text, straight from the typed payload — no analysis.
export function responseTextV2(plan, response) {
  const p = response?.payload || {}
  switch (response?.response_type) {
    case 'text': return p.text ?? ''
    case 'speech_transcript': return p.transcript ?? ''
    case 'single_choice': return p.option_id ?? ''
    case 'token_sequence': return (p.tokens || []).join(' ')
    case 'continue': return ''
    default: return p.text ?? p.transcript ?? ''
  }
}

// The status is the outcome the assessor decided, collapsed to the four
// presentation buckets. `unable_to_assess` and `not_assessed` both map to
// `not_assessed` — a truthful "we did not evaluate this", never a hidden error.
function statusFor(assessment) {
  if (!assessment) return 'not_assessed'
  if (assessment.status === 'assessed') {
    if (assessment.outcome === 'correct') return 'correct'
    if (assessment.outcome === 'partial') return 'partial'
    if (assessment.outcome === 'incorrect') return 'incorrect'
  }
  return 'not_assessed'
}

const HEADLINES = {
  correct: 'Correto',
  partial: 'Quase lá',
  incorrect: 'Ainda não',
  not_assessed: 'Prática registrada',
}

/**
 * Build the presentation view model. PURE.
 *   buildV2FeedbackViewModel({ plan, response, assessment, plannedEvidence, recordedEvidence })
 * `plannedEvidence` defaults to plan.planned_evidence; `recordedEvidence` is
 * optional (the batch that was / would be persisted).
 */
export function buildV2FeedbackViewModel({
  plan,
  response = null,
  assessment,
  plannedEvidence = null,
  recordedEvidence = null,
} = {}) {
  const status = statusFor(assessment)
  const feedback = assessment?.feedback || {}
  const provenance = assessmentProvenanceV2(plan, response, assessment)

  const detectedErrors = Array.isArray(feedback.detected_errors) ? feedback.detected_errors : []
  const naturalAlternatives = Array.isArray(feedback.natural_alternatives) ? feedback.natural_alternatives : []

  // §8 partition of the assessor's OWN reported items — no re-classification.
  const linguisticErrors = detectedErrors.filter((e) => !isNaturalnessError(e))
  const naturalnessErrors = detectedErrors.filter((e) => isNaturalnessError(e))

  const issues = linguisticErrors.map((e) => {
    const t = issueText(e)
    return {
      title: t.title,
      text: t.summary,
      category: e.category ?? null,
      severity: e.severity ?? null,
    }
  })

  const suggestions = []
  for (const e of naturalnessErrors) {
    const t = issueText(e)
    suggestions.push({ text: t.summary, source: 'naturalness_note' })
  }
  for (const alt of naturalAlternatives) {
    if (alt?.text) suggestions.push({ text: alt.text, source: 'natural_alternative' })
  }
  // A "one natural form" hint from the semantic engine is a SUGGESTION, never
  // an error — it only appears when it actually differs from the reference.
  if (feedback.corrected_version && feedback.corrected_version !== plan?.text_en
    && !suggestions.some((s) => s.text === feedback.corrected_version)) {
    suggestions.push({ text: feedback.corrected_version, source: 'corrected_version' })
  }

  // Positive points — stated only from concrete structured evidence.
  const correctPoints = []
  if (status === 'correct') {
    if (feedback.kind === 'choice') correctPoints.push({ text: 'Você escolheu a opção correta.' })
    else if (feedback.kind === 'completion') correctPoints.push({ text: 'Você preencheu a forma esperada.' })
    else if (feedback.kind === 'word_order') correctPoints.push({ text: 'Você reconstruiu a frase na ordem esperada.' })
    else if (feedback.kind === 'semantic') correctPoints.push({ text: 'Sua produção foi compreendida e considerada adequada.' })
    else correctPoints.push({ text: 'Resposta considerada correta.' })
  } else if (status === 'partial' && feedback.kind === 'completion'
    && typeof assessment?.partial_score === 'number') {
    correctPoints.push({ text: 'Parte da forma esperada foi preenchida corretamente.' })
  }

  // §8 forma-alvo: the authored reference, shown for comparison ONLY. Never
  // presented as an error. Absent for exposure (no single "answer").
  const target_form = (plan && plan.recipe !== 'exposure' && plan.text_en)
    ? { text_en: plan.text_en, text_pt: plan.text_pt ?? null }
    : null

  // §9 honesty: a coarse outcome with no structured cause must not be dressed
  // up as a specific error. Detect it and record a factual note instead.
  let headline = HEADLINES[status]
  let note = null
  const hasStructuredCause = issues.length > 0 || suggestions.length > 0
  if (status === 'partial' && !hasStructuredCause) {
    headline = 'Resposta parcialmente adequada'
    note = 'O avaliador não forneceu uma causa linguística específica.'
  } else if (status === 'incorrect' && !hasStructuredCause) {
    // Deterministic recipes are honestly "incorrect" without a linguistic
    // explanation — the mismatch IS the fact (exact comparison). Only semantic
    // assessments owe a cause; when they give none, say so.
    if (provenance.code === 'semantic_assessment' || provenance.code === 'speech_semantic') {
      note = 'O avaliador considerou a resposta incorreta, mas não forneceu uma causa linguística específica.'
    }
  } else if (status === 'not_assessed') {
    if (assessment?.status === 'unable_to_assess') {
      headline = 'Não foi possível avaliar'
      note = feedback.reason
        ? `O avaliador não pôde avaliar esta resposta (motivo técnico: ${feedback.reason}).`
        : 'O avaliador não pôde avaliar esta resposta.'
    } else if (assessment?.outcome === 'observed') {
      headline = 'Prática registrada'
      note = 'Atividade de exposição: registrada como observada, sem avaliação de acerto.'
    }
  }

  const planned = plannedEvidence ?? plan?.planned_evidence ?? []

  return {
    view_model_version: FEEDBACK_VIEW_MODEL_VERSION,
    status,
    headline,
    response_text: responseTextV2(plan, response),
    correct_points: correctPoints,
    issues,
    suggestions,
    target_form,
    diagnostics: {
      provenance,
      assessment_status: assessment?.status ?? null,
      assessment_outcome: assessment?.outcome ?? null,
      assessment_confidence: assessment?.assessment_confidence ?? null,
      partial_score: assessment?.partial_score ?? null,
      semantic_verdict: feedback.kind === 'semantic' ? (feedback.verdict ?? null) : null,
      assessment_kind: feedback.kind ?? null,
      note,
      // Counts kept explicit so a reviewer can confirm nothing was invented:
      // every issue/suggestion traces to a reported item.
      reported_error_count: detectedErrors.length,
      linguistic_issue_count: issues.length,
      naturalness_suggestion_count: suggestions.length,
      planned_evidence_count: planned.length,
      recorded_evidence_count: Array.isArray(recordedEvidence) ? recordedEvidence.length : null,
    },
  }
}
