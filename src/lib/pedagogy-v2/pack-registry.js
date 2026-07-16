// pack-registry.js — minimal loader for builtin pedagogical_v2 packs: validates
// once, deep-freezes, caches. Future slices may add runtime-installed packs
// behind the same surface (mirroring knowledge-pack-store.js); this slice only
// needs the builtin set.

import { BUILTIN_PEDAGOGY_V2_PACKS } from '../../content/pedagogy-v2/index.js'
import { validatePedagogyV2Packs } from './validator.js'

let _cache = null

function deepFreeze(node) {
  if (node && typeof node === 'object' && !Object.isFrozen(node)) {
    Object.freeze(node)
    for (const v of Object.values(node)) deepFreeze(v)
  }
  return node
}

/**
 * Validated, frozen builtin pedagogy-v2 packs. Throws on an invalid builtin
 * pack — shipping broken curriculum data is a build defect, not a runtime
 * condition to degrade around.
 */
export function loadBuiltinPedagogyV2Packs() {
  if (_cache) return _cache
  const result = validatePedagogyV2Packs(BUILTIN_PEDAGOGY_V2_PACKS)
  if (!result.valid) throw new Error(`PEDAGOGY_V2_PACKS_INVALID:${result.errors.join(',')}`)
  _cache = BUILTIN_PEDAGOGY_V2_PACKS.map((p) => deepFreeze(structuredClone(p)))
  return _cache
}

export function getPedagogyV2Pack(packId) {
  return loadBuiltinPedagogyV2Packs().find((p) => p.manifest.pack_id === packId) || null
}

export function listPedagogyV2Packs() {
  return loadBuiltinPedagogyV2Packs().map((p) => ({
    pack_id: p.manifest.pack_id,
    title: p.manifest.title,
    version: p.manifest.version,
    counts: {
      lexemes: p.lexemes?.length || 0,
      senses: p.senses?.length || 0,
      constructions: p.constructions?.length || 0,
      communicative_functions: p.communicative_functions?.length || 0,
      exemplars: p.exemplars?.length || 0,
    },
  }))
}

export function __resetPedagogyV2RegistryForTests() {
  _cache = null
}
