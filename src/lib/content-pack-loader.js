// content-pack-loader.js — loads the builtin (bundled) content pack JSON
// files. The JSON under src/content/packs is the canonical source of the
// linguistic content; JS only carries engines and registries.

// import.meta.glob is compiled away by Vite/Vitest; plain node consumers
// (benchmark, quality gate scripts) inject packs via setBundledPacksForNode.
let modules = {}
try {
  modules = import.meta.glob('../content/packs/**/*.json', { eager: true })
} catch {
  modules = {}
}

let injected = null
export function setBundledPacksForNode(packs) { injected = packs }

export function loadBuiltinContentPacks() {
  const packs = injected || Object.values(modules).map((m) => m.default || m)
  return packs.sort((a, b) => {
    // Cores first so dependency validation sees them as installed.
    const coreA = a.manifest.theme === 'core' ? 0 : 1
    const coreB = b.manifest.theme === 'core' ? 0 : 1
    return coreA - coreB || a.manifest.pack_id.localeCompare(b.manifest.pack_id)
  })
}

export function builtinPackIds() {
  return loadBuiltinContentPacks().map((p) => p.manifest.pack_id)
}

// Composes a generator-ready snapshot straight from bundled packs (no
// IndexedDB) — used by data tests and offline tooling. App code goes through
// content-pack-repository.resolveContentSnapshot instead.
export function composeBundledSnapshot(theme, level) {
  const packs = loadBuiltinContentPacks().filter((p) =>
    (p.manifest.theme === theme && p.manifest.level === level)
    || p.manifest.pack_id === `core_${level.toLowerCase()}`)
  const pack_ids = packs.map((p) => p.manifest.pack_id)
  const pack_versions = Object.fromEntries(packs.map((p) => [p.manifest.pack_id, p.manifest.version]))
  const s = pack_ids.join('|')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return {
    pack_ids, pack_versions,
    checksum: (h >>> 0).toString(16).padStart(8, '0'),
    theme, level, content_schema_version: '1',
    lexical_items: packs.flatMap((p) => p.lexical_items.map((x) => ({ ...x, pack_id: p.manifest.pack_id }))),
    template_definitions: packs.flatMap((p) => p.template_definitions.map((x) => ({ ...x, pack_id: p.manifest.pack_id }))),
    collocations: packs.flatMap((p) => p.collocations.map((x) => ({ ...x, pack_id: p.manifest.pack_id }))),
  }
}
