const STAGES = new Set(['A1', 'A1-A2', 'A2', 'A2-B1', 'B1', 'B1-B2', 'B2'])

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function hasAll(values, required) {
  const set = new Set(values || [])
  return asArray(required).every((value) => set.has(value))
}

function hasAny(values, requested) {
  const wanted = asArray(requested)
  if (wanted.length === 0) return true
  const set = new Set(values || [])
  return wanted.some((value) => set.has(value))
}

function fillTokens(template, values) {
  return String(template).replace(/\{([a-z_]+)\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`LEXICON_RENDER_TOKEN_MISSING:${key}`)
    return values[key]
  })
}

function fillFrameTemplate(template, surface) {
  if (!String(template).includes('{{slot}}')) throw new Error('LEXICON_FRAME_SLOT_TOKEN_REQUIRED')
  return String(template).replace(/\{\{slot\}\}/g, surface)
}

export function indexLexiconUnits(lexicon) {
  return new Map((lexicon?.units || []).map((unit) => [unit.unit_id, unit]))
}

export function selectLexiconUnits(lexicon, {
  type = null,
  requireRoles = [],
  requireDomains = [],
  anyDomains = [],
  relation = null,
  seedGroups = [],
} = {}) {
  const allowedSeedGroups = new Set(asArray(seedGroups))
  return (lexicon?.units || []).filter((unit) => {
    if (type && unit.type !== type) return false
    if (!hasAll(unit.roles, requireRoles)) return false
    if (!hasAll(unit.domains, requireDomains)) return false
    if (!hasAny(unit.domains, anyDomains)) return false
    if (relation && !(unit.affordances?.location_relations || []).includes(relation)) return false
    if (allowedSeedGroups.size > 0 && !allowedSeedGroups.has(unit.seed_group)) return false
    return true
  })
}

export function renderLexiconRelation(lexicon, unitOrId, relation, { articleProfile = null } = {}) {
  const unit = typeof unitOrId === 'string' ? indexLexiconUnits(lexicon).get(unitOrId) : unitOrId
  if (!unit) throw new Error(`LEXICON_UNIT_NOT_FOUND:${unitOrId}`)
  if (!(unit.affordances?.location_relations || []).includes(relation)) {
    throw new Error(`LEXICON_RELATION_NOT_ALLOWED:${unit.unit_id}:${relation}`)
  }

  const rule = lexicon?.renderer_rules?.[relation]
  if (!rule?.en || !rule?.pt) throw new Error(`LEXICON_RENDER_RULE_MISSING:${relation}`)
  const profileId = articleProfile || unit.affordances?.article_profile
  const profile = lexicon?.article_profiles?.[profileId]
  if (!profile) throw new Error(`LEXICON_ARTICLE_PROFILE_MISSING:${unit.unit_id}:${profileId}`)

  const contraction = (token) => {
    const value = lexicon?.pt_contractions?.[token]?.[unit.pt_gender]
    if (!value) throw new Error(`LEXICON_PT_CONTRACTION_MISSING:${unit.unit_id}:${token}:${unit.pt_gender}`)
    return value
  }

  const override = unit.surface_overrides?.[relation] || {}
  const values = {
    en: unit.en,
    pt: unit.pt,
    article: profile[relation] ?? '',
    em: contraction('em'),
    o: contraction('o'),
    de: contraction('de'),
  }

  return {
    unit_id: unit.unit_id,
    relation,
    en: override.en ?? fillTokens(rule.en, values),
    pt: override.pt ?? fillTokens(rule.pt, values),
    lexical_stage: unit.lexical_stage,
    roles: [...(unit.roles || [])],
    domains: [...(unit.domains || [])],
    article_profile: profileId,
  }
}

export function compileLexiconSlotCandidates(lexicon, {
  relation,
  type = lexicon?.entity_type || null,
  requireRoles = [],
  requireDomains = [],
  anyDomains = [],
  seedGroups = [],
  articleProfile = null,
} = {}) {
  if (!relation) throw new Error('LEXICON_FRAME_RELATION_REQUIRED')
  return selectLexiconUnits(lexicon, {
    type,
    requireRoles,
    requireDomains,
    anyDomains,
    relation,
    seedGroups,
  }).map((unit) => renderLexiconRelation(lexicon, unit, relation, { articleProfile }))
}

