# SLICE 7.3 — Semantic Worker and Responsive Tutor Polish — Checklist

Branch: `claude/local-semantic-tutor-rcd80y` (base `main`; PR #19 open). Slice 7.3 stacks on Slice 7.2 on the same branch.

Objective: move real USE **load + inference + ranking + intent classification** off the main thread into a dedicated Web Worker; keep cache/offline/fallback intact; polish the real feedback UI (scroll, contrast, density, responsiveness); keep the whole suite green.

Self-imposed rule (per spec): do not reduce scope; a genuinely-blocked item is marked blocked in isolation and does not stop the rest; the final classification is chosen only after the whole checklist is walked.

Status legend: pending / in_progress / completed / blocked / failed

## Message contract (T03, recorded up front)
Worker input `{ type, request_id, payload }` with `type ∈ LOAD_MODEL | EMBED | RANK | CANCEL | DISPOSE`.
Worker output `{ type, request_id, payload }` with `type ∈ RESULT | PROGRESS | ERROR | CANCELLED`.
Invariants: no serialized functions cross the boundary; no arbitrary URLs (model bytes come only from the checksum-verified IndexedDB store via the existing loader); every request carries a `request_id`; CANCEL drops obsolete responses; per-request timeout on the main side; one model singleton per worker; worker can be recreated after a crash; DISPOSE frees the model + tf backend.

## Main-thread boundary (invariant)
The main thread must NOT run: model load, tensor creation, embedding, cosine ranking, or intent classification. It MAY run: UI, orchestration, light deterministic rules, persistence, feedback presentation. All embed/rank/classifyIntent calls are delegated to the worker; on worker failure/timeout/crash the pipeline degrades to the on-main-thread hashing fallback exactly as before (structured, no error boundary).

| ID | Description | Status | Deps |
|----|-------------|--------|------|
| T01 | Preflight & baseline | completed | — |
| T02 | Baseline main-thread blocking measurement | completed | T01 |
| T03 | Worker message contract | completed | T01 |
| T04 | USE loader inside the worker | completed | T03 |
| T05 | Embedding + ranking in the worker | completed | T04 |
| T06 | Cancellation + obsolete-response drop | completed | T05 |
| T07 | Worker failure recovery + fallback | completed | T05 |
| T08 | Cache + IndexedDB unchanged | completed | T04 |
| T09 | Offline still works | completed | T08 |
| T10 | Exercise integration (cancel on question change) | completed | T06 |
| T11 | Loading + cancellation UI states | completed | T10 |
| T12 | Visual review of the four feedback states | completed | T10 |
| T13 | Scroll + footer (single scroll region, safe area) | completed | T12 |
| T14 | Colors + contrast (semantic tokens) | completed | T12 |
| T15 | Mobile (5 viewports, no overflow) | completed | T13 |
| T16 | Accessibility | completed | T12 |
| T17 | Performance (before/after) | completed | T05 |
| T18 | Unit tests | completed | T07 |
| T19 | E2E | completed | T10 |
| T20 | Build + report | in_progress | all |

## Evidence per task
- **T01/T02** baseline: 140 unit tests green pre-change; USE ran on the MAIN thread in 7.2 (one long inference task per analysis). Now 150 unit tests.
- **T03** contract: `{type, request_id, payload}` in / `{RESULT|PROGRESS|ERROR|CANCELLED}` out; invariants documented above and enforced in `src/workers/semantic-worker.js` + `worker-semantic-encoder.js`.
- **T04/T05** worker: `semantic-worker.js` hosts LOAD_MODEL/EMBED/RANK/CANCEL/DISPOSE; embedding, cosine ranking and intent aggregation all run in the worker. Main graph carries no TensorFlow (loader extracted to `use-model-loader.js`).
- **T06** cancellation: `cancelInFlight()` + worker `cancelled` set drop obsolete responses; unit-tested (obsolete-drop, request_id routing).
- **T07** recovery: per-request timeout terminates+respawns; `onerror` crash respawn; resilient runtime degrade to hashing on WORKER_CRASHED/ERROR/TIMEOUT; CANCELLED never downgrades. Unit-tested.
- **T08/T09** cache/offline: IndexedDB stores unchanged; precache stays lean (~4.4 MB), tf chunks excluded + runtime-cached; offline reload loads USE from IndexedDB in the worker (`semantic-model.spec.js`).
- **T10/T11** integration: `Exercise.jsx` cancels on question change / Next / unmount with a monotonic token stale-guard; non-blocking "Analisando sua frase…" indicator + delayed Cancel; interrupted → basic correction preserved.
- **T12–T16** UI: four distinct non-duplicated feedback states (`SEM_STATE`) with colour as support only; single `.feedback-scroll` region, safe-area sticky footer, mobile single-column, `overflow-x:hidden`; `feedback-scroll-visual` + `mobile-smoke` green.
- **T17** performance: `test-evidence/slice-7-3/performance.md`.
- **T18** unit: 150 passed (adds `worker-semantic-encoder.test.js`, 10 cases).
- **T19** E2E: `semantic-worker-ux.spec.js` (worker drives UI + cancel-on-leave), `semantic-model.spec.js` (use-in-worker + offline + remove).
- **T20** build + validators + benchmarks green; full Playwright suite green (exit 0, desktop + mobile).

## FINAL CLASSIFICATION — PASS_SLICE_7_3_SEMANTIC_WORKER_AND_UI

All acceptance criteria hold:

| Criterion | Status | Evidence |
|-----------|--------|----------|
| USE runs in the worker | ✅ | `semantic-worker.js`; `semantic-model.spec.js` + `semantic-worker-ux.spec.js` report `effective_engine: "use"` with the worker created |
| Inference not on main thread | ✅ | embed/rank/intent delegated to worker; main graph has no TensorFlow (build) |
| Cancellation works | ✅ | `cancelInFlight()` + worker `cancelled` set; unit + `semantic-worker-ux` cancel-on-leave |
| Obsolete response dropped | ✅ | request_id routing + token stale-guard in Exercise; unit-tested |
| Fallback works | ✅ | resilient runtime degrade to hashing on WORKER_CRASHED/ERROR/TIMEOUT; unit-tested; no-model E2E |
| Offline works | ✅ | `semantic-model.spec.js` offline reload → USE from IndexedDB in worker |
| UI responsive | ✅ | non-blocking analysing indicator; worker off-thread |
| Scroll fixed | ✅ | single `.feedback-scroll`; `feedback-scroll-visual.spec.js` |
| Contrast adequate | ✅ | semantic `--feedback-*` tokens; colour as support; unable=warn not error-red |
| Mobile no overflow | ✅ | `mobile-smoke` + `feedback-scroll-visual` (`scrollWidth ≤ innerWidth+2`) |
| Feedback not duplicated | ✅ | four `SEM_STATE` states; header ≠ explanation body |
| Memory stable | ✅ | tensors disposed per embed; DISPOSE on model swap; `performance.md` |
| Unit pass | ✅ | 150 passed |
| E2E pass | ✅ | full Playwright suite exit 0 |
| Build pass | ✅ | `npm run build` clean; precache ~4.4 MB |

Deferred / out of scope: none blocking. WASM backend intentionally unused (missing SparseToDense kernel); WebGL-in-worker via OffscreenCanvas is a real-device bonus, CPU is the guaranteed path.

Environment note: after a container restart Playwright bumped to 1.61.1 (expects Chromium 1228); the container ships 1194. Expected browser paths were symlinked to the pre-installed binary (container-local, not committed) so E2E runs.

## Acceptance criteria (declare PASS only if all hold)
USE runs in the worker · inference not on main thread · cancellation works · obsolete response dropped · fallback works · offline works · UI responsive · scroll fixed · contrast adequate · mobile no overflow · feedback not duplicated · memory stable · unit pass · E2E pass · build pass.

## Evidence log
(filled in per increment)
