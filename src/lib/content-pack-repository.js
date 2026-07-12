// content-pack-repository.js — the app-facing API over the content pack
// stores: idempotent builtin seeding, enable/disable, restore, and the
// immutable content snapshot the lesson generator consumes.

import * as store from './storage.js'
import { loadBuiltinContentPacks } from './content-pack-loader.js'
import { validateContentPack, contentPackChecksum, CONTENT_SCHEMA_VERSION } from './content-pack-validator.js'
import { LESSON_GENERATOR_VERSION } from './lesson-generator.js'

export const CONTENT_SEED_VERSION = '1'

export const THEMES = [
  { theme: 'daily_life', label_pt: 'Vida cotidiana' },
  { theme: 'workplace', label_pt: 'Trabalho' },
  { theme: 'travel', label_pt: 'Viagens' },
  { theme: 'food_and_restaurants', label_pt: 'Comida e restaurantes' },
  { theme: 'shopping_and_services', label_pt: 'Compras e serviços' },
  { theme: 'technology_and_communication', label_pt: 'Tecnologia e comunicação' },
]
export const LEVELS = ['A1', 'A2', 'B1', 'B2']

function versionInRange(gc) {
  return String(gc.min_version) <= LESSON_GENERATOR_VERSION && LESSON_GENERATOR_VERSION <= String(gc.max_version)
}

function packRecordFrom(pack, checksum, counts, { enabled }) {
  const m = pack.manifest
  return {
    pack_id: m.pack_id,
    schema_version: m.schema_version,
    title_pt: m.title.pt,
    title_en: m.title.en,
    theme: m.theme,
    level: m.level,
    language_pair: m.language_pair,
    version: m.version,
    source: m.source || 'builtin',
    enabled,
    dependencies: m.dependencies || [],
    generator_min_version: m.generator_compatibility.min_version,
    generator_max_version: m.generator_compatibility.max_version,
    checksum,
    lexical_item_count: counts.lexical_items,
    template_count: counts.template_definitions,
    collocation_count: counts.collocations,
  }
}

// Idempotent builtin seed. Installs new packs, upgrades builtin packs whose
// version/checksum changed, never touches custom/imported packs, and skips
// entirely when the stored seed signature matches the bundle.
export async function seedBuiltinContentPacks({ force = false } = {}) {
  const bundled = loadBuiltinContentPacks()
  const bundleSignature = `${CONTENT_SEED_VERSION}:${bundled.map((p) => `${p.manifest.pack_id}@${p.manifest.version}:${contentPackChecksum(p)}`).join('|')}`
  const settings = await store.getSettings()
  if (!force && settings.content_seed_signature === bundleSignature) {
    return { installed: 0, updated: 0, skipped: bundled.length, invalid: [] }
  }

  const knownPacks = bundled.map((p) => p.manifest.pack_id)
  const result = { installed: 0, updated: 0, skipped: 0, invalid: [] }
  for (const pack of bundled) {
    const validation = validateContentPack(pack, { knownPacks })
    if (!validation.valid) {
      result.invalid.push({ pack_id: pack.manifest?.pack_id, errors: validation.errors })
      continue
    }
    if (!versionInRange(pack.manifest.generator_compatibility)) {
      result.invalid.push({ pack_id: pack.manifest.pack_id, errors: [{ code: 'GENERATOR_INCOMPATIBLE' }] })
      continue
    }
    const checksum = contentPackChecksum(pack)
    const existing = await store.getContentPackRecord(pack.manifest.pack_id)
    if (existing && existing.source !== 'builtin') { result.skipped++; continue } // never clobber custom/imported
    if (existing && existing.version === pack.manifest.version && existing.checksum === checksum) { result.skipped++; continue }
    const enabled = existing ? existing.enabled : pack.manifest.enabled_by_default !== false
    await store.installContentPack({
      record: packRecordFrom(pack, checksum, validation.counts, { enabled }),
      lexical_items: pack.lexical_items,
      template_definitions: pack.template_definitions,
      collocations: pack.collocations,
    })
    if (existing) result.updated++; else result.installed++
  }
  if (!result.invalid.length) await store.setSetting('content_seed_signature', bundleSignature)
  return result
}

export async function getContentPack(packId) {
  return store.getContentPackRecord(packId)
}

export async function getEnabledContentPacks() {
  return (await store.getAllContentPackRecords()).filter((p) => p.enabled)
}

export async function getAllContentPacks() {
  return store.getAllContentPackRecords()
}

export async function getContentPacksByThemeAndLevel(theme, level) {
  return store.getContentPackRecordsByThemeAndLevel(theme, level)
}

