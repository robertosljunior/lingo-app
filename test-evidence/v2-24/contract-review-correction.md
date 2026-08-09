# V2.24a — contract-review correction

## Why this follow-up exists

The technical scaffold from PR #88 was merged before the V2.24 human/economic gate was completed. Runtime safety remained intact because provisional licensed realizations are still disabled by default and `unless` is not in the builtin catalogue, but the repository state and the issue wording diverged. Issue #81 has therefore been reopened and remains the acceptance authority for V2.24.

A post-merge contract review also exposed a real metadata gap in the `unless` pilot. Every authored and derived sample uses present tense in the `unless` condition and `will` in the result clause, while the pack/filler metadata previously declared only the V1 `simple_present` bridge. The canonical V1 skill registry defines `first_conditional` separately and starts it at B1.

## Correction

- Authored `unless` exemplars now declare both `simple_present` and `first_conditional` compatibility bridges.
- Condition fillers explicitly declare `simple_present`.
- Result fillers explicitly declare `first_conditional`.
- Result fillers are staged at B1, so the licensed max-stage calculation now emits B1 for all 12 provisional `unless` realizations.
- The licensed generator provenance version is bumped to `v2.24-pilot-2`; realization IDs remain signature-derived and therefore unchanged by this metadata correction.
- Regression coverage checks the canonical V1 skill, source filler declarations, authored exemplar metadata, composed prerequisites, and calculated realization stage.
- The human worksheet now exposes calculated stage and composed prerequisites for every candidate and instructs the reviewer to reject contract mismatches even when the sentence itself is natural.

## Scope discipline

This follow-up does not change planner policy, cooldowns, diversity policy, distractor selection, provisional approval status, or builtin catalogue membership. V2.25 remains blocked until the human approval/economics verdict is recorded in #81.
