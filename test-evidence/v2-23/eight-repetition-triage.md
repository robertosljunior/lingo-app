# V2.23 — triage of the “same phrase ~8 times” report

## Scope

This evidence deliberately distinguishes four identities that can feel like “the same phrase” to a learner:

1. exact `exemplar_id`;
2. exact `text_en` (different IDs could theoretically share text);
3. same `construction_id` with different exemplars;
4. recurrence across session boundaries / resumed flow.

It also keeps V1 outside the V2 conclusion.

## Current production-policy facts

The default V2 policy has:

- `max_activities_per_session = 12`;
- `exemplar_cooldown = 3`;
- `recent_exemplar_interactions = 4`;
- no product override is part of this V2.23 slice.

The real engine excludes any exemplar found in the trailing cooldown window and only retries with cooldown bypass if the first candidate pass is empty (`repeating beats stalling`). Cross-session diversity uses only the recent interaction window.

## Controlled baseline probe

The pre-slice probe that motivated V2.23 observed:

| Scenario | Maximum same exemplar | cooldown bypass |
|---|---:|---:|
| 12 activities, broad focus | 3 | 0 / 240 |
| 12 activities, target focus (5 exemplars) | 3 | 0 / 240 |
| 12 activities, target discourse focus (4 exemplars) | 3 | 0 / 240 |
| 24 activities | 6 | 0 / 480 |
| cooldown = 1, 12 activities | 6 | 0 / 240 |

The expanded `audit:practice-variety-v2` now reproduces this class of probe and records every activity, including exact exemplar, exact text, construction and inferred cooldown bypass.

## Conclusion of the literal eight-repeat triage

**The report is not reproducible as eight occurrences of one `exemplar_id` inside one ordinary 12-activity V2 session under the default policy.**

Therefore V2.23 must not add a second repetition cap in response to that report.

The original learner observation still can be explained by one of these materially different phenomena:

- several different exemplars from the same construction feeling equivalent;
- exact text recurrence across session boundaries/resume;
- a longer-than-standard/local test flow;
- V1 rather than V2;
- a session/history presentation that the learner experienced as one lesson.

The new audit exposes enough identity detail to classify future reproductions instead of treating all of them as `exemplar_id` repetition.

## New finding: cross-session opener monotony

Running the corrected audit at the production length of 12 activities revealed a separate, real phenomenon that the older 6-activity audit hid. In the measured run:

- `immediate_exemplar_repeat_rate` across session openers rose to approximately `0.793`;
- `rolling_unique_exemplars` fell to `2`;
- `context_repeat_rate` was approximately `0.793`;
- the same exemplar opened the first five measured sessions.

This is not a regression caused by V2.23. The likely mechanism is the existing ratio `recent_exemplar_interactions = 4` versus `max_activities_per_session = 12`: when a new session starts, the cross-session recency mechanism only sees the trailing third of the preceding session and is blind to how that session began.

This finding is recorded now but deliberately NOT corrected in V2.23. V2.25 must freeze this policy so compiler OFF/ON changes only realization supply. If the opener fixed point survives a much larger pool, it becomes an explicit scheduler/policy follow-up after the experiment.

## Construction concentration

The same audit also observed `max_construction_occurrences_per_session = 12` in the tested focus. This is a distinct form of monotony: several different literal exemplars can still feel repetitive when every activity trains the same construction. No policy change is made here; V2.25 records it as an observed metric alongside literal repetition.

## Corrected theoretical floor

The audit reports:

`minimum_possible_max_repeat = ceil(session_length / eligible_realizations)`

The denominator must be the DISTINCT realizations that can serve the selected anchor focus — primary target + capability + modality + support lane — not every exemplar present in the broad pre-anchor `trace.candidates` list.

The initial V2.23 implementation used the broad candidate set, which could report a pool near 22 and a false floor of 1 even though the effective same-focus supply was only about 4–5. The follow-up instrumentation now derives distinct same-focus exemplar IDs and separately retains broad-pool / `same_focus_candidates` diagnostics. This avoids counting multiple candidate rows for one exemplar as multiple realizations.

With 12 activities and only 4–5 same-focus realizations, the correct lower bound is 3. A measured maximum of 3 is therefore compatible with the supply optimum rather than evidence that the scheduler is three times worse than possible.

## Decision

- Do not change cooldown in V2.23.
- Do not change `recent_exemplar_interactions` in V2.23.
- Do not add an independent hard cap.
- Treat literal repetition, text repetition, construction repetition and cross-session opener recurrence as separate metrics.
- Use V2.25 to test whether increasing supply removes repetition forced by scarcity while the known cross-session policy remains frozen.
