// lesson-engine-context.js — READ-ONLY integration between the lesson engine
// and the approved V2.2 persistence (storage.js). Builds a
// LessonEngineContextV2 snapshot for selectNextActivityV2.
//
// Guarantees (proven by tests): building a context writes nothing — no
// evidence, no state rebuilds — and it never touches the V1 skill_profiles.
// `now` is REQUIRED so the engine core stays free of any clock read.

import { getLearnerEvidenceV2, getLearnerTargetStatesV2 } from '../storage.js'
import { LESSON_ENGINE_CONTEXT_V2_VERSION } from './lesson-engine-contracts.js'

export async function buildLessonEngineContextV2(profileId, { now, packId = null, recentEvidenceLimit = 50 } = {}) {
  if (typeof now !== 'string' || Number.isNaN(Date.parse(now))) throw new Error('CONTEXT_NOW_REQUIRED')
  const [learner_states, evidence] = await Promise.all([
    getLearnerTargetStatesV2(profileId),
    getLearnerEvidenceV2(profileId),
  ])
  return {
    context_version: LESSON_ENGINE_CONTEXT_V2_VERSION,
    profile_id: profileId,
    now,
    pack_id: packId,
    learner_states,
    // getLearnerEvidenceV2 returns chronological order; keep the tail.
    recent_evidence: evidence.slice(-recentEvidenceLimit),
  }
}
