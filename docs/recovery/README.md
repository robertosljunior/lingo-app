# Recovery track

Source of truth: GitHub issue #58.

Execution order:

1. RX-0 — restore visibility of already persisted V2 evidence in History and Review Points.
2. RX-1 — persist full V2 sessions/interactions atomically.
3. RX-2 — complete History V2 over durable session records.
4. RX-3 — complete Review Points V2 over durable diagnoses.
5. RX-4 — close every remaining V1 surface leak.

No content expansion is approved while P0 recovery items remain open.
