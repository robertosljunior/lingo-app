// registry.js — formal multi-pack registry for pedagogical_v2 content
// (Slice V2.5, replacing the single-pack pack-registry.js).
//
// Guarantees:
//   - deterministic: packs are canonically ordered by pack_id, so the registry
//     (and every query over it) is independent of import order;
//   - globally unique IDs and single ownership: the registry only loads after
//     validatePedagogyV2Registry passes (duplicate entities, undeclared or
//     circular dependencies, unresolved cross-pack references all fail);
//   - immutable: every pack and the registry object are deep-frozen after
//     validation — the lesson engine and the UI cannot mutate curriculum data;
//   - V2-only: nothing here imports V1 packs (src/content/packs/), the V1 skill
//     registry, or converts V2 entities to V1 skills.
//
// Cross-pack references (same-pack references included) resolve through the
// entity index built from the OWNING pack of each id.

import { BUILTIN_PEDAGOGY_V2_PACKS } from '../../content/pedagogy-v2/index.js'
import { validatePedagogyV2Registry } from './validator.js'
import {
  PEDAGOGY_V2_REGISTRY_VERSION, PEDAGOGY_V2_SCHEMA_VERSION,
  entityKindOfId,
} from './contracts.js'

function deepFreeze(node) {
  if (node && typeof node === 'object' && !Object.isFrozen(node)) {
    Object.freeze(node)
    for (const v of Object.values(node)) deepFreeze(v)
  }
  return node
}

// Registry → lazily built lookup indexes. Kept OUTSIDE the frozen registry
// object (WeakMap) so the registry itself stays plain immutable data.
const _indexes = new WeakMap()

function indexesOf(registry) {
  let idx = _indexes.get(registry)
  if (idx) return idx
  const byPackId = new Map()
  const entities = new Map() // entity id → { pack_id, kind, entity }
  for (const pack of registry.packs) {
    const packId = pack.manifest.pack_id
    byPackId.set(packId, pack)
    const add = (kind, id, entity) => { if (!entities.has(id)) entities.set(id, { pack_id: packId, kind, entity }) }
    for (const l of pack.lexemes || []) add('lexeme', l.lexeme_id, l)
    for (const s of pack.senses || []) add('sense', s.sense_id, s)
    for (const c of pack.constructions || []) add('construction', c.construction_id, c)
    for (const f of pack.communicative_functions || []) add('communicative_function', f.function_id, f)
    for (const e of pack.exemplars || []) add('exemplar', e.exemplar_id, e)
  }
  idx = { byPackId, entities }
  _indexes.set(registry, idx)
  return idx
}

/**
 * Build a validated, frozen registry from an explicit pack list (pure — used
 * by tests and by the builtin loader). Throws on any registry validation
 * failure: shipping a broken curriculum is a build defect, not a runtime
 * condition to degrade around.
 */
export function buildPedagogyV2Registry(packs) {
  const result = validatePedagogyV2Registry(packs)
  if (!result.valid) throw new Error(`PEDAGOGY_V2_REGISTRY_INVALID:${result.errors.join(',')}`)
  const sorted = [...packs]
    .sort((a, b) => (a.manifest.pack_id < b.manifest.pack_id ? -1 : 1))
    .map((p) => deepFreeze(structuredClone(p)))
  return deepFreeze({
    registry_version: PEDAGOGY_V2_REGISTRY_VERSION,
    schema_version: PEDAGOGY_V2_SCHEMA_VERSION,
    pack_ids: sorted.map((p) => p.manifest.pack_id),
    packs: sorted,
  })
}

let _builtin = null

/** The validated, frozen registry over the builtin pedagogy-v2 packs. */
export function loadPedagogyV2Registry() {
  if (!_builtin) _builtin = buildPedagogyV2Registry(BUILTIN_PEDAGOGY_V2_PACKS)
  return _builtin
}

export function getPedagogyPack(packId, registry = loadPedagogyV2Registry()) {
  return indexesOf(registry).byPackId.get(packId) || null
}

