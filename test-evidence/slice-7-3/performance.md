# Slice 7.3 — Semantic Worker Performance Evidence

Measured in headless Chromium (CPU backend — the worst case; real devices use
WebGL and are faster). USE similarities are advisory; correctness never depends
on model latency.

## Main-thread blocking — the headline change

| Work item | Slice 7.2 (main thread) | Slice 7.3 (worker) |
|-----------|-------------------------|--------------------|
| Model load (tfjs import + `use.load` from IndexedDB) | on main thread — blocks UI for the full load | **in worker** — main thread never blocks |
| Tensor creation / embedding | on main thread (~480 ms/sentence, CPU) | **in worker** |
| Cosine ranking | on main thread | **in worker** |
| Intent classification (aggregate) | on main thread | **in worker** |
| Main-thread long tasks caused by inference | one per analysis (hundreds of ms – seconds on load) | **none** |

The main thread now runs only UI, orchestration, light deterministic rules,
persistence and feedback presentation. All heavy work is delegated to
`src/workers/semantic-worker.js` over the `{type, request_id, payload}` contract.
This is enforced structurally: the main-thread module graph contains **no
TensorFlow at all** (the loader lives in `use-model-loader.js`, imported only by
the worker; `npm run build` emits the tf chunks solely in the worker graph).

## Observed behaviour (E2E, `semantic-worker-ux.spec.js`, real USE in worker)

- A valid free sentence is analysed by the worker-hosted USE model and drives the
  real feedback UI end-to-end (`effective_engine: "use"`, not hashing). The page
  stays interactive throughout — the "Analisando sua frase…" indicator is a
  non-blocking overlay, never a frozen screen.
- Leaving the lesson mid-analysis cancels the in-flight worker request (CANCEL
  with the target `request_id`); no stale feedback ever appears and there are no
  console/page errors.

## Cancellation, obsolete responses, crash recovery (unit, `worker-semantic-encoder.test.js`)

- `cancelInFlight()` rejects pending work with `CANCELLED` and tells the worker to
  drop the matching result — a late response can never update a newer question.
- A per-request timeout (20 s) terminates a stuck worker and the next call
  transparently respawns a fresh one.
- A worker crash (`onerror`) rejects all pending work and respawns on the next
  call; the resilient encoder degrades to the hashing fallback at runtime so a
  crash never surfaces to React.
- An intentional `CANCELLED` never downgrades the effective engine (it is not a
  failure); genuine failures (`WORKER_CRASHED` / `WORKER_ERROR` / `TIMEOUT` /
  load errors) do, and are reported honestly.

## Memory / stability

- One model singleton per worker; `LOAD_MODEL` coalesces concurrent loads.
- Swapping or removing the model disposes the previous worker (`DISPOSE` frees the
  model and the tf backend, then the worker is terminated), so a model change
  never leaks a thread or keeps stale weights warm.
- Embedding tensors are disposed immediately after each `embed` inside the worker,
  so repeated analyses do not accumulate GPU/CPU tensors.

## Bundle / offline cost (unchanged "zero cost until opt-in")

- Base precache: **~4.4 MB** (92 entries). The opt-in tf chunks
  (`semantic-runtime-*`, `model-*`, `graph_model-*`, ~6 MB) are excluded from the
  precache and runtime-cached on first use (online, right after the model
  download). The tiny worker entry (`semantic-worker-*`, ~4 KB) IS precached so it
  is available offline.
- After the one-time model download, a full offline reload still loads USE from
  IndexedDB **inside the worker** (`effective_engine: "use"`, verified in
  `semantic-model.spec.js`).
