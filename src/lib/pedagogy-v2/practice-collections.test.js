// practice-collections.test.js — Slice V2.22-UX2. The editorial layer and the
// optional study scope, checked against the REAL registry and the REAL engine
// recipe table.
//
// The rules that matter here are the ones that would be invisible until a
// learner hit them: a collection pointing at a deleted exemplar, a format chip
// naming a recipe the engine does not have, a scope that lets a session
// materialize a sentence from outside the context it promised.

import { describe, it, expect } from 'vitest'
import { loadPedagogyV2Registry } from './registry.js'
import { RECIPE_NAMES } from './lesson-engine-contracts.js'
import {
  loadPracticeCollectionsV2, getPracticeCollectionV2, resolvePracticeCollectionV2,
  PRACTICE_COLLECTION_CONTRACT_VERSION,
} from './practice-collections.js'
import {
  buildStudyScopeFromCollectionV2, isStudyScopeV2, scopeAllowsExemplarV2,
  scopeAllowsTargetV2, intersectAllowedPackIdsV2, STUDY_SCOPE_V2_VERSION,
} from './study-scope.js'
import { auditPracticeCollectionsV2 } from './practice-collections-audit.js'
import {
  PRACTICE_FORMATS, recipeForPracticeFormatV2, buildPracticeCollectionCatalogV2,
  buildRecipePreferenceNoticeV2, buildContextualSessionEntryV2, LEARNER_HOME_PRESENTATION_VERSION,
  CATALOG_INITIAL_VISIBLE,
} from './learner-home-presentation.js'

const registry = loadPedagogyV2Registry()
const doc = loadPracticeCollectionsV2()

