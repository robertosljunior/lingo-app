// build-knowledge-catalog.mjs — produces the versioned catalog + per-pack assets
// intended for GitHub Releases (NOT a mutable branch). Each catalog entry pins a
// SHA-256 so the client can verify integrity before install.
//
//   node scripts/build-knowledge-catalog.mjs [outDir]
//
// Output:
//   <outDir>/catalog-v1.json
//   <outDir>/<pack_id>-v<version>.json   (copies of the source packs)

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src/content/knowledge-packs')
const outDir = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(root, 'dist/knowledge-catalog')
mkdirSync(outDir, { recursive: true })

const RELEASE_BASE = 'https://github.com/robertosljunior/lingo-app/releases/download/knowledge-v1'

const packs = readdirSync(src).filter((f) => f.endsWith('.json'))
const entries = []
for (const file of packs) {
  const bytes = readFileSync(join(src, file))
  const pack = JSON.parse(bytes)
  const m = pack.manifest
  const assetName = `${m.pack_id}-v${m.version}.json`
  writeFileSync(join(outDir, assetName), bytes)
  entries.push({
    pack_id: m.pack_id,
    version: m.version,
    title_pt: m.title?.pt || m.pack_id,
    levels: m.levels,
    asset_url: `${RELEASE_BASE}/${assetName}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size_bytes: bytes.byteLength,
    dependencies: m.dependencies || [],
    min_app_version: m.min_app_version || '1.0.0',
    schema_version: m.schema_version,
    coverage: pack.coverage || null,
  })
}

const catalog = { catalog_version: 1, generated_at: new Date().toISOString(), packs: entries }
writeFileSync(join(outDir, 'catalog-v1.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log(`Wrote catalog with ${entries.length} packs to ${outDir}`)
