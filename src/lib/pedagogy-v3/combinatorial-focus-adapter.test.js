import { it, expect } from 'vitest'
import { loadPedagogyV2Registry } from '../pedagogy-v2/registry.js'
import { materializeV3ForPack, V3_FOCUS_BINDINGS, assertNoAvoidableLiteralRepeatV3 } from './combinatorial-focus-adapter.js'
import { selectNextActivityV2 } from '../pedagogy-v2/lesson-engine.js'
import { createLessonSessionV2 } from '../pedagogy-v2/lesson-engine-contracts.js'
import { resolveNextStudyActivityV2 } from '../pedagogy-v2/study-focus-resolver.js'
import { createStudySessionV2 } from '../pedagogy-v2/study-planner-contracts.js'
const registry = loadPedagogyV2Registry()
it('binds three active constructions; the fourth binding remains outside the production registry', () => {
  const rows = registry.packs.flatMap(p => materializeV3ForPack(p))
  expect(rows).toHaveLength(192)
  expect(new Set(rows.map(r => r.focus_id)).size).toBe(3)
  for (const row of rows) {
    expect(row.approval_status).toBe('provisional_nonhuman')
    expect(row.construction_id).toBe(V3_FOCUS_BINDINGS.find(b => b.focus_id === row.focus_id).construction_id)
    expect(row.eligible_recipes).not.toContain('free_production')
  }
})
it('throws V3_AVOIDABLE_LITERAL_REPEAT with actionable trace', () => {
  const make = (id,text) => ({ exemplar: { realization_id: id, text_en: text }, recipe: { recipe: 'meaning_recognition' }, capability: 'recognition', modality: 'reading' })
  expect(() => assertNoAvoidableLiteralRepeatV3({ selected: make('old','old'), seenTexts: new Set(['old']), candidates: [make('new','new')], focus: 'test' })).toThrow(/V3_AVOIDABLE_LITERAL_REPEAT.*candidate_ids/)
})
it('OFF preserves the baseline selection', () => {
  const pack = registry.packs[0]
  const args = { pack, session: createLessonSessionV2({ session_id: 'fixed', now: '2026-09-27T12:00:00Z' }) }
  expect(selectNextActivityV2({ ...args, combinatorialSupplyV3: { enabled: false } })).toEqual(selectNextActivityV2(args))
})
it('consumes 64 V3 rows in the engine then exhausts; real resolver continues', () => {
  const pack = registry.packs.find(p => p.exemplars.some(e => e.exemplar_id === 'exemplar:still.001'))
  const target = 'construction:still.subject_still_lexical_verb'
  const supplyHistory = pack.exemplars.map(e => ({ plan: e })) // authored pool consumed
  const session = () => createLessonSessionV2({ session_id: 'exhaustion', now: '2026-09-27T12:00:00Z' })
  const learnerStates = pack.exemplars[0].pedagogical_targets.map(t => ({ target: t, exposure: { count: 1 } }))
  const args = { pack, learnerStates, session: session(), focus: { target_id: target, capability: 'recognition', modality: 'reading' }, combinatorialSupplyV3: { enabled: true, strict_unseen: true }, supplyHistory }
  // Recognition is executable without changing any policy or mastery gate.
  const seen = new Set()
  for (let n = 0; n < 64; n++) {
    const decision = selectNextActivityV2(args)
    expect(decision.status).toBe('activity')
    expect(decision.plan.realization_id).toBeTruthy()
    expect(seen.has(decision.plan.text_en)).toBe(false)
    seen.add(decision.plan.text_en); supplyHistory.push({ plan: decision.plan })
  }
  expect(selectNextActivityV2(args).status).toBe('focus_exhausted')
  const resolution = resolveNextStudyActivityV2({ registry, studySession: createStudySessionV2({ study_session_id: 's', mode: 'adaptive', profile_id: 'p', now: '2026-09-27T12:00:00Z' }), now: '2026-09-27T12:00:00Z', makeLessonSessionId: id => `next-${id}`, combinatorialSupplyV3: { enabled: true }, supplyHistory })
  expect(resolution.status).toBe('activity')
})
it('the real Planner switches away from a mapped exhausted recognition focus', () => {
  const targets = new Map(registry.packs.flatMap(p=>p.exemplars.flatMap(e=>e.pedagogical_targets)).map(t=>[t.target_id,t]))
  const learnerStates = [...targets.values()].map(target=>({target, exposure:{count:1}}))
  const args = { registry, learnerStates, studySession: createStudySessionV2({ study_session_id:'switch', mode:'adaptive', profile_id:'p', now:'2026-09-27T12:00:00Z' }), now:'2026-09-27T12:00:00Z', makeLessonSessionId:id=>`switch-${id}`, combinatorialSupplyV3:{enabled:true} }
  const first = resolveNextStudyActivityV2(args)
  expect(first.status).toBe('activity')
  expect(first.engine_decision.trace.supply_selection.v3_eligible_count).toBeGreaterThan(0)
  const pack=registry.packs.find(p=>p.manifest.pack_id===first.focus.pack_id)
  const supplyHistory=[...pack.exemplars,...materializeV3ForPack(pack)].map(plan=>({plan}))
  const next=resolveNextStudyActivityV2({...args,supplyHistory})
  expect(next.status).toBe('activity')
  expect(next.resolution_trace.attempts[0].engine_status).toBe('focus_exhausted')
  expect(next.resolution_trace.attempts[0].reason_codes).toContain('V3_FOCUS_EXHAUSTED')
  expect(next.resolution_trace.selected.focus_key).not.toBe(first.resolution_trace.selected.focus_key)
})
