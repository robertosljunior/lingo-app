// inspect-pedagogy-v2.mjs — READ-ONLY authoring inspection of the pedagogy-v2
// registry (Slice V2.5). Prints a deterministic report: packs, dependencies,
// lexemes, senses, constructions, functions, exemplars, progression,
// cross-pack references, unused ids, targets without exemplars, functions
// without constructions, constructions without progression, per-exemplar
// novelty budget and the recognition-alternatives audit.
//
// Never modifies any file. Output ordering is fully canonical (sorted ids,
// no timestamps) so two runs over the same content are byte-identical.

// Slice V2.6 additions: Study-Planner relation roles, curricular entry-path /
// reachability analysis, structurally impossible recognition targets and an
// OPTIONAL simulated review queue over a caller-provided fixture
// (`--fixture <path>` with { now, learner_states, recent_evidence }). The
// default mode stays purely structural and never depends on real user data.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validatePedagogyV2Registry } from '../src/lib/pedagogy-v2/validator.js'
import { EXPOSURE_STAGES, stageIndex } from '../src/lib/pedagogy-v2/contracts.js'
import { auditRecognitionOptionsV2 } from '../src/lib/pedagogy-v2/options-audit.js'
import { buildPedagogyV2Registry } from '../src/lib/pedagogy-v2/registry.js'
import { buildReviewQueueV2 } from '../src/lib/pedagogy-v2/review-queue.js'
import { RELATION_PLANNER_POLICY } from '../src/lib/pedagogy-v2/study-planner-contracts.js'
import { buildRecognitionOptionsV2 } from '../src/lib/pedagogy-v2/lesson-engine.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/content/pedagogy-v2')
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
const packs = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))

