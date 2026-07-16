// validate-pedagogy-v2.mjs — validates every pedagogical_v2 pack under
// src/content/pedagogy-v2/. Read-only: reports errors with file path and
// logical location, exits non-zero on any failure. Mirrors the conventions of
// validate-knowledge-packs.mjs without touching V1 commands.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validatePedagogyV2Packs } from '../src/lib/pedagogy-v2/validator.js'

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

const result = validatePedagogyV2Packs(packs.map((p) => p.pack))
console.table(result.packs.map((r, i) => ({ file: packs[i]?.file, pack_id: r.pack_id, valid: r.valid, ...r.counts })))

let errorCount = parseFailures
result.packs.forEach((r, i) => {
  for (const err of r.errors) {
    errorCount++
    console.error(`✗ ${join(dir, packs[i]?.file || '?')}\n    ${err}`)
  }
})

if (errorCount) {
  console.error(`\n${errorCount} pedagogy-v2 validation error(s).`)
  process.exit(1)
}
console.log('\nAll pedagogy-v2 packs valid.')
