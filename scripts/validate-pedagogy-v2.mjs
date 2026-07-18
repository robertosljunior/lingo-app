// validate-pedagogy-v2.mjs — validates every pedagogical_v2 pack under
// src/content/pedagogy-v2/ AND the multi-pack registry built from them
// (Slice V2.5): per-pack structure, global ID ownership, declared pack
// dependencies and every cross-pack reference. Read-only: reports errors with
// file path and logical location, exits non-zero on any failure. Mirrors the
// conventions of validate-knowledge-packs.mjs without touching V1 commands.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validatePedagogyV2Registry } from '../src/lib/pedagogy-v2/validator.js'
import { auditRecognitionOptionsV2 } from '../src/lib/pedagogy-v2/options-audit.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/content/pedagogy-v2')
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()

if (!files.length) {
  console.error(`No pedagogy-v2 packs found in ${dir}`)
  process.exit(1)
}

const packs = []
let parseFailures = 0
for (const f of files) {
  const path = join(dir, f)
  try {
    packs.push({ file: f, pack: JSON.parse(readFileSync(path, 'utf8')) })
  } catch (e) {
    parseFailures++
    console.error(`✗ ${path}: JSON parse error — ${e.message}`)
  }
}

// Registry validation covers each pack individually (same per-pack validator),
// the registry as a whole and every cross-pack reference.
const result = validatePedagogyV2Registry(packs.map((p) => p.pack))
const fileByPackId = new Map(packs.map((p) => [p.pack?.pack?.manifest?.pack_id ?? p.pack?.manifest?.pack_id, p.file]))
console.table(result.packs.map((r) => ({
  file: fileByPackId.get(r.pack_id) || '?',
  pack_id: r.pack_id,
  valid: r.valid,
  cross_pack_refs: (r.external_refs || []).length,
  ...r.counts,
})))

let errorCount = parseFailures
for (const err of result.errors) {
  errorCount++
  console.error(`✗ ${err}`)
}

// Structural audit of authored recognition alternatives (Slice V2.5 §21):
// reported as warnings — the runtime already degrades safely (no_safe_options
// → other exemplar/recipe → no_eligible_activity), options are never invented.
for (const { file, pack } of packs) {
  const audit = auditRecognitionOptionsV2(pack)
  for (const f of audit.findings) {
    console.warn(`⚠ ${join(dir, file)}: ${JSON.stringify(f)}`)
  }
}

if (errorCount) {
  console.error(`\n${errorCount} pedagogy-v2 validation error(s).`)
  process.exit(1)
}
console.log('\nAll pedagogy-v2 packs and the registry are valid.')
