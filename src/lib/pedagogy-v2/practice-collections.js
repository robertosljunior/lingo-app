// practice-collections.js — Slice V2.22-UX2. The EDITORIAL navigation layer.
//
// A PracticeCollectionV2 is presentation + scope and NOTHING else. It is the
// answer to "in what kind of situation do I want to practise?", authored by a
// human, validated against the Registry, and deliberately orthogonal to the
// curriculum graph:
//
//   content packs (still / but / yet)  → HOW the curriculum is organised
//   practice collections               → HOW THE LEARNER navigates it
//
// A collection therefore SPANS packs on purpose (§5): "Conversas do dia a dia"
// draws on still, but and yet without ever naming them. It is not derivable
// from pack_id (§3.8) — the membership is authored, never inferred from text by
// React (§4).
//
// Hard boundaries (§3), enforced by the validator and the audit:
//   - a collection creates NO evidence, receives NO mastery, is NEVER a target;
//   - it does not duplicate the Learner Model and invents no sentence;
//   - every member id must resolve in the Registry;
//   - the same exemplar MAY belong to several collections when that is
//     editorially true.
//
// PURE: no clock, no randomness, no storage.

// The catalogue lives in a SUBDIRECTORY of the pedagogy-v2 content folder on
// purpose: `scripts/validate-pedagogy-v2.mjs` treats every *.json directly in
// that folder as a content pack, so a sibling file here would be reported as a
// pack with no manifest. It is pedagogy-v2 content, just not a pack.
//
// `with { type: 'json' }` is required by plain Node ESM — the validator and
// audit scripts import this module directly, outside Vite. See the same note in
// src/content/pedagogy-v2/index.js.
import COLLECTIONS_DOC from '../../content/pedagogy-v2/collections/practice-collections.json' with { type: 'json' }
import { loadPedagogyV2Registry, resolvePedagogyExemplar } from './registry.js'

export const PRACTICE_COLLECTION_CONTRACT_VERSION = 1

/** Frozen, catalog-ordered collections. Order is authored, never alphabetic. */
function normalize(doc) {
  const list = [...(doc?.collections || [])]
    .sort((a, b) => (a.catalog_order ?? 0) - (b.catalog_order ?? 0)
      || String(a.collection_id).localeCompare(String(b.collection_id)))
    .map((c) => Object.freeze({
      ...c,
      authored_scope: Object.freeze({
        exemplar_ids: Object.freeze([...(c.authored_scope?.exemplar_ids || [])]),
      }),
    }))
  return Object.freeze({
    contract_version: doc?.contract_version ?? PRACTICE_COLLECTION_CONTRACT_VERSION,
    collections: Object.freeze(list),
  })
}

let _builtin = null

/** The authored collection catalogue (frozen). */
export function loadPracticeCollectionsV2() {
  if (!_builtin) _builtin = normalize(COLLECTIONS_DOC)
  return _builtin
}

export function getPracticeCollectionV2(collectionId, doc = loadPracticeCollectionsV2()) {
  return doc.collections.find((c) => c.collection_id === collectionId) || null
}

/**
 * Resolve a collection against the Registry: the concrete exemplars, the
 * pedagogical targets they declare and the INTERNAL packs they happen to span.
 *
 * `pack_ids` is derived, DIAGNOSTIC ONLY — it exists so the planner can be
 * scoped and the audit can prove multi-pack coverage. It is never learner-facing
 * copy (§1/§18): no screen ever renders a pack id.
 */
export function resolvePracticeCollectionV2(collection, registry = loadPedagogyV2Registry()) {
  const exemplars = []
  const missing = []
  const packIds = new Set()
  const targetIds = new Set()
  const constructionIds = new Set()
  for (const id of collection?.authored_scope?.exemplar_ids || []) {
    const hit = resolvePedagogyExemplar(id, registry)
    if (!hit) { missing.push(id); continue }
    exemplars.push(hit.entity)
    packIds.add(hit.pack_id)
    if (hit.entity.construction_id) constructionIds.add(hit.entity.construction_id)
    for (const t of hit.entity.pedagogical_targets || []) targetIds.add(t.target_id)
  }
  return {
    collection_id: collection?.collection_id ?? null,
    exemplars,
    missing_exemplar_ids: missing.sort(),
    exemplar_ids: exemplars.map((e) => e.exemplar_id).sort(),
    pack_ids: [...packIds].sort(),
    target_ids: [...targetIds].sort(),
    construction_ids: [...constructionIds].sort(),
  }
}

export function __resetPracticeCollectionsForTests() {
  _builtin = null
}
