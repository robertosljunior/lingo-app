// study-focus-resolver.test.js — Slice V2.16. The shared Planner→Engine
// materialization bridge: no magic cap, termination by candidate exhaustion,
// each focus key attempted at most once, invariants, and the three outcome
// states. Synthetic candidate pools (§27) drive scalability without real packs
// by injecting synthetic planner/engine seams; the real registry regression
// lives in study-focus-resolver-regression.test.js.

import { describe, it, expect } from 'vitest'
import {
  resolveNextStudyActivityV2, buildFocusMaterializationMetricsV2,
  detectMaterializationRejectionPressureV2, engineRejectionReasonCodesV2,
  FocusResolutionInvariantError, STUDY_FOCUS_RESOLVER_VERSION,
} from './study-focus-resolver.js'
import { studyFocusKeyV2 } from './study-planner.js'

// ---- synthetic harness ------------------------------------------------------

const keyFor = (i) => `p|deepen|t${i}|recognition|reading`
function focusFromKey(key) {
  const [pack_id, focus_type, target, capability, modality] = key.split('|')
  return {
    pack_id, focus_type, lexeme_id: 'lex:p',
    target: target === '-' ? null : { target_type: 'sense', target_id: target },
    capability: capability === '-' ? null : capability,
    modality: modality === '-' ? null : modality,
    is_new_target: false,
  }
}

// A planner over a fixed universe of N keys, returning the first non-suppressed
// key in rank order; trace exposes the full candidate universe every call.
function syntheticPlanner(n) {
  const universe = Array.from({ length: n }, (_, i) => keyFor(i))
  let calls = 0
  const fn = ({ suppressedFocusKeys = [] }) => {
    calls++
    const suppressed = new Set(suppressedFocusKeys)
    const candidates = universe.map((k) => ({ key: k }))
    const next = universe.find((k) => !suppressed.has(k))
    if (!next) return { status: 'no_eligible_focus', focus: null, trace: { candidates, excluded: [...suppressed].map((k) => ({ key: k })) } }
    return { status: 'focus', focus: focusFromKey(next), trace: { candidates, excluded: [...suppressed].map((k) => ({ key: k })) } }
  }
  return { fn, universe, get calls() { return calls } }
}

// An engine that materializes iff the target id is in `materializable`.
function syntheticEngine(materializableTargetIds, { calls } = {}) {
  const set = new Set(materializableTargetIds)
  const c = calls || { n: 0 }
  const fn = ({ focus }) => {
    c.n++
    if (set.has(focus.target_id)) return { status: 'activity', plan: { activity_id: `act:${focus.target_id}`, target_id: focus.target_id } }
    return { status: 'no_eligible_activity', trace: { excluded: [{ exemplar_id: 'x', reason: 'exemplar_cooldown' }] } }
  }
  return { fn, engineCalls: c }
}

const baseArgs = (planner, engine) => ({
  registry: {}, studySession: { mode: 'adaptive', now: 't', seed: 's', pack_history: [], focus_history: [] },
  makeLessonSessionId: (pack) => `ls:${pack}:1`, now: 't',
  selectFocus: planner.fn, selectActivity: engine.fn,
})

// ---- §36.1 contract ---------------------------------------------------------

describe('§36.1 — resolver contract', () => {
  it('materializes rank 1 and reports the trace', () => {
    const planner = syntheticPlanner(100)
    const engine = syntheticEngine(['t0'])
    const r = resolveNextStudyActivityV2(baseArgs(planner, engine))
    expect(r.status).toBe('activity')
    expect(r.resolution_trace.resolver_version).toBe(STUDY_FOCUS_RESOLVER_VERSION)
    expect(r.resolution_trace.selected.planner_rank).toBe(1)
    expect(r.resolution_trace.attempted_count).toBe(1)
    expect(r.resolution_trace.candidate_count).toBe(100)
    expect(studyFocusKeyV2(r.focus)).toBe('p|deepen|t0|recognition|reading')
  })
})

// ---- §36.2/3/4 — rank 1 / mid / 100 -----------------------------------------

