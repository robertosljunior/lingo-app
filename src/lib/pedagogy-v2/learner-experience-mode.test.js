// learner-experience-mode.test.js — Slice V2.20 §2. The dogfood resolution must
// (a) default DEV/E2E to V2 so nobody tests V1 believing it is V2, and (b) leave
// the production rollout exactly as it was.
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

  it('defaults to V2 in a dev build when the setting was never chosen', () => {
    expect(resolveLearnerExperienceMode({}, DEV)).toBe('v2')
    expect(resolveLearnerExperienceMode(null, DEV)).toBe('v2')
    expect(resolveLearnerExperienceMode({ v2_learner_experience_enabled: undefined }, DEV)).toBe('v2')
  })

  it('defaults to V2 in an explicit dogfood build (the E2E preview bundle)', () => {
    expect(resolveLearnerExperienceMode({}, DOGFOOD_BUILD)).toBe('v2')
    expect(resolveLearnerExperienceMode({}, { DEV: false, VITE_V2_DOGFOOD: 'true' })).toBe('v2')
  })

  it('does NOT change the production rollout: unset stays V1 in a production build', () => {
    expect(resolveLearnerExperienceMode({}, PROD)).toBe('v1')
    expect(resolveLearnerExperienceMode(null, PROD)).toBe('v1')
    expect(learnerExperienceV2Enabled({}, PROD)).toBe(false)
  })
})

describe('isDogfoodBuild', () => {
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
