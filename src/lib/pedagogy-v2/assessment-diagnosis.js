// assessment-diagnosis.js — Slice V2.13. A PURE, typed diagnosis layer that
// answers "WHY did this response get this outcome?" strictly from structured
// evidence that already exists in the pipeline. It NEVER:
//   - uses an LLM;
//   - invents an explanation;
//   - derives an error from the pedagogical target;
//   - turns a text ≠ model-sentence mismatch into a linguistic error;
//   - recomputes learner mastery (outcome, not diagnosis, drives evidence).
//
// The contract separates `outcome` (correct/partial/incorrect/not_assessed)
// from `diagnosis` (the typed cause). Every cause carries a `source`, so the
// system can always answer "which datum classified this cause?". When there is
// no structured evidence, the category is `unknown` and `cause_coverage` is
// `none` — honest, and preferred over fabrication.
//
//   buildAssessmentDiagnosisV2({ activityPlan, response, semanticResult,
//                               assessmentOutcome, assessmentStatus, feedback })
//     → AssessmentDiagnosisV2  (pure)

export const DIAGNOSIS_VERSION = 1

export const DIAGNOSIS_CATEGORIES = [
  'grammar', 'lexical_choice', 'naturalness', 'semantic_context',
  'target_form', 'incomplete_response', 'unknown',
]

export const DIAGNOSIS_SOURCES = [
  'semantic_engine', 'deterministic_comparison', 'structured_error', 'assessment_adapter',
]

export const CAUSE_COVERAGE = ['specific', 'partial', 'none']

// Categories that describe an actual linguistic/communicative problem (they go
// to the learner as "issues" once mapped by the feedback view model). Naturalness
// and target_form are deliberately NOT here — they are a suggestion and a
// (non-error) note respectively.
const BLOCKING_CATEGORIES = new Set(['grammar', 'lexical_choice', 'semantic_context', 'incomplete_response'])

// Map an ENGINE detected_error.category to a typed diagnosis category. This is
// the only place the mapping lives, and it can never send a naturalness signal
// into a grammar bucket (guarded by tests / invariants).
const ENGINE_CATEGORY_MAP = {
  verb_form: 'grammar',
  grammar: 'grammar',
  spelling: 'grammar',
  capitalization: 'grammar',
  punctuation: 'grammar',
  vocabulary: 'lexical_choice',
  lexical: 'lexical_choice',
  lexical_choice: 'lexical_choice',
  word_choice: 'lexical_choice',
  naturalness: 'naturalness',
  meaning: 'semantic_context',
  semantic: 'semantic_context',
  task: 'semantic_context',
  intent: 'semantic_context',
}

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 }
const sevRank = (s) => SEVERITY_RANK[s] || 0

function detectedErrorToCause(err) {
  const mapped = ENGINE_CATEGORY_MAP[err.category] ?? 'grammar'
  return {
    category: mapped,
    severity: err.severity ?? null,
    code: (err.error_id || err.category || 'error').toString().toUpperCase(),
    confidence: typeof err.confidence === 'number' ? err.confidence : null,
    // Provenance (§4): the structured error object is the datum. We keep the
    // engine's own origin so a reviewer can trace it precisely.
    source: 'structured_error',
    origin: err.source ?? null,
    origin_category: err.category ?? null,
    subtype: err.subtype ?? null,
    explanation: err.explanation_pt
      ? { title: err.explanation_pt.title ?? null, summary: err.explanation_pt.summary ?? err.message ?? null }
      : (err.message ? { title: null, summary: err.message } : null),
  }
}

function pickPrimary(causes) {
  if (!causes.length) return null
  // Prefer blocking categories, then higher severity, then higher confidence.
  return [...causes].sort((a, b) => {
    const ba = BLOCKING_CATEGORIES.has(a.category) ? 1 : 0
    const bb = BLOCKING_CATEGORIES.has(b.category) ? 1 : 0
    if (ba !== bb) return bb - ba
    if (sevRank(b.severity) !== sevRank(a.severity)) return sevRank(b.severity) - sevRank(a.severity)
    return (b.confidence ?? 0) - (a.confidence ?? 0)
  })[0]
}