describe('§14/§16/§36 — rank selection without a magic cap', () => {
  it('§16 rank 1 materializable → attempted_count 1 (no wasted attempts)', () => {
    const planner = syntheticPlanner(100)
    const r = resolveNextStudyActivityV2(baseArgs(planner, syntheticEngine(['t0'])))
    expect(r.resolution_trace.attempted_count).toBe(1)
    expect(r.resolution_trace.selected.planner_rank).toBe(1)
  })

  it('§36.3 intermediate rank (7) materializes', () => {
    const planner = syntheticPlanner(100)
    const r = resolveNextStudyActivityV2(baseArgs(planner, syntheticEngine(['t6'])))
    expect(r.status).toBe('activity')
    expect(r.resolution_trace.selected.planner_rank).toBe(7)
    expect(r.resolution_trace.attempted_count).toBe(7)
  })

  it('§14 rank 100 materializes — would FAIL under the old cap of 60', () => {
    const planner = syntheticPlanner(100)
    const r = resolveNextStudyActivityV2(baseArgs(planner, syntheticEngine(['t99'])))
    expect(r.status).toBe('activity')
    expect(r.resolution_trace.selected.planner_rank).toBe(100)
    expect(r.resolution_trace.attempted_count).toBe(100)
  })
})

// ---- §15/§18 — all rejected → no_materializable_focus -----------------------

describe('§15/§18 — planner_empty vs no_materializable_focus', () => {
  it('§15 all 100 candidates non-materializable → no_materializable_focus (not session complete after 60)', () => {
    const planner = syntheticPlanner(100)
    const r = resolveNextStudyActivityV2(baseArgs(planner, syntheticEngine([])))
    expect(r.status).toBe('no_materializable_focus')
    expect(r.resolution_trace.candidate_count).toBe(100)
    expect(r.resolution_trace.attempted_count).toBe(100)
  })

  it('§18 no eligible focus at all → planner_empty (distinct from no_materializable_focus)', () => {
    const planner = syntheticPlanner(0)
    const r = resolveNextStudyActivityV2(baseArgs(planner, syntheticEngine([])))
    expect(r.status).toBe('planner_empty')
    expect(r.resolution_trace.attempted_count).toBe(0)
  })
})

// ---- §17 — key uniqueness + exhaustion --------------------------------------

