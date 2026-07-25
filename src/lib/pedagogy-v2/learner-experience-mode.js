// learner-experience-mode.js — Slice V2.20 §2. Resolves WHICH learning product
// Training renders: the V2 learner experience or the legacy V1 Training Hub.
//
// The problem this solves: until V2.19 the only way to see V2 was to know that a
// hidden IndexedDB key (`v2_learner_experience_enabled`) existed and flip it. A
// developer opening Training in a dev build silently landed on the V1 hub and
// could believe they were dogfooding the new product (§2/§33).
//
// The resolution is deliberately three-valued, so DEV can default to V2 WITHOUT
// touching the production rollout (§2 "Não alterar rollout de produção sem
// necessidade"):
//
//   setting === true       → 'v2'   (explicit opt-in — any environment)
//   setting === false      → 'v1'   (explicit opt-out — any environment; this is
//                                    how regression/legacy tests pin V1)
//   setting undefined/null → the ENVIRONMENT default:
//                              dogfood build (dev / VITE_V2_DOGFOOD) → 'v2'
//                              production                           → 'v1'
//
// Only the *unset* case changes behaviour, so every existing production install
// (which has no row for the key) keeps the V1 hub in a production bundle, and
// every stored explicit choice is still honoured verbatim.
//
// This module is pure: the environment is passed in, never read from globals, so
// it is unit-testable and the caller decides what "dogfood" means.

export const EXPERIENCE_V2 = 'v2'
export const EXPERIENCE_V1 = 'v1'

/** Reads the ambient build environment. Kept separate so tests inject theirs. */
export function readBuildEnvironment(env = undefined) {
  const e = env ?? (typeof import.meta !== 'undefined' ? import.meta.env : undefined) ?? {}
  return {
    dev: !!e.DEV,
    dogfood: e.VITE_V2_DOGFOOD === '1' || e.VITE_V2_DOGFOOD === 'true',
  }
}

/**
 * True when this build should default the learner experience to V2. A dev server
 * always dogfoods; a build can opt in explicitly with VITE_V2_DOGFOOD=1 (that is
 * how the E2E preview build — which is a *production* build — dogfoods V2).
 */
export function isDogfoodBuild(env = undefined) {
  const { dev, dogfood } = readBuildEnvironment(env)
  return dev || dogfood
}

/**
 * The single source of truth for "am I in V2 or V1?".
 * @returns {'v2'|'v1'}
 */
export function resolveLearnerExperienceMode(settings, env = undefined) {
  const explicit = settings?.v2_learner_experience_enabled
  if (explicit === true) return EXPERIENCE_V2
  if (explicit === false) return EXPERIENCE_V1
  return isDogfoodBuild(env) ? EXPERIENCE_V2 : EXPERIENCE_V1
}

/** Convenience predicate — the V2 learner experience is the active product. */
export function learnerExperienceV2Enabled(settings, env = undefined) {
  return resolveLearnerExperienceMode(settings, env) === EXPERIENCE_V2
}

/**
 * True when the visible DEV experience switch should be offered (§2 alternative:
 * "um seletor DEV muito visível"). It is shown in dogfood builds and whenever
 * the internal diagnostics flags are on — never to an ordinary production user.
 */
export function experienceSwitcherAvailable(settings, env = undefined) {
  return !!(
    isDogfoodBuild(env) ||
    settings?.pedagogy_v2_diagnostics_enabled ||
    settings?.pedagogy_v2_pilot_enabled
  )
}
