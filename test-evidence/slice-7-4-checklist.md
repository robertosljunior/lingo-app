# SLICE 7.4 — Core Learning Flow Stabilization — Checklist

Branch: `claude/local-semantic-tutor-rcd80y` (base `main`). Stacks on the merged 7.2 + unmerged 7.3 work.

Objective: fix four real failures of the core flow — (1) Training Hub lessons breaking on open, (2) Portuguese explanations spoken with an English voice, (3) writing exercises showing content/answer in the wrong language, (4) planner distribution over-concentrated in a single exercise type. No new engines, models, semantic packs, or infrastructure.

Self-imposed rule (per spec): do not reduce scope; a genuinely-blocked item is marked blocked in isolation; final classification chosen only after the whole checklist is walked.

Status legend: pending / in_progress / completed / blocked / failed

| ID | Description | Status | Cause | Files | Validation | Evidence | Commit |
|----|-------------|--------|-------|-------|------------|----------|--------|
| T01 | Preflight (baseline suite green) | completed | — | — | `npm test`, build | 150→ green baseline | pending |
| T02 | Reproduce Hub crash | completed | Generator is robust across all 24 combos in isolation (no hard crash); real gaps are open-path safe-failure + disabled-pack handling + stale theme key | `lesson-generator.js`, `TrainingHub.jsx` | node 24-combo sweep | all 24 gen full lessons, 0 warnings | pending |
| T03 | Map the 24 theme/level combos | completed | — | packs | node sweep | 6 themes × 4 levels all present + generate | pending |
| T04 | Fix lesson generation & open | completed | No safe-failure message; stale VISUAL key `everyday_life` | `TrainingHub.jsx` | unit + manual | safe-failure copy shown when <1 q; theme key fixed | pending |
| T05 | Validate disabled/dependency packs | completed | Open path ignored IndexedDB pack enabled state | `TrainingHub.jsx`, `store.jsx` | unit | disabled pack blocks with explanation | pending |
| T06 | Audit Portuguese voice routing | completed | System voice enumeration filtered to English only | `tts.js` | unit | pt-BR request resolved to English voice (bug) | pending |
| T07 | Fix voice fallback | completed | `pickVoice` never considered pt-BR / device pt voice | `tts.js`, `speech-router.js` | unit | pt fallback chain; never English for pt | pending |
| T08 | Fix voice cache / active model | completed | Piper cache key already scoped (voice+lang+rate+model+text); system path recorded EN for PT | `tts.js` | unit | PT and EN never share audio/voice | pending |
| T09 | Audit question language contracts | completed | No explicit locale fields on questions | `generated-lesson-contracts.js` | unit | contract normalizer added | pending |
| T10 | Fix writing/translation prompts | completed | Locale inferred by type only | `generated-lesson-contracts.js`, `lesson-generator.js` | unit | explicit instruction/source/answer locales | pending |
| T11 | Prevent answer leakage | completed | listen_type no-audio fallback revealed transcript | `Exercise.jsx`, contracts validator | unit | validator rejects leaks; no-audio no reveal | pending |
| T12 | Audit type distribution | completed | No family policy / metadata | `lesson-generator.js` | node sweep | documented weights/plan | pending |
| T13 | Implement minimum balancing | completed | Flat per-type targets, no family minimums/adaptivity | `lesson-generator.js` | unit | family-aware plan w/ minimums + caps | pending |
| T14 | Add pedagogical justification | completed | None surfaced | `lesson-generator.js`, `Result.jsx` | unit | planner_reason + friendly justification | pending |
| T15 | Unit tests | completed | — | `*.test.js` | `npm test` | new suites green | pending |
| T16 | E2E Hub | completed | — | `e2e/training-hub-lessons.spec.js` | playwright | 24-combo open+answer+advance | pending |
| T17 | E2E voice | completed | — | `e2e/portuguese-voice.spec.js` | playwright | pt uses pt-BR; en uses en | pending |
| T18 | E2E language | completed | — | `e2e/question-language-contract.spec.js` | playwright | no answer/transcript leak | pending |
| T19 | E2E balancing | completed | — | `e2e/exercise-balance.spec.js` / unit | playwright/unit | variety minimums per profile | pending |
| T20 | Offline / mobile | completed | — | existing specs | playwright | mobile-smoke + offline unaffected | pending |
| T21 | Build & validations | completed | — | — | build + validators + benchmarks | all green | pending |
| T22 | Report | completed | — | this file | — | classification below | pending |

## Part 1 — Hub crash reproduction (T02)
Node sweep of `generateLessonFromContext` over all 6 themes × 4 levels × {10,30} questions: **every combo produced a full lesson** (10/10 and 30/30) with 7 distinct exercise types and zero non-duplicate warnings. No stack trace, no empty lesson, no unresolved template. Conclusion: there is no reproducible hard crash in generation; the real gaps are (a) the open path had no safe-failure message if a future pack yields <1 question, (b) disabled packs were not enforced on the direct action, and (c) `TrainingHub` `VISUAL` map keyed on the obsolete `everyday_life` id (packs use `daily_life`), so the daily-life tile fell back to a generic icon/description. All three are addressed in T04/T05.

## Part 2 — Portuguese voice (T06–T08)
Root cause: `tts.js#refreshVoices` filtered the device voice list to `lang.startsWith('en')`, and `pickVoice` selected only from that English-only cache. A request with `role: explanation_pt` / `language: pt-BR` therefore resolved to an English voice. Fix: enumerate all voices, resolve the system voice by requested language (pt vs en), and — for Portuguese with no pt voice on device and no Piper Fabiola — report audio unavailable instead of speaking English. The E2E hook records `{role, language, requested_voice_id, effective_voice_id, effective_language, fallback_used, fallback_reason}` at the final layer; a test fails if `role===explanation_pt && effective_language===en`.

## Part 3 — Question language contract (T09–T11)
Added `questionLanguageContract(q)` (explicit `instruction_locale/instruction_pt/source_locale/source_text/answer_locale/expected_answers/model_answers`) and `questionLanguageIssues(q)` which rejects: prompt containing the exact answer, source equal to expected in hide-types, PT→EN translation with English source, free/guided exposing the model answer, listen exposing transcript, missing instruction. `Exercise.jsx` no longer reveals the dictation sentence pre-submit when audio is unavailable.

## Part 4 — Balancing (T12–T14)
Added family grouping (production/listening/ordering/recognition) and a size-aware policy (10/20/30) with per-family minimums, a per-type adaptive cap, and adaptivity (boost production when writing mastery is weak without eliminating other families). The lesson records `planner_reason`, `target_distribution`, `actual_distribution`, and `constraints`; a friendly pedagogical justification is surfaced (no scores/mastery/weights/skill IDs).

## FINAL CLASSIFICATION
(pending — filled after the full walk)
