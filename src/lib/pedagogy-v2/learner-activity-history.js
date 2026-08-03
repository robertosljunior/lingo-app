// learner-activity-history.js — recovery presentation over the immutable V2
// evidence log. This adapter deliberately exposes only facts that old evidence
// can prove. It does not reconstruct missing learner text, assessment diagnosis,
// selected collection, or feedback copy.

const ASSESSED_OUTCOMES = new Set(['correct', 'partial', 'incorrect'])
const OUTCOME_PRIORITY = Object.freeze({
  incorrect: 5,
  partial: 4,
  correct: 3,
  observed: 2,
  not_assessed: 1,
})

function registryExemplarIndex(registry) {
  const out = new Map()
  for (const pack of registry?.packs || []) {
    for (const exemplar of pack.exemplars || []) {
      out.set(exemplar.exemplar_id, {
        exemplar_id: exemplar.exemplar_id,
        text_en: exemplar.text_en || '',
        text_pt: exemplar.text_pt || '',
      })
    }
  }
  return out
}

function strongestOutcome(events) {
  return events.reduce((best, event) => {
    const outcome = event?.outcome || 'not_assessed'
    return (OUTCOME_PRIORITY[outcome] || 0) > (OUTCOME_PRIORITY[best] || 0) ? outcome : best
  }, 'not_assessed')
}

function directAssessedOutcome(events) {
  const direct = events.filter((event) => event?.attribution === 'direct' && ASSESSED_OUTCOMES.has(event?.outcome))
  return direct.length ? strongestOutcome(direct) : null
}

function summarizeInteraction(interactionId, events, exemplarIndex) {
  const ordered = [...events].sort((a, b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')))
  const first = ordered[0] || {}
  const exemplar = exemplarIndex.get(first.exemplar_id) || {
    exemplar_id: first.exemplar_id || null,
    text_en: '',
    text_pt: '',
  }
  const directOutcome = directAssessedOutcome(ordered)
  const overallOutcome = directOutcome || strongestOutcome(ordered)
  return {
    interaction_id: interactionId,
    session_id: first.session_id || null,
    occurred_at: ordered.at(-1)?.occurred_at || first.occurred_at || null,
    exemplar,
    outcome: overallOutcome,
    has_direct_assessment: !!directOutcome,
    activity_kind: first.activity?.activity_kind || null,
    capability: first.activity?.capability || null,
    modality: first.activity?.modality || null,
    evidence_count: ordered.length,
    target_count: new Set(ordered.map((event) => `${event.target?.target_type}:${event.target?.target_id}`)).size,
  }
}

export function buildV2InteractionSummaries(events = [], registry = null) {
  const exemplarIndex = registryExemplarIndex(registry)
  const byInteraction = new Map()
  for (const event of events || []) {
    if (!event?.interaction_id) continue
    if (!byInteraction.has(event.interaction_id)) byInteraction.set(event.interaction_id, [])
    byInteraction.get(event.interaction_id).push(event)
  }
  return [...byInteraction.entries()]
    .map(([interactionId, rows]) => summarizeInteraction(interactionId, rows, exemplarIndex))
    .sort((a, b) => String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')))
}

export function buildV2HistoryFromEvidence(events = [], registry = null) {
  const interactions = buildV2InteractionSummaries(events, registry)
  const bySession = new Map()
  for (const interaction of interactions) {
    const sessionId = interaction.session_id || `unscoped:${interaction.interaction_id}`
    if (!bySession.has(sessionId)) bySession.set(sessionId, [])
    bySession.get(sessionId).push(interaction)
  }

  return [...bySession.entries()].map(([sessionId, rows]) => {
    const ordered = [...rows].sort((a, b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')))
    const outcomes = { correct: 0, partial: 0, incorrect: 0, observed: 0, not_assessed: 0 }
    for (const row of ordered) outcomes[row.outcome] = (outcomes[row.outcome] || 0) + 1
    return {
      session_id: sessionId,
      started_at: ordered[0]?.occurred_at || null,
      ended_at: ordered.at(-1)?.occurred_at || null,
      interaction_count: ordered.length,
      exemplar_count: new Set(ordered.map((row) => row.exemplar.exemplar_id).filter(Boolean)).size,
      activity_kinds: [...new Set(ordered.map((row) => row.activity_kind).filter(Boolean))].sort(),
      modalities: [...new Set(ordered.map((row) => row.modality).filter(Boolean))].sort(),
      outcomes,
      interactions: ordered,
      source: 'evidence_backfill',
      limited: true,
    }
  }).sort((a, b) => String(b.ended_at || '').localeCompare(String(a.ended_at || '')))
}

export function buildV2ReviewPointsFromEvidence(events = [], registry = null) {
  const interactions = buildV2InteractionSummaries(events, registry)
    .filter((row) => row.has_direct_assessment && ['incorrect', 'partial'].includes(row.outcome))

  const byExemplar = new Map()
  for (const interaction of interactions) {
    const key = interaction.exemplar.exemplar_id || interaction.interaction_id
    if (!byExemplar.has(key)) byExemplar.set(key, [])
    byExemplar.get(key).push(interaction)
  }

  return [...byExemplar.values()].map((rows) => {
    const ordered = [...rows].sort((a, b) => String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')))
    const latest = ordered[0]
    return {
      exemplar: latest.exemplar,
      latest_at: latest.occurred_at,
      latest_outcome: latest.outcome,
      occurrence_count: ordered.length,
      activity_kinds: [...new Set(ordered.map((row) => row.activity_kind).filter(Boolean))].sort(),
      modalities: [...new Set(ordered.map((row) => row.modality).filter(Boolean))].sort(),
      source: 'evidence_backfill',
      limited: true,
    }
  }).sort((a, b) => String(b.latest_at || '').localeCompare(String(a.latest_at || '')))
}