describe('§17 — key uniqueness and exhaustion', () => {
  it('each focus key appears at most once across attempts', () => {
    const planner = syntheticPlanner(50)
    const r = resolveNextStudyActivityV2(baseArgs(planner, syntheticEngine([])))
    const keys = r.resolution_trace.attempts.map((a) => a.focus_key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBe(50)
  })

  it('a planner that re-returns a suppressed key → FOCUS_RESOLUTION_DUPLICATE_ATTEMPT', () => {
    // Buggy planner: always returns the same focus, ignoring suppression.
    const buggy = () => ({ status: 'focus', focus: focusFromKey('p|deepen|t0|recognition|reading'), trace: { candidates: [{ key: 'p|deepen|t0|recognition|reading' }, { key: 'p|deepen|t1|recognition|reading' }], excluded: [] } })
    expect(() => resolveNextStudyActivityV2({ ...baseArgs(syntheticPlanner(2), syntheticEngine([])), selectFocus: buggy }))
      .toThrow(FocusResolutionInvariantError)
  })

  it('a planner returning a key outside its universe → FOCUS_RESOLUTION_SELECTED_UNRANKED_CANDIDATE', () => {
    const rogue = () => ({ status: 'focus', focus: focusFromKey('p|deepen|t999|recognition|reading'), trace: { candidates: [{ key: 'p|deepen|t0|recognition|reading' }], excluded: [] } })
    expect(() => resolveNextStudyActivityV2({ ...baseArgs(syntheticPlanner(1), syntheticEngine([])), selectFocus: rogue }))
      .toThrow(/UNRANKED_CANDIDATE/)
  })
})

// ---- §9 — lesson-session recreation -----------------------------------------

describe('§9 — lesson-session recreation on session_complete', () => {
  it('recreates the lesson session once, then materializes', () => {
    let firstCall = true
    const engine = { fn: ({ focus }) => {
      if (firstCall) { firstCall = false; return { status: 'session_complete' } }
      return { status: 'activity', plan: { activity_id: 'a', target_id: focus.target_id } }
    } }
    const madeIds = []
    const r = resolveNextStudyActivityV2({
      ...baseArgs(syntheticPlanner(5), engine),
      makeLessonSessionId: (pack) => { const id = `ls:${pack}:${madeIds.length + 1}`; madeIds.push(id); return id },
    })
    expect(r.status).toBe('activity')
    expect(madeIds.length).toBe(2) // original + recreated
    expect(r.lesson_session.session_id).toBe('ls:p:2')
  })
})

// ---- §13/§14 — engine rejection reason codes --------------------------------

describe('§8 — structured engine rejection reason codes', () => {
  it('maps engine statuses/enums without parsing free text', () => {
    expect(engineRejectionReasonCodesV2({ status: 'session_complete' })).toEqual(['ENGINE_SESSION_EXHAUSTED'])
    expect(engineRejectionReasonCodesV2({ status: 'focus_not_executable', reason: 'FOCUS_INDEPENDENCE_NOT_EXECUTABLE' })).toEqual(['ENGINE_FOCUS_INDEPENDENCE_NOT_EXECUTABLE'])
    expect(engineRejectionReasonCodesV2({ status: 'no_eligible_activity', trace: { excluded: [{ reason: 'prerequisite_unmet:x' }] } })).toEqual(['ENGINE_PREREQUISITE_UNMET'])
    expect(engineRejectionReasonCodesV2({ status: 'no_eligible_activity', trace: { excluded: [{ reason: 'no_safe_options' }] } })).toEqual(['ENGINE_NO_SAFE_RECIPE'])
    expect(engineRejectionReasonCodesV2({ status: 'no_eligible_activity', trace: { excluded: [{ reason: 'exemplar_cooldown' }] } })).toEqual(['ENGINE_NO_ELIGIBLE_EXEMPLAR'])
  })
})

// ---- §32 — determinism ------------------------------------------------------

describe('§32 — deterministic resolution', () => {
  it('same inputs → identical resolution trace (structurally)', () => {
    const run = () => resolveNextStudyActivityV2(baseArgs(syntheticPlanner(30), syntheticEngine(['t20'])))
    const a = run(); const b = run()
    expect(JSON.stringify(a.resolution_trace)).toBe(JSON.stringify(b.resolution_trace))
  })
})

// ---- §27 — synthetic scalability (10/50/100/250/500) ------------------------

describe('§27/§28 — cost grows with candidates, not with a magic constant', () => {
  for (const n of [10, 50, 100, 250, 500]) {
    it(`${n} candidates, only the last materializes → attempted_count = ${n}`, () => {
      const planner = syntheticPlanner(n)
      const engineCalls = { n: 0 }
      const engine = syntheticEngine([`t${n - 1}`], { calls: engineCalls })
      const r = resolveNextStudyActivityV2(baseArgs(planner, engine))
      expect(r.status).toBe('activity')
      expect(r.resolution_trace.attempted_count).toBe(n)
      expect(r.resolution_trace.selected.planner_rank).toBe(n)
      // engine attempts == planner attempts == candidate rank reached (§28 shape)
      expect(engineCalls.n).toBe(n)
      expect(planner.calls).toBe(n)
    })
  }
})

// ---- §21/§22 — metrics + rejection-pressure warning -------------------------

describe('§21/§22 — materialization metrics and rejection warning', () => {
  it('aggregates materialization rate, selected rank, and reason distribution', () => {
    const resolutions = [
      resolveNextStudyActivityV2(baseArgs(syntheticPlanner(100), syntheticEngine(['t0']))),   // rank 1
      resolveNextStudyActivityV2(baseArgs(syntheticPlanner(100), syntheticEngine(['t9']))),   // rank 10
      resolveNextStudyActivityV2(baseArgs(syntheticPlanner(100), syntheticEngine([]))),        // no_materializable
    ]
    const m = buildFocusMaterializationMetricsV2(resolutions)
    expect(m.resolution_count).toBe(3)
    expect(m.no_materializable_focus_count).toBe(1)
    expect(m.mean_selected_rank).toBeCloseTo((1 + 10) / 2, 4)
    expect(m.top_rank_materialization_rate).toBeCloseTo(0.5, 4)
    expect(m.rejection_reason_distribution.ENGINE_NO_ELIGIBLE_EXEMPLAR).toBeGreaterThan(0)
  })

  it('detects MATERIALIZATION_REJECTION_PRESSURE when rejection is high', () => {
    const heavy = resolveNextStudyActivityV2(baseArgs(syntheticPlanner(100), syntheticEngine(['t50']))) // rank 51
    const m = buildFocusMaterializationMetricsV2([heavy])
    const findings = detectMaterializationRejectionPressureV2(m)
    expect(findings.some((f) => f.code === 'MATERIALIZATION_REJECTION_PRESSURE')).toBe(true)
  })

  it('no warning when materialization is efficient', () => {
    const easy = resolveNextStudyActivityV2(baseArgs(syntheticPlanner(100), syntheticEngine(['t0'])))
    expect(detectMaterializationRejectionPressureV2(buildFocusMaterializationMetricsV2([easy]))).toEqual([])
  })
})
