# RX-0 — Evidence visibility recovery

This recovery step restores learner-facing visibility of data that already exists in `learner_evidence_v2`.

## What it fixes

- V2 navigation no longer opens the V1 `History` implementation.
- V2 navigation no longer opens the V1 `Mistakes`/skill-mastery implementation.
- Existing V2 evidence is grouped by durable `session_id` and `interaction_id`.
- Direct `partial` and `incorrect` evidence becomes an honest review point.
- V1 history and mistakes remain unchanged behind explicit legacy mode.

## Deliberate limitations

Evidence written before full interaction persistence does **not** contain:

- the learner's typed/spoken response;
- the complete assessment diagnosis;
- the selected Practice Collection;
- the exact learner-facing feedback;
- a durable parent session record with explicit start/end status.

The UI therefore does not reconstruct or invent those fields. It labels recovered rows as limited evidence-backed history.

## Follow-up

RX-1 will add versioned `StudySessionV2` and `LearnerInteractionV2` persistence so future history can show complete factual records and survive interruption/reload without loss or duplication.
