// index.js — builtin pedagogical_v2 content packs (the "content_v2" namespace).
// Pure data, bundled with the app, fully offline. Deliberately SEPARATE from
// src/content/packs/ (V1 theme×level packs) and src/content/knowledge-packs/
// (semantic_knowledge packs consumed by the analysis engine): pedagogical_v2
// packs describe lexemes, senses, constructions, communicative functions and
// exemplar sentences for the V2 pedagogical core.
//
// Nothing in the frozen V1 core (lesson-generator, correction-engine, skill
// registry, generated-lesson contracts) imports from here.

import pedagogy_v2_still from './still.json'

export const BUILTIN_PEDAGOGY_V2_PACKS = [
  pedagogy_v2_still,
]

export function pedagogyV2PackById(id) {
  return BUILTIN_PEDAGOGY_V2_PACKS.find((p) => p.manifest.pack_id === id) || null
}