const result = validatePedagogyV2Registry(packs)
if (!result.valid) {
  console.error('Registry INVALID — fix validation errors before inspecting:')
  for (const e of result.errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}

const sortedPacks = [...packs].sort((a, b) => (a.manifest.pack_id < b.manifest.pack_id ? -1 : 1))
const byId = new Map()
for (const p of sortedPacks) {
  for (const l of p.lexemes || []) byId.set(l.lexeme_id, { pack: p.manifest.pack_id, kind: 'lexeme', entity: l })
  for (const s of p.senses || []) byId.set(s.sense_id, { pack: p.manifest.pack_id, kind: 'sense', entity: s })
  for (const c of p.constructions || []) byId.set(c.construction_id, { pack: p.manifest.pack_id, kind: 'construction', entity: c })
  for (const f of p.communicative_functions || []) byId.set(f.function_id, { pack: p.manifest.pack_id, kind: 'communicative_function', entity: f })
  for (const e of p.exemplars || []) byId.set(e.exemplar_id, { pack: p.manifest.pack_id, kind: 'exemplar', entity: e })
}

const lines = []
const say = (s = '') => lines.push(s)

say('PEDAGOGY V2 — registry inspection (read-only)')
say('='.repeat(60))

// ---- packs + dependencies ----
say()
say(`Packs (${sortedPacks.length}):`)
for (const p of sortedPacks) {
  const m = p.manifest
  say(`  ${m.pack_id} v${m.version} (schema ${m.schema_version}) — primary ${m.primary_lexeme_id}`)
  say(`    ${p.lexemes?.length || 0} lexemes · ${p.senses?.length || 0} senses · ${p.constructions?.length || 0} constructions · ${p.communicative_functions?.length || 0} functions · ${p.exemplars?.length || 0} exemplars · ${p.relations?.length || 0} relations`)
  for (const d of m.dependencies || []) {
    say(`    depends on ${d.pack_id} (schema ${d.required_schema_version}): ${d.reason}`)
  }
}

// ---- lexemes ----
say()
say('Lexemes:')
for (const p of sortedPacks) {
  for (const l of [...(p.lexemes || [])].sort((a, b) => (a.lexeme_id < b.lexeme_id ? -1 : 1))) {
    say(`  ${l.lexeme_id} "${l.lemma}" (${l.language}) [${l.part_of_speech.join(', ')}] — ${l.frequency_band} — glosses: ${l.glosses_pt.join(', ')}`)
  }
}

// ---- senses / constructions / functions / exemplars ----
say()
say('Senses:')
for (const p of sortedPacks) {
  for (const s of [...(p.senses || [])].sort((a, b) => (a.sense_id < b.sense_id ? -1 : 1))) {
    say(`  ${s.sense_id} [${s.first_exposure_stage}] — ${s.label} → functions: ${(s.communicative_function_ids || []).join(', ') || '—'}`)
  }
}
say()
say('Constructions:')
for (const p of sortedPacks) {
  for (const c of [...(p.constructions || [])].sort((a, b) => (a.construction_id < b.construction_id ? -1 : 1))) {
    say(`  ${c.construction_id} [${c.recommended_stage}] — ${c.pattern}`)
    if ((c.prerequisite_construction_ids || []).length) say(`    prerequisites: ${c.prerequisite_construction_ids.join(', ')}`)
  }
}
say()
say('Communicative functions:')
for (const p of sortedPacks) {
  for (const f of [...(p.communicative_functions || [])].sort((a, b) => (a.function_id < b.function_id ? -1 : 1))) {
    say(`  ${f.function_id} — ${f.label_pt}`)
  }
}
say()
say('Exemplars:')
for (const p of sortedPacks) {
  for (const e of [...(p.exemplars || [])].sort((a, b) => (a.exemplar_id < b.exemplar_id ? -1 : 1))) {
    say(`  ${e.exemplar_id} [${e.exposure_stage}] ${e.construction_id} — "${e.text_en}"`)
  }
}

// ---- progression per pack ----
say()
say('Progression (exposure stages, authored order within a stage):')
for (const p of sortedPacks) {
  say(`  ${p.manifest.pack_id}:`)
  const ordered = [...(p.exemplars || [])]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (stageIndex(a.e.exposure_stage) - stageIndex(b.e.exposure_stage)) || (a.i - b.i))
  for (const stage of EXPOSURE_STAGES) {
    const ids = ordered.filter(({ e }) => e.exposure_stage === stage).map(({ e }) => e.exemplar_id)
    if (ids.length) say(`    ${stage}: ${ids.join(', ')}`)
  }
}

// ---- cross-pack references + typed relations ----
say()
say('Cross-pack references:')
let anyCross = false
for (const row of [...result.packs].sort((a, b) => (a.pack_id < b.pack_id ? -1 : 1))) {
  for (const ref of [...(row.external_refs || [])].sort((a, b) => (a.where < b.where ? -1 : 1))) {
    const owner = byId.get(ref.ref)?.pack ?? '?'
    say(`  ${row.pack_id}: ${ref.where} → ${ref.ref} (owned by ${owner})`)
    anyCross = true
  }
}
if (!anyCross) say('  (none)')
say()
say('Typed relations:')
let anyRel = false
for (const p of sortedPacks) {
  for (const r of p.relations || []) {
    say(`  [${r.relation_type}] ${r.from} → ${r.to}  (declared by ${p.manifest.pack_id})`)
    anyRel = true
  }
}
if (!anyRel) say('  (none)')

// ---- usage analysis ----
const referenced = new Set()
for (const p of sortedPacks) {
  for (const c of p.constructions || []) {
    for (const sid of c.sense_ids || []) referenced.add(sid)
    for (const fid of c.communicative_function_ids || []) referenced.add(fid)
    for (const pid of c.prerequisite_construction_ids || []) referenced.add(pid)
  }
  for (const s of p.senses || []) {
    referenced.add(s.lexeme_id)
    for (const fid of s.communicative_function_ids || []) referenced.add(fid)
    for (const rid of s.related_sense_ids || []) referenced.add(rid)
  }
  for (const e of p.exemplars || []) {
    referenced.add(e.construction_id)
    for (const sid of e.sense_ids || []) referenced.add(sid)
    for (const fid of e.communicative_function_ids || []) referenced.add(fid)
    for (const t of e.pedagogical_targets || []) referenced.add(t.target_id)
    for (const pr of e.prerequisites || []) if (pr.type !== 'grammar_skill_v1') referenced.add(pr.ref)
    for (const n of e.intended_new_items || []) referenced.add(n.ref)
  }
  for (const r of p.relations || []) { referenced.add(r.from); referenced.add(r.to) }
}

