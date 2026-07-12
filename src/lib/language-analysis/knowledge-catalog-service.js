// knowledge-catalog-service.js — orchestrates the download → verify → install
// lifecycle for semantic knowledge packs, and produces the overview the Settings
// UI renders. All network access goes through the guarded, allowlisted,
// checksum-verifying path in pack-catalog.js; remote content is never executed.

import { BUILTIN_KNOWLEDGE_PACKS } from '../../content/knowledge-packs/index.js'
import { fetchGuarded, verifyDownloadedPack, isAllowlistedUrl } from './pack-catalog.js'
import { installKnowledgePack, removeKnowledgePack, listInstalledPacks } from './knowledge-pack-store.js'

const APP_VERSION = '1.0.0'
// Production catalog lives on a versioned GitHub Release (allowlisted), never a
// mutable branch. Overridable for local/E2E servers.
export const DEFAULT_CATALOG_URL =
  'https://github.com/robertosljunior/lingo-app/releases/download/knowledge-v1/catalog-v1.json'

function builtinOverview() {
  return BUILTIN_KNOWLEDGE_PACKS.map((p) => ({
    pack_id: p.manifest.pack_id,
    title_pt: p.manifest.title?.pt || p.manifest.pack_id,
    levels: p.manifest.levels,
    version: p.manifest.version,
    coverage: p.coverage || null,
    dependencies: p.manifest.dependencies || [],
    status: 'installed',
    source: 'builtin',
    installed_at: null,
  }))
}

/** Combined overview: builtin packs plus any packs installed from the catalog. */
export async function getKnowledgeOverview({ dbFactory } = {}) {
  const builtin = builtinOverview()
  const installed = await listInstalledPacks(dbFactory ? { dbFactory } : {})
  const byId = new Map(builtin.map((p) => [p.pack_id, p]))
  for (const row of installed) {
    byId.set(row.pack_id, {
      pack_id: row.pack_id,
      title_pt: row.pack?.manifest?.title?.pt || row.pack_id,
      levels: row.pack?.manifest?.levels || [],
      version: row.version,
      coverage: row.coverage || null,
      dependencies: row.pack?.manifest?.dependencies || [],
      status: 'installed',
      source: row.source,
      installed_at: row.installed_at,
    })
  }
  return [...byId.values()].sort((a, b) => a.pack_id.localeCompare(b.pack_id))
}

/** Fetch + validate the remote catalog (guarded). Returns { ok, packs } or error. */
export async function fetchCatalog({ url = DEFAULT_CATALOG_URL, fetchImpl } = {}) {
  if (!isAllowlistedUrl(url)) return { ok: false, code: 'URL_NOT_ALLOWLISTED' }
  const res = await fetchGuarded(url, fetchImpl ? { fetchImpl } : {})
  if (!res.ok) return { ok: false, code: res.code }
  let catalog
  try { catalog = JSON.parse(new TextDecoder().decode(res.bytes)) } catch { return { ok: false, code: 'INVALID_JSON' } }
  if (!Array.isArray(catalog?.packs)) return { ok: false, code: 'INVALID_CATALOG' }
  return { ok: true, catalog }
}

/**
 * Download, verify (allowlist + HTTPS + size + checksum + schema + compat) and
 * transactionally install a pack from a catalog entry. Never executes content.
 * @returns {{ ok, code?, pack_id? }}
 */
export async function installFromCatalogEntry(entry, { fetchImpl, dbFactory, onProgress } = {}) {
  const step = (s) => { if (typeof onProgress === 'function') onProgress(s) }
  if (!entry?.asset_url) return { ok: false, code: 'NO_ASSET_URL' }
  if (!isAllowlistedUrl(entry.asset_url)) return { ok: false, code: 'URL_NOT_ALLOWLISTED' }
  step('downloading')
  const res = await fetchGuarded(entry.asset_url, fetchImpl ? { fetchImpl } : {})
  if (!res.ok) return { ok: false, code: res.code }
  step('validating')
  const verified = await verifyDownloadedPack({ bytes: res.bytes, catalogEntry: entry, appVersion: APP_VERSION })
  if (!verified.ok) return { ok: false, code: verified.code, validation: verified.validation }
  step('installing')
  const installed = await installKnowledgePack(verified.pack, { source: 'remote', ...(dbFactory ? { dbFactory } : {}) })
  return installed
}

export async function removeInstalledPack(pack_id, opts = {}) {
  return removeKnowledgePack(pack_id, opts)
}

/** Compare catalog against installed to derive per-pack UI state. */
export function deriveCatalogState(catalogPacks, overview) {
  const installed = new Map(overview.map((p) => [p.pack_id, p]))
  return catalogPacks.map((entry) => {
    const local = installed.get(entry.pack_id)
    let state = 'available'
    if (local) state = local.version >= entry.version ? 'installed' : 'update_available'
    return { ...entry, state, installed_version: local?.version || null, installed_source: local?.source || null }
  })
}
