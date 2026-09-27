import {
  COMBINATORIAL_FRAMES_V3,
  COMBINATORIAL_V3_EXPECTED_FRAME_COUNT,
  COMBINATORIAL_V3_MINIMUM_REALIZATIONS,
} from '../../content/pedagogy-v3/combinatorial-catalog.js'

export const COMBINATORIAL_SUPPLY_GENERATOR_VERSION = 'v3.0-combinatorial-1'

function fnv32(text, seed) {
  let h = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function stableCombinatorialHash(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const a = fnv32(text, 2166136261).toString(16).padStart(8, '0')
  const b = fnv32(`v3|${text}`, 2246822507).toString(16).padStart(8, '0')
  return `${a}${b}`
}

function fill(template, surfaces) {
  return String(template).replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    if (!(key in surfaces)) throw new Error(`V3_COMBINATORIAL_SLOT_MISSING:${key}`)
    return surfaces[key]
  })
}

function normalizeText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ')
}

function canonicalText(text) {
  return normalizeText(text).toLocaleLowerCase('en-US')
}

function validateFrame(frame) {
  if (!frame?.focus_id) throw new Error('V3_COMBINATORIAL_FOCUS_REQUIRED')
  if (!frame?.stage) throw new Error(`V3_COMBINATORIAL_STAGE_REQUIRED:${frame?.focus_id || 'unknown'}`)
  if (!frame?.category) throw new Error(`V3_COMBINATORIAL_CATEGORY_REQUIRED:${frame.focus_id}`)
  for (const slotName of ['a', 'b']) {
    const values = frame?.slots?.[slotName]
    if (!Array.isArray(values) || values.length < 8) {
      throw new Error(`V3_COMBINATORIAL_SLOT_DEPTH_TOO_LOW:${frame.focus_id}:${slotName}`)
    }
    const ids = new Set()
    for (const row of values) {
      if (!row?.id || !row?.en || !row?.pt) throw new Error(`V3_COMBINATORIAL_SLOT_INVALID:${frame.focus_id}:${slotName}`)
      if (ids.has(row.id)) throw new Error(`V3_COMBINATORIAL_SLOT_ID_DUPLICATE:${frame.focus_id}:${slotName}:${row.id}`)
      ids.add(row.id)
    }
  }
}

function materializeFrame(frame) {
  validateFrame(frame)
  const out = []
  for (const a of frame.slots.a) {
    for (const b of frame.slots.b) {
      const signature = {
        focus_id: frame.focus_id,
        slots: { a: a.id, b: b.id },
        generator_version: COMBINATORIAL_SUPPLY_GENERATOR_VERSION,
      }
      const hash = stableCombinatorialHash(signature)
      const textEn = normalizeText(fill(frame.template_en, { a: a.en, b: b.en }))
      const textPt = normalizeText(fill(frame.template_pt, { a: a.pt, b: b.pt }))
      out.push({
        realization_id: `realization:v3.${hash}`,
        focus_id: frame.focus_id,
        stage: frame.stage,
        category: frame.category,
        text_en: textEn,
        text_pt: textPt,
        slot_signature: signature,
        source: 'combinatorial_v3',
        naturalness_status: 'provisional_curated_slots',
        approval_status: 'provisional_nonhuman',
        generator_version: COMBINATORIAL_SUPPLY_GENERATOR_VERSION,
      })
    }
  }
  return out
}

export function materializeCombinatorialCorpusV3() {
  if (COMBINATORIAL_FRAMES_V3.length !== COMBINATORIAL_V3_EXPECTED_FRAME_COUNT) {
    throw new Error(`V3_COMBINATORIAL_FRAME_COUNT_DRIFT:${COMBINATORIAL_FRAMES_V3.length}!=${COMBINATORIAL_V3_EXPECTED_FRAME_COUNT}`)
  }

  const rows = COMBINATORIAL_FRAMES_V3.flatMap(materializeFrame)
  const ids = new Set()
  const texts = new Map()

  for (const row of rows) {
    if (ids.has(row.realization_id)) throw new Error(`V3_COMBINATORIAL_ID_DUPLICATE:${row.realization_id}`)
    ids.add(row.realization_id)

    const key = canonicalText(row.text_en)
    const existing = texts.get(key)
    if (existing) throw new Error(`V3_COMBINATORIAL_TEXT_DUPLICATE:${row.realization_id}:${existing}`)
    texts.set(key, row.realization_id)
  }

  if (rows.length < COMBINATORIAL_V3_MINIMUM_REALIZATIONS) {
    throw new Error(`V3_COMBINATORIAL_SUPPLY_BELOW_FLOOR:${rows.length}<${COMBINATORIAL_V3_MINIMUM_REALIZATIONS}`)
  }

  return rows
}

export function auditCombinatorialCorpusV3(rows = materializeCombinatorialCorpusV3()) {
  const byFocus = new Map()
  const byStage = {}
  const byCategory = {}

  for (const row of rows) {
    byFocus.set(row.focus_id, (byFocus.get(row.focus_id) || 0) + 1)
    byStage[row.stage] = (byStage[row.stage] || 0) + 1
    byCategory[row.category] = (byCategory[row.category] || 0) + 1
  }

  const focusCounts = [...byFocus.values()]
  return {
    generator_version: COMBINATORIAL_SUPPLY_GENERATOR_VERSION,
    total_realizations: rows.length,
    distinct_english_texts: new Set(rows.map((row) => canonicalText(row.text_en))).size,
    distinct_focuses: byFocus.size,
    min_realizations_per_focus: Math.min(...focusCounts),
    max_realizations_per_focus: Math.max(...focusCounts),
    by_stage: Object.fromEntries(Object.entries(byStage).sort()),
    by_category: Object.fromEntries(Object.entries(byCategory).sort()),
    focus_counts: Object.fromEntries([...byFocus.entries()].sort(([a], [b]) => a.localeCompare(b))),
  }
}

function rankForSeed(seed, id) {
  return stableCombinatorialHash(`${seed}|${id}`)
}

/**
 * Strict no-repeat selector for the V3 supply experiment.
 *
 * A focus returns every unseen realization before any repeat is possible.
 * Once the focus is exhausted it returns focus_exhausted; it never silently
 * re-admits seen content. The future session planner can then switch focus or
 * explicitly enter a spaced-retrieval mode.
 */
export function selectUnseenRealizationV3({
  rows,
  focusId,
  seenRealizationIds = [],
  seed = '',
} = {}) {
  const seen = seenRealizationIds instanceof Set
    ? seenRealizationIds
    : new Set(seenRealizationIds || [])
  const pool = (rows || []).filter((row) => row.focus_id === focusId)
  if (!pool.length) return { status: 'focus_not_found', realization: null, remaining_unseen: 0 }

  const unseen = pool.filter((row) => !seen.has(row.realization_id))
  if (!unseen.length) {
    return {
      status: 'focus_exhausted',
      realization: null,
      remaining_unseen: 0,
      total_in_focus: pool.length,
    }
  }

  unseen.sort((x, y) => {
    const hx = rankForSeed(seed, x.realization_id)
    const hy = rankForSeed(seed, y.realization_id)
    return hx < hy ? -1 : hx > hy ? 1 : x.realization_id.localeCompare(y.realization_id)
  })

  return {
    status: 'realization',
    realization: unseen[0],
    remaining_unseen: unseen.length - 1,
    total_in_focus: pool.length,
  }
}
