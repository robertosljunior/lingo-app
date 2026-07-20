// three-pack-graph.test.js — §39 + §12 (Slice V2.11). The registry as a REAL
// three-pack curriculum graph: import-order independence, the yet→still and
// yet→but dependency edges (a DAG, no cycles), the N-to-N relation web (one
// existing entity receiving relations from more than one pack; the new pack
// relating to more than one pack), single ownership, preserved still/but IDs
// and full backward compatibility of previously-persisted evidence.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import * as storage from '../storage.js'
import {
  loadPedagogyV2Registry, buildPedagogyV2Registry, resolvePedagogyEntity, getPedagogyPack,
} from './registry.js'
import { BUILTIN_PEDAGOGY_V2_PACKS } from '../../content/pedagogy-v2/index.js'
import { validatePedagogyV2Registry } from './validator.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'

globalThis.indexedDB = indexedDB
globalThis.IDBKeyRange = IDBKeyRange

const registry = loadPedagogyV2Registry()

describe('§39.21–22 — three valid packs, import order independent', () => {
  it('21: the registry validates and carries the three packs', () => {
    expect(registry.pack_ids).toEqual(['pedagogy_v2_but', 'pedagogy_v2_still', 'pedagogy_v2_yet'])
    expect(validatePedagogyV2Registry(BUILTIN_PEDAGOGY_V2_PACKS).valid).toBe(true)
  })

  it('22: every import order yields the identical registry', () => {
    const [a, b, c] = BUILTIN_PEDAGOGY_V2_PACKS
    const orders = [[a, b, c], [c, b, a], [b, c, a], [c, a, b]]
    const canon = JSON.stringify(buildPedagogyV2Registry(orders[0]).pack_ids)
    for (const order of orders) {
      const r = buildPedagogyV2Registry(order)
      expect(JSON.stringify(r.pack_ids)).toBe(canon)
      expect(r.packs.map((p) => p.manifest.pack_id)).toEqual(['pedagogy_v2_but', 'pedagogy_v2_still', 'pedagogy_v2_yet'])
    }
  })
})

describe('§39.23–26 — dependencies and typed cross-pack relations', () => {
  const yet = getPedagogyPack('pedagogy_v2_yet', registry)

  it('23+24: yet declares directed dependencies on still and but', () => {
    const deps = yet.manifest.dependencies.map((d) => d.pack_id)
    expect(deps).toEqual(expect.arrayContaining(['pedagogy_v2_still', 'pedagogy_v2_but']))
  })

  it('25: the temporal relation yet↔still is explicit, typed and non-fusing', () => {
    const rel = yet.relations.find((r) => r.relation_type === 'contrasts_with'
      && r.from === 'sense:yet.temporal_pending' && r.to === 'sense:still.continuity')
    expect(rel).toBeTruthy()
    // Related but distinct: both senses keep existing as separate entities.
    expect(resolvePedagogyEntity('sense:yet.temporal_pending', registry).pack_id).toBe('pedagogy_v2_yet')
    expect(resolvePedagogyEntity('sense:still.continuity', registry).pack_id).toBe('pedagogy_v2_still')
  })

  it('26: the concessive relation yet↔but is explicit (shared function, distinct construction)', () => {
    expect(yet.relations.some((r) => r.relation_type === 'related_construction'
      && r.from === 'construction:yet.clause_yet_clause' && r.to === 'construction:but.clause_but_clause')).toBe(true)
    expect(yet.relations.some((r) => r.relation_type === 'realizes_shared_function'
      && r.from === 'construction:yet.clause_yet_clause' && r.to === 'function:express_unexpected_result')).toBe(true)
  })
})

describe('§39.27 — the graph is N-to-N, not a chain', () => {
  it('an existing still entity receives relations from MORE THAN ONE pack', () => {
    const but = getPedagogyPack('pedagogy_v2_but', registry)
    const yet = getPedagogyPack('pedagogy_v2_yet', registry)
    const target = 'construction:still.clause_but_subject_still_verb'
    const fromBut = but.relations.some((r) => r.from === target || r.to === target)
    const fromYet = yet.relations.some((r) => r.from === target || r.to === target)
    expect(fromBut).toBe(true)
    expect(fromYet).toBe(true)
  })

  it('the new pack relates to entities of BOTH other packs (multiple curricular paths)', () => {
    const yet = getPedagogyPack('pedagogy_v2_yet', registry)
    const stillRefs = yet.relations.filter((r) => r.to.includes(':still.'))
    const butRefs = yet.relations.filter((r) => r.to.includes(':but.') || r.to === 'function:express_unexpected_result')
    expect(stillRefs.length).toBeGreaterThanOrEqual(2)
    expect(butRefs.length).toBeGreaterThanOrEqual(2)
    // and yet connects to BOTH but...still and although...still — two distinct
    // cross-pack paths into the same functional space.
    expect(yet.relations.some((r) => r.to === 'construction:still.clause_but_subject_still_verb')).toBe(true)
    expect(yet.relations.some((r) => r.to === 'construction:still.although_clause_subject_still_verb')).toBe(true)
  })
})

