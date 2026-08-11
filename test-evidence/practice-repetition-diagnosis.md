# Praticar repetition — measured diagnosis

Investigation of the standing complaint that the real Praticar flow keeps showing
the same sentences, still reported after PR #110 (`b79b74b`) made exemplar
recency session-aware.

Everything below is measured on the **real learner-facing pipeline**
(`buildStudyPlannerContextV2` → `study-session-controller` → `study-focus-resolver`
→ `selectNextActivityV2` → assessment → persisted evidence), over consecutive
sessions on **one profile whose IndexedDB is never cleared**, with **every
assessable activity answered correctly** from the plan's own response contract.

The correctness of the answers is not a detail. The earlier investigation's
harness answered recognition by clicking the first option; wrong answers push the
Planner into remediation, remediation pins one construction, and the "same four
sentences forever" that harness recorded was largely its own doing. Re-measured
with correct answers, the failure is smaller but real — and has a different
cause.

## 1. Reproduction

20 consecutive sessions, 240 activities, all correct (deterministic Node harness
over the real controller and real IndexedDB):

| | value |
|---|---|
| activities | 240 |
| distinct EN sentences shown | **28** |
| distinct constructions reached | **6** of 18 authored |
| authored exemplars in the catalogue | **85** (3 packs) |
| new sentences per session | 11, 4, 0, 0, 0, 1, 1, 0, 3, 0, 3, 1, 0, 0, 2, 0, 1, 1, 0, 0 |

Ten of the twenty sessions introduced **zero** new sentences. That is the
reported experience, reproduced.

## 2. Causes, by category

### A — recency/selection bug: PARTIALLY CONFIRMED

`avoidable_exact_repeat` (a repeat of an exemplar used inside the recency window
while the band still held one outside it) was **0** before and after. The hard
"never repeat something recent while a fresh alternative exists" rule was
already honoured.

But the *ordering* was not. Once two or more candidates were outside the
4-interaction window they were treated as identical: `interactions_since_seen`
was computed, put in the trace, and then discarded, so the winner fell through to
a per-session seed hash. An exemplar read last session competed on exactly equal
terms with one **never seen in the learner's life** (`interactions_since_seen`
= `Infinity`).

Measured: in **73 of 240** decisions the engine presented an exemplar it had seen
more recently than another exemplar sitting in the same band. Fixed → **10**
(the remainder are legitimate: a genuinely higher-scoring candidate wins first).

### B — same-focus band collapse: CONFIRMED, with a bug component

Diversity competes only among candidates realising the anchor's focus. That test
compared `primaries[0] === primaries[0]` — the FIRST entry of each exemplar's
authored `pedagogical_targets` array.

Array position is an authoring artifact. `exemplar:still.001` authors
`[sense:still.continuity, construction:still.subject_still_lexical_verb]`;
`still.002/003/005` author the same two targets in the opposite order. All four
declare both as `role: primary`, all four pass the same gates, all four score
**identically** — and `plannedEvidenceFor` keys attribution on `target_type` /
`role`, never on position, so they are genuinely interchangeable.

Measured: in **109 of 240** decisions (45%) at least one interchangeable exemplar
was excluded from the band purely by field order. When the anchor was the
odd-ordered one the band collapsed to the anchor alone, guaranteeing a repeat.

| | before | after |
|---|---|---|
| decisions with a band of exactly 1 exemplar | 114 / 240 (47.5%) | 88 / 240 (36.7%) |
| decisions with a band of ≥ 4 | 50 / 240 | 85 / 240 |
| mean band size | 2.31 | 2.86 |
| focus signatures that NEVER exceeded 1 interchangeable exemplar | 22 / 50 | 8 / 51 |

### C — Planner focus concentration: CONFIRMED, and by design

Over 240 activities the Planner issued `introduce` **3 times**. Its dominant
exclusions are `frontier_at_capacity` (2348) and `max_pack_switches_reached`
(1582) — the scale-safe frontier gate (§5(F)/§23) and the pack-switch cap doing
exactly what they were built to do: not opening more simultaneous knowledge than
the learner is carrying. This is pedagogy, not a defect, and it is **not**
touched here.

### D — content/supply: CONFIRMED, and the dominant residual

A focus target is one construction or one sense, and each authored construction
carries **4–5 exemplars** — of which some are prerequisite-gated on their own
construction (e.g. `still.004` requires `construction:still.subject_still_lexical_verb`
before it can be served). With `exemplar_cooldown: 3` a focus whose reachable
supply is 4 sentences is a forced 4-cycle: the engine has literally one candidate
left and no policy can create variety from it.

After the fix, **8 of 51** observed focus signatures still never exceeded a single
interchangeable exemplar. Those are supply, not scheduling. See §5.

### E — persistence/context: ELIMINATED

Checked end to end in the real flow, not in a unit fixture:

* evidence carries `session_id` (`assessment-to-evidence.js` ← `plan.session_id`);
* `recordDurableLearnerInteractionV2` commits interaction + evidence + derived
  state in one IndexedDB transaction, before the next `buildPlannerContext`;
