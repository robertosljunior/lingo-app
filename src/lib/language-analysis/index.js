// index.js — public surface for the local semantic tutor engine. Screens import
// from here only; they never touch wink/compromise/Harper/USE directly.

import { analyzeUserProduction } from './language-analysis-orchestrator.js'
import { KnowledgeBase } from './knowledge-base.js'
import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'
import { getActiveKnowledgePacks } from './knowledge-pack-store.js'

export { analyzeUserProduction } from './language-analysis-orchestrator.js'
export { createGrammarChecker } from './grammar-checker-adapter.js'
export { createStructuralNlp } from './structural-nlp-adapter.js'
export { createSemanticEncoder } from './semantic-encoder-adapter.js'
export { KnowledgeBase } from './knowledge-base.js'
export {
  installKnowledgePack, removeKnowledgePack, listInstalledPacks,
} from './knowledge-pack-store.js'

let _kbCache = null
let _kbSignature = ''

/**
 * Build a KnowledgeBase from builtin packs plus any packs installed in IndexedDB.
 * Cached until the installed set changes. Works fully offline.
 */
export async function loadKnowledgeBase({ includeInstalled = true } = {}) {
  let installed = []
  if (includeInstalled) {
    try { installed = await getActiveKnowledgePacks() } catch { installed = [] }
  }
  const packs = mergePacks(BUILTIN_KNOWLEDGE_PACKS, installed)
  const signature = packs.map((p) => `${p.manifest.pack_id}@${p.manifest.version}`).sort().join(',')
  if (_kbCache && signature === _kbSignature) return _kbCache
  _kbCache = new KnowledgeBase(packs)
  _kbSignature = signature
  return _kbCache
}

function mergePacks(builtin, installed) {
  const byId = new Map(builtin.map((p) => [p.manifest.pack_id, p]))
  for (const p of installed) byId.set(p.manifest.pack_id, p) // installed/newer wins
  return [...byId.values()]
}

/**
 * Convenience for screens: analyze a learner's production with the current
 * knowledge base and adapters. `engines` may inject Harper/USE loaders.
 */
export async function analyzeProduction(params) {
  const knowledgeBase = params.engines?.knowledgeBase || await loadKnowledgeBase()
  return analyzeUserProduction({ ...params, engines: { ...params.engines, knowledgeBase } })
}
