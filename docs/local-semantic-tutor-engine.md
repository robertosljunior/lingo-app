# Local Semantic Tutor Engine (Slice 7)

Offline-first, LLM-free analysis of free/guided learner production. No generative
model, no remote AI, no user text leaves the device.

## Pipeline

```
text
 → safe normalization
 → grammar lint            (Harper.js adapter, internal fallback)
 → structural NLP          (heuristic default; wink primary, compromise fallback)
 → deterministic rules     (built-in + declarative pack usage_rules)
 → naturalness hints       (context-dependent, low severity)
 → semantic retrieval      (USE adapter; hashing encoder fallback)
 → knowledge-pack matching (frames / alternatives / transformations)
 → evidence fusion         (per assessment mode + safety rules)
 → diagnosis → explanation (pt-BR) → intent-preserving alternatives
```

Entry point: `src/lib/language-analysis/index.js` → `analyzeProduction()`.
Screens import from there only; they never touch wink/compromise/Harper/USE.

## Adapters (`src/lib/language-analysis/`)

| Adapter | Contract | Impls |
| --- | --- | --- |
| `grammar-checker-adapter.js` | `lint(text) => {ok, engine, issues[]}` | `HarperGrammarCheckerAdapter`, `InternalGrammarChecker` |
| `structural-nlp-adapter.js` | `analyzeStructure(text) => {tokens, pos, verbs, subjects, negations, sentence_type, tense_candidates, intent_signals, ...}` | `Heuristic`, `Wink`, `Compromise` |
| `semantic-encoder-adapter.js` | `embed / rank / classifyIntent` | `UseSemanticEncoderAdapter`, `HashingSemanticEncoder` |
| `language-analysis-orchestrator.js` | `analyzeUserProduction(params)` | — |

Heavy engines (Harper WASM, USE/TFJS) are **injected loaders** pointing at local
assets — never a mandatory CDN. On load failure the pipeline degrades:
grammar → `GRAMMAR_ENGINE_UNAVAILABLE` + internal rules; USE → hashing encoder.
The app never opens an error boundary for these.

## Safety invariants (enforced in `fuseVerdict` + validators)

- USE never decides grammatical correctness and never fails free production on
  low similarity.
- No high-severity error is ever created from embedding distance / missing intent
  / missing example alone.
- Free mode never compares against a hidden model answer.
- Alternatives preserve intent, entities, polarity, tense, person.

## Assessment modes

- `exact` — no USE needed.
- `equivalent` — meaning must match `equivalentTarget`; combines similarity with
  essential words + grammar + intent (never similarity alone).
- `guided` — structure confirms the requested frame/intent; USE only corroborates.
- `free` — grammar/structure decide; USE only retrieves frames/alternatives.

## Knowledge packs (`src/content/knowledge-packs/`)

`pack_kind: "semantic_knowledge"` — pure data (no code, no regex, no serialized
functions). `when` conditions are matched by safe resolvers
(`usage-rule-resolvers.js`); transformations reference `operation_id`s registered
in `transformation-registry.js`. Builtin packs: `semantic_do`, `semantic_at`,
`semantic_in`, `semantic_on`, `semantic_be`, `semantic_have`,
`semantic_at_in_on_contrasts`, `semantic_requests`.

## Distribution & storage

- Catalog built by `scripts/build-knowledge-catalog.mjs` → `catalog-v1.json` +
  per-pack assets for **GitHub Releases** (not a mutable branch). Each entry pins
  SHA-256, size, min_app_version, schema_version.
- `pack-catalog.js` enforces: HTTPS + allowlisted host, max size, timeout,
  checksum verification, schema + compatibility check, JSON-only parse (never
  executed), no following pack-supplied URLs / out-of-catalog dependencies.
- `knowledge-pack-store.js` — separate IndexedDB database (non-destructive),
  transactional install (active only after validation + commit), per-pack removal
  that never touches persisted history, embedding cache keyed by model version.

## Commands

```
npm run validate:knowledge-packs     # schema + reference + golden checks
npm run benchmark:structural-nlp     # wink vs compromise over 300+ labeled cases
npm run build && npm test
```

## Known limitations

- Structural adapters share the heuristic's aux/negation/sentence-type bookkeeping
  and override only POS/lemmas, so the wink/compromise benchmark chiefly separates
  them on latency; deeper POS-level comparison is future work.
- Harper.js and USE loaders are wired as injectable adapters with local-asset
  contracts and graceful fallback, but the production WASM/model assets are not
  bundled in this slice — the app runs fully on internal rules + the hashing
  encoder until those assets are provisioned.
- The download UI (Settings → "Conhecimento linguístico") is specified and backed
  by tested install/remove/catalog logic; the React screen wiring is the remaining
  integration step.
```
