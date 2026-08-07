// production-assessment-service.js — Slice V2.14. The SINGLE shared adapter
// between the V2 runtime and the language-analysis PUBLIC API. Every V2 surface
// (Playground session/sandbox/target, Lab focused, Study Session) MUST use this
// factory instead of an inline wrapper that silently drops fields.

import { requestToAnalyzeParamsV2 } from './semantic-assessment-bridge.js'
import { assessGuidedTaskRelevanceV2 } from './task-relevance-gate.js'

function unconfirmedTaskResult(relevance) {
  return {
    analysis_version: '1',
    assessment_mode: 'free',
    grammar: {},
    structure: {},
    semantics: {},
    detected_errors: [],
    detected_intents: [],
    matched_concepts: [],
    corrected_version: null,
    natural_alternatives: [],
    verdict: 'unable_to_assess',
    confidence: relevance.confidence,
    evidence: [{ type: 'guided_task_relevance', status: relevance.status, shared_concepts: [] }],
    engines: null,
    fallback_events: [],
    knowledge_pack_versions: {},
    task_relevance: relevance,
  }
}

/**
 * Build the assessmentServices object consumed by the pilot / study
 * controllers and the Playground. `analyzeProduction` is injected for tests;
 * in the app it is lazily imported so the language-analysis bundle stays out of
 * the main chunk.
 *
 * #72: guided written production gets a conservative topical preflight before a
 * positive semantic result can award mastery. It does not claim an answer is
 * wrong: when the authored reference and learner response share no confirmable
 * topical concept, the result is `unable_to_assess`. Free production remains
 * open-ended, and speech keeps its separate ASR/polarity gates.
 */
export function createProductionAssessmentServicesV2({ analyzeProduction = null } = {}) {
  const run = analyzeProduction
    ? (params) => analyzeProduction(params)
    : async (params) => (await import('../language-analysis/index.js')).analyzeProduction(params)
  return {
    analyzeSemantics: async (request) => {
      const shouldCheckRelevance = request?.provenance?.recipe === 'guided_production'
        && request?.response_type === 'text'
        && typeof request?.reference_text === 'string'
        && request.reference_text.trim()

      let relevance = null
      if (shouldCheckRelevance) {
        relevance = assessGuidedTaskRelevanceV2({
          referenceText: request.reference_text,
          responseText: request.text,
        })
        if (relevance.status === 'unconfirmed') return unconfirmedTaskResult(relevance)
      }

      const result = await run(requestToAnalyzeParamsV2(request))
      return relevance ? { ...result, task_relevance: relevance } : result
    },
  }
}

/** Convenience for direct callers/tests: run one bridge request through the API. */
export async function analyzeActivitySemanticsV2(request, { analyzeProduction = null } = {}) {
  const services = createProductionAssessmentServicesV2({ analyzeProduction })
  return services.analyzeSemantics(request)
}
