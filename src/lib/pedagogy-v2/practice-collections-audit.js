// practice-collections-audit.js — Slice V2.22-UX2 §29. Structural audit of the
// EDITORIAL layer. It measures coverage and honesty; it never scores pedagogy,
// never touches the Learner Model and never feeds the Planner.
//
// Hard failures (a broken catalogue is a build defect, not a runtime condition):
//   COLLECTION_REFERENCE_UNKNOWN   a member id does not resolve in the Registry
//   COLLECTION_EMPTY               a collection resolves to no content
//   COLLECTION_DUPLICATE_ID        two collections share an id
//   COLLECTION_TECHNICAL_LABEL     a pack id / lemma leaked into learner copy
//   COLLECTION_SINGLE_EXEMPLAR     a "context" with one sentence is not a context (§23)
//
// Advisory only: orphan exemplars (authored content in no collection) — that is
// an editorial decision, not a defect.

import { loadPedagogyV2Registry } from './registry.js'
import { loadPracticeCollectionsV2, resolvePracticeCollectionV2 } from './practice-collections.js'

export const PRACTICE_COLLECTION_AUDIT_VERSION = 1

// §29 — a learner-facing label must never be a technical name. Checked against
// the REAL pack ids and their primary lemmas, so the rule cannot drift from the
// catalogue it guards.
function technicalTermsOf(registry) {
  const terms = new Set()
  for (const pack of registry.packs || []) {
    const id = pack.manifest?.pack_id
    if (id) {
      terms.add(id.toLowerCase())
      terms.add(String(id).split(':').pop().toLowerCase())
    }
    const lemma = String(pack.manifest?.title?.pt ?? '').split('—')[0].trim().toLowerCase()
    if (lemma) terms.add(lemma)
  }
  return [...terms].filter(Boolean)
}

export function auditPracticeCollectionsV2({
  registry = loadPedagogyV2Registry(),
  doc = loadPracticeCollectionsV2(),
} = {}) {
  const failures = []
  const findings = []
  const rows = []
  const seenIds = new Set()
  const claimed = new Set()
  const technical = technicalTermsOf(registry)

  for (const collection of doc.collections) {
    const id = collection.collection_id
    if (seenIds.has(id)) failures.push({ code: 'COLLECTION_DUPLICATE_ID', collection_id: id })
    seenIds.add(id)

    const resolved = resolvePracticeCollectionV2(collection, registry)
    for (const missing of resolved.missing_exemplar_ids) {
      failures.push({ code: 'COLLECTION_REFERENCE_UNKNOWN', collection_id: id, exemplar_id: missing })
    }
    if (!resolved.exemplar_ids.length) failures.push({ code: 'COLLECTION_EMPTY', collection_id: id })
    else if (resolved.exemplar_ids.length < 2) failures.push({ code: 'COLLECTION_SINGLE_EXEMPLAR', collection_id: id })

    const copy = `${collection.title_pt} ${collection.description_pt}`.toLowerCase()
    for (const term of technical) {
      // Word-boundary match: "but" must not fire inside "atributo".
      if (new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(copy)) {
        failures.push({ code: 'COLLECTION_TECHNICAL_LABEL', collection_id: id, term })
      }
    }

    for (const xid of resolved.exemplar_ids) claimed.add(xid)
    rows.push({
      collection_id: id,
      title: collection.title_pt,
      exemplars: resolved.exemplar_ids.length,
      constructions: resolved.construction_ids.length,
      internal_packs: resolved.pack_ids.length,
      // Proof of §33.5: the context genuinely crosses the internal curriculum.
      spans_multiple_packs: resolved.pack_ids.length > 1,
    })
  }

  const allExemplarIds = []
  for (const pack of registry.packs || []) {
    for (const e of pack.exemplars || []) allExemplarIds.push(e.exemplar_id)
  }
  const orphans = allExemplarIds.filter((x) => !claimed.has(x)).sort()
  if (orphans.length) {
    findings.push({ code: 'ORPHAN_EXEMPLARS', severity: 'advisory', count: orphans.length, exemplar_ids: orphans })
  }
  const notSpanning = rows.filter((r) => !r.spans_multiple_packs).map((r) => r.collection_id)
  if (notSpanning.length) {
    findings.push({ code: 'COLLECTION_SINGLE_PACK', severity: 'advisory', collection_ids: notSpanning })
  }

  return {
    audit_version: PRACTICE_COLLECTION_AUDIT_VERSION,
    ok: failures.length === 0,
    failures,
    findings,
    collections: rows,
    coverage: {
      authored_exemplars: allExemplarIds.length,
      exemplars_in_a_collection: claimed.size,
      orphan_exemplars: orphans.length,
    },
  }
}
