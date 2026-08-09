# Synthetic presentation material and learner evidence

Status: V2.23 baseline contract.

## Why this document exists

The lesson engine itself only plans authored exemplars and authored recognition/context options. The learner interaction layer for `word_order_reconstruction`, however, may add bounded synthetic distractor tokens (for example a connector, pronoun, preposition, auxiliary or noun-neighbor token) that are not part of the authored exemplar and may not exist in the active pedagogy-V2 pack.

That means the product-wide invariant is narrower than “the app never generates language”. The precise baseline is:

- the engine never fabricates the target exemplar, target translation or target context;
- the word-order presentation layer may synthesize bounded distractor tokens;
- those distractors are presentation material, not new curricular targets;
- nevertheless, the learner's final ordered-token answer is assessed as a whole, so choosing a synthetic distractor can affect the activity outcome and therefore learner evidence for the authored targets.

## Current evidence behavior

`word_order_reconstruction` is a `form_first` recipe. Its planned evidence assigns direct form evidence to authored construction targets (and to other target kinds according to the existing attribution contract). Assessment is reference-match over the submitted sequence, not per-token diagnosis.

Therefore the current system cannot distinguish these two causes of an incorrect reconstruction:

1. the learner does not know the authored construction;
2. the learner understands the construction but chooses a synthetic distractor token.

Both can yield `incorrect` for the activity and can therefore lower evidence for the authored target. This is intentional **baseline behavior for V2.23**; this slice does not reinterpret historical evidence or change assessment attribution.

There are currently no corpus targets of type `lexeme_usage`, so this contract does not invent a special lexeme-evidence rule for a target class that is not exercised by the shipped corpus.

## Decision

For V2.23, keep the existing assessment/evidence behavior unchanged and make the boundary explicit.

Synthetic presentation material:

- MAY affect the whole-activity correctness result when selected by the learner;
- MUST NOT become an `intended_new_item` or curricular target merely because it appeared as a distractor;
- MUST remain bounded/deterministic under the PR #70 interaction contract;
- MUST NOT create a hidden per-token evidence channel;
- MUST be observable in audit/test evidence so a future change can compare behavior deliberately.

Any future policy that wants to separate “construction error” from “distractor trap” must introduce an explicit assessment/evidence contract and migration/test plan. It must not be implemented as an incidental presentation-layer heuristic.

## V2.23 non-goal

This document records the current frontier; it does not claim that the current attribution is pedagogically optimal. V2.23 is baseline-correctness work, so changing attribution here would contaminate the realization-supply experiment planned for V2.24/V2.25.
