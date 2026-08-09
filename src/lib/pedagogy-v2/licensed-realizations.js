import {
  LICENSED_REALIZATION_GENERATOR_VERSION,
  LICENSED_REALIZATION_PROVENANCE_KIND,
  LICENSED_TIER1_ELIGIBLE_RECIPES,
  canonicalSlotSignature,
  maxExposureStage,
  stableSignatureHash,
} from './licensed-realization-contracts.js'
import {
  STILL_LEXICAL_PILOT,
  STILL_PILOT_ALLOWLIST,
  UNLESS_CLAUSE_PILOT,
  UNLESS_PILOT_ALLOWLIST,
} from '../../content/pedagogy-v2/licensed/pilot-catalog.js'

function fillTemplate(template, surfaces) {
  return String(template).replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    if (!(key in surfaces)) throw new Error(`LICENSED_TEMPLATE_SLOT_MISSING:${key}`)
    return surfaces[key]
  })
}

function dedupePrerequisites(rows) {
  const seen = new Set()
  const out = []
  for (const row of rows || []) {
    const key = `${row?.type || ''}|${row?.ref || ''}|${row?.compat_bridge === true ? 'bridge' : ''}`
    if (!row?.type || !row?.ref || seen.has(key)) continue
    seen.add(key)
    out.push({ ...row })
  }
  return out
}

function copyTargets(rows) {
  return (rows || []).map((row) => ({ ...row }))
}

function approvalAllowed(entry, { allowProvisional = false } = {}) {
  if (entry?.approval?.status === 'human_approved') return true
  return allowProvisional && entry?.approval?.status === 'provisional_nonhuman'
}

function parentOf(pack, id) {
  const parent = (pack?.exemplars || []).find((e) => e.exemplar_id === id)
  if (!parent) throw new Error(`LICENSED_PARENT_NOT_FOUND:${id}`)
  return parent
}

function licensedId(packId, signature) {
  const slug = String(packId || 'pack').replace(/^pedagogy_v2_/, '').replace(/[^a-z0-9_]+/gi, '_')
  return `exemplar:licensed.${slug}.${stableSignatureHash(signature)}`
}

function buildRealization({
  pack,
  parent,
  strategy,
  frameId = null,
  slots,
  textEn,
  textPt,
  contextItems,
  sourceStages,
  prerequisites,
  approval,
}) {
  const slotSignature = canonicalSlotSignature({
    parent_exemplar_id: parent.exemplar_id,
    strategy,
    frame_id: frameId,
    slots,
  })
  const exemplarId = licensedId(pack.manifest.pack_id, slotSignature)
  const exposureStage = maxExposureStage(sourceStages)
  return {
    realization_id: exemplarId,
    exemplar_id: exemplarId,
    text_en: textEn,
    text_pt: textPt,
    context_items: [...new Set(contextItems || [])],
    construction_id: parent.construction_id,
    sense_ids: [...(parent.sense_ids || [])],
    communicative_function_ids: [...(parent.communicative_function_ids || [])],
    pedagogical_targets: copyTargets(parent.pedagogical_targets),
    exposure_stage: exposureStage,
    prerequisites: dedupePrerequisites(prerequisites),
    intended_new_items: [],
    naturalness_status: approval?.status === 'human_approved' ? 'curated' : 'needs_review',
    slot_signature: slotSignature,
    eligible_recipes: [...LICENSED_TIER1_ELIGIBLE_RECIPES],
    provenance: {
      kind: LICENSED_REALIZATION_PROVENANCE_KIND,
      parent_exemplar_id: parent.exemplar_id,
      filler_ids: Object.values(slots).sort(),
      generator_version: LICENSED_REALIZATION_GENERATOR_VERSION,
      approved_by: approval?.approved_by || null,
      approved_at: approval?.approved_at || null,
      approval_status: approval?.status || 'missing',
      source_stages: [...sourceStages],
      ...(frameId ? { frame_id: frameId } : {}),
    },
    ...(parent.semantic_assessment ? { semantic_assessment: structuredClone(parent.semantic_assessment) } : {}),
  }
}

function mapById(rows) {
  return new Map((rows || []).map((row) => [row.filler_id, row]))
}

function materializeStill(pack, options) {
  const parent = parentOf(pack, STILL_LEXICAL_PILOT.parent_exemplar_id)
  const subjects = mapById(STILL_LEXICAL_PILOT.subjects)
  const predicates = mapById(STILL_LEXICAL_PILOT.predicates)
  const out = []
  for (const entry of STILL_PILOT_ALLOWLIST) {
    if (!approvalAllowed(entry, options)) continue
    const subject = subjects.get(entry.slots.subject)
    const predicate = predicates.get(entry.slots.predicate)
    if (!subject || !predicate) throw new Error(`LICENSED_FILLER_NOT_FOUND:${entry.pilot_id}`)
    out.push(buildRealization({
      pack,
      parent,
      strategy: STILL_LEXICAL_PILOT.strategy,
      slots: entry.slots,
      textEn: fillTemplate(STILL_LEXICAL_PILOT.template.en, { subject: subject.en, predicate: predicate.en }),
      textPt: fillTemplate(STILL_LEXICAL_PILOT.template.pt, { subject: subject.pt, predicate: predicate.pt }),
      contextItems: [...subject.context_items, ...predicate.context_items],
      sourceStages: [STILL_LEXICAL_PILOT.construction_stage, subject.introduced_stage, predicate.introduced_stage],
      prerequisites: [...(parent.prerequisites || []), ...subject.prerequisites, ...predicate.prerequisites],
      approval: entry.approval,
    }))
  }
  return out
}