const targeted = new Set()
const exemplarsByConstruction = new Map()
for (const p of sortedPacks) {
  for (const e of p.exemplars || []) {
    for (const t of e.pedagogical_targets || []) targeted.add(t.target_id)
    exemplarsByConstruction.set(e.construction_id, (exemplarsByConstruction.get(e.construction_id) || 0) + 1)
  }
}
const functionsInConstructions = new Set()
for (const p of sortedPacks) {
  for (const c of p.constructions || []) for (const fid of c.communicative_function_ids || []) functionsInConstructions.add(fid)
}

const nonExemplarIds = [...byId.keys()].filter((id) => byId.get(id).kind !== 'exemplar').sort()

say()
say('Unused IDs (never referenced by any construction, sense, exemplar or relation):')
const unused = nonExemplarIds.filter((id) => !referenced.has(id))
say(unused.length ? unused.map((id) => `  ${id}`).join('\n') : '  (none)')

say()
say('Targets without exemplars (never a pedagogical_target of any exemplar):')
const untargeted = nonExemplarIds.filter((id) => !targeted.has(id))
say(untargeted.length ? untargeted.map((id) => `  ${id}`).join('\n') : '  (none)')

say()
say('Functions without a construction:')
const orphanFns = nonExemplarIds.filter((id) => byId.get(id).kind === 'communicative_function' && !functionsInConstructions.has(id))
say(orphanFns.length ? orphanFns.map((id) => `  ${id}`).join('\n') : '  (none)')

say()
say('Constructions without progression (no exemplar in any pack):')
const orphanCons = nonExemplarIds.filter((id) => byId.get(id).kind === 'construction' && !exemplarsByConstruction.has(id))
say(orphanCons.length ? orphanCons.map((id) => `  ${id}`).join('\n') : '  (none)')

// ---- novelty budget per exemplar ----
say()
say('Novelty budget per exemplar (intended_new_items):')
for (const p of sortedPacks) {
  for (const e of [...(p.exemplars || [])].sort((a, b) => (a.exemplar_id < b.exemplar_id ? -1 : 1))) {
    const n = (e.intended_new_items || []).length
    say(`  ${e.exemplar_id}: ${n}${n > 2 ? '  ⚠ above the 2-novelty exposure budget' : ''}`)
  }
}

// ---- recognition alternatives audit ----
say()
say('Recognition-alternatives audit (structural, per pack):')
for (const p of sortedPacks) {
  const audit = auditRecognitionOptionsV2(p)
  if (audit.clean) { say(`  ${p.manifest.pack_id}: clean`); continue }
  for (const f of audit.findings) say(`  ${p.manifest.pack_id}: ${JSON.stringify(f)}`)
}

// ---- Study Planner relation roles (V2.6) ----
say()
say('Relations as seen by the Study Planner (role per RELATION_PLANNER_POLICY):')
{
  let any = false
  for (const p of sortedPacks) {
    for (const r of p.relations || []) {
      say(`  [${RELATION_PLANNER_POLICY[r.relation_type] || 'unknown'}] ${r.relation_type}: ${r.from} → ${r.to}`)
      any = true
    }
  }
  if (!any) say('  (none)')
}