export function compileLexiconFrameSurfaces(lexicon, {
  frameId,
  relation,
  template,
  type = lexicon?.entity_type || null,
  requireRoles = [],
  requireDomains = [],
  anyDomains = [],
  seedGroups = [],
  articleProfile = null,
} = {}) {
  if (!frameId) throw new Error('LEXICON_FRAME_ID_REQUIRED')
  if (!template?.en || !template?.pt) throw new Error(`LEXICON_FRAME_TEMPLATE_REQUIRED:${frameId}`)
  const slots = compileLexiconSlotCandidates(lexicon, {
    relation,
    type,
    requireRoles,
    requireDomains,
    anyDomains,
    seedGroups,
    articleProfile,
  })
  return slots.map((slot) => ({
    frame_id: frameId,
    unit_id: slot.unit_id,
    relation,
    text_en: fillFrameTemplate(template.en, slot.en),
    text_pt: fillFrameTemplate(template.pt, slot.pt),
    slot_surface: { en: slot.en, pt: slot.pt },
    lexical_stage: slot.lexical_stage,
    roles: [...slot.roles],
    domains: [...slot.domains],
  }))
}

export function normalizeCrosslingualSurface(value) {
  return String(value || '').trim().toLocaleLowerCase('en-US').normalize('NFC')
}

export function deriveSameSurface(unit) {
  return normalizeCrosslingualSurface(unit?.en) === normalizeCrosslingualSurface(unit?.pt)
}

export function validateSemanticLexicon(lexicon) {
  const errors = []
  if (!lexicon?.lexicon_id) errors.push('LEXICON_ID_REQUIRED')
  if (!lexicon?.entity_type) errors.push('LEXICON_ENTITY_TYPE_REQUIRED')
  if (!lexicon?.en_variant) errors.push('LEXICON_EN_VARIANT_REQUIRED')
  if (!lexicon?.pt_variant) errors.push('LEXICON_PT_VARIANT_REQUIRED')
  if (!Array.isArray(lexicon?.units) || lexicon.units.length === 0) errors.push('LEXICON_UNITS_REQUIRED')

  const ids = new Set()
  for (const unit of lexicon?.units || []) {
    const prefix = unit?.unit_id || 'missing'
    if (!unit?.unit_id) errors.push('LEXICON_UNIT_ID_REQUIRED')
    else if (ids.has(unit.unit_id)) errors.push(`LEXICON_UNIT_ID_DUPLICATE:${unit.unit_id}`)
    else ids.add(unit.unit_id)
    if (!unit?.en || !unit?.pt) errors.push(`LEXICON_BILINGUAL_SURFACE_REQUIRED:${prefix}`)
    if (unit?.type !== lexicon.entity_type) errors.push(`LEXICON_ENTITY_TYPE_MISMATCH:${prefix}`)
    if (!['m', 'f'].includes(unit?.pt_gender)) errors.push(`LEXICON_PT_GENDER_INVALID:${prefix}`)
    if (!STAGES.has(unit?.lexical_stage)) errors.push(`LEXICON_STAGE_INVALID:${prefix}:${unit?.lexical_stage}`)
    if ('same_surface' in (unit?.crosslingual || {})) errors.push(`LEXICON_SAME_SURFACE_MUST_BE_DERIVED:${prefix}`)
    if ('projections' in unit) errors.push(`LEXICON_PROJECTIONS_FORBIDDEN:${prefix}`)

    const profileId = unit?.affordances?.article_profile
    if (!lexicon?.article_profiles?.[profileId]) errors.push(`LEXICON_ARTICLE_PROFILE_UNKNOWN:${prefix}:${profileId}`)
    const relations = unit?.affordances?.location_relations
    if (!Array.isArray(relations) || relations.length === 0) errors.push(`LEXICON_RELATIONS_REQUIRED:${prefix}`)
    for (const relation of relations || []) {
      if (!lexicon?.renderer_rules?.[relation]) errors.push(`LEXICON_RELATION_RULE_UNKNOWN:${prefix}:${relation}`)
    }
    for (const relation of Object.keys(unit?.surface_overrides || {})) {
      if (!(relations || []).includes(relation)) errors.push(`LEXICON_OVERRIDE_RELATION_NOT_ALLOWED:${prefix}:${relation}`)
      const override = unit.surface_overrides[relation]
      if (!override?.en && !override?.pt) errors.push(`LEXICON_OVERRIDE_EMPTY:${prefix}:${relation}`)
    }
  }

  return { valid: errors.length === 0, errors, count: lexicon?.units?.length || 0 }
}
