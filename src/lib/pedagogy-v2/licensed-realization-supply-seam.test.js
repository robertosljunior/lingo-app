// licensed-realization-supply-seam.test.js — V2.25 (#82) supply seam.
//
// The lesson engine has accepted `licensedRealizations` since V2.24, but no
// production path forwarded it: the learner-facing chain
// (study-session-controller → study-focus-resolver → selectNextActivityV2) left
// it undefined, so every real Praticar session ran with `licensedEnabled ===
// false` and `derivedExemplars === []`. The compiler existed and nothing could
// switch it on, which is why "add more realizations" could never be tested
// against the real flow.
//
// This file pins the seam in both directions:
//   * OFF BY DEFAULT — the learner-facing default is authored exemplars only,
//     so adding the seam changes no shipped behaviour. #97 (lexical
//     diagnosticity) and #82 gate what may ever turn it on for a learner.
//   * REACHABLE — a caller that opts in reaches the engine, which is the
//     precondition for running the #82 BEFORE/AFTER experiment at all.
//
// It also pins the supply precondition #82 states for its pilot focus
// (`eligible_realizations_per_focus >= max_activities_per_session`), so a
// content change that silently drops the pilot below it fails here rather than
// quietly invalidating the experiment.

import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { resolveNextStudyActivityV2 } from './study-focus-resolver.js'
import { studyFocusKeyV2 } from './study-planner.js'
import { materializeLicensedRealizationsForPack } from './licensed-realizations.js'
import { DEFAULT_LESSON_ENGINE_POLICY_V2 } from './lesson-engine-contracts.js'

const PILOT_CONSTRUCTION = 'construction:still.subject_still_lexical_verb'

const focus = {
  pack_id: 'pedagogy_v2_still',
  focus_type: 'deepen',
  lexeme_id: 'lexeme:still',
  target: { target_type: 'construction', target_id: PILOT_CONSTRUCTION },
  capability: 'recognition',
  modality: 'reading',
  is_new_target: false,
}

/** A planner that offers exactly one focus, then exhausts. */
function onePlanner() {
  let served = false
  return () => {
    const universe = { candidates: [{ key: studyFocusKeyV2(focus) }], excluded: [] }
    if (served) return { status: 'no_eligible_focus', focus: null, trace: universe }
    served = true
    return { status: 'focus', focus, trace: universe }
  }
}

function captureEngine(seen) {
  return (args) => {
    seen.push(args)
    return { status: 'activity', plan: { activity_id: 'act:1' } }
  }
}

const resolve = (over = {}) => {
  const seen = []
  const result = resolveNextStudyActivityV2({
    registry: { packs: [stillPack] },
    studySession: { study_session_id: 's', mode: 'adaptive', now: '2026-08-01T09:00:00.000Z', pack_history: [], focus_history: [] },
    now: '2026-08-01T09:00:00.000Z',
    makeLessonSessionId: () => 'lesson:1',
    selectFocus: onePlanner(),
    selectActivity: captureEngine(seen),
    ...over,
  })
  return { result, seen }
}

describe('licensed-realization supply seam', () => {
  it('is OFF by default — the learner-facing chain serves authored exemplars only', () => {
    const { result, seen } = resolve()
    expect(result.status).toBe('activity')
    expect(seen).toHaveLength(1)
    // Explicitly null, not merely absent: the engine reads
    // `licensedRealizations?.enabled === true`, so this is what keeps
    // `derivedExemplars` empty for every real session today.
    expect(seen[0].licensedRealizations ?? null).toBeNull()
  })

  it('forwards an opted-in supply configuration to the engine', () => {
    const licensedRealizations = { enabled: true, allow_provisional: true }
    const { seen } = resolve({ licensedRealizations })
    expect(seen[0].licensedRealizations).toEqual(licensedRealizations)
  })

  it('the still pilot supplies the #82 experiment floor for its focus', () => {
    // Human-approved only: nothing materializes yet — the pilot allowlist is
    // entirely `provisional_nonhuman`, so no learner can meet these sentences
    // without an explicit, auditable opt-in.
    expect(materializeLicensedRealizationsForPack(stillPack, { allowProvisional: false })).toHaveLength(0)

    const derived = materializeLicensedRealizationsForPack(stillPack, { allowProvisional: true })
    const authored = stillPack.exemplars.filter((e) => e.construction_id === PILOT_CONSTRUCTION)
    for (const realization of derived) expect(realization.construction_id).toBe(PILOT_CONSTRUCTION)

    // #82's precondition: the pilot focus must be able to offer at least one
    // distinct realization per activity of a full session, or the experiment
    // cannot separate supply from scheduling.
    expect(derived.length + authored.length)
      .toBeGreaterThanOrEqual(DEFAULT_LESSON_ENGINE_POLICY_V2.max_activities_per_session)

    // A licensed variant never smuggles in lexical curriculum (#97).
    for (const realization of derived) expect(realization.intended_new_items ?? []).toEqual([])
  })
})
