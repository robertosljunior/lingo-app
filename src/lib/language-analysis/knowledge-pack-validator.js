// knowledge-pack-validator.js — declarative validation for semantic_knowledge
// content packs. Packs are pure data: no functions, no regex, no serialized
// code. `when` conditions are interpreted by safe resolvers in code (see
// usage-rule-resolvers.js); transformations reference `operation_id`s only.

import { isKnownOperation } from './transformation-registry.js'

export const KNOWLEDGE_SCHEMA_VERSION = '1'
export const ANALYSIS_VERSION = '1'

const LEVELS = new Set(['A1', 'A2', 'B1', 'B2'])
const SECTIONS = [
  'concepts', 'usage_rules', 'semantic_frames', 'contrast_sets', 'patterns',
  'transformations', 'explanations_pt', 'natural_alternatives',
  'retrieval_exemplars', 'golden_tests', 'naturalness_hints',
]

// Guard against any executable / serialized-function content sneaking into a
// pack. Applied to every string value in the pack.
const CODE_SMELLS = [
  /\beval\s*\(/i,
  /\bnew\s+Function\b/i,
  /=>\s*[{(]/,
  /function\s*\*/i,
  /\bfunction\s*\(/i,
]

function walkStrings(node, visit, path = '') {
  if (typeof node === 'string') { visit(node, path); return }
  if (Array.isArray(node)) { node.forEach((v, i) => walkStrings(v, visit, `${path}[${i}]`)); return }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'function') throw new Error(`FUNCTION_IN_PACK:${path}.${k}`)
      walkStrings(v, visit, path ? `${path}.${k}` : k)
    }
  }
}

export function validateKnowledgePack(pack, opts = {}) {
  const errors = []
  const warnings = []
  const globalIds = opts.globalIds || new Set()
  const localIds = new Set()

  const addId = (kind, id) => {
    if (!id) { errors.push(`${kind}_ID_REQUIRED`); return }
    if (localIds.has(id)) errors.push(`DUPLICATE_ID:${id}`)
    localIds.add(id)
    if (opts.globalIds) {
      if (globalIds.has(id)) errors.push(`GLOBAL_DUPLICATE_ID:${id}`)
      else globalIds.add(id)
    }
  }

  // No executable content anywhere.
  try {
    walkStrings(pack, (s, path) => {
      for (const re of CODE_SMELLS) if (re.test(s)) { errors.push(`EXECUTABLE_CONTENT:${path}`); break }
    })
  } catch (e) {
    errors.push(String(e.message))
  }

  const m = pack?.manifest
  if (!m) {
    errors.push('MANIFEST_REQUIRED')
  } else {
    if (m.schema_version !== KNOWLEDGE_SCHEMA_VERSION) errors.push('SCHEMA_VERSION_INVALID')
    if (m.pack_kind !== 'semantic_knowledge') errors.push('PACK_KIND_INVALID')
    if (!m.pack_id) errors.push('PACK_ID_REQUIRED')
    if (!(m.version >= 1)) errors.push('VERSION_INVALID')
    if (!Array.isArray(m.levels) || !m.levels.length || m.levels.some((l) => !LEVELS.has(l))) errors.push('LEVELS_INVALID')
    const ac = m.analysis_compatibility
    if (!ac || ac.min_version !== ANALYSIS_VERSION) errors.push('ANALYSIS_COMPATIBILITY_INVALID')
  }

  // Collect id namespaces to resolve references.
  const conceptIds = new Set((pack?.concepts || []).map((c) => c.concept_id))
  const frameIds = new Set((pack?.semantic_frames || []).map((f) => f.frame_id))
  const explanationIds = new Set((pack?.explanations_pt || []).map((e) => e.explanation_id))

  for (const section of SECTIONS) {
    if (pack && pack[section] != null && !Array.isArray(pack[section])) errors.push(`SECTION_NOT_ARRAY:${section}`)
  }

  ;(pack?.concepts || []).forEach((c) => {
    addId('CONCEPT', c.concept_id)
    if (c.level && !LEVELS.has(c.level)) errors.push(`CONCEPT_LEVEL_INVALID:${c.concept_id}`)
    if (!c.meaning_pt) warnings.push(`CONCEPT_NO_MEANING:${c.concept_id}`)
  })

  ;(pack?.usage_rules || []).forEach((r) => {
    addId('RULE', r.rule_id)
    if (r.concept_id && !conceptIds.has(r.concept_id)) errors.push(`RULE_CONCEPT_UNRESOLVED:${r.rule_id}`)
    if (r.explanation_id && !explanationIds.has(r.explanation_id)) errors.push(`RULE_EXPLANATION_UNRESOLVED:${r.rule_id}`)
    if (!r.when || typeof r.when !== 'object') errors.push(`RULE_WHEN_REQUIRED:${r.rule_id}`)
  })

  ;(pack?.semantic_frames || []).forEach((f) => {
    addId('FRAME', f.frame_id)
    if (!Array.isArray(f.positive_exemplars) || !f.positive_exemplars.length) warnings.push(`FRAME_NO_EXEMPLARS:${f.frame_id}`)
  })

  ;(pack?.contrast_sets || []).forEach((cs) => addId('CONTRAST', cs.contrast_id))
  ;(pack?.patterns || []).forEach((p) => addId('PATTERN', p.pattern_id))

  ;(pack?.transformations || []).forEach((t) => {
    addId('TRANSFORMATION', t.transformation_id)
    if (!isKnownOperation(t.operation_id)) errors.push(`UNKNOWN_OPERATION:${t.operation_id}`)
    if (t.explanation_id && !explanationIds.has(t.explanation_id)) errors.push(`TRANSFORM_EXPLANATION_UNRESOLVED:${t.transformation_id}`)
  })

  ;(pack?.explanations_pt || []).forEach((e) => {
    addId('EXPLANATION', e.explanation_id)
    if ((e.locale || 'pt-BR') !== 'pt-BR') warnings.push(`EXPLANATION_LOCALE:${e.explanation_id}`)
    if (!e.summary && !e.title) errors.push(`EXPLANATION_EMPTY:${e.explanation_id}`)
  })

  ;(pack?.natural_alternatives || []).forEach((a) => {
    addId('ALTSET', a.alternative_set_id)
    if (a.frame_id && !frameIds.has(a.frame_id)) errors.push(`ALT_FRAME_UNRESOLVED:${a.alternative_set_id}`)
    if (!Array.isArray(a.alternatives) || !a.alternatives.length) errors.push(`ALT_EMPTY:${a.alternative_set_id}`)
  })

  ;(pack?.retrieval_exemplars || []).forEach((ex) => {
    addId('EXEMPLAR', ex.example_id)
    if (ex.frame_id && !frameIds.has(ex.frame_id)) errors.push(`EXEMPLAR_FRAME_UNRESOLVED:${ex.example_id}`)
    if (!ex.text) errors.push(`EXEMPLAR_TEXT_REQUIRED:${ex.example_id}`)
  })

  ;(pack?.naturalness_hints || []).forEach((h) => {
    addId('HINT', h.hint_id)
    if (h.explanation_id && !explanationIds.has(h.explanation_id)) errors.push(`HINT_EXPLANATION_UNRESOLVED:${h.hint_id}`)
    if (!Array.isArray(h.contains_all) || !h.contains_all.length) errors.push(`HINT_TOKENS_REQUIRED:${h.hint_id}`)
  })

  ;(pack?.golden_tests || []).forEach((g, i) => {
    if (!g.input) errors.push(`GOLDEN_INPUT_REQUIRED:${i}`)
    if (!g.expect || typeof g.expect !== 'object') errors.push(`GOLDEN_EXPECT_REQUIRED:${i}`)
  })

  if (!pack?.coverage) warnings.push('COVERAGE_MISSING')

  return {
    valid: errors.length === 0,
    pack_id: m?.pack_id || null,
    errors,
    warnings,
    counts: {
      concepts: pack?.concepts?.length || 0,
      usage_rules: pack?.usage_rules?.length || 0,
      semantic_frames: pack?.semantic_frames?.length || 0,
      transformations: pack?.transformations?.length || 0,
      explanations_pt: pack?.explanations_pt?.length || 0,
      natural_alternatives: pack?.natural_alternatives?.length || 0,
      retrieval_exemplars: pack?.retrieval_exemplars?.length || 0,
      golden_tests: pack?.golden_tests?.length || 0,
    },
  }
}

export function validateKnowledgePacks(packs) {
  const globalIds = new Set()
  const rows = packs.map((p) => validateKnowledgePack(p, { globalIds }))
  return {
    valid: rows.every((r) => r.valid),
    packs: rows,
    errors: rows.flatMap((r) => r.errors.map((e) => `${r.pack_id}:${e}`)),
  }
}