export function getAllPedagogyPacks(registry = loadPedagogyV2Registry()) {
  return registry.packs
}

/** Resolve ANY typed V2 entity id to { pack_id, kind, entity } or null. */
export function resolvePedagogyEntity(entityId, registry = loadPedagogyV2Registry()) {
  return indexesOf(registry).entities.get(entityId) || null
}

export function getLexemeAcrossRegistry(lexemeId, registry = loadPedagogyV2Registry()) {
  const hit = resolvePedagogyEntity(lexemeId, registry)
  return hit && hit.kind === 'lexeme' ? { pack_id: hit.pack_id, lexeme: hit.entity } : null
}

/**
 * Resolve a pedagogical target reference ({ target_type, target_id }) across
 * the registry. The id's typed prefix must agree with the declared target_type
 * (lexeme_usage targets carry lexeme ids). Returns { pack_id, kind, entity }.
 */
export function resolvePedagogyTarget(target, registry = loadPedagogyV2Registry()) {
  if (!target || typeof target.target_id !== 'string') return null
  const hit = resolvePedagogyEntity(target.target_id, registry)
  if (!hit) return null
  const expectedKind = target.target_type === 'lexeme_usage' ? 'lexeme' : target.target_type
  return hit.kind === expectedKind ? hit : null
}

export function resolvePedagogyExemplar(exemplarId, registry = loadPedagogyV2Registry()) {
  const hit = resolvePedagogyEntity(exemplarId, registry)
  return hit && hit.kind === 'exemplar' ? hit : null
}

export function resolvePedagogyConstruction(constructionId, registry = loadPedagogyV2Registry()) {
  const hit = resolvePedagogyEntity(constructionId, registry)
  return hit && hit.kind === 'construction' ? hit : null
}

/**
 * Resolve an exemplar prerequisite ({ type, ref }). V2 references resolve in
 * the registry; `grammar_skill_v1` bridges are returned unresolved — the V1
 * skill registry is never imported here, resolution is the caller's opt-in.
 */
export function resolvePedagogyPrerequisite(prerequisite, registry = loadPedagogyV2Registry()) {
  if (!prerequisite || typeof prerequisite !== 'object') return null
  if (prerequisite.type === 'grammar_skill_v1') {
    return { kind: 'grammar_skill_v1', ref: prerequisite.ref, pack_id: null, entity: null, compat_bridge: true }
  }
  const hit = resolvePedagogyEntity(prerequisite.ref, registry)
  if (!hit) return null
  const expectedKind = prerequisite.type === 'lexeme_usage' ? 'lexeme' : prerequisite.type
  return hit.kind === expectedKind ? hit : null
}

/**
 * Packs pedagogically anchored on a lexeme: the pack that OWNS it plus any
 * pack declaring it as primary lexeme (deterministic pack_id order).
 */
export function getPacksForLexeme(lexemeId, registry = loadPedagogyV2Registry()) {
  const owner = resolvePedagogyEntity(lexemeId, registry)
  return registry.packs.filter((p) =>
    p.manifest.primary_lexeme_id === lexemeId
    || (owner && owner.pack_id === p.manifest.pack_id && owner.kind === 'lexeme'))
}

/**
 * Target resolver for the learner model (storage.js): true when the target id
 * exists — with the right kind — anywhere in the validated registry.
 */
export function createRegistryTargetResolver(registry = null) {
  return (target) => {
    const r = registry ?? loadPedagogyV2Registry()
    return !!resolvePedagogyTarget(target, r)
  }
}

/** Which pack owns an entity id (null when unknown). */
export function getPedagogyEntityOwner(entityId, registry = loadPedagogyV2Registry()) {
  return resolvePedagogyEntity(entityId, registry)?.pack_id ?? null
}

/** Kind helper re-exported for callers that navigate raw ids. */
export { entityKindOfId }

export function __resetPedagogyV2RegistryForTests() {
  _builtin = null
}
