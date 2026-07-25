// learner-experience-mode.test.js — V2.20-R §17. The cutover contract: V2 is the
// default product in EVERY environment (production included), and only an
// explicit `false` still resolves to the legacy V1 experience.
import { describe, it, expect } from 'vitest'
import {
  resolveLearnerExperienceMode,
  learnerExperienceV2Enabled,
  experienceSwitcherAvailable,
  isDogfoodBuild,
} from './learner-experience-mode.js'

const PROD = { DEV: false }
const DEV = { DEV: true }
const DOGFOOD_BUILD = { DEV: false, VITE_V2_DOGFOOD: '1' }

describe('resolveLearnerExperienceMode', () => {
  it('honours an explicit opt-in in every environment', () => {
    for (const env of [PROD, DEV, DOGFOOD_BUILD]) {
      expect(resolveLearnerExperienceMode({ v2_learner_experience_enabled: true }, env)).toBe('v2')
    }
  })

  it('honours an explicit opt-out in every environment — including dev', () => {
    // This is how a developer (and the legacy E2E smoke) pins V1 on purpose.
    for (const env of [PROD, DEV, DOGFOOD_BUILD]) {
      expect(resolveLearnerExperienceMode({ v2_learner_experience_enabled: false }, env)).toBe('v1')
    }
  })

  it('defaults to V2 when the setting was never chosen — in EVERY environment', () => {
    for (const env of [PROD, DEV, DOGFOOD_BUILD]) {
      expect(resolveLearnerExperienceMode(undefined, env)).toBe('v2')
      expect(resolveLearnerExperienceMode(null, env)).toBe('v2')
      expect(resolveLearnerExperienceMode({}, env)).toBe('v2')
      expect(resolveLearnerExperienceMode({ v2_learner_experience_enabled: undefined }, env)).toBe('v2')
    }
  })

  it('V2.20-R §3 — a PRODUCTION build with no flag opens V2 (the cutover)', () => {
    // This is the published GitHub Pages bundle: production build, no dogfood
    // env, no stored choice. It must be the V2 product.
    expect(resolveLearnerExperienceMode({}, PROD)).toBe('v2')
    expect(learnerExperienceV2Enabled({}, PROD)).toBe(true)
    // ...and it must not depend on the environment argument at all.
    expect(learnerExperienceV2Enabled({})).toBe(true)
  })

  it('V2.20-R §4 — explicit false remains the emergency rollback to V1', () => {
    expect(resolveLearnerExperienceMode({ v2_learner_experience_enabled: false }, PROD)).toBe('v1')
    expect(learnerExperienceV2Enabled({ v2_learner_experience_enabled: false }, PROD)).toBe(false)
  })
})

describe('isDogfoodBuild', () => {
  // Still meaningful — but only for DEV TOOLING (§3): it no longer selects a
  // product.
  it('is true for dev and for an explicit dogfood flag only', () => {
    expect(isDogfoodBuild(DEV)).toBe(true)
    expect(isDogfoodBuild(DOGFOOD_BUILD)).toBe(true)
    expect(isDogfoodBuild(PROD)).toBe(false)
    expect(isDogfoodBuild({ DEV: false, VITE_V2_DOGFOOD: '0' })).toBe(false)
  })
})

describe('experienceSwitcherAvailable', () => {
  it('is offered in dogfood builds and to internal/diagnostics users', () => {
    expect(experienceSwitcherAvailable({}, DEV)).toBe(true)
    expect(experienceSwitcherAvailable({}, DOGFOOD_BUILD)).toBe(true)
    expect(experienceSwitcherAvailable({ pedagogy_v2_diagnostics_enabled: true }, PROD)).toBe(true)
    expect(experienceSwitcherAvailable({ pedagogy_v2_pilot_enabled: true }, PROD)).toBe(true)
  })

  it('is hidden from an ordinary production learner', () => {
    expect(experienceSwitcherAvailable({}, PROD)).toBe(false)
  })
})
