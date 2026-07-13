# SLICE 7.3 — Semantic Worker and Responsive Tutor Polish — Checklist

Branch: `claude/local-semantic-tutor-rcd80y` (base `main`; PR #19 open). Slice 7.3 stacks on Slice 7.2 on the same branch.

Objective: move real USE **load + inference + ranking + intent classification** off the main thread into a dedicated Web Worker; keep cache/offline/fallback intact; polish the real feedback UI (scroll, contrast, density, responsiveness); keep the whole suite green.

Self-imposed rule (per spec): do not reduce scope; a genuinely-blocked item is marked blocked in isolation and does not stop the rest; the final classification is chosen only after the whole checklist is walked.

Status legend: pending / in_progress / completed / blocked / failed

## Message contract (T03, recorded up front)
Worker input `{ type, request_id, payload }` with `type ∈ LOAD_MODEL | EMBED | RANK | CANCEL | DISPOSE`.
Worker output `{ type, request_id, payload }` with `type ∈ RESULT | PROGRESS | ERROR | CANCELLED`.
Invariants: no serialized functions cross the boundary; no arbitrary URLs (model bytes come only from the checksum-verified IndexedDB store via the existing loader); every request carries a `request_id`; CANCEL drops obsolete responses; per-request timeout on the main side; one model singleton per worker; worker can be recreated after a crash; DISPOSE frees the model + tf backend.

## Main-thread boundary (invariant)
The main thread must NOT run: model load, tensor creation, embedding, cosine ranking, or intent classification. It MAY run: UI, orchestration, light deterministic rules, persistence, feedback presentation. All embed/rank/classifyIntent calls are delegated to the worker; on worker failure/timeout/crash the pipeline degrades to the on-main-thread hashing fallback exactly as before (structured, no error boundary).

| ID | Description | Status | Deps |
|----|-------------|--------|------|
| T01 | Preflight & baseline | in_progress | — |
| T02 | Baseline main-thread blocking measurement | pending | T01 |
| T03 | Worker message contract | completed | T01 |
| T04 | USE loader inside the worker | pending | T03 |
| T05 | Embedding + ranking in the worker | pending | T04 |
| T06 | Cancellation + obsolete-response drop | pending | T05 |
| T07 | Worker failure recovery + fallback | pending | T05 |
| T08 | Cache + IndexedDB unchanged | pending | T04 |
| T09 | Offline still works | pending | T08 |
| T10 | Exercise integration (cancel on question change) | pending | T06 |
| T11 | Loading + cancellation UI states | pending | T10 |
| T12 | Visual review of the four feedback states | pending | T10 |
| T13 | Scroll + footer (single scroll region, safe area) | pending | T12 |
| T14 | Colors + contrast (semantic tokens) | pending | T12 |
| T15 | Mobile (5 viewports, no overflow) | pending | T13 |
| T16 | Accessibility | pending | T12 |
| T17 | Performance (before/after) | pending | T05 |
| T18 | Unit tests | pending | T07 |
| T19 | E2E | pending | T10 |
| T20 | Build + report | pending | all |

## Acceptance criteria (declare PASS only if all hold)
USE runs in the worker · inference not on main thread · cancellation works · obsolete response dropped · fallback works · offline works · UI responsive · scroll fixed · contrast adequate · mobile no overflow · feedback not duplicated · memory stable · unit pass · E2E pass · build pass.

## Evidence log
(filled in per increment)
