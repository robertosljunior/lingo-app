import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validateKnowledgePacks } from '../src/lib/language-analysis/knowledge-pack-validator.js'
import { analyzeUserProduction } from '../src/lib/language-analysis/language-analysis-orchestrator.js'
import { KnowledgeBase } from '../src/lib/language-analysis/knowledge-base.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/content/knowledge-packs')
const packs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))

const result = validateKnowledgePacks(packs)
console.table(result.packs.map((p) => ({ pack_id: p.pack_id, valid: p.valid, ...p.counts })))
if (!result.valid) { console.error('SCHEMA ERRORS:\n' + result.errors.join('\n')); process.exit(1) }

// Run every pack's golden_tests through the real orchestrator.
const kb = new KnowledgeBase(packs)
const snapshot = { knowledgePacks: packs }
let failures = 0
for (const pack of packs) {
  for (const g of pack.golden_tests || []) {
    const r = await analyzeUserProduction({
      text: g.input, assessmentMode: g.mode || 'free', requestedIntent: g.requestedIntent || null,
      equivalentTarget: g.equivalentTarget || null, level: g.level || 'A1', contentSnapshot: snapshot,
      engines: { knowledgeBase: kb },
    })
    const problems = []
    if (g.expect.verdict && r.verdict !== g.expect.verdict) problems.push(`verdict ${r.verdict} != ${g.expect.verdict}`)
    if (g.expect.no_corrected_version && r.corrected_version) problems.push(`unexpected correction: ${r.corrected_version}`)
    if (g.expect.no_high_severity && r.detected_errors.some((e) => e.severity === 'high' || e.severity === 'critical')) problems.push('unexpected high-severity error')
    if (g.expect.intent && !r.detected_intents.includes(g.expect.intent)) problems.push(`missing intent ${g.expect.intent}`)
    if (g.expect.suggests && !r.natural_alternatives.some((a) => a.text === g.expect.suggests)) problems.push(`missing suggestion "${g.expect.suggests}"`)
    if (problems.length) { failures++; console.error(`✗ [${pack.manifest.pack_id}] "${g.input}": ${problems.join('; ')}`) }
  }
}
if (failures) { console.error(`\n${failures} golden failure(s)`); process.exit(1) }
console.log('\nAll knowledge-pack goldens passed.')
