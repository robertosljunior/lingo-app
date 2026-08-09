# V2.23 — authored-corpus confusability audit

Command:

```sh
npm run audit:authored-confusability-v2
```

The command writes a deterministic artifact to:

`test-evidence/v2-23/authored-confusability.generated.json`

## Purpose

`normalizeTranslationPt()` only removes structural differences such as case, accents, punctuation and whitespace. It cannot identify semantic paraphrases such as two different pt-BR sentences that are both plausible renderings of the same English meaning.

V2.23 therefore adds an **offline candidate detector**. It never changes a live lesson. It scans the authored `still`, `but` and `yet` exemplars pairwise and emits review candidates using:

- normalized pt-BR equality;
- high pt-BR token overlap;
- existing sense/construction relations;
- the repository's deterministic hashing semantic encoder over authored English text as an auxiliary signal.

The hashing encoder is intentionally not treated as semantic authority. Every emitted pair has `disposition: needs_human_review`.

## Determinism

- input packs are sorted by stable exemplar ID;
- pair IDs are stable `exemplarA::exemplarB` values;
- thresholds are versioned in `CONFUSABILITY_THRESHOLDS`;
- no `Math.random()` or wall-clock value participates;
- tests prove identical input/scorer produces byte-equivalent report objects and stable pair order.

## V2.26 handoff

V2.26 may consume **reviewed** pairs as exclusions when varying recognition/context distractor sets. It must not treat the raw detector output as proof that two answers are equivalent.

This keeps semantic ambiguity handling out of the lesson runtime until the pairs are reviewed and the product rule is explicit.
