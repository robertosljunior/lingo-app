# RX-0 change log

## New learner-facing surfaces

- `V2History.jsx`
- `V2ReviewPoints.jsx`

## Product routers

- `History.jsx`
- `Mistakes.jsx`

## Preserved legacy surfaces

- `LegacyHistory.jsx`
- `LegacyMistakes.jsx`

## Pure recovery adapter

- `learner-activity-history.js`

The adapter deduplicates target evidence by `interaction_id`, groups by `session_id`, and creates review points only from direct assessed evidence with `partial` or `incorrect` outcomes.
