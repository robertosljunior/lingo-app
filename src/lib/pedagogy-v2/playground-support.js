// playground-support.js — PURE helpers for the Slice V2.12 Pedagogy V2
// Playground. Two jobs, both side-effect free:
//
//   1. enumerate a pack's referenced targets for the "Testar target" selectors;
//   2. synthesize an in-memory learner state for "Teste isolado" so a requested
//      (capability, modality) domain becomes materializable WITHOUT reading or
//      writing the real learner model (§13 — "contexto controlado/in-memory").
//
// The synthesis only warms the ladder rungs STRICTLY BELOW the requested
// capability (so the requested rung stays fresh and is the one the engine
// trains), plus fully warms external cross-pack prerequisite targets so their
// prerequisites resolve as met. It never fabricates evidence for the requested
// rung itself, and it is never persisted.

import { CAPABILITY_LADDER } from './capability-entry.js'
import { buildLearnerEvidenceV2 } from './learner-evidence-contracts.js'
import { aggregateProfileEvidence } from './learner-model.js'
import { resolvePedagogyEntity } from './registry.js'

// Enough correct, unaided, DIRECT events to clear the emerging evidence level
// (threshold 2) and the 0.7 advancement mastery bar for a lane.
const WARM_EVENTS_PER_KEY = 3

const ACTIVITY_KIND_FOR_CAPABILITY = {
  recognition: 'meaning_recognition',
  comprehension: 'meaning_recognition',
  controlled_production: 'guided_production',
  free_production: 'free_production',
  pronunciation: 'pronunciation',
}

/** The pedagogical targets a pack owns/references, for the Target-mode selector. */
export function packReferencedTargetsV2(pack) {
  if (!pack) return []
  const label = (v, fallback) => (typeof v === 'string' && v.trim()) ? v : (v?.pt || v?.en || fallback)
  const out = []
  for (const s of pack.senses || []) out.push({ target_type: 'sense', target_id: s.sense_id, label: label(s.label, s.meaning_pt || s.sense_id) })
  for (const c of pack.constructions || []) out.push({ target_type: 'construction', target_id: c.construction_id, label: label(c.label, c.construction_id) })
  if (pack.manifest?.primary_lexeme_id) out.push({ target_type: 'lexeme_usage', target_id: pack.manifest.primary_lexeme_id, label: `uso de ${pack.manifest.primary_lexeme_id}` })
  return out
}

// The capability keys (`modality_capability`) whose lanes must be warmed so the
// gate for `capability` opens, leaving `capability` itself unwarmed.
export function prerequisiteKeysForFocusV2(capability, modality) {
  if (!capability) return { warmExposure: false, keys: [] }
  const keys = new Set()
  switch (capability) {
    case 'recognition':
      break // only needs exposure > 0
    case 'comprehension':
      keys.add(`${modality || 'reading'}_recognition`)
      break
    case 'controlled_production':
      keys.add('reading_recognition')
      keys.add('listening_recognition')
      break
    case 'free_production':
      keys.add('reading_recognition')
      keys.add(`${modality || 'writing'}_controlled_production`)
      break
    case 'pronunciation':
      keys.add('reading_recognition')
      keys.add('writing_controlled_production')
      keys.add('speaking_controlled_production')
      break
    default:
      break
  }
  return { warmExposure: true, keys: [...keys] }
}

const FULL_WARM_KEYS = ['reading_recognition', 'listening_recognition', 'writing_controlled_production', 'speaking_controlled_production']

function warmEventsForTarget(target, { warmExposure, keys }, profileId, counter) {
  const events = []
  const t0 = Date.UTC(2026, 0, 1, 0, 0, 0)
  const emit = (activity, attribution, outcome) => {
    const seq = counter.n++
    events.push(buildLearnerEvidenceV2({
      evidence_id: `evidence:playground-iso.${seq}`,
      profile_id: profileId,
      interaction_id: `interaction:playground-iso.${seq}`,
      session_id: 'session:playground-isolated',
      target: { target_type: target.target_type, target_id: target.target_id },
      exemplar_id: null,
      activity,
      attribution,
      outcome,
      source: { source_type: 'playground_isolated' },
      occurred_at: new Date(t0 + seq * 60000).toISOString(),
    }))
  }
  if (warmExposure) emit({ activity_kind: 'exposure', capability: 'recognition', modality: 'reading' }, 'exposure', 'observed')
  for (const key of keys) {
    const idx = key.indexOf('_')
    const modality = key.slice(0, idx)
    const capability = key.slice(idx + 1)
    for (let i = 0; i < WARM_EVENTS_PER_KEY; i++) {
      emit({ activity_kind: ACTIVITY_KIND_FOR_CAPABILITY[capability] || 'meaning_recognition', capability, modality }, 'direct', 'correct')
    }
  }
  return events
}

/**
 * Synthesize the isolated in-memory learner states for a focus.
 *   synthesizeIsolatedStatesV2({ registry, pack, capability, modality, externalPrerequisiteTargets })
 * Returns { states, evidence } — never touches storage. Empty for an
 * introduction focus (capability null) so exposure remains materializable.
 */
export function synthesizeIsolatedStatesV2({ registry, pack, capability = null, modality = null, externalPrerequisiteTargets = [], profileId = 'playground-isolated' }) {
  const counter = { n: 0 }
  const prereq = prerequisiteKeysForFocusV2(capability, modality)
  const events = []

  for (const t of packReferencedTargetsV2(pack)) {
    events.push(...warmEventsForTarget(t, prereq, profileId, counter))
  }
  // Cross-pack prerequisite targets are background knowledge — fully warmed so
  // their prerequisite checks resolve as met regardless of the required rung.
  for (const ext of externalPrerequisiteTargets) {
    const hit = resolvePedagogyEntity(ext.target_id, registry)
    const kind = hit?.kind
    const target_type = kind === 'lexeme' ? 'lexeme_usage' : kind
    if (!target_type) continue
    events.push(...warmEventsForTarget({ target_type, target_id: ext.target_id }, { warmExposure: true, keys: FULL_WARM_KEYS }, profileId, counter))
  }

  return { states: aggregateProfileEvidence(events), evidence: events }
}

export { CAPABILITY_LADDER }
