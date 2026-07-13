// index.js — public surface for the local semantic tutor engine. Screens import
// from here only; they never touch wink/compromise/Harper/USE directly.

import { analyzeUserProduction } from './language-analysis-orchestrator.js'
import { KnowledgeBase } from './knowledge-base.js'
import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'
import { getActiveKnowledgePacks } from './knowledge-pack-store.js'
import { createGrammarChecker, createProductionHarperLoader } from './grammar-checker-adapter.js'
import { createStructuralNlp } from './structural-nlp-adapter.js'
import { ResilientSemanticEncoder, createProductionUseLoader } from './semantic-encoder-adapter.js'

export { analyzeUserProduction } from './language-analysis-orchestrator.js'
export { createGrammarChecker, createProductionHarperLoader } from './grammar-checker-adapter.js'
export { createStructuralNlp } from './structural-nlp-adapter.js'
export { createSemanticEncoder, createProductionUseLoader, ResilientSemanticEncoder } from './semantic-encoder-adapter.js'
export { resolveAssessmentMode, usesSemanticPipeline, toExerciseAnalysis, essentialWords } from './exercise-bridge.js'
export { KnowledgeBase } from './knowledge-base.js'
export {
  installKnowledgePack, removeKnowledgePack, listInstalledPacks,
} from './knowledge-pack-store.js'
export { getDefaultModelEntry, SEMANTIC_MODEL_CATALOG } from './semantic-model-catalog.js'
export { installModel, removeModel, getInstalledModel } from './semantic-model-store.js'

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

// Cache production engine singletons so heavy setup (Harper WASM, USE model)
// happens once and instances warm across questions.
let _grammar = null
let _structural = null
let _semantic = null
let _semanticSignature = ''

function baseEngines() {
  if (!_grammar) _grammar = createGrammarChecker({ harperLoader: createProductionHarperLoader() })
  if (!_structural) _structural = createStructuralNlp({ primary: 'heuristic' })
  return { grammarChecker: _grammar, structuralNlp: _structural }
}

/**
 * Choose the semantic encoder from the CURRENT install state: a USE-backed
 * ResilientSemanticEncoder when a model is installed (loaded from local bytes),
 * hashing otherwise. Rebuilt only when the installed model changes, so the loaded
 * USE model stays warm across questions. Falls back to hashing if the store can't
 * be read (e.g. no IndexedDB) — correctness never depends on the model.
 */
async function resolveSemanticEncoder() {
  let installed = null
  try {
    const { getInstalledModel } = await import('./semantic-model-store.js')
    installed = await getInstalledModel()
  } catch { installed = null }
  const signature = installed ? `${installed.model_id}@${installed.version}` : 'hashing'
  if (_semantic && signature === _semanticSignature) return _semantic
  const useLoader = installed ? createProductionUseLoader({ modelId: installed.model_id }) : null
  _semantic = new ResilientSemanticEncoder({ useLoader })
  _semanticSignature = signature
  return _semantic
}

/** Reset the cached semantic encoder (call after install/remove so the next
 * analysis rebinds to the new model state). */
export function resetSemanticEncoder() { _semantic = null; _semanticSignature = '' }

/**
 * Convenience for screens: analyze a learner's production with the current
 * knowledge base and production adapters (real Harper; real USE when installed,
 * hashing fallback otherwise — always reported in `result.engines`).
 */
export async function analyzeProduction(params) {
  const knowledgeBase = params.engines?.knowledgeBase || await loadKnowledgeBase()
  const semanticEncoder = params.engines?.semanticEncoder || await resolveSemanticEncoder()
  const engines = { ...baseEngines(), semanticEncoder, ...params.engines, knowledgeBase }
  return analyzeUserProduction({ ...params, engines })
}

/** Report the effective semantic engine for the current install state (UI copy). */
export async function getSemanticEngineStatus() {
  const enc = await resolveSemanticEncoder()
  try { await enc.embed(['warm']) } catch { /* report reflects the attempt */ }
  return typeof enc.report === 'function' ? enc.report() : { requested_engine: 'hashing', effective_engine: 'hashing', fallback_used: false, fallback_reason: null }
}