// ---- curricular entry paths + reachability (V2.6) ----
// A pack's ENTRY point is an exemplar with no V2 prerequisites. Reachability:
// fixed point over "an exemplar is reachable when every V2 prerequisite ref
// was introduced by an already-reachable exemplar".
say()
say('Curricular entry paths:')
const reachableTargets = new Set()
{
  const exemplars = sortedPacks.flatMap((p) => (p.exemplars || []).map((e) => ({ pack_id: p.manifest.pack_id, e })))
  const v2Prereqs = ({ e }) => (e.prerequisites || []).filter((pr) => pr.type !== 'grammar_skill_v1')
  for (const p of sortedPacks) {
    const entries = (p.exemplars || []).filter((e) => !(e.prerequisites || []).some((pr) => pr.type !== 'grammar_skill_v1'))
    say(`  ${p.manifest.pack_id}: ${entries.length ? `${entries.length} entry exemplar(s) (${entries.map((e) => e.exemplar_id).join(', ')})` : '⚠ NO curricular entry path'}`)
  }
  let changed = true
  const reachableExemplars = new Set()
  while (changed) {
    changed = false
    for (const row of exemplars) {
      if (reachableExemplars.has(row.e.exemplar_id)) continue
      if (v2Prereqs(row).every((pr) => reachableTargets.has(pr.ref))) {
        reachableExemplars.add(row.e.exemplar_id)
        for (const t of row.e.pedagogical_targets || []) if (!reachableTargets.has(t.target_id)) { reachableTargets.add(t.target_id); changed = true }
        for (const n of row.e.intended_new_items || []) if (!reachableTargets.has(n.ref)) { reachableTargets.add(n.ref); changed = true }
        changed = true
      }
    }
  }
  say()
  say('Unreachable targets (no prerequisite path can ever introduce them):')
  const unreachable = nonExemplarIds.filter((id) => targeted.has(id) && !reachableTargets.has(id))
  say(unreachable.length ? unreachable.map((id) => `  ${id}`).join('\n') : '  (none)')

  say()
  say('Relations that can never become eligible (an endpoint is unreachable):')
  const ineligible = []
  for (const p of sortedPacks) {
    for (const r of p.relations || []) {
      const ends = [r.from, r.to].filter((id) => byId.has(id) && byId.get(id).kind !== 'lexeme')
      if (ends.some((id) => targeted.has(id) && !reachableTargets.has(id))) ineligible.push(`  [${r.relation_type}] ${r.from} → ${r.to}`)
    }
  }
  say(ineligible.length ? ineligible.join('\n') : '  (none)')
}

// ---- targets without a technically possible recognition recipe (V2.6) ----
// Structural approximation (no runtime snapshot): a target whose EVERY
// declaring exemplar cannot form the minimum safe recognition option set.
say()
say('Targets without a technically possible recognition recipe:')
{
  const bad = []
  for (const p of sortedPacks) {
    const byTarget = new Map()
    for (const e of p.exemplars || []) {
      for (const t of e.pedagogical_targets || []) {
        if (!byTarget.has(t.target_id)) byTarget.set(t.target_id, [])
        byTarget.get(t.target_id).push(e)
      }
    }
    for (const [targetId, exemplars] of [...byTarget.entries()].sort()) {
      if (exemplars.every((e) => buildRecognitionOptionsV2(p, e, 3) === null)) {
        bad.push(`  ${targetId} (pack ${p.manifest.pack_id})`)
      }
    }
  }
  say(bad.length ? bad.join('\n') : '  (none)')
}

