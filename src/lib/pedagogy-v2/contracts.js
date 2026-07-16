// contracts.js — canonical constants and typed-ID helpers for the pedagogy V2
// content model ("content_v2"). This namespace is deliberately ISOLATED from the
// frozen V1 core: it never imports skill-registry.js, lesson-template-registry.js,
// lexical-bank.js or the generated-lesson contracts, and V2 entity IDs are
// structurally distinguishable from V1 skill_ids (typed prefixes, see below).
//
// Entities (see docs/pedagogy-v2-content-model.md):
//   lexeme                 — canonical word; NEVER carries a global CEFR level
//   sense                  — one meaning/semantic function of a lexeme
//   construction           — reusable structural pattern with fixed elements + slots
//   communicative_function — what the learner learns to express/understand
//   exemplar               — complete, natural, bilingual sentence with explicit
//                            pedagogical targets, prerequisites and intended new items

export const PEDAGOGY_V2_SCHEMA_VERSION = '1'
export const PEDAGOGY_V2_PACK_KIND = 'pedagogical_v2'

// Curricular exposure stages. These are RECOMMENDATIONS for when a given USE
// (sense/construction/exemplar) is first worth exposing — never a level owned by
// a word. Bands ("A1-A2") express transitions the curriculum may schedule either
// side of.
export const EXPOSURE_STAGES = ['A1', 'A1-A2', 'A2', 'A2-B1', 'B1', 'B1-B2', 'B2']

// Discriminated pedagogical-target union: { target_type, target_id, role }.
export const TARGET_TYPES = ['sense', 'construction', 'communicative_function', 'lexeme_usage']
export const TARGET_ROLES = ['primary', 'secondary']

// Prerequisite reference types. `grammar_skill_v1` is an OPT-IN compatibility
// bridge to the V1 skill registry (must set compat_bridge: true) — it is never
// the identity of V2 content.
export const PREREQUISITE_TYPES = ['lexeme', 'sense', 'construction', 'communicative_function', 'grammar_skill_v1']

// Intended-new-item reference types (what an exemplar deliberately introduces).
export const NEW_ITEM_TYPES = ['lexeme', 'sense', 'construction', 'communicative_function']

// Authoring status of an exemplar sentence. Structural validation cannot prove
// naturalness — that is the author's responsibility, tracked explicitly here.
export const NATURALNESS_STATUSES = ['curated', 'needs_review']

// Typed ID prefixes. Every V2 entity ID starts with its kind prefix, which makes
// silent mixing with V1 identifiers (plain snake_case skill_ids) impossible.
export const ID_PREFIXES = {
  lexeme: 'lexeme:',
  sense: 'sense:',
  construction: 'construction:',
  communicative_function: 'function:',
  exemplar: 'exemplar:',
}

// target_type → the ID prefix its target_id must carry.
export const TARGET_TYPE_PREFIX = {
  sense: ID_PREFIXES.sense,
  construction: ID_PREFIXES.construction,
  communicative_function: ID_PREFIXES.communicative_function,
  lexeme_usage: ID_PREFIXES.lexeme,
}

// Lexemes must not carry any global proficiency level — the level belongs to the
// use (sense/construction/exemplar), never to the word. Any of these keys on a
// lexeme is a validation error.
export const FORBIDDEN_LEXEME_LEVEL_KEYS = ['level', 'levels', 'cefr', 'cefr_level', 'cefr_start', 'stage']

export function hasV2Prefix(id) {
  return typeof id === 'string' && Object.values(ID_PREFIXES).some((p) => id.startsWith(p))
}

export function isV2Id(kind, id) {
  const prefix = ID_PREFIXES[kind]
  return !!prefix && typeof id === 'string' && id.startsWith(prefix) && id.length > prefix.length
}

export function isExposureStage(stage) {
  return EXPOSURE_STAGES.includes(stage)
}

// Order index of a stage for progression queries (lower = earlier exposure).
export function stageIndex(stage) {
  return EXPOSURE_STAGES.indexOf(stage)
}
