import { EXPOSURE_STAGES, stageIndex } from './contracts.js'

export const LICENSED_REALIZATION_GENERATOR_VERSION = 'v2.24-pilot-1'
export const LICENSED_REALIZATION_PROVENANCE_KIND = 'licensed_variant'

// Tier 1 deliberately has no authored context. These are the only recipes whose
// presentation can be built honestly from the licensed sentence itself.
export const LICENSED_TIER1_ELIGIBLE_RECIPES = Object.freeze([
  'meaning_recognition',
  'listening_recognition',
  'word_order_reconstruction',
  'pronunciation',
])

export const LICENSED_CONTEXT_REQUIRED_RECIPES = Object.freeze([
  'exposure',
  'context_recognition',
  'fixed_element_completion',
  'guided_production',
  'free_production',
])

export function isLicensedRealization(exemplar) {
  return exemplar?.provenance?.kind === LICENSED_REALIZATION_PROVENANCE_KIND
}

export function deriveLicensedEligibleRecipes(exemplar) {
  if (!isLicensedRealization(exemplar)) return null
  if (String(exemplar.context || '').trim()) return [] // Tier 2 is intentionally not licensed in V2.24.
  return [...LICENSED_TIER1_ELIGIBLE_RECIPES]
}

export function maxExposureStage(stages) {
  let best = null
  let bestIndex = -1
  for (const stage of stages || []) {
    const idx = stageIndex(stage)
    if (idx < 0) throw new Error(`LICENSED_STAGE_INVALID:${stage}`)
    if (idx > bestIndex) { bestIndex = idx; best = stage }
  }
  return best || EXPOSURE_STAGES[0]
}

// Stable, synchronous content hash for runtime materialization. Two independent
// 32-bit FNV-1a passes make generator ordering irrelevant while keeping the
// engine synchronous/offline. The canonical slot signature is the hashed input.
function fnv32(text, seed) {
  let h = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function stableSignatureHash(signature) {
  const text = typeof signature === 'string' ? signature : JSON.stringify(signature)
  const a = fnv32(text, 2166136261).toString(16).padStart(8, '0')
  const b = fnv32(`licensed|${text}`, 2246822507).toString(16).padStart(8, '0')
  return `${a}${b}`
}

export function canonicalSlotSignature({ parent_exemplar_id, strategy, slots, frame_id = null }) {
  const normalizedSlots = Object.entries(slots || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot_id, filler_id]) => ({ slot_id, filler_id }))
  return {
    parent_exemplar_id,
    strategy,
    ...(frame_id ? { frame_id } : {}),
    slots: normalizedSlots,
  }
}
