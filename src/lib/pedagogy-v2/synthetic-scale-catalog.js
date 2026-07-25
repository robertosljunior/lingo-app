// synthetic-scale-catalog.js — V2.21-R3c §3.
//
// A SYNTHETIC catalogue used only to prove the planner scales. The product
// registry is unchanged: nothing here is exported into
// src/content/pedagogy-v2/index.js, and no synthetic pack is ever loadable by
// the app. The harness clones the three real packs into additional
// "generations" so the planner faces 6 / 9 / 12 packs with the SAME pedagogical
// shape it already handles at 3 — which isolates catalogue SIZE as the only
// independent variable (§3: same learner, same horizon, same seed logic, same
// correct answers).
//
// Cloning rewrites every id OWNED by the generation, and only those. Because a
// generation clones all three packs together, its internal cross-pack relations
// (still↔but↔yet) are rewritten consistently and stay cross-pack — a generation
// is a self-contained copy of the real curriculum graph, not a flattened one.

import { buildPedagogyV2Registry } from './registry.js'
import { BUILTIN_PEDAGOGY_V2_PACKS } from '../../content/pedagogy-v2/index.js'

const ID_FIELDS_SUFFIXABLE = true // documented below: exact-string id rewriting

/** Every entity id owned by a pack (the ids a clone must rename). */
function ownedIds(pack) {
  const ids = new Set()
  for (const l of pack.lexemes || []) ids.add(l.lexeme_id)
  for (const s of pack.senses || []) ids.add(s.sense_id)
  for (const c of pack.constructions || []) ids.add(c.construction_id)
  for (const f of pack.communicative_functions || []) ids.add(f.function_id)
  for (const e of pack.exemplars || []) ids.add(e.exemplar_id)
  return ids
}

/**
 * Deep-copy `node`, replacing any string that is EXACTLY an owned id with the
 * suffixed id. Exact-match only: prose (description_pt, exemplar text) never
 * contains a bare typed id, so no content is corrupted, and refs into packs
 * outside the generation are left alone by construction.
 */
function rewriteIds(node, owned, suffix) {
  if (typeof node === 'string') return owned.has(node) ? `${node}${suffix}` : node
  if (Array.isArray(node)) return node.map((n) => rewriteIds(n, owned, suffix))
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = rewriteIds(v, owned, suffix)
    return out
  }
  return node
}

/**
 * Clone the three builtin packs into generation `gen` (gen >= 1). Generation 0
 * is the real catalogue and is never cloned.
 */
function buildGeneration(gen) {
  const suffix = `_sg${gen}`
  const owned = new Set()
  for (const pack of BUILTIN_PEDAGOGY_V2_PACKS) for (const id of ownedIds(pack)) owned.add(id)
  // Lemma renames are GENERATION-wide, not pack-wide: an exemplar of the `but`
  // clone may declare a sense owned by the `still` clone, and its text must
  // contain that clone's lemma.
  const renamed = new Map()
  for (const pack of BUILTIN_PEDAGOGY_V2_PACKS) {
    for (const l of pack.lexemes || []) renamed.set(l.lemma, `${l.lemma}${gen}`)
  }
  return BUILTIN_PEDAGOGY_V2_PACKS.map((pack) => {
    const clone = rewriteIds(structuredClone(pack), owned, suffix)
    clone.manifest = {
      ...clone.manifest,
      pack_id: `${pack.manifest.pack_id}${suffix}`,
      // Declared cross-pack dependencies must point at the generation's own
      // clones, so the generation's dependency graph is closed exactly like the
      // real one (an undeclared cross-pack ref is a registry error).
      dependencies: (clone.manifest.dependencies || []).map((d) => ({ ...d, pack_id: `${d.pack_id}${suffix}` })),
      catalog_order: (pack.manifest.catalog_order ?? 0) + gen * 100,
      title: {
        pt: `${pack.manifest.title.pt} (sintético ${gen})`,
        en: `${pack.manifest.title.en} (synthetic ${gen})`,
      },
      notes: `SYNTHETIC SCALE CLONE (generation ${gen}) — harness only, never shipped.`,
    }
    // The registry requires one canonical lexeme per (lemma, language): a clone
    // is a DIFFERENT lexeme, so it carries a distinct lemma — and every
    // exemplar text must still contain it (EXEMPLAR_LEXEME_MISSING_FROM_TEXT).
    // The rename is whole-word and English-side only: the synthetic prose is
    // never shown to anyone, but it has to satisfy the same validator the real
    // packs do, or the harness would be measuring a weaker catalogue.
    clone.lexemes = (clone.lexemes || []).map((l) => ({ ...l, lemma: renamed.get(l.lemma), aliases: [] }))
    // The same rename has to reach the constructions' fixed elements and the
    // exemplar prose, or EXEMPLAR_FIXED_ELEMENT_MISSING fires. Case is
    // preserved so sentence-initial "Still," stays a complete sentence.
    const renameIn = (text) => {
      let out = text
      for (const [from, to] of renamed) {
        out = out.replace(new RegExp(`\\b${from}\\b`, 'gi'), (m) => (
          m[0] === m[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to
        ))
      }
      return out
    }
    clone.constructions = (clone.constructions || []).map((c) => ({
      ...c,
      fixed_elements: (c.fixed_elements || []).map((f) => renameIn(f)),
      pattern: renameIn(c.pattern),
    }))
    clone.exemplars = (clone.exemplars || []).map((e) => ({ ...e, text_en: renameIn(e.text_en) }))
    return clone
  })
}

/**
 * A validated registry with `packCount` packs (a multiple of 3). packCount === 3
 * returns exactly the real builtin catalogue, so the 3-pack row of the scale
 * curve is the product baseline, not an approximation of it.
 */
export function buildSyntheticScaleRegistryV2(packCount) {
  const real = BUILTIN_PEDAGOGY_V2_PACKS.length
  if (!Number.isInteger(packCount) || packCount < real || packCount % real !== 0) {
    throw new Error(`SYNTHETIC_SCALE_PACK_COUNT_INVALID:${packCount}`)
  }
  const packs = [...BUILTIN_PEDAGOGY_V2_PACKS]
  for (let gen = 1; gen < packCount / real; gen++) packs.push(...buildGeneration(gen))
  return buildPedagogyV2Registry(packs)
}

/** The scale points the audit and the regression both use (§3/§11). */
export const SYNTHETIC_SCALE_PACK_COUNTS = [3, 6, 9, 12]

export { ID_FIELDS_SUFFIXABLE }