export const getLexicalItemsForPacks = (packIds) => store.getLexicalItemsForPackIds(packIds)
export const getTemplatesForPacks = (packIds) => store.getTemplatesForPackIds(packIds)
export const getCollocationsForPacks = (packIds) => store.getCollocationsForPackIds(packIds)

export async function enableContentPack(packId) {
  return store.setContentPackEnabled(packId, true)
}

export async function disableContentPack(packId) {
  return store.setContentPackEnabled(packId, false)
}

// Reinstall a builtin pack from the bundle (recovers content, keeps enabled
// state). Only valid for packs shipped in the app bundle.
export async function restoreBuiltinContentPack(packId) {
  const pack = loadBuiltinContentPacks().find((p) => p.manifest.pack_id === packId)
  if (!pack) throw new Error(`Pack builtin desconhecido: ${packId}`)
  const validation = validateContentPack(pack)
  if (!validation.valid) throw new Error(`Pack builtin inválido: ${packId}`)
  const existing = await store.getContentPackRecord(packId)
  await store.installContentPack({
    record: packRecordFrom(pack, contentPackChecksum(pack), validation.counts, { enabled: existing?.enabled ?? true }),
    lexical_items: pack.lexical_items,
    template_definitions: pack.template_definitions,
    collocations: pack.collocations,
  })
  return store.getContentPackRecord(packId)
}

export class ContentDependencyError extends Error {
  constructor(packId, missing) {
    super(`Dependência ausente para ${packId}: ${missing.join(', ')}`)
    this.name = 'ContentDependencyError'
    this.code = 'CONTENT_DEPENDENCY_MISSING'
    this.pack_id = packId
    this.missing = missing
  }
}

// Resolves the frozen content snapshot for a generation run. Either pass
// explicit packIds, or theme+level (the matching theme pack plus its core
// dependency). The result is deep-frozen so generation cannot mutate content.
export async function resolveContentSnapshot({ theme, level, packIds } = {}) {
  let ids = packIds
  if (!ids) {
    const themePacks = await getContentPacksByThemeAndLevel(theme, level)
    ids = themePacks.filter((p) => p.enabled).map((p) => p.pack_id)
    if (!ids.length) throw new ContentDependencyError(`${theme}_${String(level).toLowerCase()}`, [`${theme}_${String(level).toLowerCase()}`])
  }
  const packs = []
  for (const id of ids) {
    const rec = await store.getContentPackRecord(id)
    if (!rec) throw new ContentDependencyError(id, [id])
    packs.push(rec)
  }
  // Pull in dependencies (cores) and verify they are installed and enabled.
  const byId = new Map(packs.map((p) => [p.pack_id, p]))
  for (const p of [...packs]) {
    const missing = []
    for (const dep of p.dependencies || []) {
      if (byId.has(dep)) continue
      const rec = await store.getContentPackRecord(dep)
      if (!rec || !rec.enabled) { missing.push(dep); continue }
      byId.set(dep, rec)
      packs.push(rec)
    }
    if (missing.length) throw new ContentDependencyError(p.pack_id, missing)
  }
  for (const p of packs) {
    if (!(String(p.generator_min_version) <= LESSON_GENERATOR_VERSION && LESSON_GENERATOR_VERSION <= String(p.generator_max_version))) {
      throw new ContentDependencyError(p.pack_id, [`generator:${LESSON_GENERATOR_VERSION}`])
    }
  }
  const ordered = [...byId.values()].sort((a, b) => (a.theme === 'core' ? 0 : 1) - (b.theme === 'core' ? 0 : 1) || a.pack_id.localeCompare(b.pack_id))
  const orderedIds = ordered.map((p) => p.pack_id)
  const [lexical_items, template_definitions, collocations] = await Promise.all([
    store.getLexicalItemsForPackIds(orderedIds),
    store.getTemplatesForPackIds(orderedIds),
    store.getCollocationsForPackIds(orderedIds),
  ])
  const pack_versions = Object.fromEntries(ordered.map((p) => [p.pack_id, p.version]))
  const checksum = snapshotChecksum(ordered)
  const snapshot = {
    pack_ids: orderedIds,
    pack_versions,
    checksum,
    theme: theme || ordered.find((p) => p.theme !== 'core')?.theme || 'core',
    level: level || ordered[0]?.level,
    content_schema_version: CONTENT_SCHEMA_VERSION,
    lexical_items,
    template_definitions: template_definitions.filter((t) => t.enabled !== false),
    collocations,
  }
  return deepFreeze(snapshot)
}

function snapshotChecksum(packRecords) {
  const s = packRecords.map((p) => `${p.pack_id}@${p.version}:${p.checksum}`).join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj)
    for (const v of Object.values(obj)) deepFreeze(v)
  }
  return obj
}

export { validateContentPack, contentPackChecksum }
