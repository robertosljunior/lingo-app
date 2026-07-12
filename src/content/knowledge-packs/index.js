// index.js — builtin semantic_knowledge packs bundled with the app. These load
// offline with no network. Additional packs can be installed at runtime from the
// GitHub catalog (see pack-catalog.js) and merged with these.

import semantic_do from './semantic-do.json'
import semantic_at from './semantic-at.json'
import semantic_in from './semantic-in.json'
import semantic_on from './semantic-on.json'
import semantic_be from './semantic-be.json'
import semantic_have from './semantic-have.json'
import semantic_at_in_on_contrasts from './semantic-at-in-on-contrasts.json'
import semantic_requests from './semantic-requests.json'

export const BUILTIN_KNOWLEDGE_PACKS = [
  semantic_do,
  semantic_at,
  semantic_in,
  semantic_on,
  semantic_be,
  semantic_have,
  semantic_at_in_on_contrasts,
  semantic_requests,
]

export function knowledgePackById(id) {
  return BUILTIN_KNOWLEDGE_PACKS.find((p) => p.manifest.pack_id === id) || null
}