// ---- training-domain reachability audit (Slice V2.9) ----
// Structural: for every engine-level training domain (capability × modality),
// can the planner GENERATE a candidate for it, can the engine EXECUTE it, and
// does it produce ASSESSED evidence? This is the audit that catches a domain
// like production/writing being trainable yet never proposable (the V2.8 bug).
{
  const { auditTrainingDomainReachabilityV2 } = await import('../src/lib/pedagogy-v2/training-domain-reachability.js')
  const { getTrainingAffordancesV2, getTrainableModalitiesForCapabilityV2 } = await import('../src/lib/pedagogy-v2/training-affordances.js')
  const audit = auditTrainingDomainReachabilityV2({})
  say()
  say('Training-domain reachability (engine-level; runtime-dependent domains are conditional at runtime):')
  for (const d of audit.domains) {
    say(`  ${d.capability}/${d.modality} · ${d.status} · candidate:${d.has_candidate_path ? 'yes' : 'NO'} engine:${d.has_engine_path ? 'yes' : 'NO'} assessed:${d.has_assessment_path ? 'yes' : 'NO'}`)
  }
  say(audit.warnings.length
    ? `  WARNINGS: ${audit.warnings.map((w) => `${w.code}:${w.capability}/${w.modality}`).join(' ')}`
    : '  No reachability warnings — every trainable domain has a candidate path.')

  const affordances = getTrainingAffordancesV2({})
  const capabilities = [...new Set(affordances.map((a) => a.capability))].sort()
  say()
  say('Capabilities with multiple trainable modalities (modality-expansion applies):')
  for (const cap of capabilities) {
    const mods = getTrainableModalitiesForCapabilityV2(cap, { affordances })
    if (mods.length >= 2) say(`  ${cap}: ${mods.join(', ')}`)
  }
}

// ---- optional simulated review queue over a fixture (V2.6) ----
// `--fixture <path>`: { now, learner_states, recent_evidence } — read-only,
// Slice V2.14: authored semantic-assessment metadata audit. Never fails; a
// guided_production exemplar without a semantic target is a WARNING only (§24).
{
  const { validateSemanticAssessmentMetadataV2 } = await import('../src/lib/pedagogy-v2/semantic-assessment-bridge.js')
  say()
  say('Semantic-assessment metadata (Slice V2.14):')
  let withMeta = 0
  const warnings = []
  for (const pack of packs) {
    for (const e of pack.exemplars || []) {
      if (e.semantic_assessment != null) {
        withMeta++
        const v = validateSemanticAssessmentMetadataV2(e.semantic_assessment, { referenceText: e.text_en })
        const status = v.valid ? 'OK' : `INVALID(${v.errors.join(',')})`
        const pol = e.semantic_assessment.polarity ? ` · polarity=${e.semantic_assessment.polarity}` : ''
        say(`  ${e.exemplar_id} · ${e.semantic_assessment.strategy} · essential=[${(e.semantic_assessment.essential_words || []).join(', ')}]${pol} · ${status}`)
      }
    }
    for (const c of pack.constructions || []) {
      if (c.semantic_assessment != null) {
        withMeta++
        const v = validateSemanticAssessmentMetadataV2(c.semantic_assessment, { referenceText: null })
        say(`  ${c.construction_id} · ${c.semantic_assessment.strategy} · ${v.valid ? 'OK' : `INVALID(${v.errors.join(',')})`}`)
      }
    }
  }
  if (!withMeta) say('  (no authored semantic-assessment metadata)')
  say(`  total exemplars/constructions with metadata: ${withMeta}`)
  if (warnings.length) { say('  warnings:'); for (const w of warnings) say(`    ⚠ ${w}`) }
}

// deterministic. Without the flag nothing user-specific is ever touched.
{
  const idx = process.argv.indexOf('--fixture')
  if (idx !== -1 && process.argv[idx + 1]) {
    const fixture = JSON.parse(readFileSync(process.argv[idx + 1], 'utf8'))
    const registry = buildPedagogyV2Registry(packs)
    const queue = buildReviewQueueV2({
      registry,
      learnerStates: fixture.learner_states || [],
      recentEvidence: fixture.recent_evidence || [],
      now: fixture.now,
    })
    say()
    say(`Simulated review queue (fixture ${process.argv[idx + 1]}, now=${fixture.now}):`)
    if (!queue.length) say('  (empty)')
    for (const item of queue) {
      say(`  ${item.target.target_id} · ${item.capability_key} · priority ${item.priority} · ${item.reason_codes.join(',')}`)
    }
  }
}

console.log(lines.join('\n'))
