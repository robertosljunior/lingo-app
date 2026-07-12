// content-pack-validator.js — validates declarative content packs before they
// are installed into IndexedDB. Unknown *fields* only warn; missing required
// fields, unknown pattern/constraint/strategy/skill IDs, level violations and
// broken cross-references invalidate the pack.

import { getPattern, isKnownConstraint, isKnownStrategy, skillAllowedAtLevel, patternAllowedAtLevel } from './content-rule-registry.js'
import { getSkill } from './skill-registry.js'
import { EXERCISE_TYPES } from './lesson-parser.js'

export const CONTENT_SCHEMA_VERSION = '1'
const LEVELS = ['A1', 'A2', 'B1', 'B2']
const THEMES = ['core', 'daily_life', 'workplace', 'travel', 'food_and_restaurants', 'shopping_and_services', 'technology_and_communication']
const MANIFEST_KNOWN = new Set(['schema_version', 'pack_id', 'title', 'theme', 'level', 'language_pair', 'version', 'source', 'enabled_by_default', 'dependencies', 'generator_compatibility'])

// Data may never smuggle executable code: reject function-typed values and
// source strings that look like code (defense in depth; JSON.parse can't
// produce functions, but packs can also arrive as objects).
function findExecutable(value, path = '') {
  if (typeof value === 'function') return path || '(root)'
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findExecutable(value[i], `${path}[${i}]`)
      if (hit) return hit
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const hit = findExecutable(v, path ? `${path}.${k}` : k)
      if (hit) return hit
    }
  }
  return null
}

