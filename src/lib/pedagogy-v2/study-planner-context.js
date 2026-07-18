// study-planner-context.js — READ-ONLY snapshot the Study Planner consumes.
// Unlike the lesson-engine context (which filters to ONE active pack), the
// planner deliberately sees the WHOLE multi-pack picture: every learner state
// and the recent evidence tail across packs — that is exactly the information
// "what should be studied next" depends on. Building a context writes nothing.

import { getLearnerEvidenceV2, getLearnerTargetStatesV2 } from '../storage.js'
import { loadPedagogyV2Registry } from './registry.js'

export const STUDY_PLANNER_CONTEXT_V2_VERSION = 1

export async function buildStudyPlannerContextV2(profileId, {
  now, registry = null, recentEvidenceLimit = 100,
} = {}) {
  if (typeof now !== 'string' || Number.isNaN(Date.parse(now))) throw new Error('CONTEXT_NOW_REQUIRED')
  const reg = registry ?? loadPedagogyV2Registry()
  const [learner_states, evidence] = await Promise.all([
    getLearnerTargetStatesV2(profileId),
    getLearnerEvidenceV2(profileId),
  ])
  return {
    context_version: STUDY_PLANNER_CONTEXT_V2_VERSION,
    profile_id: profileId,
    now,
    registry_version: reg.registry_version,
    pack_ids: [...reg.pack_ids],
    learner_states,
    recent_evidence: evidence.slice(-recentEvidenceLimit),
  }
}