* `getLearnerEvidenceV2` → `filterEvidence` sorts by `occurred_at` then
  `evidence_id`, so the tail really is chronological (the raw
  `getAllFromIndex` order is by primary key and would NOT be);
* `interactions_since_seen` observed in the trace matches the value computed by
  hand from the recorded stream (verified at S4.08: 16, exactly).

Nothing is lost between turns.

### F — session identity: CONFIRMED, secondary

`buildRecentExemplarUsageV2().latest_session_id` resolves to a **lesson** session,
which is per pack. One learner-visible Praticar session routinely spans 2–3 packs:

```
v2study-001 → v2lesson-…_yet-0001, v2lesson-…_but-0002, v2lesson-…_still-0003
```

So #110's "protect everything from the latest session" protects only the last
pack's fragment — typically 4–5 of the session's 12 activities — and its "opener"
is that fragment's opener, not the session's. This is why #110 did not move the
needle in practice.

It is left in place rather than rewired: with the least-recent ordering of §A now
in effect, an exemplar used in the previous session has a small
`interactions_since_seen` and loses to staler ones on its own, so the session
membership flag is no longer load-bearing. Changing which id evidence carries
would alter the LearnerEvidenceV2 contract for no additional behaviour.

### G — other: bundle identity

Ruled out as a confounder. The E2E asserts `engine_version === 4` read from the
live decision trace and records the module-script fingerprint of the build it
drove, so a cached service-worker/dist copy can never make it pass.

## 3. What was changed

`src/lib/pedagogy-v2/lesson-engine.js`, selection only:

1. the same-focus band is keyed on primary-target **membership**
   (`c.primaries.includes(anchorTarget)`) instead of array position;
2. `interactions_since_seen` **orders** the pool of equally-scored realisations
   (least recent first, never-seen first of all) instead of only breaking the
   all-recent fallback;
3. the plan reports the **anchor's** target as `primary_target` even when a
   diversity swap lands on an exemplar that authors its primaries in a different
   order — the focus was never supposed to move on a swap, and letting the label
   follow the array order made the reported focus flip.

No threshold, weight, cooldown or window was changed. `LESSON_ENGINE_V2_VERSION`
3 → 4 because selection semantics moved; `LESSON_ENGINE_POLICY_VERSION` stays 5
because no knob did.

## 4. Result

Deterministic 20-session harness, identical seeds:

| metric | before | after |
|---|---|---|
| distinct EN sentences (240 activities) | 28 | 30 |
| most-repeated sentence | 23× | 17× |
| presented a staler alternative was available | 73 | 10 |
| `avoidable_exact_repeat` | 0 | 0 |
| mean band size | 2.31 | 2.86 |
| band of exactly 1 | 47.5% | 36.7% |
| fewest distinct sentences in a session | 6 | 8 |

Real browser, `e2e/practice-repetition-across-sessions.spec.js`, 5 sessions ×
12 activities, all correct, IndexedDB preserved:

| metric | before | after |
|---|---|---|
| engine_version in the live trace | 3 | 4 |
| presented a staler alternative was available | 16 | 2 |
| mean band size | 2.73 | 3.33 |
| band of exactly 1 | 21 / 60 | 14 / 60 |
| band of ≥ 4 | 18 / 60 | 31 / 60 |
| `avoidable_exact_repeat` | 0 | 0 |
| back-to-back identical sentence | 0 | 0 |
| distinct EN sentences | 16 | 15 |

The browser run uses real (random) session ids, so per-session sentence counts
move between runs; the band and staleness figures are the mechanism-linked ones.

**The honest headline: distinct sentences barely moved (28 → 30 of 85), because
the ceiling is not the scheduler.** The engine is now close to optimal given the
focus it is handed — it picks the stalest interchangeable realisation available,
and 88 of 240 decisions still have exactly one to pick from.

## 5. Where the next correction belongs

Not in the engine, and not in a heuristic that hides the shortage.

1. **Supply per focus.** 8 of 51 observed focus signatures have a single
   reachable exemplar; the modal construction carries 4. Raising authored
   exemplars per construction to ≥ 8 would let `exemplar_cooldown: 3` rotate
   instead of forcing a cycle. This is a content slice, measurable up front with
   `scripts/audit-target-content-depth-v2.mjs`.
2. **Self-gating prerequisites.** Several exemplars list their own construction
   as a prerequisite (`still.004`, `but.004`–`but.007`), which removes them from
   the very focus they belong to until it is already consolidated. Worth an
   authoring review: it costs roughly a third of the early supply of the packs'
   entry constructions.
3. **Frontier width.** The frontier gate is correct in principle, but with 4–5
   exemplars per construction a working set of this size cannot fill a
   12-activity session without repetition. The trade-off between frontier width
   and per-construction depth is a pedagogy decision, and should be taken with
   these numbers rather than by loosening the gate.