export function validateContentPack(pack, { knownPacks = [] } = {}) {
  const errors = []
  const warnings = []
  const err = (code, detail) => errors.push({ code, detail })
  const warn = (code, detail) => warnings.push({ code, detail })

  if (!pack || typeof pack !== 'object') {
    return { valid: false, errors: [{ code: 'PACK_NOT_OBJECT' }], warnings, counts: { lexical_items: 0, template_definitions: 0, collocations: 0 } }
  }

  const exec = findExecutable(pack)
  if (exec) err('EXECUTABLE_CONTENT', exec)

  // ---- manifest ----
  const m = pack.manifest || {}
  if (!pack.manifest) err('MANIFEST_MISSING')
  if (m.schema_version !== CONTENT_SCHEMA_VERSION) err('SCHEMA_VERSION_UNSUPPORTED', m.schema_version)
  if (!m.pack_id || !/^[a-z][a-z0-9_]*$/.test(m.pack_id || '')) err('PACK_ID_INVALID', m.pack_id)
  if (!m.title?.pt || !m.title?.en) err('TITLE_MISSING', m.pack_id)
  if (!THEMES.includes(m.theme)) err('THEME_UNKNOWN', m.theme)
  if (!LEVELS.includes(m.level)) err('LEVEL_UNKNOWN', m.level)
  if (m.language_pair !== 'pt-BR/en') err('LANGUAGE_PAIR_UNSUPPORTED', m.language_pair)
  if (!Number.isInteger(m.version) || m.version < 1) err('VERSION_INVALID', m.version)
  if (!Array.isArray(m.dependencies)) err('DEPENDENCIES_MISSING', m.pack_id)
  const gc = m.generator_compatibility || {}
  if (!gc.min_version || !gc.max_version) err('GENERATOR_COMPATIBILITY_MISSING', m.pack_id)
  for (const k of Object.keys(m)) if (!MANIFEST_KNOWN.has(k)) warn('MANIFEST_UNKNOWN_FIELD', k)
  for (const dep of m.dependencies || []) {
    if (knownPacks.length && !knownPacks.includes(dep)) err('DEPENDENCY_UNKNOWN', dep)
  }

  const lexical = Array.isArray(pack.lexical_items) ? pack.lexical_items : []
  const templates = Array.isArray(pack.template_definitions) ? pack.template_definitions : []
  const collocations = Array.isArray(pack.collocations) ? pack.collocations : []
  if (!Array.isArray(pack.lexical_items)) err('LEXICAL_ITEMS_MISSING')
  if (!Array.isArray(pack.template_definitions)) err('TEMPLATE_DEFINITIONS_MISSING')
  if (!Array.isArray(pack.collocations)) err('COLLOCATIONS_MISSING')

  // ---- lexical items ----
  const itemIds = new Set()
  const semanticTypes = new Set()
  for (const it of lexical) {
    const where = it.item_id || '(missing id)'
    if (!it.item_id) err('ITEM_ID_MISSING', JSON.stringify(it.en || ''))
    else if (itemIds.has(it.item_id)) err('ITEM_ID_DUPLICATE', it.item_id)
    itemIds.add(it.item_id)
    if (!it.en || !it.pt) err('ITEM_TRANSLATION_MISSING', where)
    if (!it.semantic_type) err('ITEM_SEMANTIC_TYPE_MISSING', where)
    else semanticTypes.add(it.semantic_type)
    if (it.level && it.level !== m.level) err('ITEM_LEVEL_MISMATCH', where)
    for (const c of it.constraints || []) if (!isKnownConstraint(c)) err('ITEM_CONSTRAINT_UNKNOWN', `${where}:${c}`)
  }

  // ---- templates ----
  const templateIds = new Set()
  for (const t of templates) {
    const where = t.template_id || '(missing id)'
    if (!t.template_id) err('TEMPLATE_ID_MISSING')
    else if (templateIds.has(t.template_id)) err('TEMPLATE_ID_DUPLICATE', t.template_id)
    templateIds.add(t.template_id)
    if (!t.family_id) err('TEMPLATE_FAMILY_MISSING', where)
    const pattern = getPattern(t.pattern_id)
    if (!pattern) err('TEMPLATE_PATTERN_UNKNOWN', `${where}:${t.pattern_id}`)
    else if (!patternAllowedAtLevel(t.pattern_id, m.level)) err('TEMPLATE_PATTERN_LEVEL_VIOLATION', `${where}:${t.pattern_id}@${m.level}`)
    if (!t.primary_skill_id) err('TEMPLATE_PRIMARY_SKILL_MISSING', where)
    for (const s of [t.primary_skill_id, ...(t.skill_ids || [])].filter(Boolean)) {
      if (!getSkill(s)) err('TEMPLATE_SKILL_UNKNOWN', `${where}:${s}`)
      if (!skillAllowedAtLevel(s, m.level)) err('TEMPLATE_SKILL_LEVEL_VIOLATION', `${where}:${s}@${m.level}`)
    }
    if (!Array.isArray(t.exercise_types) || !t.exercise_types.length) err('TEMPLATE_EXERCISE_TYPES_MISSING', where)
    for (const et of t.exercise_types || []) if (!EXERCISE_TYPES.includes(et)) err('TEMPLATE_EXERCISE_TYPE_UNKNOWN', `${where}:${et}`)
    for (const c of t.constraints || []) if (!isKnownConstraint(c)) err('TEMPLATE_CONSTRAINT_UNKNOWN', `${where}:${c}`)
    for (const s of t.distractor_strategy_ids || []) if (!isKnownStrategy(s)) err('TEMPLATE_STRATEGY_UNKNOWN', `${where}:${s}`)
    // Slots must be resolvable: pattern slots covered, lexical slots must have
    // compatible items in this pack (dependencies carry the shared types).
    const slots = t.slots || {}
    for (const required of pattern?.required_slots || []) {
      if (!slots[required]) err('TEMPLATE_SLOT_MISSING', `${where}:${required}`)
    }
    for (const [name, slot] of Object.entries(slots)) {
      if (slot?.source === 'lexical_items' && slot.semantic_type) {
        const local = semanticTypes.has(slot.semantic_type)
        // Types conventionally provided by the core dependency.
        const fromCore = ['person_subject', 'wh_word', 'modal', 'duration', 'time_expression', 'action_verb', 'theme_object', 'connector'].includes(slot.semantic_type)
        if (!local && !(m.dependencies?.length && fromCore)) err('TEMPLATE_SLOT_UNRESOLVABLE', `${where}:${name}:${slot.semantic_type}`)
      }
    }
    if (!Array.isArray(t.variants) || !t.variants.length) err('TEMPLATE_VARIANTS_MISSING', where)
    for (const v of t.variants || []) {
      if (!v.en || !v.pt) err('TEMPLATE_VARIANT_TRANSLATION_MISSING', where)
      if (!v.blank || !String(v.en).includes(v.blank)) err('TEMPLATE_VARIANT_BLANK_INVALID', where)
      if (!v.wrong) err('TEMPLATE_VARIANT_WRONG_MISSING', where)
    }
  }

  // ---- collocations ----
  const colIds = new Set()
  const canonicals = new Set()
  for (const c of collocations) {
    const where = c.collocation_id || '(missing id)'
    if (!c.collocation_id) err('COLLOCATION_ID_MISSING')
    else if (colIds.has(c.collocation_id)) err('COLLOCATION_ID_DUPLICATE', c.collocation_id)
    colIds.add(c.collocation_id)
    if (!c.canonical || !c.pt) err('COLLOCATION_TRANSLATION_MISSING', where)
    if (canonicals.has(c.canonical)) err('COLLOCATION_CANONICAL_DUPLICATE', c.canonical)
    canonicals.add(c.canonical)
    if (!Array.isArray(c.invalid_variants) || !c.invalid_variants.length) err('COLLOCATION_VARIANTS_MISSING', where)
    for (const v of c.invalid_variants || []) if (!v.text || !v.error_id) err('COLLOCATION_VARIANT_INVALID', where)
    if (!Array.isArray(c.examples) || !c.examples.length) err('COLLOCATION_EXAMPLES_MISSING', where)
    for (const ex of c.examples || []) if (!ex.en || !ex.pt) err('COLLOCATION_EXAMPLE_INVALID', where)
  }

  // Cross-store ID collisions inside the pack.
  for (const id of templateIds) if (itemIds.has(id) || colIds.has(id)) err('CROSS_STORE_ID_COLLISION', id)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      lexical_items: lexical.length,
      template_definitions: templates.length,
      collocations: collocations.length,
    },
  }
}

// Stable FNV-1a checksum over the canonical JSON of the pack content.
export function contentPackChecksum(pack) {
  const canonical = JSON.stringify({
    manifest: pack.manifest,
    lexical_items: pack.lexical_items,
    template_definitions: pack.template_definitions,
    collocations: pack.collocations,
  })
  let h = 2166136261
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
