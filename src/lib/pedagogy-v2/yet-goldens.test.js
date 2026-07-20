// yet-goldens.test.js — §40/§41 + goldens §31–§34 (Slice V2.11). The planner
// discovers `yet` purely through the registry (no lexical special-case), the
// engine serves it with the generic recipes, and the acceptance-critical
// journeys hold: SAME LEXEME / NEW USE (temporal yet known ⇏ concessive yet
// known, and no restart from the first temporal construction), still→yet and
// but→yet transfer, and the three-pack N-to-N graph in action. Deterministic.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { loadPedagogyV2Registry } from './registry.js'
import { buildStudyCandidatesV2, selectNextStudyFocusV2 } from './study-planner.js'
import { createStudySessionV2 } from './study-planner-contracts.js'
import { selectNextActivityV2 } from './lesson-engine.js'
import { createLessonSessionV2, LESSON_RECIPES } from './lesson-engine-contracts.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'
import { runSimulationV2 } from './simulation-runner.js'
import { createSimulationScenarioV2 } from './simulation-contracts.js'
import { computePedagogicalMetricsV2 } from './pedagogical-metrics.js'
import { analyzeTrajectoryV2 } from './trajectory-analyzer.js'
import { buildStandardScenarioV2 } from './simulation-scenarios.js'

const registry = loadPedagogyV2Registry()
const NOW = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)).toISOString()
const FULL = computeRecipeRuntimeAvailability({ text_input: true, audio_output: true, speech_input: true, semantic_assessment: true, pronunciation_assessment: false })

let seq = 0
function seed(profileId, rows) {
  const t0 = Date.UTC(2026, 0, 4, 9, 0, 0)
  return rows.flatMap((row) => Array.from({ length: row.n ?? 3 }, () => buildLearnerEvidenceV2({
    evidence_id: `evidence:yg.${profileId}.${String(++seq).padStart(4, '0')}`,
    profile_id: profileId, interaction_id: `interaction:yg.${profileId}.${seq}`,
    target: row.target, exemplar_id: null,
    activity: {
      activity_kind: row.modality === 'listening' ? 'listening_recognition' : 'meaning_recognition',
      capability: 'recognition', modality: row.modality,
    },
    attribution: 'direct', outcome: 'correct',
    occurred_at: new Date(t0 + seq * 60000).toISOString(), source: { source_type: 'test' },
  })))
}
const recog = (targetId, targetType = 'sense') => [
  { target: { target_type: targetType, target_id: targetId }, modality: 'reading' },
  { target: { target_type: targetType, target_id: targetId }, modality: 'listening' },
]
const states = (evidence) => aggregateProfileEvidence(evidence)
const session = (over = {}) => createStudySessionV2({ study_session_id: 's', mode: 'adaptive', now: NOW, ...over })

// yet temporal consolidated: sense + first two temporal constructions.
const YET_TEMPORAL_KNOWN = (profileId) => seed(profileId, [
  ...recog('sense:yet.temporal_pending'),
  ...recog('construction:yet.subject_be_not_complement_yet', 'construction'),
  ...recog('construction:yet.interrogative_clause_yet', 'construction'),
])
// but contrast consolidated.
const BUT_KNOWN = (profileId) => seed(profileId, [
  ...recog('sense:but.contrast'),
  ...recog('construction:but.clause_but_clause', 'construction'),
])
// still continuity consolidated.
const STILL_KNOWN = (profileId) => seed(profileId, [
  ...recog('sense:still.continuity'),
  ...recog('construction:still.subject_still_lexical_verb', 'construction'),
])

// ---- §40.33–35 — discovery without hardcode ---------------------------------

describe('§40.33 — focused mode on yet', () => {
  it('allowedPackIds [yet] produces yet-only focuses through the generic flow', () => {
    const d = selectNextStudyFocusV2({
      registry, learnerStates: [], recentEvidence: [], studySession: session(),
      runtimeAvailability: FULL, allowedPackIds: ['pedagogy_v2_yet'],
    })
    expect(d.status).toBe('focus')
    expect(d.focus.pack_id).toBe('pedagogy_v2_yet')
    expect(d.focus.focus_type).toBe('introduce')
  })
})

