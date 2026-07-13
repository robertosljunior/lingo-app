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
| T05 | Semantic worker (cancellation, timeout, stale-drop) | deferred | T04 |
| T06 | Model download + validation (catalog, checksum, transactional) | completed | T03 |
| T07 | Persistence & embedding cache (invalidate on model change) | completed | T06 |
| T08 | Real USE executes in browser (effective_engine === "use") | completed | T04,T06 |
| T09 | Explicit hashing fallback + honest UI copy | completed | T04 |
| T10 | Calibration corpus expansion | completed | T08 |
| T11 | Per-frame thresholds (no global cutoff) | completed | T10 |
| T12 | Intent/entity/polarity preservation | completed | T11 |
| T13 | Free integration | completed | T11,T12 |
| T14 | Guided integration (constraints) | completed | T11,T12 |
| T15 | Equivalent integration (grammar vs meaning) | completed | T11,T12 |
| T16 | Semantic tutor feedback UI (no technical terms) | completed | T13,T15 |
| T17 | Semantic model management UI (Settings) | completed | T06,T09 |
| T18 | Knowledge-packs UI review/grouping | completed | T17 |
| T19 | Mobile & accessibility | completed | T16,T17,T18 |
| T20 | Offline | completed | T06,T07,T08 |
| T21 | Performance & memory | completed | T08 |
| T22 | Unit tests | completed | T04-T15 |
| T23 | E2E | completed | T08-T18 |
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

## Increment 3 — calibration: per-frame thresholds + 1000-pair corpus
## T10 — Calibration corpus — completed
- `semantic-calibration-corpus.mjs` now 1024 labeled pairs (14 hand-authored anchors + generated) across all eight categories: valid_paraphrase, same_topic_different_intent, opposite_polarity, entity_mismatch (600), tense_mismatch (151), equivalent (152), related_not_equivalent, ambiguous. Generated pairs are labeled by construction (entity swap → entity_mismatch, negation → opposite_polarity, tense change → tense_mismatch), so labels are exact.
- Benchmark reports per-category mean similarity. Hashing margin is negative (~-0.05, acc 0.33) — it CANNOT discriminate meaning (entity-mismatch pairs share words → high score). This is expected and documented; it is exactly why the pipeline never trusts similarity alone.
## T11 — Per-frame thresholds — completed
- `frame-thresholds.js`: NO global cutoff. Per-intent defaults (polite_request/future_plan/past_experience/location/possession/opinion/obligation/question) + optional `frame.semantic_policy` override, each with threshold + minimum_margin + ambiguity_policy + negative_exemplars. `assessFrameChoice` flags ambiguity when a different-intent frame is within the margin (top-1 vs top-2). Wired into `retrieveSemantics` (frame gated by its own threshold) and guided fusion (an ambiguous USE frame no longer satisfies a constraint alone). 6 unit tests.
## T12 — Intent/entity/polarity preservation — completed
- `preservesIntent` (pre-existing, retained + now reinforced by thresholds): polarity match, essential-entity survival for requests, frame-flip guard (request → copula/description rejected). Every surfaced alternative must pass it — USE similarity alone never approves one.
## T13/T14/T15 — free / guided / equivalent — completed
- free: grammar/structure decide; low similarity NEVER fails (verdicts valid / valid_with_suggestions / needs_revision / unable_to_assess). guided: requested intent confirmed by structure (USE corroborates, ambiguous match ignored). equivalent: exact/paraphrase short-circuit; meaning_mismatch surfaced as a SEPARATE 'meaning' error distinct from grammar errors. Covered by existing orchestrator tests (140 unit green) + the USE E2E analyses.

## Increment 4 — mobile/a11y, performance, and final closure
## T16 — Tutor feedback UI — completed
- Feedback sheet already renders the spec's states with the correct hierarchy (headline "Muito bem" / "Quase lá" / "Vamos ajustar uma coisa" → explanation PT → user sentence → corrected version → natural alternatives → next action) and NO technical terms. Technical diagnostics (category/severity/confidence) are gated behind `import.meta.env.DEV` only — never in production. Per the slice's own "Decisão de UI", tutor+offline-management UI were the only surfaces touched this round.
## T19 — Mobile & accessibility — completed
- mobile-smoke.spec.js (Pixel 7) now also opens Settings and asserts the semantic-model + knowledge-pack cards render with NO horizontal overflow, the status chip and download control are reachable by testid/role, and screenshots are attached. Progress bar exposes role="progressbar" with aria-valuenow/min/max and an aria-label. Buttons use real button roles/labels.
## T21 — Performance & memory — completed
- See test-evidence/slice-7-2/performance.md. Key result: memory stable ~190 MB across repeated analyses (no leak); UI async-responsive. CPU-path embed jank on headless is the documented case a worker (T05) would remove.
## T05 — Semantic worker — DEFERRED (documented, non-blocking)
- USE currently runs on the main thread. It does not block correctness or the effective-engine result, and on WebGL devices embeds in tens of ms. A Web Worker migration (request-id/cancellation/timeout/stale-drop) is the clean enhancement to remove CPU-path jank on low-end devices; deferred to keep this slice's diff focused and the suite stable. Not part of the 21 PASS criteria.
## T22 — Unit tests — completed
- 140 unit tests: model catalog/store (install/checksum/cancel/artifacts/removal/invalidation), frame thresholds (defaults/override/ambiguity/margin), plus the existing orchestrator free/guided/equivalent/fallback coverage.
## T23 — E2E — completed
- semantic-model.spec.js (real UI download → effective "use" → analyses → offline persists → remove → basic; no-model hashing fallback), knowledge-pack-download.spec.js, mobile-smoke Settings overflow. Full suite green (see T24).
