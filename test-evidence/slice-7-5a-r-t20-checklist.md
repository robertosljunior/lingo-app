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

## FINAL CLASSIFICATION
(pending)
