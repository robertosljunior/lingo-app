import { stageIndex } from './contracts.js'
import {
  canonicalSlotSignature,
  deriveLicensedEligibleRecipes,
  isLicensedRealization,
  stableSignatureHash,
} from './licensed-realization-contracts.js'

function normalizedText(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function containsWord(text, word) {
  const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escape(word)}\\b`, 'i').test(String(text || ''))
}

function expectedId(packId, slotSignature) {
  const slug = String(packId || 'pack').replace(/^pedagogy_v2_/, '').replace(/[^a-z0-9_]+/gi, '_')
  return `exemplar:licensed.${slug}.${stableSignatureHash(slotSignature)}`
}

function sameStringArray(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || [])
}

export function validateLicensedRealizationsV2(pack, realizations) {
  const errors = []
  const err = (code, id, detail = '') => errors.push(`${code}:${id}${detail ? `:${detail}` : ''}`)
  const parentIds = new Set((pack?.exemplars || []).map((e) => e.exemplar_id))
  const seenIds = new Set(parentIds)
  const seenText = new Map((pack?.exemplars || []).map((e) => [normalizedText(e.text_en), e.exemplar_id]))

  for (const e of realizations || []) {
    const id = e?.exemplar_id || 'missing'
    if (!isLicensedRealization(e)) { err('LICENSED_PROVENANCE_KIND_REQUIRED', id); continue }
    if (e.realization_id !== e.exemplar_id) err('LICENSED_REALIZATION_ID_MISMATCH', id)
    if (seenIds.has(id)) err('LICENSED_DUPLICATE_ID', id)
    seenIds.add(id)

    const parentId = e.provenance?.parent_exemplar_id
    if (!parentIds.has(parentId)) err('LICENSED_PARENT_NOT_IN_PACK', id, String(parentId))
    if (e.slot_signature?.parent_exemplar_id !== parentId) err('LICENSED_SIGNATURE_PARENT_MISMATCH', id)

    const canonical = canonicalSlotSignature({
      parent_exemplar_id: e.slot_signature?.parent_exemplar_id,
      strategy: e.slot_signature?.strategy,
      frame_id: e.slot_signature?.frame_id || null,
      slots: Object.fromEntries((e.slot_signature?.slots || []).map((row) => [row.slot_id, row.filler_id])),
    })
    if (JSON.stringify(canonical) !== JSON.stringify(e.slot_signature)) err('LICENSED_SLOT_SIGNATURE_NOT_CANONICAL', id)
    if (expectedId(pack?.manifest?.pack_id, canonical) !== id) err('LICENSED_ID_NOT_CONTENT_STABLE', id)

    if ((e.intended_new_items || []).length !== 0) err('LICENSED_NEW_ITEMS_FORBIDDEN', id)
    if (e.introduction_group_id != null) err('LICENSED_INTRODUCTION_GROUP_FORBIDDEN', id)
    if (String(e.context || '').trim()) err('LICENSED_TIER1_CONTEXT_FORBIDDEN', id)

    const derivedRecipes = deriveLicensedEligibleRecipes(e)
    if (!sameStringArray(e.eligible_recipes, derivedRecipes)) err('LICENSED_ELIGIBLE_RECIPES_MISMATCH', id)

    const sourceStages = e.provenance?.source_stages || []
    const ownStage = stageIndex(e.exposure_stage)
    if (ownStage < 0 || !sourceStages.length) err('LICENSED_SOURCE_STAGES_REQUIRED', id)
    for (const stage of sourceStages) {
      const sourceIndex = stageIndex(stage)
      if (sourceIndex < 0) err('LICENSED_SOURCE_STAGE_INVALID', id, stage)
      else if (ownStage < sourceIndex) err('LICENSED_STAGE_BELOW_SOURCE', id, `${e.exposure_stage}<${stage}`)
    }

    for (const p of e.prerequisites || []) {
      if (p.type === 'grammar_skill_v1' && p.compat_bridge !== true) {
        err('PREREQ_V1_BRIDGE_FLAG_REQUIRED', id, p.ref)
      }
    }

    for (const item of e.context_items || []) {
      if (!containsWord(e.text_en, item)) err('LICENSED_CONTEXT_ITEM_MISSING_FROM_TEXT', id, item)
    }

    const textKey = normalizedText(e.text_en)
    const duplicate = seenText.get(textKey)
    if (duplicate) err('LICENSED_DUPLICATE_TEXT', id, duplicate)
    seenText.set(textKey, id)

    if (e.provenance?.approval_status === 'human_approved') {
      if (!e.provenance.approved_by) err('LICENSED_APPROVER_REQUIRED', id)
      if (!e.provenance.approved_at) err('LICENSED_APPROVAL_TIME_REQUIRED', id)
      if (e.naturalness_status !== 'curated') err('LICENSED_HUMAN_APPROVED_NOT_CURATED', id)
    }
  }

  return { valid: errors.length === 0, errors, count: (realizations || []).length }
}
