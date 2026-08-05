// RX-1B — combine complete durable V2 records with the pre-RX-1A evidence
// backfill. Durable interaction_ids always win, preventing duplicate activity.

import {
  buildV2HistoryFromEvidence,
  buildV2InteractionSummaries,
  buildV2ReviewPointsFromEvidence,
} from './learner-activity-history.js'

const ASSESSED = new Set(['correct', 'partial', 'incorrect'])

function exemplarIndex(registry) {
  const out = new Map()
  for (const pack of registry?.packs || []) {
    for (const ex of pack.exemplars || []) out.set(ex.exemplar_id, ex)
  }
  return out
}

function responseSummary(record) {
  const response = record?.response
  const payload = response?.payload || {}
  if (!response) return null
  if (response.response_type === 'text') return payload.text?.trim() ? { kind: 'text', text: payload.text.trim() } : null
  if (response.response_type === 'token_sequence') {
    const tokens = Array.isArray(payload.tokens) ? payload.tokens.map(String) : []
    return tokens.length ? { kind: 'token_sequence', text: tokens.join(' '), tokens } : null
  }
  if (['speech_transcript', 'pronunciation_attempt'].includes(response.response_type)) {
    return payload.transcript?.trim() ? { kind: 'speech', text: payload.transcript.trim() } : null
  }
  if (response.response_type === 'single_choice') {
    const option = (record.plan?.options || []).find((row) => row.option_id === payload.option_id)
    return { kind: 'choice', text: option?.text_pt || option?.text_en || null, option_id: payload.option_id || null }
  }
  return null
}

function diagnosisSummary(assessment) {
  const d = assessment?.diagnosis
  const cause = d?.primary_cause
  if (!d) return null
  return {
    category: cause?.category || null,
    code: cause?.code || null,
    title: cause?.explanation?.title || null,
    summary: cause?.explanation?.summary || null,
    cause_coverage: d.cause_coverage || null,
  }
}

function durableInteraction(record, exIndex) {
  const plan = record.plan || {}
  const authored = exIndex.get(plan.exemplar_id) || {}
  return {
    interaction_id: record.interaction_id,
    session_id: record.lesson_session_id || plan.lesson_session_id || null,
    study_session_id: record.study_session_id || null,
    occurred_at: record.occurred_at || record.response?.submitted_at || null,
    exemplar: {
      exemplar_id: plan.exemplar_id || authored.exemplar_id || null,
      text_en: plan.text_en || authored.text_en || '',
      text_pt: plan.text_pt || authored.text_pt || '',
    },
    outcome: ASSESSED.has(record.assessment?.outcome) ? record.assessment.outcome : 'not_assessed',
    has_direct_assessment: record.assessment?.status === 'assessed' && ASSESSED.has(record.assessment?.outcome),
    activity_kind: plan.activity_kind || null,
    recipe: plan.recipe || null,
    capability: plan.capability || null,
    modality: plan.modality || null,
    response: responseSummary(record),
    diagnosis: diagnosisSummary(record.assessment),
    collection_id: record.collection_id || null,
    collection_title_pt: record.collection_title_pt || null,
    source: 'durable_journal',
    limited: false,
  }
}

function counts(rows) {
  const out = { correct: 0, partial: 0, incorrect: 0, observed: 0, not_assessed: 0 }
  for (const row of rows) out[row.outcome] = (out[row.outcome] || 0) + 1
  return out
}

export function buildCombinedV2History({ sessions = [], interactions = [], evidence = [] } = {}, registry = null) {
  const exIndex = exemplarIndex(registry)
  const durable = interactions.filter((row) => row?.interaction_id).map((row) => durableInteraction(row, exIndex))
  const durableIds = new Set(durable.map((row) => row.interaction_id))
  const sessionRows = new Map(sessions.filter((row) => row?.study_session_id).map((row) => [row.study_session_id, row]))
  const grouped = new Map()

  for (const row of durable) {
    const key = row.study_session_id || `durable:${row.interaction_id}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  }

  const current = [...grouped.entries()].map(([id, rows]) => {
    const ordered = [...rows].sort((a, b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')))
    const persisted = sessionRows.get(id) || {}
    return {
      session_id: id,
      study_session_id: id,
      started_at: persisted.started_at || ordered[0]?.occurred_at || null,
      ended_at: persisted.ended_at || ordered.at(-1)?.occurred_at || null,
      last_activity_at: persisted.last_activity_at || ordered.at(-1)?.occurred_at || null,
      interaction_count: ordered.length,
      exemplar_count: new Set(ordered.map((row) => row.exemplar.exemplar_id).filter(Boolean)).size,
      activity_kinds: [...new Set(ordered.map((row) => row.activity_kind).filter(Boolean))].sort(),
      modalities: [...new Set(ordered.map((row) => row.modality).filter(Boolean))].sort(),
      outcomes: counts(ordered),
      interactions: ordered,
      mode: persisted.mode || null,
      status: persisted.status || null,
      collection_id: persisted.collection_id || ordered.find((row) => row.collection_id)?.collection_id || null,
      collection_title_pt: persisted.collection_title_pt || ordered.find((row) => row.collection_title_pt)?.collection_title_pt || null,
      source: 'durable_journal',
      limited: false,
    }
  })

  const legacy = buildV2HistoryFromEvidence(
    evidence.filter((event) => !durableIds.has(event?.interaction_id)),
    registry,
  )
  return [...current, ...legacy].sort((a, b) =>
    String(b.last_activity_at || b.ended_at || '').localeCompare(String(a.last_activity_at || a.ended_at || '')))
}

function groupReview(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = row.exemplar.exemplar_id || row.interaction_id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.values()].map((items) => {
    const ordered = [...items].sort((a, b) => String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')))
    const latest = ordered[0]
    const sources = new Set(ordered.map((row) => row.source))
    return {
      exemplar: latest.exemplar,
      latest_at: latest.occurred_at,
      latest_outcome: latest.outcome,
      occurrence_count: ordered.length,
      activity_kinds: [...new Set(ordered.map((row) => row.activity_kind).filter(Boolean))].sort(),
      modalities: [...new Set(ordered.map((row) => row.modality).filter(Boolean))].sort(),
      response: latest.response || null,
      diagnosis: latest.diagnosis || null,
      collection_id: latest.collection_id || null,
      collection_title_pt: latest.collection_title_pt || null,
      source: sources.size > 1 ? 'mixed' : latest.source,
      limited: latest.limited,
    }
  }).sort((a, b) => String(b.latest_at || '').localeCompare(String(a.latest_at || '')))
}

export function buildCombinedV2ReviewPoints({ interactions = [], evidence = [] } = {}, registry = null) {
  const exIndex = exemplarIndex(registry)
  const durable = interactions.filter((row) => row?.interaction_id).map((row) => durableInteraction(row, exIndex))
  const durableIds = new Set(durable.map((row) => row.interaction_id))
  const failures = durable.filter((row) => row.has_direct_assessment && ['partial', 'incorrect'].includes(row.outcome))
  const legacy = buildV2InteractionSummaries(
    evidence.filter((event) => !durableIds.has(event?.interaction_id)),
    registry,
  ).filter((row) => row.has_direct_assessment && ['partial', 'incorrect'].includes(row.outcome))

  // Keep the old exported builder exercised and compatible; combined output is
  // grouped here because durable rows carry response and diagnosis fields.
  if (!durable.length) return buildV2ReviewPointsFromEvidence(evidence, registry)
  return groupReview([...failures, ...legacy])
}
