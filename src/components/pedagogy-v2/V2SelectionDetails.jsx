// V2SelectionDetails.jsx — collapsible internal diagnostics panel ("Por que
// esta atividade foi escolhida?"). Rendered ONLY in dev builds or behind the
// caller-provided diagnostics flag; collapsed by default. Learner-facing
// screens never show these internals otherwise.

export default function V2SelectionDetails({ plan, assessment = null, events = null, visible = false }) {
  if (!visible || !plan) return null
  const trace = plan.selection_trace || {}
  return (
    <details data-testid="v2-selection-details" style={{ fontSize: 12, border: '1px dashed var(--border)', borderRadius: 10, padding: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Por que esta atividade foi escolhida?</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontFamily: 'var(--font-mono, monospace)' }}>
        <div>primary target: {plan.primary_target.target_type} {plan.primary_target.target_id}</div>
        <div>senses: {plan.sense_ids.join(', ')} · construction: {plan.construction_id}</div>
        <div>capability/modality: {plan.capability} / {plan.modality} · support tier: {plan.support.derived_tier}</div>
        <div>reasons: {(trace.reasons || []).join(' · ') || '—'}</div>
        <div>budget: {JSON.stringify(trace.budget)}</div>
        <div>prerequisites: {JSON.stringify(trace.prerequisite_assessments)}</div>
        <div>excluded: {JSON.stringify(trace.excluded)}</div>
        <div>score breakdown: {JSON.stringify(trace.score_breakdown)}</div>
        <div>planned evidence: {JSON.stringify(plan.planned_evidence)}</div>
        {assessment && <div>assessment: {JSON.stringify({ status: assessment.status, outcome: assessment.outcome, confidence: assessment.assessment_confidence })}</div>}
        {events && <div>events: {JSON.stringify(events.map((e) => ({ id: e.evidence_id, outcome: e.outcome, attribution: e.attribution })))}</div>}
      </div>
    </details>
  )
}
