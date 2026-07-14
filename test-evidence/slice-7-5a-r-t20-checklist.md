# SLICE 7.5A-R T20 — Thematic Bilingual Content Rewrite — Checklist

Branch: `claude/content-thematic-rewrite-t20` (from `main` = redesign + USE-stability + audit). Scope: content only — no engine/worker/USE/UI/onboarding/architecture changes.

Goal: replace the generic noun-swap bilingual content with natural, theme-situated, CEFR-appropriate, semantically-equivalent pairs authored from communicative situations. Meet: ≥6 structures, ≥5 lexical verbs, ≥4 intents per theme×level; no noun-swap-only pairs; genuine theme alignment; a diversity validator that FAILS on regressions.

Status: pending / in_progress / completed

| ID | Task | Status | Files | Validation | Evidence |
|----|------|--------|-------|------------|----------|
| T20.01 | Baseline post-merge | completed | — | 177 unit, build, validators, benchmarks green on main | recorded |
| T20.02 | Inventory current pairs | completed | — | measured 4 structures/4 verbs, noun-swaps | slice-7-5a-r/bilingual-metrics.md |
| T20.03 | Communicative-situation matrix | in_progress | thematic-corpus | design | — |
| T20.04 | CEFR matrix | in_progress | thematic-corpus | design | — |
| T20.05 | Pilot daily_life A1 | pending | corpus, build, validator | validators + print 8 pairs | — |
| T20.06 | Validate pilot | pending | — | diversity+equivalence+theme | — |
| T20.07 | daily_life A2–B2 | pending | corpus | validators | — |
| T20.08 | workplace A1–B2 | pending | corpus | validators | — |
| T20.09 | travel A1–B2 | pending | corpus | validators | — |
| T20.10 | food_and_restaurants A1–B2 | pending | corpus | validators | — |
| T20.11 | shopping_and_services A1–B2 | pending | corpus | validators | — |
| T20.12 | technology_and_communication A1–B2 | pending | corpus | validators | — |
| T20.13 | Emit bilingual contracts | pending | build script | build | — |
| T20.14 | Validate equivalence | pending | bilingual-content | goldens | — |
| T20.15 | Validate diversity | pending | bilingual-content | new validator | — |
| T20.16 | Validate theme adherence | pending | bilingual-content | validator | — |
| T20.17 | Validate CEFR | pending | bilingual-content | validator | — |
| T20.18 | Sample audit | pending | audit doc | ≥20/level, ≥10/theme | — |
| T20.19 | Regenerate compiled packs | pending | generated.js | build | — |
| T20.20 | Unit + validators | pending | — | gates | — |
| T20.21 | E2E | pending | — | playwright | — |
| T20.22 | Final report | pending | this file | — | — |

## Structural signature (T20 "Similaridade estrutural")
A normalized signature computed from the English target capturing: clause type
(statement/yes-no-question/wh-question/imperative/conditional), tense+aspect
(present-simple, present-continuous, past-simple, going-to, will, present-perfect,
present-perfect-continuous, passive, reported, second-conditional), modality
(can/could/would/should/none), and polarity (affirmative/negative). Noun-swaps
collapse to the same signature+verb → counted once. Two pairs are a "noun-swap"
defect when they share signature AND main verb AND differ only in the object noun.

## Progress

**Done**
- Semantic-frame **architecture** (`scripts/content-packs/semantic-frames.mjs`): noun classes (semantic_class/allowed_roles/compatible_actions), verb–argument compatibility (`ACTION_COMPATIBILITY` + `FORBIDDEN_COMBINATIONS`, `isCompatible`), and a structural signature (clause/tense/modality/polarity).
- **Build-time gate** (`validateFrames`): rejects incompatible combos and below-minimum diversity (≥8 pairs, ≥6 structures, ≥5 verbs, ≥4 intents, no noun-swap) — proven when it rejected `call+work_location` during authoring.
- **A1 pilots authored for 3 themes** (travel, workplace, food_and_restaurants) — each 8 frames, 8 structures, ≥5 verbs, 8 intents, theme-situated, natural PT+EN pairs, all compatibility-validated. Other packs keep the deterministic generator (app + E2E stay green).
- Added A1-appropriate content patterns to the rule registry; `src/lib/semantic-frames.test.js` (8 tests, rejects `update+train_station` etc.); sample audit `slice-7-5a-r-t20/pilot-audit.md`.
- Gates: 185 unit tests, content validators, and E2E for the 3 pilot combos (+ exercises, translation) all green.

**Remaining** (same model, authoring only): travel A2–B2, workplace A2–B2, food A2–B2, and all levels of daily_life / shopping_and_services / technology_and_communication — **21 theme×level sets** — plus the runtime diversity validator wired into `validate:content-packs`, the full sample audit (≥20/level, ≥10/theme), and the final gate re-run (build/validators/benchmarks/playwright/repeat-each).

## FINAL CLASSIFICATION — PARTIAL_PASS_SLICE_7_5A_R_CONTENT_COVERAGE

The **root-cause fix is implemented and proven**: content is now generated from
semantic frames with enforced verb–argument compatibility (no more "update the
train station"), a structural signature that collapses noun-swaps, and a
build-time validator that fails on regressions. Three themes' A1 sets are authored
to the full diversity bar and pass all gates. The remaining **21 theme×level sets**
are the same-model authoring continuation — not a FAIL (no regression; architecture
+ validators + 3 pilots complete), but coverage is not yet the full 24.
