// validator.js — structural validation for pedagogical_v2 content packs.
//
// Scope: consistency of the pack as data (IDs, references, prefixes, required
// pedagogical declarations, full-sentence exemplars, fixed elements present).
// Deliberately NOT in scope: linguistic naturalness — that is authoring +
// content-test responsibility and cannot be decided by regex.
//
// Error format follows the repo convention (knowledge-pack-validator.js):
// `CODE:logical-location` strings, aggregated per pack.

import {
  PEDAGOGY_V2_SCHEMA_VERSION, PEDAGOGY_V2_PACK_KIND,
  TARGET_TYPES, TARGET_ROLES, TARGET_TYPE_PREFIX,
  PREREQUISITE_TYPES, NEW_ITEM_TYPES, NATURALNESS_STATUSES,
  ID_PREFIXES, FORBIDDEN_LEXEME_LEVEL_KEYS,
  hasV2Prefix, isV2Id, isExposureStage,
} from './contracts.js'

const SECTIONS = ['lexemes', 'senses', 'constructions', 'communicative_functions', 'exemplars']

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Case-insensitive whole-word presence of `word` in `text`.
function containsWord(text, word) {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(String(text || ''))
}

// A stored exemplar must be a complete sentence, never an isolated word or an
// unauthorized fragment: at least 3 word tokens, sentence-initial capital,
// sentence-final punctuation.
export function isCompleteSentence(text) {
  const s = String(text || '').trim()
  if (!/^[A-Z]/.test(s)) return false
  if (!/[.?!]$/.test(s)) return false
  const words = s.match(/[A-Za-z']+/g) || []
  return words.length >= 3
}

export function validatePedagogyV2Pack(pack, opts = {}) {
  const errors = []
  const globalIds = opts.globalIds || new Set()
  const localIds = new Set()
  const err = (code, where) => errors.push(where ? `${code}:${where}` : code)

  if (!pack || typeof pack !== 'object') {
    return { valid: false, pack_id: null, errors: ['PACK_REQUIRED'], counts: {} }
  }

  // ---- manifest (invariant 1) ----
  const m = pack.manifest
  if (!m) {
    err('MANIFEST_REQUIRED')
  } else {
    if (m.pack_kind !== PEDAGOGY_V2_PACK_KIND) err('PACK_KIND_INVALID', `manifest.pack_kind=${m.pack_kind ?? 'missing'}`)
    if (m.schema_version !== PEDAGOGY_V2_SCHEMA_VERSION) err('SCHEMA_VERSION_INVALID', `manifest.schema_version=${m.schema_version ?? 'missing'}`)
    if (!m.pack_id) err('PACK_ID_REQUIRED', 'manifest')
    if (!(m.version >= 1)) err('VERSION_INVALID', 'manifest')
  }

  for (const section of SECTIONS) {
    if (pack[section] != null && !Array.isArray(pack[section])) err('SECTION_NOT_ARRAY', section)
  }
  const lexemes = Array.isArray(pack.lexemes) ? pack.lexemes : []
  const senses = Array.isArray(pack.senses) ? pack.senses : []
  const constructions = Array.isArray(pack.constructions) ? pack.constructions : []
  const functions = Array.isArray(pack.communicative_functions) ? pack.communicative_functions : []
  const exemplars = Array.isArray(pack.exemplars) ? pack.exemplars : []

  // ---- IDs: presence, typed prefix (invariant 20), duplicates (invariant 3) ----
  const addId = (kind, id, where) => {
    if (!id) { err('ID_REQUIRED', where); return }
    if (!isV2Id(kind, id)) err('ID_PREFIX_INVALID', `${where}=${id} (expected prefix "${ID_PREFIXES[kind]}")`)
    if (localIds.has(id)) err('DUPLICATE_ID', id)
    localIds.add(id)
    if (opts.globalIds) {
      if (globalIds.has(id)) err('GLOBAL_DUPLICATE_ID', id)
      else globalIds.add(id)
    }
  }
  lexemes.forEach((l, i) => addId('lexeme', l.lexeme_id, `lexemes[${i}].lexeme_id`))
  senses.forEach((s, i) => addId('sense', s.sense_id, `senses[${i}].sense_id`))
  constructions.forEach((c, i) => addId('construction', c.construction_id, `constructions[${i}].construction_id`))
  functions.forEach((f, i) => addId('communicative_function', f.function_id, `communicative_functions[${i}].function_id`))
  exemplars.forEach((e, i) => addId('exemplar', e.exemplar_id, `exemplars[${i}].exemplar_id`))

  const lexemeById = new Map(lexemes.map((l) => [l.lexeme_id, l]))
  const senseById = new Map(senses.map((s) => [s.sense_id, s]))
  const constructionById = new Map(constructions.map((c) => [c.construction_id, c]))
  const functionIds = new Set(functions.map((f) => f.function_id))

  // ---- lexemes (invariant 2: no global level, ever) ----
  lexemes.forEach((l) => {
    const where = l.lexeme_id || 'lexemes[?]'
    if (!l.lemma) err('LEXEME_LEMMA_REQUIRED', where)
    if (!l.language) err('LEXEME_LANGUAGE_REQUIRED', where)
    if (!Array.isArray(l.part_of_speech) || !l.part_of_speech.length) err('LEXEME_POS_REQUIRED', where)
    if (!Array.isArray(l.glosses_pt) || !l.glosses_pt.length) err('LEXEME_GLOSSES_REQUIRED', where)
    for (const key of FORBIDDEN_LEXEME_LEVEL_KEYS) {
      if (key in l) err('LEXEME_GLOBAL_LEVEL_FORBIDDEN', `${where}.${key}`)
    }
  })

  // ---- senses (references + stage, invariants 4/16) ----
  senses.forEach((s) => {
    const where = s.sense_id || 'senses[?]'
    if (!s.lexeme_id || !lexemeById.has(s.lexeme_id)) err('SENSE_LEXEME_UNRESOLVED', `${where}→${s.lexeme_id}`)
    if (!s.label) err('SENSE_LABEL_REQUIRED', where)
    if (!s.meaning_pt) err('SENSE_MEANING_PT_REQUIRED', where)
    if (!isExposureStage(s.first_exposure_stage)) err('STAGE_INVALID', `${where}.first_exposure_stage=${s.first_exposure_stage}`)
    ;(s.communicative_function_ids || []).forEach((fid) => {
      if (!functionIds.has(fid)) err('SENSE_FUNCTION_UNRESOLVED', `${where}→${fid}`)
    })
    ;(s.related_sense_ids || []).forEach((rid) => {
      if (!senseById.has(rid)) err('SENSE_RELATED_UNRESOLVED', `${where}→${rid}`)
    })
  })

  // ---- communicative functions ----
  functions.forEach((f) => {
    const where = f.function_id || 'communicative_functions[?]'
    if (!f.label_pt) err('FUNCTION_LABEL_PT_REQUIRED', where)
    if (!f.description_pt) err('FUNCTION_DESCRIPTION_PT_REQUIRED', where)
  })

  // ---- constructions (invariants 5/6/13/15/16) ----
  constructions.forEach((c) => {
    const where = c.construction_id || 'constructions[?]'
    if (!c.label) err('CONSTRUCTION_LABEL_REQUIRED', where)
    if (!c.pattern) err('CONSTRUCTION_PATTERN_REQUIRED', where)
    if (!Array.isArray(c.fixed_elements)) err('CONSTRUCTION_FIXED_ELEMENTS_REQUIRED', where)
    if (!Array.isArray(c.sense_ids) || !c.sense_ids.length) err('CONSTRUCTION_WITHOUT_SENSE', where)
    if (!Array.isArray(c.communicative_function_ids) || !c.communicative_function_ids.length) err('CONSTRUCTION_WITHOUT_FUNCTION', where)
    ;(c.sense_ids || []).forEach((sid) => { if (!senseById.has(sid)) err('CONSTRUCTION_SENSE_UNRESOLVED', `${where}→${sid}`) })
    ;(c.communicative_function_ids || []).forEach((fid) => { if (!functionIds.has(fid)) err('CONSTRUCTION_FUNCTION_UNRESOLVED', `${where}→${fid}`) })
    ;(c.prerequisite_construction_ids || []).forEach((pid) => {
      if (!constructionById.has(pid)) err('CONSTRUCTION_PREREQ_UNRESOLVED', `${where}→${pid}`)
    })
    if (!isExposureStage(c.recommended_stage)) err('STAGE_INVALID', `${where}.recommended_stage=${c.recommended_stage}`)
    ;(c.slots || []).forEach((slot, i) => {
      if (!slot.slot_id) err('SLOT_ID_REQUIRED', `${where}.slots[${i}]`)
      if (!slot.syntactic_role) err('SLOT_SYNTACTIC_ROLE_REQUIRED', `${where}.slots[${i}]`)
    })
  })

  // Cycle detection over construction prerequisites (invariant 15).
  const visiting = new Set()
  const done = new Set()
  const walk = (id, trail) => {
    if (done.has(id)) return
    if (visiting.has(id)) { err('CONSTRUCTION_PREREQ_CYCLE', [...trail, id].join('→')); return }
    visiting.add(id)
    for (const pid of constructionById.get(id)?.prerequisite_construction_ids || []) {
      if (constructionById.has(pid)) walk(pid, [...trail, id])
    }
    visiting.delete(id)
    done.add(id)
  }
  for (const id of constructionById.keys()) walk(id, [])

  // ---- shared reference validators ----
  const validateTarget = (t, where) => {
    if (!t || typeof t !== 'object') { err('TARGET_INVALID', where); return }
    if (!TARGET_TYPES.includes(t.target_type)) { err('TARGET_TYPE_INVALID', `${where}.target_type=${t.target_type}`); return }
    if (!TARGET_ROLES.includes(t.role)) err('TARGET_ROLE_INVALID', `${where}.role=${t.role}`)
    const prefix = TARGET_TYPE_PREFIX[t.target_type]
    if (typeof t.target_id !== 'string' || !t.target_id.startsWith(prefix)) {
      err('TARGET_ID_PREFIX_MISMATCH', `${where}=${t.target_id} (expected prefix "${prefix}")`)
      return
    }
    const resolved = t.target_type === 'sense' ? senseById.has(t.target_id)
      : t.target_type === 'construction' ? constructionById.has(t.target_id)
      : t.target_type === 'communicative_function' ? functionIds.has(t.target_id)
      : lexemeById.has(t.target_id)
    if (!resolved) err('TARGET_UNRESOLVED', `${where}→${t.target_id}`)
  }

  // Prerequisites: V2 references resolve in-pack; grammar_skill_v1 is an opt-in
  // compatibility bridge and must be flagged, with a plain (non-prefixed) V1 id
  // (invariant 20 — no silent mixing in either direction).
  const validatePrerequisite = (p, where) => {
    if (!p || typeof p !== 'object') { err('PREREQ_INVALID', where); return }
    if (!PREREQUISITE_TYPES.includes(p.type)) { err('PREREQ_TYPE_INVALID', `${where}.type=${p.type}`); return }
    if (p.type === 'grammar_skill_v1') {
      if (p.compat_bridge !== true) err('PREREQ_V1_BRIDGE_FLAG_REQUIRED', `${where}=${p.ref}`)
      if (typeof p.ref !== 'string' || !p.ref || hasV2Prefix(p.ref) || p.ref.includes(':')) {
        err('PREREQ_V1_REF_INVALID', `${where}=${p.ref}`)
      }
      return
    }
    if (!isV2Id(p.type === 'communicative_function' ? 'communicative_function' : p.type, p.ref)) {
      err('PREREQ_V2_REF_PREFIX_INVALID', `${where}=${p.ref}`)
      return
    }
    const resolved = p.type === 'lexeme' ? lexemeById.has(p.ref)
      : p.type === 'sense' ? senseById.has(p.ref)
      : p.type === 'construction' ? constructionById.has(p.ref)
      : functionIds.has(p.ref)
    if (!resolved) err('PREREQ_UNRESOLVED', `${where}→${p.ref}`)
  }

  const validateNewItem = (n, where) => {
    if (!n || typeof n !== 'object') { err('NEW_ITEM_INVALID', where); return }
    if (!NEW_ITEM_TYPES.includes(n.type)) { err('NEW_ITEM_TYPE_INVALID', `${where}.type=${n.type}`); return }
    if (!isV2Id(n.type === 'communicative_function' ? 'communicative_function' : n.type, n.ref)) {
      err('NEW_ITEM_REF_PREFIX_INVALID', `${where}=${n.ref}`)
      return
    }
    const resolved = n.type === 'lexeme' ? lexemeById.has(n.ref)
      : n.type === 'sense' ? senseById.has(n.ref)
      : n.type === 'construction' ? constructionById.has(n.ref)
      : functionIds.has(n.ref)
    if (!resolved) err('NEW_ITEM_UNRESOLVED', `${where}→${n.ref}`)
  }

  // ---- exemplars (invariants 4–12, 14, 16–19) ----
  exemplars.forEach((e) => {
    const where = e.exemplar_id || 'exemplars[?]'

    if (!e.text_en) err('EXEMPLAR_TEXT_EN_REQUIRED', where)
    else if (!isCompleteSentence(e.text_en)) err('EXEMPLAR_NOT_FULL_SENTENCE', `${where}="${e.text_en}"`)
    if (!e.text_pt || !String(e.text_pt).trim()) err('EXEMPLAR_TEXT_PT_REQUIRED', where)

    // Construction (required, resolved, fixed elements present in the text).
    if (!e.construction_id) err('EXEMPLAR_CONSTRUCTION_REQUIRED', where)
    else if (!constructionById.has(e.construction_id)) err('EXEMPLAR_CONSTRUCTION_UNRESOLVED', `${where}→${e.construction_id}`)
    else {
      for (const fixed of constructionById.get(e.construction_id).fixed_elements || []) {
        if (!containsWord(e.text_en, fixed)) err('EXEMPLAR_FIXED_ELEMENT_MISSING', `${where} missing "${fixed}"`)
      }
    }

    // Senses / functions must resolve; the declared lexeme use must actually
    // appear in the sentence (invariant 17).
    if (!Array.isArray(e.sense_ids) || !e.sense_ids.length) err('EXEMPLAR_SENSE_REQUIRED', where)
    ;(e.sense_ids || []).forEach((sid) => {
      if (!senseById.has(sid)) { err('EXEMPLAR_SENSE_UNRESOLVED', `${where}→${sid}`); return }
      const lex = lexemeById.get(senseById.get(sid).lexeme_id)
      if (lex?.lemma && e.text_en && !containsWord(e.text_en, lex.lemma)) {
        err('EXEMPLAR_LEXEME_MISSING_FROM_TEXT', `${where} declares ${sid} but "${lex.lemma}" is not in text_en`)
      }
    })
    ;(e.communicative_function_ids || []).forEach((fid) => {
      if (!functionIds.has(fid)) err('EXEMPLAR_FUNCTION_UNRESOLVED', `${where}→${fid}`)
    })

    // Pedagogical declarations: targets (with a primary), prerequisites and
    // intended new items must be explicitly declared (empty array = explicit
    // "none"; a missing field is an authoring omission and is rejected).
    if (!Array.isArray(e.pedagogical_targets) || !e.pedagogical_targets.length) err('EXEMPLAR_TARGETS_REQUIRED', where)
    else {
      e.pedagogical_targets.forEach((t, i) => validateTarget(t, `${where}.pedagogical_targets[${i}]`))
      if (!e.pedagogical_targets.some((t) => t.role === 'primary')) err('EXEMPLAR_PRIMARY_TARGET_REQUIRED', where)
    }
    if (!Array.isArray(e.prerequisites)) err('EXEMPLAR_PREREQUISITES_REQUIRED', where)
    else e.prerequisites.forEach((p, i) => validatePrerequisite(p, `${where}.prerequisites[${i}]`))
    if (!Array.isArray(e.intended_new_items)) err('EXEMPLAR_NEW_ITEMS_REQUIRED', where)
    else e.intended_new_items.forEach((n, i) => validateNewItem(n, `${where}.intended_new_items[${i}]`))

    if (!e.context || !String(e.context).trim()) err('EXEMPLAR_CONTEXT_REQUIRED', where)
    if (!NATURALNESS_STATUSES.includes(e.naturalness_status)) err('NATURALNESS_STATUS_INVALID', `${where}=${e.naturalness_status}`)
    if (!isExposureStage(e.exposure_stage)) err('STAGE_INVALID', `${where}.exposure_stage=${e.exposure_stage}`)

    // Declared context vocabulary must actually occur in the sentence.
    ;(e.context_items || []).forEach((w) => {
      if (!containsWord(e.text_en, w)) err('CONTEXT_ITEM_MISSING_FROM_TEXT', `${where}="${w}"`)
    })
  })

  return {
    valid: errors.length === 0,
    pack_id: m?.pack_id || null,
    errors,
    counts: {
      lexemes: lexemes.length,
      senses: senses.length,
      constructions: constructions.length,
      communicative_functions: functions.length,
      exemplars: exemplars.length,
    },
  }
}

export function validatePedagogyV2Packs(packs) {
  const globalIds = new Set()
  const rows = packs.map((p) => validatePedagogyV2Pack(p, { globalIds }))
  return {
    valid: rows.every((r) => r.valid),
    packs: rows,
    errors: rows.flatMap((r) => r.errors.map((e) => `${r.pack_id || 'unknown'}:${e}`)),
  }
}
