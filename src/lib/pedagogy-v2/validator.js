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
  ID_PREFIXES, FORBIDDEN_LEXEME_LEVEL_KEYS, PEDAGOGY_V2_RELATION_TYPES,
  hasV2Prefix, isV2Id, isExposureStage, entityKindOfId,
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
    return { valid: false, pack_id: null, errors: ['PACK_REQUIRED'], counts: {}, external_refs: [] }
  }

  // ---- manifest (invariant 1) ----
  const m = pack.manifest
  const dependencies = Array.isArray(m?.dependencies) ? m.dependencies : []
  if (!m) {
    err('MANIFEST_REQUIRED')
  } else {
    if (m.pack_kind !== PEDAGOGY_V2_PACK_KIND) err('PACK_KIND_INVALID', `manifest.pack_kind=${m.pack_kind ?? 'missing'}`)
    if (m.schema_version !== PEDAGOGY_V2_SCHEMA_VERSION) err('SCHEMA_VERSION_INVALID', `manifest.schema_version=${m.schema_version ?? 'missing'}`)
    if (!m.pack_id) err('PACK_ID_REQUIRED', 'manifest')
    if (!(m.version >= 1)) err('VERSION_INVALID', 'manifest')
    // Slice V2.5: every pack must declare its principal lexeme (validated as
    // OWNED below) — a pedagogy pack without a main lexeme is unnavigable.
    if (!isV2Id('lexeme', m.primary_lexeme_id)) err('PACK_PRIMARY_LEXEME_REQUIRED', `manifest.primary_lexeme_id=${m.primary_lexeme_id ?? 'missing'}`)
    if (m.dependencies != null && !Array.isArray(m.dependencies)) err('DEPENDENCIES_NOT_ARRAY', 'manifest.dependencies')
    dependencies.forEach((d, i) => {
      const where = `manifest.dependencies[${i}]`
      if (!d || typeof d !== 'object' || !d.pack_id || typeof d.pack_id !== 'string') { err('DEPENDENCY_PACK_ID_REQUIRED', where); return }
      if (d.pack_id === m.pack_id) err('DEPENDENCY_SELF', `${where}=${d.pack_id}`)
      if (d.required_schema_version == null) err('DEPENDENCY_SCHEMA_VERSION_REQUIRED', where)
      if (!d.reason || typeof d.reason !== 'string') err('DEPENDENCY_REASON_REQUIRED', where)
    })
  }
  const dependencyPackIds = new Set(dependencies.map((d) => d?.pack_id).filter(Boolean))

  // External-reference collection (Slice V2.5): a pack that formally declares
  // dependencies may reference entities it does not own. Such references are
  // NOT errors here — they are collected (with their location) and resolved by
  // the registry validator against the declared dependency packs. A pack
  // WITHOUT dependencies keeps the strict single-pack behavior.
  const externalRefs = []
  const externalCandidate = (kind, ref, where) => {
    if (dependencyPackIds.size && isV2Id(kind, ref)) {
      externalRefs.push({ kind, ref, where })
      return true
    }
    return false
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

  // The principal lexeme must be OWNED by this pack (a pack cannot delegate its
  // identity to another pack's lexeme).
  if (m && isV2Id('lexeme', m.primary_lexeme_id) && !lexemeById.has(m.primary_lexeme_id)) {
    err('PACK_PRIMARY_LEXEME_UNRESOLVED', `manifest.primary_lexeme_id→${m.primary_lexeme_id}`)
  }

  // ---- senses (references + stage, invariants 4/16) ----
  senses.forEach((s) => {
    const where = s.sense_id || 'senses[?]'
    if (!s.lexeme_id || !lexemeById.has(s.lexeme_id)) err('SENSE_LEXEME_UNRESOLVED', `${where}→${s.lexeme_id}`)
    if (!s.label) err('SENSE_LABEL_REQUIRED', where)
    if (!s.meaning_pt) err('SENSE_MEANING_PT_REQUIRED', where)
    if (!isExposureStage(s.first_exposure_stage)) err('STAGE_INVALID', `${where}.first_exposure_stage=${s.first_exposure_stage}`)
    ;(s.communicative_function_ids || []).forEach((fid) => {
      if (!functionIds.has(fid) && !externalCandidate('communicative_function', fid, `${where}.communicative_function_ids`)) {
        err('SENSE_FUNCTION_UNRESOLVED', `${where}→${fid}`)
      }
    })
    ;(s.related_sense_ids || []).forEach((rid) => {
      if (!senseById.has(rid) && !externalCandidate('sense', rid, `${where}.related_sense_ids`)) {
        err('SENSE_RELATED_UNRESOLVED', `${where}→${rid}`)
      }
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
    ;(c.sense_ids || []).forEach((sid) => {
      if (!senseById.has(sid) && !externalCandidate('sense', sid, `${where}.sense_ids`)) err('CONSTRUCTION_SENSE_UNRESOLVED', `${where}→${sid}`)
    })
    ;(c.communicative_function_ids || []).forEach((fid) => {
      if (!functionIds.has(fid) && !externalCandidate('communicative_function', fid, `${where}.communicative_function_ids`)) {
        err('CONSTRUCTION_FUNCTION_UNRESOLVED', `${where}→${fid}`)
      }
    })
    ;(c.prerequisite_construction_ids || []).forEach((pid) => {
      if (!constructionById.has(pid) && !externalCandidate('construction', pid, `${where}.prerequisite_construction_ids`)) {
        err('CONSTRUCTION_PREREQ_UNRESOLVED', `${where}→${pid}`)
      }
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
    const kind = t.target_type === 'lexeme_usage' ? 'lexeme' : t.target_type
    const resolved = t.target_type === 'sense' ? senseById.has(t.target_id)
      : t.target_type === 'construction' ? constructionById.has(t.target_id)
      : t.target_type === 'communicative_function' ? functionIds.has(t.target_id)
      : lexemeById.has(t.target_id)
    if (!resolved && !externalCandidate(kind, t.target_id, where)) err('TARGET_UNRESOLVED', `${where}→${t.target_id}`)
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
    if (!resolved && !externalCandidate(p.type, p.ref, where)) err('PREREQ_UNRESOLVED', `${where}→${p.ref}`)
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
    if (!resolved && !externalCandidate(n.type, n.ref, where)) err('NEW_ITEM_UNRESOLVED', `${where}→${n.ref}`)
  }

  // ---- exemplars (invariants 4–12, 14, 16–19) ----
  exemplars.forEach((e) => {
    const where = e.exemplar_id || 'exemplars[?]'

    if (!e.text_en) err('EXEMPLAR_TEXT_EN_REQUIRED', where)
    else if (!isCompleteSentence(e.text_en)) err('EXEMPLAR_NOT_FULL_SENTENCE', `${where}="${e.text_en}"`)
    if (!e.text_pt || !String(e.text_pt).trim()) err('EXEMPLAR_TEXT_PT_REQUIRED', where)

    // Construction (required, resolved, fixed elements present in the text).
    // A cross-pack construction reference defers the fixed-element check to the
    // registry validator (which resolves the owning pack's construction).
    if (!e.construction_id) err('EXEMPLAR_CONSTRUCTION_REQUIRED', where)
    else if (!constructionById.has(e.construction_id)) {
      if (!externalCandidate('construction', e.construction_id, `${where}.construction_id`)) {
        err('EXEMPLAR_CONSTRUCTION_UNRESOLVED', `${where}→${e.construction_id}`)
      }
    } else {
      for (const fixed of constructionById.get(e.construction_id).fixed_elements || []) {
        if (!containsWord(e.text_en, fixed)) err('EXEMPLAR_FIXED_ELEMENT_MISSING', `${where} missing "${fixed}"`)
      }
    }

    // Senses / functions must resolve; the declared lexeme use must actually
    // appear in the sentence (invariant 17).
    if (!Array.isArray(e.sense_ids) || !e.sense_ids.length) err('EXEMPLAR_SENSE_REQUIRED', where)
    ;(e.sense_ids || []).forEach((sid) => {
      if (!senseById.has(sid)) {
        if (!externalCandidate('sense', sid, `${where}.sense_ids`)) err('EXEMPLAR_SENSE_UNRESOLVED', `${where}→${sid}`)
        return
      }
      const lex = lexemeById.get(senseById.get(sid).lexeme_id)
      if (lex?.lemma && e.text_en && !containsWord(e.text_en, lex.lemma)) {
        err('EXEMPLAR_LEXEME_MISSING_FROM_TEXT', `${where} declares ${sid} but "${lex.lemma}" is not in text_en`)
      }
    })
    ;(e.communicative_function_ids || []).forEach((fid) => {
      if (!functionIds.has(fid) && !externalCandidate('communicative_function', fid, `${where}.communicative_function_ids`)) {
        err('EXEMPLAR_FUNCTION_UNRESOLVED', `${where}→${fid}`)
      }
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

  // ---- typed relations (Slice V2.5) ----
  // Every relation must be TYPED (never a loose string array), directed and
  // well-formed. Endpoints may be local or cross-pack; the registry validator
  // resolves both against the declared dependencies.
  if (pack.relations != null && !Array.isArray(pack.relations)) err('RELATIONS_NOT_ARRAY', 'relations')
  const relations = Array.isArray(pack.relations) ? pack.relations : []
  relations.forEach((r, i) => {
    const where = `relations[${i}]`
    if (!r || typeof r !== 'object') { err('RELATION_INVALID', where); return }
    if (!PEDAGOGY_V2_RELATION_TYPES.includes(r.relation_type)) {
      err('RELATION_TYPE_INVALID', `${where}.relation_type=${r.relation_type ?? 'missing'}`)
    }
    for (const endpoint of ['from', 'to']) {
      const id = r[endpoint]
      const kind = entityKindOfId(id)
      if (!kind) { err('RELATION_ENDPOINT_INVALID', `${where}.${endpoint}=${id ?? 'missing'} (typed V2 id required)`); continue }
      const resolvedLocal = kind === 'lexeme' ? lexemeById.has(id)
        : kind === 'sense' ? senseById.has(id)
        : kind === 'construction' ? constructionById.has(id)
        : kind === 'communicative_function' ? functionIds.has(id)
        : false
      if (!resolvedLocal && !externalCandidate(kind, id, `${where}.${endpoint}`)) {
        err('RELATION_ENDPOINT_UNRESOLVED', `${where}.${endpoint}→${id}`)
      }
    }
    if (r.from && r.from === r.to) err('RELATION_SELF', `${where}=${r.from}`)
  })

  return {
    valid: errors.length === 0,
    pack_id: m?.pack_id || null,
    errors,
    external_refs: externalRefs,
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

// ---- registry validation (Slice V2.5) ---------------------------------------
// Validates a SET of packs as one registry: per-pack structure, global ID
// uniqueness (single canonical owner per entity), pack dependencies (existence,
// schema compatibility, acyclicity), cross-pack reference resolution against
// DECLARED dependencies only, cross-pack prerequisite cycles and lexeme alias
// ambiguity. Packs are processed in canonical pack_id order so the result is
// independent of import order.

function packEntityIndex(pack) {
  const ids = new Map() // id → kind
  for (const l of pack.lexemes || []) ids.set(l.lexeme_id, 'lexeme')
  for (const s of pack.senses || []) ids.set(s.sense_id, 'sense')
  for (const c of pack.constructions || []) ids.set(c.construction_id, 'construction')
  for (const f of pack.communicative_functions || []) ids.set(f.function_id, 'communicative_function')
  for (const e of pack.exemplars || []) ids.set(e.exemplar_id, 'exemplar')
  return ids
}

export function validatePedagogyV2Registry(packs) {
  const errors = []
  const err = (packId, code, where) => errors.push(`${packId || 'unknown'}:${code}${where ? `:${where}` : ''}`)
  if (!Array.isArray(packs) || !packs.length) {
    return { valid: false, errors: ['REGISTRY_PACKS_REQUIRED'], packs: [] }
  }

  // Canonical order: registry semantics never depend on import order.
  const sorted = [...packs].sort((a, b) => {
    const ai = String(a?.manifest?.pack_id ?? '')
    const bi = String(b?.manifest?.pack_id ?? '')
    return ai < bi ? -1 : ai > bi ? 1 : 0
  })

  // Per-pack validation with a shared global ID set: an entity defined by two
  // packs (two claimed owners) is a GLOBAL_DUPLICATE_ID on the later pack.
  const globalIds = new Set()
  const rows = sorted.map((p) => validatePedagogyV2Pack(p, { globalIds }))
  rows.forEach((r) => r.errors.forEach((e) => errors.push(`${r.pack_id || 'unknown'}:${e}`)))

  // Duplicate pack ids.
  const byPackId = new Map()
  sorted.forEach((p, i) => {
    const id = p?.manifest?.pack_id
    if (!id) return
    if (byPackId.has(id)) err(id, 'PACK_ID_DUPLICATE')
    else byPackId.set(id, { pack: p, row: rows[i] })
  })

  // Ownership index: entity id → owning pack id (first definition wins; the
  // duplicate itself is already an error above).
  const ownerOf = new Map()
  const kindOf = new Map()
  for (const [packId, { pack }] of byPackId) {
    for (const [id, kind] of packEntityIndex(pack)) {
      if (!ownerOf.has(id)) { ownerOf.set(id, packId); kindOf.set(id, kind) }
    }
  }

  // Dependencies: existence, schema compatibility, no self/circularity.
  for (const [packId, { pack }] of byPackId) {
    const deps = pack.manifest?.dependencies || []
    for (const d of deps) {
      const target = byPackId.get(d.pack_id)
      if (!target) { err(packId, 'PACK_DEPENDENCY_MISSING', d.pack_id); continue }
      const targetVersion = target.pack.manifest?.schema_version
      if (String(d.required_schema_version) !== String(targetVersion)) {
        err(packId, 'PACK_DEPENDENCY_SCHEMA_INCOMPATIBLE', `${d.pack_id} requires ${d.required_schema_version}, found ${targetVersion}`)
      }
    }
  }
  {
    const visiting = new Set()
    const done = new Set()
    const walk = (packId, trail) => {
      if (done.has(packId)) return
      if (visiting.has(packId)) { err(packId, 'PACK_DEPENDENCY_CYCLE', [...trail, packId].join('→')); return }
      visiting.add(packId)
      const deps = byPackId.get(packId)?.pack.manifest?.dependencies || []
      for (const d of deps) if (byPackId.has(d.pack_id)) walk(d.pack_id, [...trail, packId])
      visiting.delete(packId)
      done.add(packId)
    }
    for (const packId of byPackId.keys()) walk(packId, [])
  }

  // Cross-pack references: every external candidate must resolve to an entity
  // of the DECLARED kind owned by a DECLARED dependency pack.
  for (const [packId, { pack, row }] of byPackId) {
    const declaredDeps = new Set((pack.manifest?.dependencies || []).map((d) => d.pack_id))
    for (const ref of row.external_refs || []) {
      const owner = ownerOf.get(ref.ref)
      if (!owner) { err(packId, 'CROSS_PACK_REF_UNRESOLVED', `${ref.where}→${ref.ref}`); continue }
      if (owner === packId) continue // resolved locally after all (defensive)
      if (!declaredDeps.has(owner)) {
        err(packId, 'CROSS_PACK_DEPENDENCY_UNDECLARED', `${ref.where}→${ref.ref} owned by ${owner}`)
        continue
      }
      const expectedKind = ref.kind === 'lexeme_usage' ? 'lexeme' : ref.kind
      if (kindOf.get(ref.ref) !== expectedKind) {
        err(packId, 'CROSS_PACK_REF_KIND_MISMATCH', `${ref.where}→${ref.ref} is a ${kindOf.get(ref.ref)}, expected ${expectedKind}`)
      }
    }
  }

  // Deferred per-exemplar checks for cross-pack constructions: the fixed
  // elements of the OWNING pack's construction must occur in the sentence.
  const constructionsById = new Map()
  for (const { pack } of byPackId.values()) {
    for (const c of pack.constructions || []) if (!constructionsById.has(c.construction_id)) constructionsById.set(c.construction_id, c)
  }
  for (const [packId, { pack }] of byPackId) {
    const local = new Set((pack.constructions || []).map((c) => c.construction_id))
    for (const e of pack.exemplars || []) {
      if (!e.construction_id || local.has(e.construction_id)) continue
      const c = constructionsById.get(e.construction_id)
      if (!c) continue // already reported as unresolved
      for (const fixed of c.fixed_elements || []) {
        if (!containsWord(e.text_en, fixed)) err(packId, 'EXEMPLAR_FIXED_ELEMENT_MISSING', `${e.exemplar_id} missing "${fixed}"`)
      }
    }
  }

  // Cross-pack prerequisite cycles: construction prerequisite edges plus
  // relations of type `prerequisite` (from is learned AFTER to → edge from→to).
  {
    const edges = new Map() // construction/entity id → Set of prerequisite ids
    const addEdge = (from, to) => {
      if (!edges.has(from)) edges.set(from, new Set())
      edges.get(from).add(to)
    }
    for (const { pack } of byPackId.values()) {
      for (const c of pack.constructions || []) {
        for (const pid of c.prerequisite_construction_ids || []) addEdge(c.construction_id, pid)
      }
      for (const r of pack.relations || []) {
        if (r?.relation_type === 'prerequisite' && r.from && r.to) addEdge(r.from, r.to)
      }
    }
    const visiting = new Set()
    const done = new Set()
    const walk = (id, trail) => {
      if (done.has(id)) return
      if (visiting.has(id)) {
        err(ownerOf.get(id), 'CROSS_PACK_PREREQ_CYCLE', [...trail, id].join('→'))
        return
      }
      visiting.add(id)
      for (const to of edges.get(id) || []) if (edges.has(to) || ownerOf.has(to)) walk(to, [...trail, id])
      visiting.delete(id)
      done.add(id)
    }
    for (const id of [...edges.keys()].sort()) walk(id, [])
  }

  // Lexeme alias ambiguity: the same (lemma, language) must have exactly one
  // canonical lexeme entity across the registry.
  {
    const byLemma = new Map()
    for (const [packId, { pack }] of byPackId) {
      for (const l of pack.lexemes || []) {
        const key = `${String(l.lemma).toLowerCase()}|${l.language}`
        const prev = byLemma.get(key)
        if (prev && prev.lexeme_id !== l.lexeme_id) {
          err(packId, 'LEXEME_ALIAS_AMBIGUOUS', `${l.lexeme_id} duplicates ${prev.lexeme_id} for lemma "${l.lemma}" (${l.language})`)
        } else if (!prev) {
          byLemma.set(key, { lexeme_id: l.lexeme_id, pack_id: packId })
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    packs: rows,
    pack_ids: [...byPackId.keys()],
  }
}