function unknownCause(code, source = 'assessment_adapter') {
  return {
    category: 'unknown', severity: null, code, confidence: null,
    source, origin: null, origin_category: null, subtype: null, explanation: null,
  }
}

// Token-boundary presence of a fixed lexical element in a free text (structural,
// not string equality with the exemplar — §10).
function containsFixedElement(text, element) {
  if (!text || !element) return false
  const re = new RegExp(`(?:^|[^a-z0-9])${element.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i')
  return re.test(String(text))
}

function emptyDiagnosis(fields) {
  return {
    diagnosis_version: DIAGNOSIS_VERSION,
    primary_cause: null,
    causes: [],
    positive_findings: [],
    target_form_relation: { status: 'not_applicable' },
    semantic_relation: { status: 'unknown' },
    cause_coverage: 'none',
    ...fields,
  }
}

/**
 * Build the typed diagnosis. `semanticResult` is the FULL raw result from the
 * semantic engine (guided/free recipes); `feedback` carries deterministic
 * details already computed by the assessment (expected_tokens, chosen option,
 * etc.). Both optional depending on recipe.
 */
export function buildAssessmentDiagnosisV2({
  activityPlan: plan,
  response = null,
  semanticResult = null,
  assessmentOutcome = null,
  assessmentStatus = null,
  feedback = {},
} = {}) {
  const recipe = plan?.recipe
  const kind = feedback?.kind

  // ---- exposure: no right/wrong exists ------------------------------------
  if (recipe === 'exposure' || kind === 'exposure') {
    return emptyDiagnosis({
      cause_coverage: 'none',
      target_form_relation: { status: 'not_applicable' },
      semantic_relation: { status: 'unknown' },
      positive_findings: [{ code: 'EXPOSURE_OBSERVED', source: 'assessment_adapter' }],
      applicability: 'not_applicable',
    })
  }

  // ---- pronunciation: no acoustic assessor in V2 (rule preserved) ---------
  if (recipe === 'pronunciation' || kind === 'pronunciation') {
    const assessed = assessmentStatus === 'assessed'
    return emptyDiagnosis({
      cause_coverage: assessed ? 'partial' : 'none',
      primary_cause: assessed ? null : unknownCause('ASSESSMENT_UNAVAILABLE_NO_ACOUSTIC_ASSESSOR'),
      applicability: assessed ? 'assessed' : 'assessment_unavailable',
    })
  }

  // ---- speech: STT / combined confidence too low --------------------------
  if (kind === 'speech') {
    return emptyDiagnosis({
      primary_cause: unknownCause('LOW_STT_OR_COMBINED_CONFIDENCE'),
      cause_coverage: 'none',
      applicability: 'unable_to_assess',
    })
  }

  // ---- deterministic recipes: exact, structurally-known cause -------------
  if (kind === 'choice') {
    const correct = assessmentOutcome === 'correct'
    return emptyDiagnosis({
      primary_cause: correct ? null : {
        category: 'target_form', severity: null, code: 'INCORRECT_OPTION_SELECTED',
        confidence: 1, source: 'deterministic_comparison', origin: 'option_comparison',
        origin_category: null, subtype: null,
        explanation: { title: null, summary: 'A opção escolhida não corresponde à esperada.' },
      },
      causes: correct ? [] : [{
        category: 'target_form', severity: null, code: 'INCORRECT_OPTION_SELECTED',
        confidence: 1, source: 'deterministic_comparison', origin: 'option_comparison',
        origin_category: null, subtype: null,
        explanation: { title: null, summary: 'A opção escolhida não corresponde à esperada.' },
      }],
      positive_findings: correct ? [{ code: 'CORRECT_OPTION_SELECTED', source: 'deterministic_comparison' }] : [],
      target_form_relation: { status: 'not_applicable' },
      semantic_relation: { status: correct ? 'aligned' : 'not_aligned', source: 'deterministic_comparison' },
      cause_coverage: 'specific',
      applicability: 'assessed',
    })
  }

  if (kind === 'completion') {
    const correct = assessmentOutcome === 'correct'
    const cause = correct ? null : {
      category: 'target_form', severity: null, code: 'FIXED_ELEMENT_MISMATCH',
      confidence: 1, source: 'deterministic_comparison', origin: 'fixed_element_comparison',
      origin_category: null, subtype: null,
      explanation: { title: null, summary: 'O preenchimento não corresponde exatamente à forma esperada.' },
    }
    return emptyDiagnosis({
      primary_cause: cause,
      causes: cause ? [cause] : [],
      positive_findings: correct ? [{ code: 'FIXED_ELEMENT_MATCHED', source: 'deterministic_comparison' }] : [],
      target_form_relation: { status: correct ? 'matches' : 'different_form', source: 'deterministic_comparison' },
      semantic_relation: { status: 'unknown' },
      cause_coverage: 'specific',
      applicability: 'assessed',
    })
  }

  if (kind === 'word_order') {
    const correct = assessmentOutcome === 'correct'
    const cause = correct ? null : {
      category: 'target_form', severity: null, code: 'TOKEN_SEQUENCE_MISMATCH',
      confidence: 1, source: 'deterministic_comparison', origin: 'token_sequence_comparison',
      origin_category: null, subtype: null,
      explanation: { title: null, summary: 'A ordem das palavras não corresponde à sequência esperada.' },
    }
    return emptyDiagnosis({
      primary_cause: cause,
      causes: cause ? [cause] : [],
      positive_findings: correct ? [{ code: 'TOKEN_SEQUENCE_MATCHED', source: 'deterministic_comparison' }] : [],
      target_form_relation: { status: correct ? 'matches' : 'different_form', source: 'deterministic_comparison' },
      semantic_relation: { status: 'unknown' },
      cause_coverage: 'specific',
      applicability: 'assessed',
    })
  }

  // ---- semantic recipes (guided / free production) ------------------------
  if (kind === 'semantic') {
    // Engine could not assess (no result / unable): honest unknown.
    if (assessmentStatus !== 'assessed' || !semanticResult) {
      return emptyDiagnosis({
        primary_cause: unknownCause(semanticResult ? 'SEMANTIC_UNABLE_TO_ASSESS' : 'SEMANTIC_ENGINE_UNAVAILABLE', 'semantic_engine'),
        cause_coverage: 'none',
        semantic_relation: { status: 'unknown' },
        target_form_relation: { status: 'unknown' },
        applicability: 'unable_to_assess',
      })
    }

    const detected = Array.isArray(semanticResult.detected_errors) ? semanticResult.detected_errors : []
    const causes = detected.map(detectedErrorToCause)
    const hasSemanticCause = causes.some((c) => c.category === 'semantic_context')

    // Naturalness suggestions from natural_alternatives become naturalness
    // causes too — clearly sourced as the semantic engine's alternatives.
    for (const alt of (semanticResult.natural_alternatives || [])) {
      if (alt?.text) {
        causes.push({
          category: 'naturalness', severity: 'low', code: 'NATURAL_ALTERNATIVE',
          confidence: null, source: 'semantic_engine', origin: 'natural_alternatives',
          origin_category: 'naturalness', subtype: alt.tone ?? null,
          explanation: { title: null, summary: alt.text },
        })
      }
    }

    // target_form_relation for production: NEVER string equality. Only a
    // structurally verifiable fixed lexical element counts (§10). Otherwise
    // unknown.
    const fixedElements = plan?.construction_fixed_elements
      || plan?.presentation?.masked_text_source?.fixed_elements
      || []
    const respText = response?.payload?.text ?? response?.payload?.transcript ?? null
    let targetForm = { status: 'unknown' }
    if (fixedElements.length && typeof respText === 'string' && respText.trim()) {
      const allPresent = fixedElements.every((el) => containsFixedElement(respText, el))
      targetForm = { status: allPresent ? 'matches' : 'different_form', source: 'deterministic_comparison', fixed_elements: [...fixedElements] }
    }

    // semantic_relation from the ENGINE's verdict + explicit meaning/task
    // signals — never from raw similarity alone (§9).
    const verdict = semanticResult.verdict
    let semanticStatus = 'unknown'
    if (hasSemanticCause) semanticStatus = 'not_aligned'
    else if (verdict === 'valid') semanticStatus = 'aligned'
    else if (verdict === 'valid_with_suggestions') semanticStatus = 'partially_aligned'
    // needs_revision without a semantic cause = grammar-driven → stays unknown.

    const positive = []
    if (assessmentOutcome === 'correct') {
      // Factual wording only — absence of a reported error is not proof of
      // correctness (§12).
      if (!causes.some((c) => c.category === 'grammar')) positive.push({ code: 'NO_GRAMMAR_ISSUE_REPORTED', source: 'semantic_engine' })
      if (semanticStatus === 'aligned') positive.push({ code: 'SEMANTIC_MEANING_ALIGNED', source: 'semantic_engine' })
      if (targetForm.status === 'matches') positive.push({ code: 'TARGET_CONSTRUCTION_REALIZED', source: 'deterministic_comparison' })
    }

    const blocking = causes.filter((c) => BLOCKING_CATEGORIES.has(c.category))
    const primary = pickPrimary(causes)
    let coverage
    if (assessmentOutcome === 'correct') {
      coverage = positive.length ? 'specific' : 'partial'
    } else if (blocking.length) {
      coverage = 'specific'
    } else if (causes.length) {
      coverage = 'partial' // only naturalness/soft signals explain it
    } else {
      coverage = 'none'
    }

    return emptyDiagnosis({
      primary_cause: (assessmentOutcome === 'correct') ? null
        : (primary || unknownCause('SEMANTIC_OUTCOME_WITHOUT_STRUCTURED_CAUSE', 'semantic_engine')),
      causes,
      positive_findings: positive,
      target_form_relation: targetForm,
      semantic_relation: { status: semanticStatus, source: 'semantic_engine' },
      cause_coverage: coverage,
      applicability: 'assessed',
    })
  }

  // ---- unknown recipe / anything else -------------------------------------
  return emptyDiagnosis({
    primary_cause: unknownCause('UNRECOGNIZED_ASSESSMENT_SHAPE'),
    cause_coverage: 'none',
    target_form_relation: { status: 'unknown' },
    semantic_relation: { status: 'unknown' },
    applicability: 'unknown',
  })
}

// ---- cause-coverage metrics (§17) ------------------------------------------
// Pure aggregation over a set of (diagnosis, meta) records. NOT a learner
// mastery metric and never fed to the Planner.

const EMPTY_DISTRIBUTION = () => ({
  grammar: 0, lexical_choice: 0, naturalness: 0, semantic_context: 0,
  target_form: 0, incomplete_response: 0, unknown: 0,
})

/**
 * @param {Array<{ diagnosis, isProductionAssessment?: boolean }>} records
 */
export function buildAssessmentCauseCoverageV2(records = []) {
  const distribution = EMPTY_DISTRIBUTION()
  let assessedProduction = 0
  let specific = 0
  let partial = 0
  let unknown = 0
  for (const r of records) {
    const d = r?.diagnosis
    if (!d) continue
    const cat = d.primary_cause?.category ?? (d.cause_coverage === 'none' ? 'unknown' : null)
    if (cat && cat in distribution) distribution[cat] += 1
    if (r.isProductionAssessment) {
      assessedProduction += 1
      if (d.cause_coverage === 'specific') specific += 1
      else if (d.cause_coverage === 'partial') partial += 1
      else unknown += 1
    }
  }
  return {
    assessed_production_count: assessedProduction,
    specific_cause_count: specific,
    partial_cause_count: partial,
    unknown_cause_count: unknown,
    cause_coverage_rate: assessedProduction ? Math.round((specific / assessedProduction) * 1e4) / 1e4 : 0,
    cause_distribution: distribution,
  }
}