function frameIndex() {
  return new Map(UNLESS_CLAUSE_PILOT.frames.map((frame) => [frame.frame_id, frame]))
}

function materializeUnless(pack, options) {
  const frames = frameIndex()
  const out = []
  for (const entry of UNLESS_PILOT_ALLOWLIST) {
    if (!approvalAllowed(entry, options)) continue
    const frame = frames.get(entry.frame_id)
    if (!frame) throw new Error(`LICENSED_FRAME_NOT_FOUND:${entry.frame_id}`)
    const parent = parentOf(pack, frame.parent_exemplar_id)
    const condition = mapById(frame.conditions).get(entry.slots.condition)
    const result = mapById(frame.results).get(entry.slots.result)
    if (!condition || !result) throw new Error(`LICENSED_FILLER_NOT_FOUND:${entry.pilot_id}`)
    out.push(buildRealization({
      pack,
      parent,
      strategy: UNLESS_CLAUSE_PILOT.strategy,
      frameId: frame.frame_id,
      slots: entry.slots,
      textEn: fillTemplate(UNLESS_CLAUSE_PILOT.template.en, { condition: condition.en, result: result.en }),
      textPt: fillTemplate(UNLESS_CLAUSE_PILOT.template.pt, { condition: condition.pt, result: result.pt }),
      contextItems: [...condition.context_items, ...result.context_items],
      sourceStages: [UNLESS_CLAUSE_PILOT.construction_stage, frame.introduced_stage, condition.introduced_stage, result.introduced_stage],
      prerequisites: [
        ...(parent.prerequisites || []),
        ...(frame.prerequisites || []),
        ...condition.prerequisites,
        ...result.prerequisites,
      ],
      approval: entry.approval,
    }))
  }
  return out
}

function assertNoTextDuplicates(pack, realizations) {
  const seen = new Map()
  for (const exemplar of pack?.exemplars || []) {
    seen.set(String(exemplar.text_en || '').trim().toLowerCase(), exemplar.exemplar_id)
  }
  for (const exemplar of realizations) {
    const key = String(exemplar.text_en || '').trim().toLowerCase()
    const duplicate = seen.get(key)
    if (duplicate) throw new Error(`LICENSED_DUPLICATE_TEXT:${exemplar.exemplar_id}:${duplicate}`)
    seen.set(key, exemplar.exemplar_id)
  }
}

export function materializeLicensedRealizationsForPack(pack, options = {}) {
  const packId = pack?.manifest?.pack_id
  let rows = []
  if (packId === STILL_LEXICAL_PILOT.pack_id) rows = materializeStill(pack, options)
  else if (packId === UNLESS_CLAUSE_PILOT.pack_id) rows = materializeUnless(pack, options)
  assertNoTextDuplicates(pack, rows)
  return rows
}

export function materializePackWithLicensedRealizations(pack, options = {}) {
  const derived = materializeLicensedRealizationsForPack(pack, options)
  return { ...pack, exemplars: [...(pack?.exemplars || []), ...derived] }
}

export function enumerateLicensedPilotCandidates(pack) {
  const packId = pack?.manifest?.pack_id
  if (packId === STILL_LEXICAL_PILOT.pack_id) {
    const parent = parentOf(pack, STILL_LEXICAL_PILOT.parent_exemplar_id)
    const rows = []
    for (const subject of STILL_LEXICAL_PILOT.subjects) {
      for (const predicate of STILL_LEXICAL_PILOT.predicates) {
        const slots = { subject: subject.filler_id, predicate: predicate.filler_id }
        const sig = canonicalSlotSignature({ parent_exemplar_id: parent.exemplar_id, strategy: STILL_LEXICAL_PILOT.strategy, slots })
        rows.push({
          candidate_id: licensedId(packId, sig),
          slot_signature: sig,
          text_en: fillTemplate(STILL_LEXICAL_PILOT.template.en, { subject: subject.en, predicate: predicate.en }),
          text_pt: fillTemplate(STILL_LEXICAL_PILOT.template.pt, { subject: subject.pt, predicate: predicate.pt }),
        })
      }
    }
    return rows
  }
  if (packId === UNLESS_CLAUSE_PILOT.pack_id) {
    const rows = []
    for (const frame of UNLESS_CLAUSE_PILOT.frames) {
      const parent = parentOf(pack, frame.parent_exemplar_id)
      for (const condition of frame.conditions) {
        for (const result of frame.results) {
          const slots = { condition: condition.filler_id, result: result.filler_id }
          const sig = canonicalSlotSignature({ parent_exemplar_id: parent.exemplar_id, strategy: UNLESS_CLAUSE_PILOT.strategy, frame_id: frame.frame_id, slots })
          rows.push({
            candidate_id: licensedId(packId, sig),
            frame_id: frame.frame_id,
            slot_signature: sig,
            text_en: fillTemplate(UNLESS_CLAUSE_PILOT.template.en, { condition: condition.en, result: result.en }),
            text_pt: fillTemplate(UNLESS_CLAUSE_PILOT.template.pt, { condition: condition.pt, result: result.pt }),
          })
        }
      }
    }
    return rows
  }
  return []
}
