// simulation-personas.test.js — §24. The artificial personas and the
// deterministic response model. Personas are behavioral CONFIG (never learner
// state); the success draw is a pure seeded hash — identical seed/index/plan
// always yields the identical outcome, and the modelled asymmetries hold.

import { describe, it, expect } from 'vitest'
import { SIMULATION_PERSONAS, PERSONA_IDS, getPersona } from './simulation-personas.js'
import {
  hash01, personaSuccessProbability, personaSucceeds,
} from './simulation-response-model.js'

// A minimal ActivityPlanV2-shaped stub carrying only the fields the response
// model reads. `tier` picks the support lane; `now` powers forgetting.
function planStub({ modality = 'reading', capability = 'recognition', recipe = 'meaning_recognition', tier = 'high', targetId = 'sense:still.continuity', now = '2026-01-05T09:00:00.000Z' } = {}) {
  return {
    modality, capability, recipe,
    primary_target: { target_type: 'sense', target_id: targetId },
    support: { derived_tier: tier },
    __now_ms: Date.parse(now),
  }
}
const NO_STATES = new Map()

describe('§24.1 — the seven personas all exist and are well-formed config', () => {
  it('every persona has a skill map and modulation knobs (never learner state)', () => {
    expect(PERSONA_IDS).toHaveLength(7)
    for (const id of PERSONA_IDS) {
      const p = SIMULATION_PERSONAS[id]
      expect(p.id).toBe(id)
      expect(typeof p.skill.recognition).toBe('number')
      expect(typeof p.support_bonus).toBe('number')
      expect(typeof p.independent_penalty).toBe('number')
      expect(typeof p.learning_rate).toBe('number')
      // No learner-model fields leak into a persona.
      expect(p).not.toHaveProperty('capabilities')
      expect(p).not.toHaveProperty('mastery')
    }
  })
})

describe('§24.2 — new learner recognizes better than it freely produces', () => {
  it('recognition probability exceeds free production', () => {
    const p = getPersona('new-learner')
    const recog = personaSuccessProbability(p, planStub({ capability: 'recognition', tier: 'none' }), NO_STATES)
    const free = personaSuccessProbability(p, planStub({ capability: 'free_production', recipe: 'free_production', tier: 'none' }), NO_STATES)
    expect(recog).toBeGreaterThan(free)
  })
})

describe('§24.3 — the strong reader / weak listener asymmetry never fuses', () => {
  it('reading recognition far exceeds listening recognition', () => {
    const p = getPersona('strong-reader-weak-listener')
    const reading = personaSuccessProbability(p, planStub({ modality: 'reading', capability: 'recognition' }), NO_STATES)
    const listening = personaSuccessProbability(p, planStub({ modality: 'listening', capability: 'recognition', recipe: 'listening_recognition' }), NO_STATES)
    expect(reading).toBeGreaterThan(listening + 0.3)
  })

  it('listening barely improves with practice (its learning rate is tiny)', () => {
    const p = getPersona('strong-reader-weak-listener')
    const capKey = 'listening_recognition'
    const states = new Map([['sense:still.continuity', {
      capabilities: { [capKey]: { overall: { assessed_evidence_count: 20 } } },
    }]])
    const cold = personaSuccessProbability(p, planStub({ modality: 'listening', capability: 'recognition', recipe: 'listening_recognition' }), NO_STATES)
    const practiced = personaSuccessProbability(p, planStub({ modality: 'listening', capability: 'recognition', recipe: 'listening_recognition' }), states)
    expect(practiced - cold).toBeLessThan(0.25) // 20 × 0.01 learning rate
  })
})

describe('§24.4 — support dependence: aided >> unaided', () => {
  it('the same activity is far more likely correct with support than without', () => {
    const p = getPersona('support-dependent')
    const aided = personaSuccessProbability(p, planStub({ tier: 'high' }), NO_STATES)
    const unaided = personaSuccessProbability(p, planStub({ tier: 'none' }), NO_STATES)
    expect(aided).toBeGreaterThan(unaided + 0.5)
  })
})

describe('§24.5 — forgetful personas decay with the simulated interval', () => {
  it('a long gap since last retrieval lowers success', () => {
    const p = getPersona('forgetful')
    const capKey = 'reading_recognition'
    const withGap = new Map([['sense:still.continuity', {
      capabilities: { [capKey]: { overall: { assessed_evidence_count: 3 } } },
      retention: { [capKey]: { last_retrieval_at: '2026-01-01T09:00:00.000Z' } },
    }]])
    const soon = personaSuccessProbability(p, planStub({ tier: 'none', now: '2026-01-01T21:00:00.000Z' }), withGap)
    const late = personaSuccessProbability(p, planStub({ tier: 'none', now: '2026-01-20T09:00:00.000Z' }), withGap)
    expect(late).toBeLessThan(soon)
  })
})

describe('§24.6 — fast learner has no independence penalty and high skill', () => {
  it('produces freely with strong probability, unaided', () => {
    const p = getPersona('fast-learner')
    expect(p.independent_penalty).toBe(0)
    const free = personaSuccessProbability(p, planStub({ capability: 'free_production', recipe: 'free_production', tier: 'none' }), NO_STATES)
    expect(free).toBeGreaterThan(0.7)
  })
})

describe('§24.7 — struggling persona is weak but never a certain 0 or 1', () => {
  it('probability stays clamped inside (0,1) — no infinite-fail loop', () => {
    const p = getPersona('struggling')
    const pr = personaSuccessProbability(p, planStub({ capability: 'free_production', recipe: 'free_production', tier: 'none' }), NO_STATES)
    expect(pr).toBeGreaterThan(0.02 - 1e-9)
    expect(pr).toBeLessThan(0.98 + 1e-9)
  })
})

describe('§24.8 — the success draw is deterministic (same seed ⇒ same outcome)', () => {
  it('hash01 is stable and in [0,1)', () => {
    expect(hash01('a|1|x')).toBe(hash01('a|1|x'))
    expect(hash01('a|1|x')).toBeGreaterThanOrEqual(0)
    expect(hash01('a|1|x')).toBeLessThan(1)
    expect(hash01('a|1|x')).not.toBe(hash01('a|2|x'))
  })

  it('personaSucceeds repeats identically for the same seed and interaction index', () => {
    const p = getPersona('new-learner')
    const plan = planStub({ tier: 'none' })
    const a = personaSucceeds(p, plan, NO_STATES, { seed: 'k', interactionIndex: 4 })
    const b = personaSucceeds(p, plan, NO_STATES, { seed: 'k', interactionIndex: 4 })
    expect(a).toBe(b)
  })
})
