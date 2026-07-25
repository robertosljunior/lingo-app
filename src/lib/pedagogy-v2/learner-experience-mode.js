// learner-experience-mode.js — resolves WHICH learning product the app renders:
// the V2 learner experience or the legacy V1 surfaces (Home / Training Hub).
//
// V2.20-R §3 — PRODUCTION CUTOVER. Until V2.20 the environment decided the
// default: a dogfood build (dev / VITE_V2_DOGFOOD) opened V2 while a production
// build opened V1. That rollout is over. V2 is now THE product, in every
// environment, and V1 is an explicitly requested legacy fallback:
//
//   setting === true       → 'v2'   (explicit opt-in — redundant, but honoured)
//   setting === false      → 'v1'   (explicit opt-out: the emergency rollback
//                                    escape hatch, and how legacy/regression
//                                    tests pin V1 on purpose — §4)
//   setting undefined/null → 'v2'   (EVERY environment, production included)
//
// The absence of the setting never means V1 again. A plain `npm run build`
// served from GitHub Pages must open the V2 Home with no flag, no query
// parameter and no DevTools (§12/§20).
//
// The build environment no longer decides which PRODUCT is default; it only
// decides whether DEVELOPER tooling (the V1/V2 switch) is offered at all — see
// `experienceSwitcherAvailable` (§3/§13).
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
 * True when this build is a DEVELOPER build (dev server, or an explicit
 * VITE_V2_DOGFOOD=1 bundle such as the E2E preview). Since V2.20-R this no
 * longer influences which product is default — V2 is default everywhere — it
 * only gates developer tooling like the visible V1/V2 switch (§3/§13).
 */
export function isDogfoodBuild(env = undefined) {
  const { dev, dogfood } = readBuildEnvironment(env)
  return dev || dogfood
}

/**
 * The single source of truth for "am I in V2 or V1?". V2 unless the learner (or
 * a test) explicitly asked for the legacy product — in EVERY environment.
 * @returns {'v2'|'v1'}
 */
export function resolveLearnerExperienceMode(settings, _env = undefined) {
  const explicit = settings?.v2_learner_experience_enabled
  if (explicit === false) return EXPERIENCE_V1
  return EXPERIENCE_V2
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