describe('§39.28–29 — single ownership, no dependency cycle', () => {
  it('28: every entity has exactly one owner pack', () => {
    const seen = new Map()
    for (const pack of registry.packs) {
      const ids = [
        ...pack.lexemes.map((l) => l.lexeme_id),
        ...pack.senses.map((s) => s.sense_id),
        ...pack.constructions.map((c) => c.construction_id),
        ...pack.communicative_functions.map((f) => f.function_id),
        ...pack.exemplars.map((e) => e.exemplar_id),
      ]
      for (const id of ids) {
        expect(seen.has(id), `${id} owned twice (${seen.get(id)} and ${pack.manifest.pack_id})`).toBe(false)
        seen.set(id, pack.manifest.pack_id)
      }
    }
  })

  it('29: the dependency graph is a DAG (still ← but, still ← yet, but ← yet)', () => {
    const edges = {}
    for (const pack of registry.packs) {
      edges[pack.manifest.pack_id] = (pack.manifest.dependencies || []).map((d) => d.pack_id)
    }
    expect(edges.pedagogy_v2_still).toEqual([])
    expect(edges.pedagogy_v2_but).toEqual(['pedagogy_v2_still'])
    expect(edges.pedagogy_v2_yet.sort()).toEqual(['pedagogy_v2_but', 'pedagogy_v2_still'])
    // Cycle check by DFS.
    const visiting = new Set(); const done = new Set()
    const visit = (id) => {
      expect(visiting.has(id), `dependency cycle through ${id}`).toBe(false)
      if (done.has(id)) return
      visiting.add(id)
      for (const dep of edges[id] || []) visit(dep)
      visiting.delete(id); done.add(id)
    }
    for (const id of Object.keys(edges)) visit(id)
  })
})

describe('§39.30–32 + §12 — backward compatibility', () => {
  const OLD_IDS = [
    'sense:still.continuity', 'sense:still.counter_expectation', 'sense:still.discourse_reservation',
    'construction:still.subject_still_lexical_verb', 'construction:still.subject_be_still_complement',
    'construction:still.clause_but_subject_still_verb', 'construction:still.although_clause_subject_still_verb',
    'construction:still.discourse_still_clause',
    'sense:but.contrast', 'sense:but.counter_expectation', 'sense:but.correction', 'sense:but.exception',
    'construction:but.clause_but_clause', 'construction:but.adjective_but_adjective',
    'construction:but.not_x_but_y', 'construction:but.universal_but_exception',
    'construction:but.polite_marker_but_clause',
  ]

  it('30+31: every pre-V2.11 still/but ID is preserved and resolves', () => {
    for (const id of OLD_IDS) {
      const hit = resolvePedagogyEntity(id, registry)
      expect(hit, id).toBeTruthy()
      expect(['pedagogy_v2_still', 'pedagogy_v2_but']).toContain(hit.pack_id)
    }
  })

  it('32 + §12: persisted still/but evidence resolves, rebuilds identical states, and survives the three-pack registry', async () => {
    await storage.__resetDbForTests()
    await indexedDB.deleteDatabase('app-idiomas')
    let seq = 0
    const mk = (targetId, targetType) => buildLearnerEvidenceV2({
      evidence_id: `evidence:compat.${String(++seq).padStart(3, '0')}`,
      profile_id: 'p1', interaction_id: `interaction:compat.${seq}`, session_id: 'compat',
      target: { target_type: targetType, target_id: targetId }, exemplar_id: null,
      activity: { activity_kind: 'meaning_recognition', capability: 'recognition', modality: 'reading' },
      attribution: 'direct', outcome: 'correct',
      occurred_at: new Date(Date.UTC(2026, 5, 1) + seq * 60000).toISOString(),
      source: { source_type: 'test' },
    })
    const events = [
      mk('sense:still.continuity', 'sense'), mk('sense:still.continuity', 'sense'),
      mk('sense:but.contrast', 'sense'), mk('construction:but.clause_but_clause', 'construction'),
    ]
    // 1-2: record evidence, load the three-pack registry.
    await storage.recordLearnerEvidenceBatchV2(events)
    // 3: every old target resolves in the NEW registry.
    for (const e of events) expect(resolvePedagogyEntity(e.target.target_id, registry)).toBeTruthy()
    // 4-5: rebuilt learner states are logically equal to a pure re-aggregation.
    const persisted = await storage.getLearnerEvidenceV2('p1')
    expect(persisted.length).toBe(events.length)
    const fromDb = aggregateProfileEvidence(persisted)
    const pure = aggregateProfileEvidence(events)
    expect(JSON.stringify(fromDb)).toBe(JSON.stringify(pure))
    // 6-7: a new session's planner context sees the prior progress untouched.
    const states = await storage.getLearnerTargetStatesV2('p1')
    const stillState = states.find((s) => s.target.target_id === 'sense:still.continuity')
    expect(stillState.capabilities.reading_recognition.overall.assessed_evidence_count).toBe(2)
    await storage.__resetDbForTests()
    await indexedDB.deleteDatabase('app-idiomas')
  })
})
