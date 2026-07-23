// production-assessment-service.js — Slice V2.14. The SINGLE shared adapter
// between the V2 runtime and the language-analysis PUBLIC API. Every V2 surface
// (Playground session/sandbox/target, Lab focused, Study Session) MUST use this
// factory instead of an inline `async ({ text, assessmentMode }) => ...` wrapper
// that silently drops fields.
//
// It receives a complete SemanticAssessmentRequestV2 and forwards ONLY the
// fields the engine actually consumes (text, assessmentMode, requestedIntent,
// equivalentTarget) to `analyzeProduction`. It never imports engine internals
// (Harper / USE / worker / orchestrator) — only `language-analysis/index.js`.
//
// Privacy (§32): the request text is passed to the analyzer in memory; nothing
// here persists the response, transcript or raw semantic payload.

import { requestToAnalyzeParamsV2 } from './semantic-assessment-bridge.js'

/**
 * Build the assessmentServices object consumed by the pilot / study
 * controllers and the Playground. `analyzeProduction` is injected for tests;
 * in the app it is lazily imported so the language-analysis bundle stays out of
 * the main chunk.
 *
 *   createProductionAssessmentServicesV2({ analyzeProduction? })
 *     → { analyzeSemantics(request) → rawSemanticResult }
 *
 * The `analyzeSemantics(request)` signature takes the FULL bridge request; the
 * activity-assessment layer builds that request via the bridge. All fields are
 * forwarded without loss.
 */
export function createProductionAssessmentServicesV2({ analyzeProduction = null } = {}) {
  const run = analyzeProduction
    ? (params) => analyzeProduction(params)
    : async (params) => (await import('../language-analysis/index.js')).analyzeProduction(params)
  return {
    analyzeSemantics: async (request) => run(requestToAnalyzeParamsV2(request)),
  }
}

/** Convenience for direct callers/tests: run one bridge request through the API. */
export async function analyzeActivitySemanticsV2(request, { analyzeProduction = null } = {}) {
  const services = createProductionAssessmentServicesV2({ analyzeProduction })
  return services.analyzeSemantics(request)
}
