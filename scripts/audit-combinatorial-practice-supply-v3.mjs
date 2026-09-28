import { writeFileSync, mkdirSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { COMBINATORIAL_FRAMES_V3 } from '../src/content/pedagogy-v3/combinatorial-catalog.js'
import { materializeCombinatorialCorpusV3, auditCombinatorialCorpusV3, stableCombinatorialHash, selectUnseenRealizationV3 } from '../src/lib/pedagogy-v3/combinatorial-supply.js'
import { auditV3Quality } from '../src/lib/pedagogy-v3/combinatorial-quality-audit.js'
import { materializeV3ForPack, V3_FOCUS_BINDINGS, V3_ELIGIBLE_RECIPES } from '../src/lib/pedagogy-v3/combinatorial-focus-adapter.js'
import { loadCombinatorialCurriculumRegistryV3, V3_CURRICULUM_BINDINGS } from '../src/lib/pedagogy-v3/combinatorial-curriculum.js'
import { LESSON_RECIPES } from '../src/lib/pedagogy-v2/lesson-engine-contracts.js'
mkdirSync('test-evidence', { recursive: true })
const before = process.memoryUsage().heapUsed
const start = performance.now()
const rows = materializeCombinatorialCorpusV3()
const elapsed = performance.now() - start
const heap = process.memoryUsage().heapUsed - before
const times = []
for (let i=0;i<200;i++) { const t=performance.now(); selectUnseenRealizationV3({ rows, focusId: rows[i % rows.length].focus_id, seed: String(i) }); times.push(performance.now()-t) }
times.sort((a,b)=>a-b)
const registry=loadCombinatorialCurriculumRegistryV3()
const active=registry.packs.flatMap(p=>materializeV3ForPack(p))
const eligibility = COMBINATORIAL_FRAMES_V3.flatMap(f => LESSON_RECIPES.flatMap(recipe => recipe.pairs.map(([capability,modality]) => ({
  focus_id: f.focus_id, recipe: recipe.recipe, capability, modality,
  eligible_realizations: V3_ELIGIBLE_RECIPES.includes(recipe.recipe) ? active.filter(r=>r.focus_id===f.focus_id).length : 0,
  reason: !active.some(r=>r.focus_id===f.focus_id) ? 'NO_ACTIVE_V2_TARGET_BINDING' : !V3_ELIGIBLE_RECIPES.includes(recipe.recipe) ? 'AUTHORED_CONTEXT_REQUIRED' : 'CONTENT_COMPATIBLE_RUNTIME_AND_LEARNER_GATES_STILL_APPLY',
}))))
const sample=COMBINATORIAL_FRAMES_V3.flatMap(f=> rows.filter(r=>r.focus_id===f.focus_id)
  .sort((a,b)=>stableCombinatorialHash('editorial-20260927|'+a.realization_id).localeCompare(stableCombinatorialHash('editorial-20260927|'+b.realization_id)))
  .slice(0,10).map(r=>({...r, slot_a: f.slots.a.find(s=>s.id===r.slot_signature.slots.a), slot_b: f.slots.b.find(s=>s.id===r.slot_signature.slots.b)})))
const report={...auditCombinatorialCorpusV3(rows), active_v2_mapped_realizations: active.length, active_v2_mapped_focuses: new Set(active.map(r=>r.focus_id)).size,
  bindings: [...V3_FOCUS_BINDINGS, ...V3_CURRICULUM_BINDINGS], eligibility, quality: auditV3Quality(rows),
  performance: { runtime:process.version, platform:process.platform, materialize_ms:elapsed, approximate_heap_delta_bytes:heap, serialized_bytes:Buffer.byteLength(JSON.stringify(rows)), select_median_ms:times[100], select_p95_ms:times[190], note:'Node host measurement; no mobile benchmark claim; heap delta includes allocations and GC noise' } }
writeFileSync('test-evidence/v3-combinatorial-supply-audit.json', JSON.stringify(report,null,2))
writeFileSync('test-evidence/v3-combinatorial-editorial-sample.json',JSON.stringify(sample,null,2))
console.log(JSON.stringify({realizations:rows.length,active:active.length,sample:sample.length,quality_findings:report.quality.findings.length,performance:report.performance},null,2))