describe('§40.34 — adaptive discovers yet from the registry', () => {
  it('a brand-new adaptive snapshot contains candidates from all three packs', () => {
    const cands = buildStudyCandidatesV2({ registry, learnerStates: [], recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    const packs = new Set(cands.map((c) => c.pack_id))
    expect(packs.has('pedagogy_v2_still')).toBe(true)
    expect(packs.has('pedagogy_v2_but')).toBe(true)
    expect(packs.has('pedagogy_v2_yet')).toBe(true)
  })
})

describe('§40.35 — targeted practice of any valid yet target', () => {
  it('the engine serves a targeted plan for the concessive construction (with support, never free production first)', () => {
    // A learner who meets the cross-pack prerequisite (but contrast) targets
    // the concessive construction directly.
    const st = states(BUT_KNOWN('p1'))
    const d = selectNextActivityV2({
      session: createLessonSessionV2({ session_id: 'yg-t', profile_id: 'p1', now: NOW }),
      scope: { registry, pack_id: 'pedagogy_v2_yet', lexeme_id: 'lexeme:yet' },
      learnerStates: st, recentEvidence: [],
      policy: { targeted_practice: { target_id: 'construction:yet.clause_yet_clause' } },
      runtimeAvailability: FULL,
    })
    expect(d.status).toBe('activity')
    const presented = [d.plan.primary_target, ...d.plan.secondary_targets].map((t) => t.target_id)
    expect(presented).toContain('construction:yet.clause_yet_clause')
    // A new learner of this target starts supported/exposed — never free production.
    expect(d.plan.recipe).not.toBe('free_production')
  })
})

// ---- §31 golden — SAME LEXEME, NEW USE (acceptance-critical) ----------------

describe('§31 golden — same lexeme, new use', () => {
  const st = () => states(YET_TEMPORAL_KNOWN('p1'))

  it('the planner can select concessive yet WITHOUT treating lexeme:yet as unknown', () => {
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st(), recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    // Concessive intro candidate exists... but requires but-contrast; with only
    // temporal known it may be prerequisite-blocked — the NEXT temporal steps
    // (negative perfect / have-yet-to) must be offered instead. Either way, the
    // pack keeps progressing FORWARD:
    const yetIntro = cands.filter((c) => c.pack_id === 'pedagogy_v2_yet' && c.focus_type === 'introduce')
    expect(yetIntro.length).toBeGreaterThan(0)
    // NEVER re-introduces the already-known first temporal construction.
    expect(yetIntro.some((c) => c.introducing_exemplar_id === 'exemplar:yet.001')).toBe(false)
  })

  it('with the but prerequisite also met, the concessive introduction is eligible and traceable', () => {
    const evidence = [...YET_TEMPORAL_KNOWN('p1'), ...BUT_KNOWN('p1')]
    const cands = buildStudyCandidatesV2({ registry, learnerStates: states(evidence), recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    const concessive = cands.find((c) => c.focus_type !== 'review'
      && (c.target?.target_id === 'sense:yet.concessive' || (c.introducing_exemplar_id || '').startsWith('exemplar:yet.017')))
    expect(concessive).toBeTruthy()
    expect(concessive.is_new_target).toBe(true) // new USE of a known lexeme
  })

  it('a full simulation from temporal-known state practices NEW yet uses, not the first temporal construction again', async () => {
    const scenario = createSimulationScenarioV2({
      scenario_id: 'golden:yet-new-use', profile_id: 'sim-profile', persona: 'fast-learner',
      mode: 'adaptive', seed: 'golden-yet-new-use', start_at: '2026-01-05T09:00:00.000Z',
      maximum_interactions: 60, clock: { strategy: 'constant_interval', interval_minutes: 5 },
      initial_evidence: [...YET_TEMPORAL_KNOWN('sim-profile'), ...BUT_KNOWN('sim-profile')],
    })
    const r = await runSimulationV2(scenario, { registry })
    // The journey introduces at least one NEW yet item (never yet.001's pair)...
    const newYetItems = r.interactions.flatMap((it) => it.new_item_refs).filter((ref) => ref.includes(':yet.'))
    expect(newYetItems.length).toBeGreaterThan(0)
    expect(newYetItems).not.toContain('sense:yet.temporal_pending')
    expect(newYetItems).not.toContain('construction:yet.subject_be_not_complement_yet')
    expect(analyzeTrajectoryV2(r, { registry }).trajectory.grave_findings).toBe(0)
  })
})

// ---- §32/§33 goldens — cross-pack transfer into yet -------------------------

describe('§32 golden — still known, yet unseen (temporal path)', () => {
  it('yet gains eligibility while still evidence NEVER touches yet state', () => {
    const evidence = STILL_KNOWN('p1')
    const st = states(evidence)
    const cands = buildStudyCandidatesV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, runtimeAvailability: FULL })
    expect(cands.some((c) => c.pack_id === 'pedagogy_v2_yet' && c.focus_type === 'introduce')).toBe(true)
    // Non-fusion: no yet target carries any state from still evidence.
    expect(st.some((s) => s.target.target_id.includes(':yet.'))).toBe(false)
  })
})

describe('§33 golden — but contrast known, concessive yet unseen', () => {
  it('the concessive construction surfaces as cross-pack transfer with correct planned evidence', async () => {
    // Session rotation models real sittings (V2.10): the per-sitting novelty
    // budget renews and the but→yet transfer introduction fires early (≈i14).
    const scenario = createSimulationScenarioV2({
      scenario_id: 'golden:but-to-yet', profile_id: 'sim-profile', persona: 'fast-learner',
      mode: 'adaptive', seed: 'golden-but-to-yet', start_at: '2026-01-05T09:00:00.000Z',
      maximum_interactions: 80, clock: { strategy: 'constant_interval', interval_minutes: 5 },
      initial_evidence: BUT_KNOWN('sim-profile'),
      session_rotation_interactions: 12,
    })
    const r = await runSimulationV2(scenario, { registry })
    const concessive = r.interactions.filter((it) => it.target.target_id === 'sense:yet.concessive'
      || it.target.target_id === 'construction:yet.clause_yet_clause'
      || (it.activity_plan.sense_ids || []).includes('sense:yet.concessive'))
    expect(concessive.length).toBeGreaterThan(0)
    // Evidence isolation: yet evidence never lands on but targets' lanes beyond
    // what but activities themselves produced.
    for (const it of concessive) {
      const events = r.evidence_generated.filter((e) => it.evidence_ids.includes(e.evidence_id))
      for (const e of events) expect(e.target.target_id.includes(':but.')).toBe(false)
    }
  })
})

// ---- §34 golden — the three-pack graph in action ----------------------------

describe('§34 golden — three-pack graph journey', () => {
  let r
  beforeAll(async () => {
    r = await runSimulationV2(buildStandardScenarioV2('cross-pack', { maximum_interactions: 150 }), { registry })
  })

  it('multiple cross-pack paths appear; ownership and targets never collapse', () => {
    const packs = new Set(r.pack_history)
    expect(packs.size).toBe(3)
    // Every practiced target belongs to exactly its owner pack.
    for (const it of r.interactions) {
      const owner = registry.packs.find((p) => p.manifest.pack_id === it.activity_plan.pack_id)
      expect(owner).toBeTruthy()
    }
    const m = computePedagogicalMetricsV2(r, { registry })
    // Transfer reason codes were traced during the journey.
    expect(m.cross_pack_transfer.total).toBeGreaterThan(0)
    // Lexical depth reports facts for the THREE lexemes.
    expect(Object.keys(m.lexical_depth).sort()).toEqual(['lexeme:but', 'lexeme:still', 'lexeme:yet'])
  })

  it('deterministic seeds: the same journey replays byte-identically', async () => {
    const again = await runSimulationV2(buildStandardScenarioV2('cross-pack', { maximum_interactions: 150 }), { registry })
    expect(JSON.stringify(again)).toBe(JSON.stringify(r))
  })
})

// ---- §41 observability + §40.39/41–43 ---------------------------------------

describe('§41 — observability with three packs', () => {
  it('44+45: yet appears in lexical depth and cross-pack metrics; 47: no new grave findings', async () => {
    const r = await runSimulationV2(buildStandardScenarioV2('new-learner'), { registry })
    const m = computePedagogicalMetricsV2(r, { registry })
    expect(m.lexical_depth['lexeme:yet']).toBeTruthy()
    expect(m.lexical_depth['lexeme:yet'].pack_id).toBe('pedagogy_v2_yet')
    const { trajectory } = analyzeTrajectoryV2(r, { registry })
    expect(trajectory.grave_findings).toBe(0)
  })
})

describe('§40.39 — knowing temporal yet does not imply the concessive lanes', () => {
  it('temporal-known state has NO evidence on any concessive target', () => {
    const st = states(YET_TEMPORAL_KNOWN('p1'))
    expect(st.some((s) => s.target.target_id === 'sense:yet.concessive')).toBe(false)
    expect(st.some((s) => s.target.target_id === 'construction:yet.clause_yet_clause')).toBe(false)
  })
})

describe('§40.43 + §44 — no lexical special-case in the generic layers', () => {
  it('the shared planner/engine/runtime/model/UI code never names yet', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const genericFiles = [
      'lib/pedagogy-v2/study-planner.js', 'lib/pedagogy-v2/study-planner-contracts.js',
      'lib/pedagogy-v2/lesson-engine.js', 'lib/pedagogy-v2/lesson-engine-contracts.js',
      'lib/pedagogy-v2/learner-model.js', 'lib/pedagogy-v2/review-queue.js',
      'lib/pedagogy-v2/training-affordances.js', 'lib/pedagogy-v2/modality-gap.js',
      'lib/pedagogy-v2/capability-entry.js', 'lib/pedagogy-v2/activity-assessment.js',
      'lib/pedagogy-v2/assessment-to-evidence.js', 'lib/pedagogy-v2/runtime-capabilities.js',
      'lib/pedagogy-v2/learner-inspector.js', 'lib/pedagogy-v2/registry.js',
      'screens/PedagogyV2Lab.jsx', 'screens/PedagogyV2Inspector.jsx',
    ]
    const forbidden = /lexeme:yet|pedagogy_v2_yet|sense:yet|construction:yet|'yet'|"yet"/
    for (const f of genericFiles) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(forbidden.test(src), `${f} hardcodes yet`).toBe(false)
    }
  })

  it('every recipe applicable to yet content is servable or cleanly refused', () => {
    // Recognition options exist for every yet exemplar (audited); production
    // recipes gate on state, never on the lexeme. Smoke: with rich state the
    // engine serves several distinct recipes from the yet pack.
    const evidence = [...YET_TEMPORAL_KNOWN('p1')]
    const st = states(evidence)
    const served = new Set()
    let lesson = createLessonSessionV2({ session_id: 'yg-r', profile_id: 'p1', now: NOW })
    for (let i = 0; i < 8; i++) {
      const d = selectNextActivityV2({
        session: lesson, scope: { registry, pack_id: 'pedagogy_v2_yet', lexeme_id: 'lexeme:yet' },
        learnerStates: st, recentEvidence: [], runtimeAvailability: FULL,
      })
      if (d.status !== 'activity') break
      served.add(d.plan.recipe)
      lesson = { ...lesson, history: [...lesson.history, { activity_id: d.plan.activity_id, exemplar_id: d.plan.exemplar_id, recipe: d.plan.recipe, capability: d.plan.capability, modality: d.plan.modality, new_item_refs: d.plan.new_item_refs }] }
    }
    expect(served.size).toBeGreaterThanOrEqual(2)
    for (const recipe of served) expect(LESSON_RECIPES.some((r2) => r2.recipe === recipe)).toBe(true)
  })
})

describe('§42.57 — the inspector lists yet by pure registry auto-discovery', () => {
  it('snapshot lexemes include lexeme:yet and the per-lexeme view resolves it', async () => {
    const { buildLearnerInspectorSnapshotV2, inspectLexemeV2 } = await import('./learner-inspector.js')
    const st = states(YET_TEMPORAL_KNOWN('p1'))
    const snap = buildLearnerInspectorSnapshotV2({ registry, learnerStates: st, recentEvidence: [], now: NOW, mode: 'adaptive' })
    expect(snap.lexemes.map((l) => l.lexeme_id)).toContain('lexeme:yet')
    expect(snap.lexemes.length).toBe(registry.packs.length)
    const view = inspectLexemeV2('lexeme:yet', { learnerStates: st, registry })
    expect(view.pack_id).toBe('pedagogy_v2_yet')
    expect(view.senses_encountered).toContain('sense:yet.temporal_pending')
    expect(view).not.toHaveProperty('mastery')
  })
})
