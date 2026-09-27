# V3 combinatorial supply — first 2,000+ realization experiment

## Goal

Break the current authored-supply ceiling before changing the learner-facing V2
planner. The experiment must create a broad pool of everyday English while
making literal repetition structurally avoidable.

## Shape

The V3 experiment is isolated from the production V2 registry.

- 48 pedagogical focus frames
- 8 compatible bilingual fillers in slot A
- 8 compatible bilingual fillers in slot B
- 64 realizations per focus
- expected total: 3,072 realizations
- hard minimum: 2,000 realizations

The catalogue covers A1 through B1 material including:

- be / have
- wants, needs, can, should, have to
- simple present, questions and negatives
- present continuous
- simple past, questions and negatives
- going-to and will futures
- there is / there are
- place prepositions and directions
- polite requests and offers
- quantities
- comparisons
- because, if, when, before, but, and, or
- used to
- present perfect experience and duration
- still, already, yet and unless

## Repetition contract

The V3 selector does not inherit V2's "repeating beats stalling" fallback.

For one focus:

1. choose only from unseen realization IDs;
2. continue until every realization in that focus has been consumed;
3. return `focus_exhausted`;
4. never silently re-admit a seen realization.

A future planner can respond to `focus_exhausted` by switching focus or by
entering an explicit spaced-retrieval mode. Literal repetition is therefore a
planner decision, not an accidental fallback.

## Quality status

The surfaces are generated from manually curated bilingual slot banks, but the
Cartesian combinations are still marked:

- `naturalness_status: provisional_curated_slots`
- `approval_status: provisional_nonhuman`

This experiment does not yet promote the 3,072 candidates into learner-facing
production. It establishes supply size, uniqueness and selection behavior first.

## Automated gates

`src/lib/pedagogy-v3/combinatorial-supply.test.js` asserts:

- >= 2,000 realizations;
- exactly 64 realizations per focus in the current catalogue;
- unique realization IDs;
- unique exact English text across the full corpus;
- broad grammar/function baseline coverage;
- zero literal repeats during the first 64 draws of every focus;
- `focus_exhausted` after the unseen pool is consumed.

The standalone audit command is:

```bash
npm run audit:combinatorial-supply-v3
```

Remote CI evidence is intentionally left to the pull request quality gate.
