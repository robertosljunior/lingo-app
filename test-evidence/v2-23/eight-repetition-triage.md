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
- no product override is part of this V2.23 slice.

The real engine excludes any exemplar found in the trailing cooldown window and only retries with cooldown bypass if the first candidate pass is empty (`repeating beats stalling`).

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

## Conclusion of the triage

**The report is not reproducible as eight occurrences of one `exemplar_id` inside one ordinary 12-activity V2 session under the default policy.**

Therefore V2.23 must not add a second repetition cap in response to that report.

The original learner observation still can be explained by one of these materially different phenomena:

- several different exemplars from the same construction feeling equivalent;
- exact text recurrence across session boundaries/resume;
- a longer-than-standard/local test flow;
- V1 rather than V2;
- a session/history presentation that the learner experienced as one lesson.

The new audit exposes enough identity detail to classify future reproductions instead of treating all of them as `exemplar_id` repetition.

## Theoretical floor

The audit reports:

`minimum_possible_max_repeat = ceil(session_length / eligible_realizations)`

This is a lower bound from supply. A measured maximum at that floor is not scheduler failure. With 12 activities and only 4–5 eligible realizations, at least one realization must occur 3 times even under an ideal distribution.

## Decision

- Do not change cooldown in V2.23.
- Do not add an independent hard cap.
- Treat literal repetition, text repetition and construction repetition as separate metrics.
- Use V2.25 to test whether increasing supply removes repetition forced by scarcity.
