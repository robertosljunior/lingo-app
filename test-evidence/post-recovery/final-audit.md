# Post-Recovery Final Audit

Baseline: `main` at `cbf552c1793cdf4748b8564988ecf31e7d8849a8` (merged RX-8F / PR #77).

## Verified recovery stack

Merged recovery/fix sequence includes RX-1A/#60, RX-1B/#61, RX-4/#62, RX-1C/#63, RX-5/#64, RX-6/#65, RX-7/#66, evaluator hardening #73/#74, RX-8A/#71, RX-8B/#69, RX-8C/#75, RX-8E/#76 and RX-8F/#77.

The current RX-8F head (`ec46f529300d3974c89a6162e22ecce516c40a69`) completed `required` run `31285643455` successfully: dependency budget, unit tests, pedagogy validation, deterministic simulation, production build, IndexedDB benchmark, zero-retry functional Playwright, PR contract and aggregate full-quality-gate all passed.

## Audit finding A-001 — HIGH — imported knowledge packs can be deleted by reclaim-space cleanup

RX-8F describes its cleanup as limited to resources that can be downloaded again. However, `getDeviceStorageSnapshot()` currently includes every row returned by `listInstalledPacks()` and `clearDownloadedResources()` removes every listed pack. `knowledge-pack-store.js` explicitly supports `source: 'imported'` packs and protects them from builtin overwrite, which means an imported/custom pack is user-supplied content and may not be re-downloadable.

Impact: selecting “Liberar espaço de recursos baixados” can silently delete an imported custom knowledge pack even though the confirmation promises only re-downloadable resources are removed.

Required correction:

- retain imported/custom packs during reclaim-space cleanup;
- expose source/reclaimability in the storage snapshot;
- count only reclaimable packs in the destructive confirmation/action;
- add regression coverage proving imported packs are preserved;
- keep the separate global destructive wipe contract (REC-106) unchanged.

## Current classification

- BLOCKER: none found yet.
- HIGH: A-001 (RX-8F imported-pack preservation).
- MEDIUM/LOW: continue audit after A-001 is fixed and CI returns green.
- Suspended by product decision: RX-8D and RX-8G performance/deeper-runtime work.
