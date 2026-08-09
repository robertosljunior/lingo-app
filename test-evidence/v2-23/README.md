# V2.23 — Variety baseline correctness

Issue: #80
Parent roadmap: #79

## What changed

- `planLevel()` now reads the `ActivityPlanV2.exposure_stage` contract.
- Transition bands use the conservative lower fallback (`A1-A2 -> A1`, `A2-B1 -> A2`, `B1-B2 -> B1`).
- PR #70 word-order distractors are re-audited by real V2 stage without changing their families, bounds or seeded selection.
- `audit:practice-variety-v2` records every activity inside each session instead of only first-of-session summaries.
- The audit reports literal exemplar/text/construction concentration, consecutive repeats, inferred cooldown bypass and the pigeonhole lower bound.
- A deterministic authored-corpus confusability candidate audit is available for the later V2.26 distractor-set slice.
- The existing synthetic-token -> whole-activity evidence behavior is documented without changing assessment semantics.

## Commands

```sh
npm test
npm run audit:practice-variety-v2
npm run audit:authored-confusability-v2
npm run validate:pedagogy-v2
npm run simulate:pedagogy-v2
npm run build
```

## Experimental integrity

V2.23 intentionally does **not** change:

- `exemplar_cooldown`;
- planner/focus selection;
- score weights;
- diversity policy;
- recognition/context distractor sets;
- content corpus size;
- evidence attribution behavior.

The output is a corrected baseline for V2.24 and the falsifiable BEFORE/AFTER in V2.25.

## Evidence files

- `eight-repetition-triage.md` — distinguishes exemplar/text/construction/session-boundary repetition and records why 8 literal repeats are not reproduced by ordinary 12-activity V2 policy.
- `authored-confusability.md` — deterministic candidate detector contract and V2.26 handoff.
- `docs/pedagogy-v2/synthetic-presentation-evidence.md` — current synthetic presentation material/evidence boundary.