describe('practice collections — the editorial layer', () => {
  it('is versioned and catalog-ordered, never alphabetic', () => {
    expect(PRACTICE_COLLECTION_CONTRACT_VERSION).toBe(1)
    const orders = doc.collections.map((c) => c.catalog_order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('every authored member resolves in the Registry (§3.6)', () => {
    for (const c of doc.collections) {
      expect(resolvePracticeCollectionV2(c, registry).missing_exemplar_ids).toEqual([])
    }
  })

  it('every collection SPANS several internal packs (§5/§33.5)', () => {
    for (const c of doc.collections) {
      const packs = resolvePracticeCollectionV2(c, registry).pack_ids
      expect(packs.length, `${c.collection_id} must cross packs`).toBeGreaterThan(1)
    }
  })

  it('no collection is derivable from a single pack_id (§3.8)', () => {
    // If a collection were just a pack in disguise, its exemplars would all
    // carry the same pack. None do.
    const byPack = doc.collections.map((c) => resolvePracticeCollectionV2(c, registry).pack_ids.join(','))
    expect(new Set(byPack).size).toBeGreaterThan(0)
    for (const p of byPack) expect(p).toContain(',')
  })

  it('an exemplar MAY belong to several collections when editorially true (§3.7)', () => {
    const seen = new Map()
    for (const c of doc.collections) {
      for (const x of resolvePracticeCollectionV2(c, registry).exemplar_ids) {
        seen.set(x, (seen.get(x) || 0) + 1)
      }
    }
    expect([...seen.values()].some((n) => n > 1)).toBe(true)
  })

  it('collections carry NO mastery, NO evidence and NO target of their own (§3)', () => {
    // Structural, not textual: the authored shape may only ever carry
    // presentation + an exemplar allow-list. (A substring scan would trip over
    // ordinary Portuguese — "e(xp)licar" contains "xp".)
    const allowed = new Set(['collection_id', 'title_pt', 'description_pt', 'catalog_order', 'icon_role', 'authored_scope'])
    for (const c of doc.collections) {
      for (const k of Object.keys(c)) expect(allowed.has(k), `unexpected authored key "${k}"`).toBe(true)
      expect(Object.keys(c.authored_scope)).toEqual(['exemplar_ids'])
    }
  })

  it('no learner-facing copy names a pack or a lemma (§1/§29)', () => {
    for (const c of doc.collections) {
      const copy = `${c.title_pt} ${c.description_pt}`.toLowerCase()
      for (const term of ['still', 'but', 'yet', 'pedagogy_v2']) {
        expect(new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(copy), `${c.collection_id} leaks "${term}"`).toBe(false)
      }
    }
  })
})

describe('the audit is the gate on the catalogue (§29)', () => {
  it('passes on the shipped catalogue, with real coverage', () => {
    const r = auditPracticeCollectionsV2({ registry })
    expect(r.failures).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.collections.every((c) => c.spans_multiple_packs)).toBe(true)
    expect(r.coverage.exemplars_in_a_collection).toBeGreaterThan(0)
  })

  it('HARD FAILS on an unknown member, an empty collection and a leaked pack label', () => {
    const bad = {
      contract_version: 1,
      collections: [
        { collection_id: 'collection:x', title_pt: 'X', description_pt: 'd', catalog_order: 1, authored_scope: { exemplar_ids: ['exemplar:does.not.exist'] } },
        { collection_id: 'collection:empty', title_pt: 'E', description_pt: 'd', catalog_order: 2, authored_scope: { exemplar_ids: [] } },
        { collection_id: 'collection:leak', title_pt: 'Praticar yet', description_pt: 'd', catalog_order: 3, authored_scope: { exemplar_ids: ['exemplar:still.001', 'exemplar:still.002'] } },
      ],
    }
    const codes = auditPracticeCollectionsV2({ registry, doc: bad }).failures.map((f) => f.code)
    expect(codes).toContain('COLLECTION_REFERENCE_UNKNOWN')
    expect(codes).toContain('COLLECTION_EMPTY')
    expect(codes).toContain('COLLECTION_TECHNICAL_LABEL')
  })

  it('a one-sentence "context" is not a context (§23)', () => {
    const bad = {
      contract_version: 1,
      collections: [{ collection_id: 'collection:thin', title_pt: 'T', description_pt: 'd', catalog_order: 1, authored_scope: { exemplar_ids: ['exemplar:still.001'] } }],
    }
    expect(auditPracticeCollectionsV2({ registry, doc: bad }).failures.map((f) => f.code))
      .toContain('COLLECTION_SINGLE_EXEMPLAR')
  })
})

describe('StudyScopeV2 — an optional filter, never a new truth', () => {
  const scope = buildStudyScopeFromCollectionV2('collection:work_and_study', registry)

  it('builds from an authored collection and carries only presentation + allow-lists', () => {
    expect(scope.scope_version).toBe(STUDY_SCOPE_V2_VERSION)
    expect(scope.scope_kind).toBe('practice_collection')
    expect(isStudyScopeV2(scope)).toBe(true)
    expect(scope.allowed_exemplar_ids.length).toBeGreaterThan(1)
    expect(scope.allowed_pack_ids.length).toBeGreaterThan(1)
    // No mastery, no evidence, no scheduler state.
    expect(Object.keys(scope).sort()).toEqual([
      'allowed_exemplar_ids', 'allowed_pack_ids', 'allowed_target_ids',
      'collection_id', 'scope_kind', 'scope_version', 'title_pt',
    ])
  })

  it('no scope means the whole catalogue — absence is never a special case', () => {
    expect(buildStudyScopeFromCollectionV2(null, registry)).toBeNull()
    expect(isStudyScopeV2(null)).toBe(false)
    expect(scopeAllowsExemplarV2(null, 'exemplar:anything')).toBe(true)
    expect(scopeAllowsTargetV2(null, 'target:anything')).toBe(true)
  })

  it('an unknown collection is a STRUCTURAL error, never a silent full session', () => {
    const bad = buildStudyScopeFromCollectionV2('collection:nope', registry)
    expect(bad.error).toBe('COLLECTION_UNKNOWN')
    expect(isStudyScopeV2(bad)).toBe(false)
  })

  it('membership is exactly the authored set — nothing outside can materialize (§29)', () => {
    for (const id of scope.allowed_exemplar_ids) expect(scopeAllowsExemplarV2(scope, id)).toBe(true)
    const outside = registry.packs.flatMap((p) => p.exemplars.map((e) => e.exemplar_id))
      .filter((id) => !scope.allowed_exemplar_ids.includes(id))
    expect(outside.length).toBeGreaterThan(0)
    for (const id of outside) expect(scopeAllowsExemplarV2(scope, id)).toBe(false)
  })

  it('a scope NARROWS a focused session and never widens it', () => {
    // focused pins one pack; the intersection keeps at most that pack.
    expect(intersectAllowedPackIdsV2(['pedagogy_v2_still'], scope)).toEqual(['pedagogy_v2_still'])
    // a pack outside the collection disappears rather than being re-admitted
    expect(intersectAllowedPackIdsV2(['pedagogy_v2_nonexistent'], scope)).toEqual([])
    // no prior restriction → the scope's own packs
    expect(intersectAllowedPackIdsV2(null, scope)).toEqual(scope.allowed_pack_ids)
    // no scope → untouched
    expect(intersectAllowedPackIdsV2(['a', 'b'], null)).toEqual(['a', 'b'])
  })
})

describe('practice formats — advisory, and REAL', () => {
  it('every format maps to a recipe the engine actually has (§13)', () => {
    const engineRecipes = new Set(RECIPE_NAMES)
    for (const f of PRACTICE_FORMATS) {
      if (f.recipe === null) continue
      expect(engineRecipes.has(f.recipe), `format "${f.format}" names a non-existent recipe "${f.recipe}"`).toBe(true)
    }
  })

  it('"mixed" is the absence of a preference, not a recipe', () => {
    expect(recipeForPracticeFormatV2('mixed')).toBeNull()
    expect(recipeForPracticeFormatV2(undefined)).toBeNull()
    expect(recipeForPracticeFormatV2('bogus')).toBeNull()
    expect(recipeForPracticeFormatV2('scramble')).toBe('word_order_reconstruction')
  })

  it('the notice is advisory copy that never claims the activity was served', () => {
    const n = buildRecipePreferenceNoticeV2({ format: 'scramble', collectionTitle: 'Trabalho e estudos' })
    expect(n.headline).toMatch(/ainda não está disponível/i)
    expect(`${n.headline} ${n.body}`).not.toMatch(/erro|falha|você errou|indisponível para sempre/i)
    // "mixed" asked for nothing, so there is nothing to explain.
    expect(buildRecipePreferenceNoticeV2({ format: 'mixed' })).toBeNull()
  })
})

describe('the Home catalogue presentation', () => {
  it('is versioned and exposes NO pack id to the screen (§28.6)', () => {
    const cat = buildPracticeCollectionCatalogV2()
    expect(cat.presentation_version).toBe(LEARNER_HOME_PRESENTATION_VERSION)
    expect(LEARNER_HOME_PRESENTATION_VERSION).toBe(2)
    const blob = JSON.stringify(cat)
    expect(blob).not.toMatch(/pack_id|pedagogy_v2_|exemplar:|construction:|sense:/)
    for (const c of cat.collections) {
      expect(c).toEqual({
        collection_id: expect.any(String), title: expect.any(String),
        description: expect.any(String), icon_role: expect.any(String),
      })
    }
  })

  it('the contextual entry state promises nothing (§17)', () => {
    const e = buildContextualSessionEntryV2({ collectionTitle: 'Viagens e deslocamentos', format: 'scramble' })
    expect(e.context_title).toBe('Viagens e deslocamentos')
    expect(e.format_label).toBe('Montar frases')
    expect(JSON.stringify(e)).not.toMatch(/\d+\s*(atividades|exerc)/i)
    // mixed shows no format echo — there is no preference to echo.
    expect(buildContextualSessionEntryV2({ collectionTitle: 'X', format: 'mixed' }).format_label).toBeNull()
  })

  it('the catalogue scales at 4 / 8 / 12 / 20 without becoming a wall (§10)', () => {
    const make = (n) => ({
      contract_version: 1,
      collections: Array.from({ length: n }, (_, i) => ({
        collection_id: `collection:c${i}`, title_pt: `C${i}`, description_pt: 'd',
        catalog_order: i, icon_role: 'context', authored_scope: { exemplar_ids: [] },
      })),
    })
    for (const n of [4, 8, 12, 20]) {
      const collapsed = buildPracticeCollectionCatalogV2(make(n))
      expect(collapsed.collections).toHaveLength(n)
      // Never more than the initial window before expanding…
      expect(collapsed.visible.length).toBe(Math.min(n, CATALOG_INITIAL_VISIBLE))
      expect(collapsed.hidden_count).toBe(Math.max(0, n - CATALOG_INITIAL_VISIBLE))
      // …and the control only exists when something is actually hidden.
      expect(collapsed.more_label === null).toBe(n <= CATALOG_INITIAL_VISIBLE)
      // Expanding shows everything, and hides the control again.
      const open = buildPracticeCollectionCatalogV2(make(n), { expanded: true })
      expect(open.visible).toHaveLength(n)
      expect(open.hidden_count).toBe(0)
      expect(open.more_label).toBeNull()
    }
  })

  it('getPracticeCollectionV2 finds authored collections and nothing else', () => {
    expect(getPracticeCollectionV2('collection:work_and_study')?.title_pt).toBe('Trabalho e estudos')
    expect(getPracticeCollectionV2('collection:nope')).toBeNull()
  })
})

describe('inside a context, the internal curriculum stays internal (§18)', () => {
  it('suppresses the pack-transition interstitial and names the CONTEXT', async () => {
    const { buildLearnerPresentationV2, LEARNER_PRESENTATION_VERSION: PV } = await import('./learner-presentation-v2.js')
    const scope = buildStudyScopeFromCollectionV2('collection:work_and_study', registry)
    const focus = { pack_id: 'pedagogy_v2_still', target: { target_id: 'sense:still.continuity' }, reason_codes: [] }
    const transition = { from_pack: 'pedagogy_v2_but', to_pack: 'pedagogy_v2_still' }
    const plan = { recipe: 'word_order_reconstruction', text_en: 'She still works at the hospital.', capability: 'controlled_production', modality: 'writing' }

    const scoped = buildLearnerPresentationV2({ plan, focus, transition, registry, studyScope: scope })
    // No "Agora vamos praticar “still”." — crossing packs inside one context is
    // an internal move and must never be announced.
    expect(scoped.transition).toBeNull()
    // The chip names the context the learner actually chose.
    expect(scoped.focus.label).toBe('Trabalho e estudos')
    // Nothing anywhere in the scoped presentation names the lexeme.
    expect(JSON.stringify(scoped)).not.toMatch(/(^|[^a-zA-Z])still([^a-zA-Z]|$)/)
    expect(PV).toBe(2)

    // Unscoped: the V2.17 behaviour is untouched.
    const plain = buildLearnerPresentationV2({ plan, focus, transition, registry })
    expect(plain.transition).not.toBeNull()
    expect(plain.focus.label).toBe('still')
  })
})
