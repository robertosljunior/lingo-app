# V2.24 — pilot kill criteria (frozen before candidate generation)

This file is committed before the pilot filler/frame banks and candidate allow-list are created. Its thresholds must not be moved after seeing compiler output.

## What is being compared

Two authoring workflows must be timed by a human editor using the same quality bar:

1. **Manual baseline** — author complete bilingual exemplars from a blank row, including targets/prerequisites/stage/context metadata required for the intended recipe tier.
2. **Licensed compiler workflow** — review deterministic compiler candidates and approve only signatures whose English, pt-BR, selectional constraints, pragmatic frame, calculated stage and composed prerequisites are acceptable without rewriting either the realization or its contract metadata.

Setup/tooling time is reported separately from steady-state review time. Rewriting a rejected candidate into a good sentence, repairing a missing prerequisite, or correcting its stage counts as manual authorship, not compiler throughput.

## Frozen numerical thresholds

The pilot is **economically failed** and must be redesigned before broad expansion if either pilot construction misses either threshold:

- **human approval rate < 60%** of reviewed candidates; or
- **approved realizations per author-hour < 1.5× the measured manual baseline**.

In addition, compiler review should reach an absolute steady-state floor of **12 approved realizations/hour**. Falling below that floor is recorded as a warning even if the 1.5× ratio happens to pass because the manual baseline was unusually slow.

These are authoring-economics thresholds, not learning metrics.

## Required measurements before final V2.24 verdict

For both `still` lexical-slot and `unless` clause-frame pilots record:

- reviewed candidate count;
- approved candidate count;
- rejected candidate count and reason categories, separating surface-language and contract-metadata failures;
- review minutes;
- approval rate;
- approved realizations/hour;
- manual baseline realizations/hour;
- compiler/manual throughput ratio.

A candidate is not approved merely because its sentence is natural. The reviewer must also confirm that the displayed calculated stage and composed prerequisite list adequately describe the language used by that realization.

No final PASS may be claimed until the human timing rows exist. Technical validation may be green while the economic verdict remains `PENDING_HUMAN_MEASUREMENT`.

## Why two pilots matter

`still.subject_still_lexical_verb` is the easy lexical-slot control. `unless` is deliberately a clause-frame stress test where pragmatic compatibility between condition and consequence must be licensed. The compiler is not considered generally useful if it wins only on lexical slots.
