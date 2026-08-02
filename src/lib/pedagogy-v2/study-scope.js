// study-scope.js — Slice V2.22-UX2. StudyScopeV2: an OPTIONAL, additive
// restriction on which authored content a study session may materialize.
//
// Why a scope and not a new study mode (§6): the four real modes (adaptive,
// explore, review, focused) answer "what kind of session is this?". A contextual
// collection answers a different question — "out of the whole catalogue, which
// authored slice is on the table?" — and it composes with every mode. Adding a
// `context_mode` would have duplicated the scheduler; an optional scope does not
// touch it at all.
//
// What the scope IS:  a set of allowed exemplar ids, plus the pack and target
//                     ids derived from them, handed to the Planner and Engine.
// What the scope IS NOT: a target, a mastery, an evidence source, a playlist,
//                     a difficulty, or a promise about how many activities the
//                     learner will get (§3/§17).
//
// The Planner keeps choosing target/capability/modality; the Engine keeps
// choosing exemplar/recipe/support. The scope only narrows the universe they
// choose from, so a scoped session can never materialize content outside the
// collection (§29 hard fail) and can never invent content inside it.
//
// PURE.

import { getPracticeCollectionV2, resolvePracticeCollectionV2 } from './practice-collections.js'
import { loadPedagogyV2Registry } from './registry.js'

export const STUDY_SCOPE_V2_VERSION = 1

/**
 * Build a StudyScopeV2 from an authored collection id. Returns null for "no
 * scope" (the whole catalogue), which is the adaptive default — callers pass
 * the result straight through, so an absent scope is never a special case.
 *
 * An unknown collection id is a STRUCTURAL error, never a silent fallback to
 * the full catalogue: a learner who tapped a context must not be given a
 * different session without being told.
 */
export function buildStudyScopeFromCollectionV2(collectionId, registry = loadPedagogyV2Registry()) {
  if (!collectionId) return null
  const collection = getPracticeCollectionV2(collectionId)
  if (!collection) return { error: 'COLLECTION_UNKNOWN', collection_id: collectionId }
  const resolved = resolvePracticeCollectionV2(collection, registry)
  if (!resolved.exemplar_ids.length) return { error: 'COLLECTION_EMPTY', collection_id: collectionId }
  return {
    scope_version: STUDY_SCOPE_V2_VERSION,
    scope_kind: 'practice_collection',
    collection_id: collection.collection_id,
    // Learner-facing title comes from the AUTHORED collection, so a lesson
    // header can name the context factually without touching a pack (§17).
    title_pt: collection.title_pt,
    allowed_exemplar_ids: resolved.exemplar_ids,
    allowed_target_ids: resolved.target_ids,
    allowed_pack_ids: resolved.pack_ids,
  }
}

export function isStudyScopeV2(scope) {
  return !!scope && !scope.error && Array.isArray(scope.allowed_exemplar_ids) && scope.allowed_exemplar_ids.length > 0
}

/** Membership helpers — the single place these questions are answered. */
export function scopeAllowsExemplarV2(scope, exemplarId) {
  if (!isStudyScopeV2(scope)) return true
  return scope.allowed_exemplar_ids.includes(exemplarId)
}

export function scopeAllowsTargetV2(scope, targetId) {
  if (!isStudyScopeV2(scope)) return true
  return !targetId || scope.allowed_target_ids.includes(targetId)
}

/**
 * The pack restriction a scope implies, INTERSECTED with an existing one.
 * `focused` mode already pins a single pack; a scope must narrow that, never
 * widen it — so the two compose without either overriding the other.
 */
export function intersectAllowedPackIdsV2(allowedPackIds, scope) {
  if (!isStudyScopeV2(scope)) return allowedPackIds ?? null
  if (!allowedPackIds) return [...scope.allowed_pack_ids]
  return allowedPackIds.filter((id) => scope.allowed_pack_ids.includes(id))
}
