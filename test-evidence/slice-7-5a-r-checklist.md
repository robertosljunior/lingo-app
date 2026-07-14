# SLICE 7.5A-R — Post-Redesign Content Quality & Runtime Stability — Checklist

Branch: `claude/local-semantic-tutor-rcd80y` — already contains the full Bob redesign (phases 1–6; phases 1–2 merged as PR #21, phases 3–6 open as PR #22). This slice builds on top. Baseline HEAD recorded in T01.

Scope guardrails (per spec): no new redesign, engines, models, broad pack expansion, gamification, login, backend, cloud sync, new Stories features, or unrelated aesthetics. Fix only objective defects.

Status: pending / in_progress / completed / blocked / failed

| ID | Status | Deps | Cause / hypothesis | Files | Validation | Evidence | Commit |
|----|--------|------|--------------------|-------|------------|----------|--------|
| T01 Preflight | in_progress | — | — | — | git state + gates | recorded below | — |
| T02 Baseline post-redesign | in_progress | T01 | — | — | unit+build+validators+benchmarks+e2e | below | — |
| T03 Fresh install Kids | pending | T02 | onboarding not e2e-covered end-to-end w/ reload | e2e | new spec | — | — |
| T04 Fresh install Adulto | pending | T02 | same | e2e | new spec | — | — |
| T05 Legacy profile migration | pending | T02 | redesign hid multi-profile; legacy data must survive | store, storage | unit/e2e | — | — |
| T06 History/progress integrity | pending | T05 | — | storage | e2e | — | — |
| T07 Navigation by mode | pending | T02 | adult direct route to Stories must not break | App, store | e2e | — | — |
| T08 Kids Stories audit | pending | T02 | comprehension check missing in current stories | Stories | audit+e2e | — | — |
| T09 Talk-with-Bob | pending | T02 | — | Talk | e2e | — | — |
| T10 Seven exercise types | pending | T02 | — | Exercise | e2e | — | — |
| T11 PT/EN voice | pending | T02 | — | tts | e2e | — | — |
| T12 Accessibility functional | pending | T02 | dark contrast, focus, reduced-motion, SR labels | tokens, components | audit+fixes | — | — |
| T13 Bilingual metrics report | pending | T02 | 96/8 numbers unexplained | report | doc | — | — |
| T14 Portuguese audit | pending | T13 | pattern content may read artificial | audit doc | sample≥ spec | — | — |
| T15 English audit | pending | T13 | same | audit doc | sample≥ spec | — | — |
| T16 Semantic equivalence | pending | T14,T15 | — | bilingual-content | goldens | — | — |
| T17 Repetition/diversity | pending | T13 | STRONG hypothesis: sentences differ only by noun (12 fixed patterns) → fails ≥6 structures, ≥5 verbs, noun-swap | build script, generator | metrics | — | — |
| T18 CEFR adequacy | pending | T14 | patterns are level-mapped; verify not size-only | build script | audit | — | — |
| T19 Theme adequacy | pending | T14 | generic "The X is important" not theme-specific | build script | audit | — | — |
| T20 Content fixes | pending | T17,T18,T19 | — | build script, packs | validators | — | — |
| T21 Reproduce USE contention | in_progress | T02 | 3 USE specs flake only under parallel CPU (real 25MB model) | playwright.config | repro | — | — |
| T22 Fix USE flakiness | pending | T21 | run real-USE specs in a dedicated SERIAL project, still real, not skipped | playwright.config, specs | full run green | — | — |
| T23 Unit + validators | pending | T20 | — | — | gates | — | — |
| T24 Full Playwright | pending | T22,T20 | — | — | e2e | — | — |
| T25 Repeat-each/stress | pending | T24 | — | — | repeat-each | — | — |
| T26 Final report | pending | all | — | this file | — | — | — |

## T21 hypothesis (USE flakiness)
Three specs (`semantic-model.spec.js` USE-download, `semantic-worker-ux.spec.js` both, `semantic-free-feedback.spec.js` agreement) each load the real ~25 MB Universal Sentence Encoder on the CPU backend. Under the default fully-parallel Playwright run they compete for CPU/memory/model-install, so a *different one* fails each run while each passes in isolation. Fix direction (per spec): a dedicated **serial** Playwright project for the real-model specs that is part of the normal `playwright test` command, runs the real model (no mock/skip), while every other spec stays parallel.

## T17 hypothesis (diversity)
`build-content-packs.mjs` generates every sentence from 12 fixed patterns with only the theme noun swapped (e.g. "The {noun} is important.", "We check the {noun} every day."). Across a theme×level only ~4 patterns are used (one per template index). This likely fails: ≥6 structures per theme×level, ≥5 verbs per theme×level, and the "sentences that only swap a noun" criterion. Fix: enrich the deterministic authoring with theme-specific, verb-diverse sentence sets — without broad pack expansion or new engines.

## FINAL CLASSIFICATION
(pending)
