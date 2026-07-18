// lesson-engine-context.js — READ-ONLY integration between the lesson engine
// and the approved V2.2 persistence (storage.js). Builds a
// LessonEngineContextV2 snapshot for selectNextActivityV2.
//
// Guarantees (proven by tests): building a context writes nothing — no
// evidence, no state rebuilds — and it never touches the V1 skill_profiles.
// `now` is REQUIRED so the engine core stays free of any clock read.
//
// Slice V2.5 (context_version 2): the context declares its multi-pack scope —
// registry version, active pack, active lexeme, declared dependencies and the
// external targets used as prerequisites. When a pack scope is given, learner
// states and recent evidence are FILTERED to the targets relevant to that pack
// (its own entities plus every reference its exemplars declare) instead of
// loading the whole history indiscriminately.

import { getLearnerEvidenceV2, getLearnerTargetStatesV2 } from '../storage.js'
import { LESSON_ENGINE_CONTEXT_V2_VERSION } from './lesson-engine-contracts.js'
import { loadPedagogyV2Registry, getPedagogyPack, resolvePedagogyEntity } from './registry.js'
import { getV2Prerequisites, getIntendedNewItems } from './query.js'

/** Every target id relevant to a pack: its own entities + declared references. */
function relevantTargetIdsForPack(pack) {
  const ids = new Set()
  for (const l of pack.lexemes || []) ids.add(l.lexeme_id)
  for (const s of pack.senses || []) ids.add(s.sense_id)
  for (const c of pack.constructions || []) {
    ids.add(c.construction_id)
    for (const pid of c.prerequisite_construction_ids || []) ids.add(pid)
  }
  for (const f of pack.communicative_functions || []) ids.add(f.function_id)
  for (const e of pack.exemplars || []) {
    if (e.construction_id) ids.add(e.construction_id)
    for (const sid of e.sense_ids || []) ids.add(sid)
    for (const fid of e.communicative_function_ids || []) ids.add(fid)
    for (const t of e.pedagogical_targets || []) ids.add(t.target_id)
    for (const p of getV2Prerequisites(e)) ids.add(p.ref)
    for (const n of getIntendedNewItems(e)) ids.add(n.ref)
  }
  return ids
}

export async function buildLessonEngineContextV2(profileId, {
  now, packId = null, lexemeId = null, registry = null, recentEvidenceLimit = 50,
} = {}) {
  if (typeof now !== 'string' || Number.isNaN(Date.parse(now))) throw new Error('CONTEXT_NOW_REQUIRED')

  const reg = registry ?? (packId ? loadPedagogyV2Registry() : null)
  let activePack = null
  if (packId) {
    activePack = getPedagogyPack(packId, reg)
    if (!activePack) throw new Error(`CONTEXT_PACK_UNKNOWN:${packId}`)
  }

  const [allStates, allEvidence] = await Promise.all([
    getLearnerTargetStatesV2(profileId),
    getLearnerEvidenceV2(profileId),
  ])

  let learnerStates = allStates
  let evidence = allEvidence
  let externalPrerequisiteTargets = []
  if (activePack) {
    const relevant = relevantTargetIdsForPack(activePack)
    learnerStates = allStates.filter((s) => relevant.has(s.target?.target_id))
    evidence = allEvidence.filter((e) => relevant.has(e.target?.target_id))
    // Targets used as prerequisites that are OWNED by another pack — declared
    // explicitly so the engine/UI can see the cross-pack curricular edges.
    const externalIds = new Set()
    for (const e of activePack.exemplars || []) {
      for (const p of getV2Prerequisites(e)) {
        const owner = resolvePedagogyEntity(p.ref, reg)
        if (owner && owner.pack_id !== packId) externalIds.add(`${p.ref}|${owner.pack_id}`)
      }
    }
    externalPrerequisiteTargets = [...externalIds].sort().map((row) => {
      const [target_id, pack_id] = row.split('|')
      return { target_id, pack_id }
    })
  }

  return {
    context_version: LESSON_ENGINE_CONTEXT_V2_VERSION,
    profile_id: profileId,
    now,
    pack_id: packId,
    registry_version: reg?.registry_version ?? null,
    active_pack_id: packId,
    active_lexeme_id: lexemeId ?? activePack?.manifest?.primary_lexeme_id ?? null,
    dependencies: activePack?.manifest?.dependencies?.map((d) => ({ ...d })) ?? [],
    external_prerequisite_targets: externalPrerequisiteTargets,
    learner_states: learnerStates,
    // storage returns chronological order; keep the newest tail.
    recent_evidence: evidence.slice(-recentEvidenceLimit),
  }
}
