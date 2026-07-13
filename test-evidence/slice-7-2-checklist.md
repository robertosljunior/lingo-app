# SLICE 7.2 — Real USE Provisioning, Semantic Calibration & Tutor UX — Checklist

Branch: `claude/local-semantic-tutor-rcd80y` (base `main`; PR #19 open, `mergeable_state: clean`, carries Slice 7.1 closure). Slice 7.2 is stacked on top on the same branch — the branch is the unit of work; commits land together when PR #19 merges.

Rule (self-imposed by spec): do not reduce scope; a blocked item is marked blocked in isolation and does not stop the rest; the final classification is chosen only after the whole checklist is walked.

Status legend: pending / in_progress / completed / blocked / failed

## Asset-strategy decision (T03, recorded up front)
The Universal Sentence Encoder (`@tensorflow-models/universal-sentence-encoder` over `@tensorflow/tfjs`) is **not** part of the base bundle or the initial app load. The app runs fully on Harper + wink + rules + packs + the hashing fallback. The semantic model is an **opt-in, assisted download** (~28 MB) that is checksum-verified and stored offline. Model source: Google's canonical, immutable `storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder/*` (model.json + vocab.json + 7 weight shards), added to a dedicated **model allowlist** with our own pinned SHA-256 for every file. No mutable branch, no arbitrary pack-supplied URL, no remote code. In-browser backend: WebGL when available, CPU fallback (headless E2E uses CPU — WASM backend lacks the `SparseToDense` kernel USE needs).

## Spike evidence (pre-implementation, de-risks T04/T08)
Real USE loaded from local assets in headless Chromium (CPU backend): `dim=512`, `load_ms≈259` (warm), `embed_ms≈480/sentence`. Cosine sits in a narrow high band — dessert↔"something sweet" 0.889, dessert↔"sweet treat" 0.924, dessert↔"server offline" 0.876. Ranking correct; **absolute cosine is not usable as a global threshold** → confirms T11 (per-frame thresholds + margins) and T12 (USE is evidence, not sole authority).

| ID | Description | Status | Deps |
|----|-------------|--------|------|
| T01 | Preflight & baseline | completed | — |
| T02 | Audit existing USE loader/adapter/fallback | completed | T01 |
| T03 | Asset distribution strategy | completed | T02 |
| T04 | Real production loader | completed | T03 |
| T05 | Semantic worker (cancellation, timeout, stale-drop) | pending | T04 |
| T06 | Model download + validation (catalog, checksum, transactional) | completed | T03 |
| T07 | Persistence & embedding cache (invalidate on model change) | completed | T06 |
| T08 | Real USE executes in browser (effective_engine === "use") | completed | T04,T06 |
| T09 | Explicit hashing fallback + honest UI copy | completed | T04 |
| T10 | Calibration corpus expansion | pending | T08 |
| T11 | Per-frame thresholds (no global cutoff) | pending | T10 |
| T12 | Intent/entity/polarity preservation | pending | T11 |
| T13 | Free integration | pending | T11,T12 |
| T14 | Guided integration (constraints) | pending | T11,T12 |
| T15 | Equivalent integration (grammar vs meaning) | pending | T11,T12 |
| T16 | Semantic tutor feedback UI (no technical terms) | pending | T13,T15 |
| T17 | Semantic model management UI (Settings) | completed | T06,T09 |
| T18 | Knowledge-packs UI review/grouping | completed | T17 |
| T19 | Mobile & accessibility | pending | T16,T17,T18 |
| T20 | Offline | completed | T06,T07,T08 |
| T21 | Performance & memory | pending | T08 |
| T22 | Unit tests | pending | T04-T15 |
| T23 | E2E | in_progress | T08-T18 |
| T24 | Build & validators & full suites | pending | all |
| T25 | Diff review | pending | T24 |
| T26 | Commits & report | pending | T25 |

---

## T01 — Preflight & baseline
- Status: completed
- git: branch `claude/local-semantic-tutor-rcd80y`, HEAD `f8016d8`, base `origin/main` `40005ee` (PR #18 merged). PR #19 open & clean, not yet merged → Slice 7.2 stacks on the same branch.
- Baseline commands: run below (see T24 for the final full re-run). Existing suites known-green from Slice 7.1A closure.

## T02 — Audit of existing USE path
- Status: completed
- `UseSemanticEncoderAdapter` / `createProductionUseLoader` / `ResilientSemanticEncoder` / `HashingSemanticEncoder` live in `semantic-encoder-adapter.js`.
- Current flow: `requested_engine: use` → `createProductionUseLoader({modelUrl,vocabUrl})` → if URLs absent throws `no_model_loader` → `ResilientSemanticEncoder` catches → `effective_engine: hashing`, `fallback_reason: MODEL_NOT_INSTALLED`. **No code treats hashing as real USE** — `report()` always tells the truth. The gap: nothing ever *provisions* `modelUrl`/`vocabUrl`, so `use` was never reachable. Slice 7.2 fills exactly that gap.
- tfjs/USE were not installed; now added (`@tensorflow/tfjs@3.21.0`, `@tensorflow-models/universal-sentence-encoder@1.3.3`, `@tensorflow/tfjs-backend-wasm@3.21.0`) as optional, dynamically-imported deps kept out of the base bundle.

## T03 — Asset strategy
- Status: completed (decision recorded above).

## T04 — Real production loader — completed
- `createProductionUseLoader` rewritten: reads checksum-verified bytes from the store, assembles `{modelTopology, weightSpecs, weightData}`, hands the model to USE via `tf.io.fromMemory` and the vocab via a `blob:` URL → fully offline, no service worker. Picks WebGL→CPU (WASM intentionally unused: it lacks the `SparseToDense` kernel USE needs). Structured error codes (MODEL_NOT_INSTALLED / MODEL_CORRUPTED / MODEL_INCOMPATIBLE / TFJS_BACKEND_UNAVAILABLE / MODEL_LOAD_FAILED); nothing reaches React as an exception. Telemetry (`__lingo`: model_version, backend, load_ms) on the returned model.
- tfjs/USE dynamically imported → Vite code-splits into a single `semantic-runtime-*.js` chunk, EXCLUDED from the workbox precache (globIgnores) and runtime-cached on first use. Base precache unchanged (~10.5 MB); no per-user cost until opt-in.

## T06 — Model download + validation — completed
- `semantic-model-catalog.js`: dedicated MODEL_ALLOWLIST (only Google's immutable tfjs-models origin, HTTPS), per-file SHA-256 pinned (9 files, ~27 MB), size + timeout + cancel guards, closed file list. `semantic-model-store.installModel`: per-file guarded fetch → size check → SHA-256 verify → staged in memory → single IndexedDB transaction commits all file rows + metadata together (active only on commit). Cancellable via AbortSignal; partial/tampered download installs nothing.
- Unit: checksum-mismatch installs nothing; cancel installs nothing; progress phases downloading/verifying/installing emitted.

## T07 — Persistence & embedding cache — completed
- Bytes + metadata persisted in the knowledge DB (v2, additive upgrade). `invalidateEmbeddingsExcept(model_version)` drops embeddings from any other model version on install/update/removal; packs/history/evaluations untouched. Unit-covered.

## T08 — Real USE in browser — completed (PROVEN)
- Proof through the app's OWN modules in headless Chromium (preview build, `context.route` serving the real pinned bytes locally since the sandbox browser has no proxy to the external origin):
  - INSTALL `{ok:true, model_version:"use-use-en-v1-v1"}`
  - STATUS `{requested_engine:"use", effective_engine:"use", fallback_used:false}`
  - ANALYSIS engines `{semantic_requested:"use", semantic_effective:"use", grammar_effective:"harper"}`
  - OFFLINE (network dropped + reload) STATUS still `effective_engine:"use"` — loads from IndexedDB, zero network.
- No mock, no hashing, no fake loader. Real 512-dim embeddings (see spike: paraphrase 0.924 > related 0.889 > unrelated 0.876).

## T09 — Hashing fallback — in_progress
- Loader already reports honestly (`ResilientSemanticEncoder.report()`; no code claims hashing is USE). Remaining: UI copy ("Modo básico ativo" / "A análise avançada ainda não está instalada. A correção gramatical continua disponível.") — lands with T16/T17.

## T20 — Offline — core proven (see T08 offline reload); full UI-driven offline E2E lands with T23.

## T22 — Unit tests — partial
- `semantic-model-store.test.js` (8): allowlist, file order, transactional install, checksum reject, cancel, artifact assembly, not-installed, removal+embedding-invalidations. More (thresholds/intent/UI-state) land with T11–T16.

## Increment commit 1: real USE provisioning runtime (loader + catalog + store + hook + config). Unit 134 green; build green; tfjs excluded from precache.

## Increment 2 — model management UI + honest fallback copy + UI-driven E2E
## T17 — Semantic model UI — completed
- New "Análise semântica" card in Settings: title/description in plain PT, status chip (Não instalado / Baixando / Verificando / Instalando / Pronto para uso offline / Falha), size, real progress bar (aria progressbar), Baixar / Cancelar (AbortController) / Tentar novamente / Remover. No technical terms (USE/TensorFlow/embedding) in the UI. `semantic-model-catalog-service.js` wraps store+catalog and resets the cached encoder on install/remove so analysis rebinds without reload.
## T09 — Hashing fallback copy — completed
- When no model: "Modo básico ativo. A correção gramatical continua disponível; a análise avançada de significado ainda não está instalada." Never an error. Engine reporting stays honest (report()).
## T18 — Knowledge packs UI — completed (grouping)
- Three visually separate cards now: "Análise semântica" (model) · "Conhecimento linguístico" (packs) · "Áudio/Vozes" — no single technical list. Pack section already has states/progress/retry/remove from 7.1A.
## T20 — Offline — completed
- E2E: install via UI → go offline → reload → effective_engine still "use" (loads from IndexedDB). Without a model, app + grammar + free work; UI shows basic mode.
## T23 — E2E — in_progress
- `semantic-model.spec.js` (2): UI download → effective USE → free/error analyses → offline persists → remove → basic; and no-model hashing fallback (free never failed). Global setup fetches/caches the pinned assets (env-gated skip only if both cache and network absent). Full suite: 29 passed, 0 failed. Remaining E2E (guided/equivalent-mismatch explicit cases) land with T14/T15.
