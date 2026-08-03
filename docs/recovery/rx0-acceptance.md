# RX-0 acceptance

- [ ] V2 History reads only `learner_evidence_v2`.
- [ ] V2 Review Points reads only direct V2 assessed evidence.
- [ ] One interaction that emitted several target events appears once.
- [ ] Evidence is grouped by the existing durable `session_id`.
- [ ] No score, CEFR, mastery percentage, V1 skill or YAML import appears in V2 surfaces.
- [ ] Missing learner response/diagnosis/collection is disclosed, not reconstructed.
- [ ] Explicit V1 mode still renders the legacy History and Mistakes screens unchanged.
- [ ] Unit tests, build and full Playwright pass in remote CI.

RX-0 does not close full persistence. RX-1 remains required for complete future records.
