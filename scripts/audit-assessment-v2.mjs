// audit-assessment-v2.mjs — Slice V2.13 cause-coverage audit. Runs a fixed set
// of CONTROLLED assessment cases (classes A/B/C/D + coarse) through the real
// evaluateActivityResponseV2 + typed AssessmentDiagnosisV2, and reports the
// cause-coverage distribution. It uses CANNED semantic-engine results injected
// as the analyzeSemantics service — this exercises the diagnosis ADAPTER
// deterministically without loading the USE model, and never fabricates a cause
// inside the adapter (the canned result stands in for the engine's own output).
//
// Warnings are advisory only — this audit NEVER fails CI (Slice V2.13 §21).

import { evaluateActivityResponseV2 } from '../src/lib/pedagogy-v2/activity-assessment.js'
import { buildAssessmentCauseCoverageV2, buildAssessmentStrategyCoverageV2 } from '../src/lib/pedagogy-v2/assessment-diagnosis.js'

// ---- controlled plan + responses -------------------------------------------

const plan = (o = {}) => ({
  plan_version: 1,
  recipe: 'guided_production',
  activity_kind: 'guided_production',
  capability: 'controlled_production',
  modality: 'writing',
  activity_id: 'audit:activity',
  session_id: 'audit',
  exemplar_id: 'audit:ex',
  construction_id: 'construction:price_high',
  sense_ids: [],
  primary_target: { target_type: 'construction', target_id: 'construction:price_high' },
  secondary_targets: [],
  text_en: 'This price is very high.',
  text_pt: 'Este preço está muito alto.',
  context: 'Falando sobre o preço de um produto.',
  planned_evidence: [{ target: { target_type: 'construction', target_id: 'construction:price_high' }, attribution: 'direct', activity: { activity_kind: 'guided_production', capability: 'controlled_production', modality: 'writing' } }],
  ...o,
})

const textResponse = (text) => ({
  response_version: 1, response_type: 'text', activity_id: 'audit:activity',
  interaction_id: 'audit:i', submitted_at: '2026-07-21T00:00:00.000Z',
  payload: { text }, support_usage: { features: [], hint_count: 0, attempt_number: 1 },
})

// Canned semantic results per class — representative of what the engine CAN
// emit (see test-evidence/v2-13-assessment-cause-coverage.md audit table).
const R = {
  grammar: { verdict: 'needs_revision', confidence: 0.85, detected_errors: [{ error_id: 'agr.1', category: 'verb_form', subtype: 'subject_verb_agreement', severity: 'high', confidence: 0.9, source: 'grammar', explanation_pt: { title: 'Concordância', summary: 'O verbo deve concordar com o sujeito: use "is".' } }], natural_alternatives: [] },
  naturalness: { verdict: 'valid_with_suggestions', confidence: 0.7, detected_errors: [{ error_id: 'nat.1', category: 'naturalness', subtype: 'context_preference', severity: 'low', confidence: 0.6, source: 'pack', explanation_pt: { title: 'Forma mais natural', summary: '"high" soa mais natural que "expensive" para preço.' } }], natural_alternatives: [{ text: 'The price is very high.', tone: 'natural' }] },
  valid_diff: { verdict: 'valid', confidence: 0.75, detected_errors: [], natural_alternatives: [] },
  semantic_with_evidence: { verdict: 'needs_revision', confidence: 0.8, detected_errors: [{ error_id: 'meaning_mismatch', category: 'meaning', subtype: 'equivalent_meaning', severity: 'high', confidence: 0.8, source: 'semantic_equivalence', explanation_pt: { title: 'Significado diferente', summary: 'A frase tem outro sentido em relação ao pedido.' } }], natural_alternatives: [] },
  coarse: { verdict: 'needs_revision', confidence: 0.6, detected_errors: [], natural_alternatives: [] },
}

// Slice V2.14: an authored equivalent_meaning target activates the bridge; the
// canned result stands in for the engine's equivalent-mode output.
const EQ = { strategy: 'equivalent_meaning', essential_words: ['price'] }
const cases = [
  { id: 'A/grammar (free)', text: 'This price are very high.', result: R.grammar },
  { id: 'B/naturalness (free)', text: 'The price is very expensive.', result: R.naturalness },
  { id: 'B2/valid-different (free)', text: 'Its price is very expensive.', result: R.valid_diff },
  { id: 'C/target-form (free)', text: 'The price is too high.', result: R.valid_diff, plan: plan({ construction_fixed_elements: ['very', 'high'] }) },
  { id: 'D/semantic (equivalent)', text: 'I like bananas.', result: R.semantic_with_evidence, plan: plan({ semantic_assessment: EQ, semantic_assessment_source: 'exemplar:audit:ex' }) },
  { id: 'D2/semantic-coarse (equivalent)', text: 'I like bananas.', result: R.coarse, plan: plan({ semantic_assessment: EQ, semantic_assessment_source: 'exemplar:audit:ex' }) },
]

const pad = (s, n) => String(s).padEnd(n)

async function main() {
  const records = []
  console.log('\nSlice V2.13 — Assessment cause-coverage audit (controlled fixtures)\n')
  console.log(pad('case', 30), pad('outcome', 10), pad('strategy', 18), pad('primary cause', 18), pad('code', 30), 'coverage')
  console.log('-'.repeat(130))
  for (const c of cases) {
    const p = c.plan || plan()
    const services = { analyzeSemantics: async () => c.result }
    const assessment = await evaluateActivityResponseV2({ activityPlan: p, response: textResponse(c.text), assessmentServices: services })
    const d = assessment.diagnosis
    records.push({ isProductionAssessment: true, diagnosis: d, id: c.id })
    console.log(
      pad(c.id, 30), pad(assessment.outcome, 10),
      pad(d.semantic_bridge?.strategy ?? '—', 18),
      pad(d.primary_cause?.category ?? '—', 18),
      pad(d.primary_cause?.code ?? '—', 30),
      d.cause_coverage,
    )
  }

  const cov = buildAssessmentCauseCoverageV2(records)
  console.log('\nCoverage metrics:')
  console.log(JSON.stringify(cov, null, 2))

  const strategyCov = buildAssessmentStrategyCoverageV2(records)
  console.log('\nStrategy coverage (§23 — free and equivalent are NOT compared as equals):')
  console.log(JSON.stringify(strategyCov, null, 2))

  // Advisory warnings only (never fail CI).
  const warnings = []
  for (const r of records) {
    const d = r.diagnosis
    // A semantic (production) assessed partial/incorrect with no typed cause.
    if (d.applicability === 'assessed' && d.cause_coverage === 'none' && d.primary_cause?.category === 'unknown') {
      warnings.push(`SEMANTIC_OUTCOME_WITHOUT_TYPED_CAUSE: ${r.id}`)
    }
  }
  const unknownRate = cov.assessed_production_count ? cov.unknown_cause_count / cov.assessed_production_count : 0
  if (unknownRate > 0.5) warnings.push(`HIGH_UNKNOWN_CAUSE_RATE: ${(unknownRate * 100).toFixed(0)}% of assessed production has no typed cause`)

  console.log('\nWarnings (advisory — do not fail CI):')
  if (!warnings.length) console.log('  none')
  else for (const w of warnings) console.log('  ⚠ ' + w)
  console.log('\nNote: cases whose cause remains `unknown` are EXPECTED and correct when the')
  console.log('semantic engine provides no structured cause (§28/§29). See')
  console.log('test-evidence/v2-13-assessment-cause-coverage.md.\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
