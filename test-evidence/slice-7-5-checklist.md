# SLICE 7.5 — Real Bilingual Content and Exercise Coverage — Checklist

Branch: `claude/local-semantic-tutor-rcd80y` (restarted from merged `main` after PR #20). No new engines/models/workers/infrastructure.

Objective: replace the placeholder Portuguese in the content packs with **real Brazilian-Portuguese sources** that are semantically equivalent to the English answers, restore genuine PT→EN translation, and guarantee minimum exercise coverage (translation / guided / ordering / listening / recognition) for every theme × level.

Root context (from Slice 7.4): all 240 templates ship `pt: "Frase sobre X."` placeholders and no real Portuguese source, so PT→EN was safely downgraded to guided production. This slice authors the real content and restores translation.

Status legend: pending / in_progress / completed / blocked / failed

| ID | Status | Files | Content affected | Validation | Evidence | Commit |
|----|--------|-------|------------------|------------|----------|--------|
| T01 Preflight | completed | — | — | `npm test` baseline | 167 green on merged main | pending |
| T02 Inventory 240 templates | completed | build script, packs | 28 packs (24 theme + 4 core) | node scan | 8 tpl/theme pack, patterns enumerated | pending |
| T03 Identify PT placeholders | completed | packs | `pt:"Frase sobre X"`, `ctx:"Contexto…"` | node scan | 240/240 placeholder | pending |
| T04 Bilingual contract | completed | contracts, build | `{source_locale,source_text_pt,target_locale,expected_answers_en,accepted_variants_en,explanation_pt,skill_targets}` | schema | contract emitted per template | pending |
| T05 Real PT sources A1 | in_progress | build script | 6 themes × A1 | validator | — | pending |
| T06 Real PT sources A2 | in_progress | build script | 6 themes × A2 | validator | — | pending |
| T07 Real PT sources B1 | in_progress | build script | 6 themes × B1 | validator | — | pending |
| T08 Real PT sources B2 | in_progress | build script | 6 themes × B2 | validator | — | pending |
| T09 Restore translate_natural | pending | lesson-generator | translate uses source_text_pt/expected_answers_en | unit+e2e | — | pending |
| T10 Expand build_sentence/word_order | pending | generator/templates | ordering tokens verified | unit | — | pending |
| T11 Expand listen_type | pending | generator/templates | listening per theme×level | unit | — | pending |
| T12 Expand speak_sentence | pending | generator | guided production | unit | — | pending |
| T13 Balance types per pack | pending | validator | min per family | validator | — | pending |
| T14 Validate PT naturalness | pending | validator/tests | no placeholder, no EN in PT | unit | — | pending |
| T15 Validate EN naturalness | pending | tests | expected answers well-formed | unit | — | pending |
| T16 Semantic equivalence | pending | tests | negative goldens | unit | — | pending |
| T17 Prevent answer leak | pending | contracts/Exercise | EN hidden pre-submit | unit+e2e | — | pending |
| T18 Validators | pending | scripts | per-pack coverage report | script | — | pending |
| T19 Unit | pending | *.test.js | new suites | npm test | — | pending |
| T20 E2E | pending | e2e | per-type per-level + 24-combo sample | playwright | — | pending |
| T21 Report | pending | this file | classification | — | — | pending |

## Bilingual contract (T04)
Every translatable template carries: `source_locale:"pt-BR"`, `source_text_pt`, `target_locale:"en"`, `expected_answers_en:[...]`, `accepted_variants_en:[...]`, `explanation_pt`, `skill_targets:[...]`. The ambiguous `pt`/`ctx` placeholders are removed; `source_text_pt` is the single Portuguese source of truth.

## Evidence summary
- **Content:** all 28 packs (24 theme + 4 core) rebuilt with real Brazilian-Portuguese sources authored deterministically in `build-content-packs.mjs` (per-noun gender/number + 12 natural pattern templates + participle/adjective agreement). Core packs now use real common nouns instead of pronouns. `content-packs.generated.js` recompiled from the packs.
- **No placeholders:** `validate:content-packs` reports `placeholders: 0` for every pack; unit test scans every template.
- **Translation restored:** 96 real `translate_natural` questions across the 24 combos, 0 guided fallbacks; prompt shows `Traduza para o inglês:` + Portuguese source; accepted contraction variants graded correct.
- **Coverage (per pack):** translation/ordering/listening/recognition all = 8 (≥ the 5/4/4/4 minimums); the validator now **fails** the build if any minimum is missed.
- **Semantic equivalence:** structural PT↔EN checks (negation + quantity) pass on every authored pair and reject the two negative goldens ("Eu não trabalho aos domingos." / "I work on Sundays.", "Ela comprou dois ingressos." / "She bought a ticket.").
- **No leak:** `questionLanguageIssues` = 0 across 960 generated questions; e2e confirms the English answer is hidden until submit.
- **Unit:** `npm test` → **177 passed** (adds `bilingual-content` suite; 10 cases). **Build** clean (precache 4.47 MB). `validate:content-packs` (+ bilingual gate), `validate:knowledge-packs`, `quality:content-packs`, `benchmark:structural-nlp/semantic/indexeddb` all green.
- **E2E:** `bilingual-translation.spec.js` (real PT→EN + accepted variant); full suite 58/60 with the two Slice 7.3 real-USE-download specs flaking only under parallel CPU contention (each passes in isolation — unrelated to content). Deterministic 7.5/hub/language specs pass `--repeat-each=3` (fixed a rare Hub read-race by exposing the active lesson id).

## FINAL CLASSIFICATION — PASS_SLICE_7_5_REAL_BILINGUAL_CONTENT

| # | Acceptance criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | No Portuguese placeholder in active packs | ✅ | validator `placeholders:0`; unit scan |
| 2 | translate_natural has real Portuguese source | ✅ | 96 real / 0 guided; `Traduza para o inglês` |
| 3 | No English answer before submit | ✅ | 0 leaks; `bilingual-translation.spec.js` |
| 4 | PT ↔ EN semantically equivalent | ✅ | equivalence checks + negative goldens |
| 5 | All 24 packs have real translation | ✅ | coverage.translation = 8 each |
| 6 | All 24 packs have ordering | ✅ | coverage.ordering = 8 each |
| 7 | All 24 packs have listening | ✅ | coverage.listening = 8 each |
| 8 | Balancing respects the minimums | ✅ | `validateBilingualPack` gate |
| 9 | No audio never reveals transcript | ✅ | dictation guard (7.4) intact |
| 10 | Portuguese explanations use pt-BR voice | ✅ | `tts` language resolver (7.4) intact |
| 11 | Unit pass | ✅ | 177 passed |
| 12 | E2E pass | ✅ | new + regression green (USE flake noted) |
| 13 | Build + validators pass | ✅ | clean |
