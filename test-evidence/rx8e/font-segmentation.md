# RX-8E — experience-scoped typography

## Scope

Targets REC-245 from recovery issue #58. RX-8D and RX-8G remain intentionally suspended; this slice does not alter semantic/grammar runtime loading or pursue broader performance changes.

## Finding

The production entrypoint imported the Bob/V1 font stack (`Nunito`, `Baloo 2`, `Geist Mono`) unconditionally, while the V2 learner surface already defines and uses its own `Barlow` / `Barlow Condensed` roles. Workbox also precached every emitted `.woff2`, so an ordinary V2 installation paid the storage/network cost of both typographic systems.

## Contract

- V2 keeps `Barlow` and `Barlow Condensed` as its eager, first-run/offline typography.
- The V1 rollback experience keeps the existing Nunito/Baloo/Geist faces and weights; RX-8E does not redesign or visually restyle V1.
- Legacy font imports live behind an explicit experience loader and are requested only after settings resolve to V1.
- A V1 font-load failure never blocks navigation; system fallbacks remain usable and the loader can retry later.
- Legacy `.woff2` binaries are excluded from the base PWA precache and cached on first V1 use, so they remain available offline after that use.
- No heavy-runtime/lazy-loading work from suspended RX-8D/RX-8G is included.

## Regression coverage

`src/lib/experience-fonts.test.js` verifies that V2 never invokes the legacy loader, V1 loading is deduplicated, failures can retry, the eager entrypoint contains no `@fontsource` imports, and Workbox keeps the legacy font binaries out of the base precache while providing a runtime cache.

## Expected build effect

The default V2 entry graph no longer owns the nine legacy `@fontsource` CSS imports. Their binaries remain build artifacts for the explicit V1 fallback, but they are not part of a normal V2 PWA precache/install. Barlow remains unchanged and fully self-hosted/offline for V2.
