import { describe, it, expect } from 'vitest'
import stillPack from '../../content/pedagogy-v2/still.json'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { getPrimaryTargets } from './query.js'
import { buildStudyCandidatesV2 } from './study-planner.js'
import { loadPedagogyV2Registry } from './registry.js'
import { computeRecipeRuntimeAvailability } from './runtime-capabilities.js'

const T0 = Date.UTC(2026, 7, 9, 16, 0, 0)
let seq = 0
const iso = (n) => new Date(T0 + n * 60000).toISOString()
const activity = (capability, modality) => ({
  activity_kind: modality === 'listening' ? 'listening_recognition' : 'meaning_recognition',
  capability,
  modality,
})

function evidence(target, capability, modality, n = 3) {
  return Array.from({ length: n }, () => {
    seq += 1
    return buildLearnerEvidenceV2({
      evidence_id: `evidence:p0-planner.${seq}`,
      profile_id: 'p0-planner',
      interaction_id: `interaction:p0-planner.${seq}`,
      target,
      exemplar_id: null,
      activity: activity(capability, modality),
      attribution: 'direct',
      outcome: 'correct',
      occurred_at: iso(seq),
      source: { source_type: 'test' },
    })
  })
}

function exposure(target) {
  seq += 1
  return buildLearnerEvidenceV2({
    evidence_id: `evidence:p0-planner.${seq}`,
    profile_id: 'p0-planner',
    interaction_id: `interaction:p0-planner.${seq}`,
    target,
    exemplar_id: null,
    activity: { activity_kind: 'exposure', capability: 'recognition', modality: 'reading' },
    attribution: 'exposure',
    outcome: 'observed',
    occurred_at: iso(seq),
    source: { source_type: 'test' },
  })
}

const runtimeAvailability = computeRecipeRuntimeAvailability({
  text_input: true,
  audio_output: true,
  speech_input: false,
  semantic_assessment: true,
  pronunciation_assessment: false,
})

const registry = loadPedagogyV2Registry()
const exemplar = stillPack.exemplars.find((row) => row.exemplar_id === 'exemplar:still.001')
const targets = getPrimaryTargets(exemplar).map((target) => ({ target_type: target.target_type, target_id: target.target_id }))
const focusTargetIds = new Set(targets.map((target) => target.target_id))

function plannerCandidates({ includeComprehension }) {
  const events = []
  for (const target of targets) {
    events.push(exposure(target))
    events.push(...evidence(target, 'recognition', 'reading'), ...evidence(target, 'recognition', 'listening'))
    if (includeComprehension) {
      events.push(...evidence(target, 'comprehension', 'reading'), ...evidence(target, 'comprehension', 'listening'))
    }
  }
  return buildStudyCandidatesV2({
    registry,
    learnerStates: aggregateProfileEvidence(events),
    recentEvidence: events,
    allowedPackIds: [stillPack.manifest.pack_id],
    now: iso(500),
    runtimeAvailability,
  })
}

describe('#106 — planner reachability is measured separately from engine selection', () => {
  it('keeps the active frontier on comprehension when recognition is established but comprehension is not', () => {
    const candidates = plannerCandidates({ includeComprehension: false })
    const inFocus = candidates.filter((row) => focusTargetIds.has(row.target?.target_id))

    expect(inFocus.some((row) => row.capability === 'comprehension')).toBe(true)
    expect(inFocus.some((row) => row.capability === 'controlled_production')).toBe(false)
  })

  it('emits controlled-production writing candidates after recognition and comprehension are established', () => {
    const candidates = plannerCandidates({ includeComprehension: true })
    const production = candidates.filter((row) =>
      focusTargetIds.has(row.target?.target_id)
      && row.capability === 'controlled_production'
      && row.modality === 'writing')

    expect(production.length).toBeGreaterThan(0)
  })
})
