# RX-8C — PWA update and Pages deploy integrity

## Scope

Targets REC-243 and REC-244 from recovery issue #58.

## Product contract

- A first service-worker install must not force a surprise reload.
- An already-controlled client must reload exactly once when a newly activated worker takes control, so old hashed JS cannot remain paired with a new cache indefinitely.
- Update checks run on registration, return to foreground, reconnect, and at a bounded hourly interval while online.
- Failure to check for an update must never break the current offline-capable client.

## Deploy contract

- Every Pages artifact is stamped after build with `dist/build-meta.json` containing the exact `github.sha`.
- Deployment smoke must reject a Pages site serving any other commit.
- A real Chromium session must install/obtain the deployed service worker, reload under SW control, go offline, reload again, and still render the app root.
- The deploy workflow is not considered successful until the post-deploy smoke job succeeds.

## Regression coverage

`src/lib/pwa-update-integrity.test.js` proves first-install behavior, stale-client reload, bounded update checks, offline no-op behavior, refresh activation, and cleanup.

`scripts/smoke-pages-deploy.mjs` is the production Pages smoke used by `.github/workflows/deploy-pages.yml`.
