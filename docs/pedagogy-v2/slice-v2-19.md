# Slice V2.19 — Controlled Practice Variety + Anti-Repetition

> The goal is not unpredictability. The goal is: *the system keeps training
> exactly what I need, but it stops feeling like the same exercise again.*

## 1. Base

| Fact | Value |
| --- | --- |
| Base SHA | `5ae96580808556443fce7343917f0cc25f038526` (Merge PR #42 / V2.18) |
| Branch | `claude/pedagogy-v2-19-practice-variety-8tqm4x` |
| DB_VERSION | **5** (unchanged — no new store) |
| Registry version | 1 (unchanged) |
| Planner version / policy | 1 / 1 (unchanged — Planner not modified) |
| Engine version | **2 → 3** |
| Engine policy version | **2 → 3** |
| ActivityPlan version | 1 (unchanged — new fields are additive within `presentation`) |
| Packs | `pedagogy_v2_still`, `pedagogy_v2_but`, `pedagogy_v2_yet` |
| Exemplars | still 22 · but 27 · yet 32 |

## 2. Baseline repetition & 3. Confirmed cause

`npm run audit:practice-variety-v2` runs the **same learner snapshot** over 30
consecutive sessions with evidence persisted between them, diversity OFF (frozen
V2.18) vs ON. Baseline (comprehension/reading):

- **option_target_position** was `{0: 180}` — the correct option was
  **structurally frozen at index 0** every single time.
- **immediate_exemplar_repeat_rate** 0.138; **in_session_recipe_streak_max** 6.

Confirmed cause = the **selector**, not the content (see Part J: every
construction has 4–7 unique authored realizations, no `LOW_EXEMPLAR_VARIETY`).
The engine always took the top score, used the seed only for exact ties, had an
in-session cooldown only, ignored `exemplar_id` from `recentEvidence`, and
sorted options / tokens lexicographically.

## 4. Exemplar-recency policy (versioned)

`DEFAULT_LESSON_ENGINE_POLICY_V2.diversity` (all knobs versioned):

```
recent_exemplar_interactions: 4   // window in INTERACTIONS, not days
acceptable_score_band:        0.15
recipe_streak_max:            2
enabled:                      true
```

**Window calibration.** The example value was 6. Audit + the 200-interaction
long-horizon simulation showed a window of 6 crossed the target-loop
grave-finding threshold for the *struggling* persona (share 0.51 > 0.50): deeper
rotation perturbs the remediation trajectory. **4** keeps every long-horizon
invariant (0.44) while still covering a whole short session before any exemplar
repeats. We did not use 6 blindly.

## 5. Cross-session behaviour (Part B)

`buildRecentExemplarUsageV2(recentEvidence)` (in `experience-diversity.js`) is
pure and groups by **interaction**, never by evidence event — one interaction
emits several target rows but counts once. It derives everything from the
already-persisted evidence tail: **no new store, DB_VERSION stays 5.** Output:
`Map<exemplar_id, {last_seen_index, interactions_since_seen, recent_interaction_count}>`.

Rule: with multiple materializable exemplars for the SAME focus, an exemplar
outside the recency window is always preferred; a recent exemplar repeats only
when it is the sole valid option (repeating beats blocking the session). The
in-session cooldown is untouched; both share this one recency helper.

## 6. Least-recent fallback (Part C)

When every eligible realization is inside the window, selection does **not**
return to the just-seen top exemplar. Ordering is
`eligibility → recency tier (least-recent first) → pedagogical score → context diversity → deterministic seed`.

## 7. Score safety (Part H)

Experience diversity only competes **within a pedagogically-acceptable band**
(`score ≥ best × (1 − 0.15)`) **and** only among candidates that share the
pedagogical anchor's **target, capability, modality and lane** (the endorsed
"hard filtering by recency among candidates sharing target/cap/mod/lane"). This
is why the focus can never drift: the anchor is the max-score candidate, and it
fixes WHAT is trained; diversity only reorders equally-valid realizations of it.
`trace.experience_diversity` records `best_score / candidate_score / score_delta`.

## 8. Recipe diversity (Part D)

In-session monotony is measured **per focus** (consecutive same recipe on the
same capability/modality/construction). After the cap, a valid equivalent
alternative recipe is preferred when one exists in the band; when none exists
(e.g. word-order not executable) the same recipe legitimately repeats.

## 9. Option shuffle (Part E)

The authored option set and the correct alternative are preserved; only the
presentation order is a deterministic seeded shuffle keyed on
`session seed | sequence_index | exemplar_id`. Audit: target position went from
`{0: 180}` to `{0: 58, 1: 62, 2: 60}` — no longer structurally frozen.

## 10. Word-order shuffle (Part F)

`canonicalOrderTokens()` (the correct answer) is untouched. The plan carries the
final `presented_tokens` (`presentation_order: 'seeded_shuffle'`), so the
renderer never runs randomness. The shuffle can never accidentally equal the
canonical sentence (it advances to the next deterministic permutation);
single-distinct-token / very short inputs return the canonical order (documented
safe behaviour). Contractions/punctuation are preserved verbatim.

## 11. Context diversity (Part G)

`context_repeat` counts exact overlaps of authored `context_items` with
exemplars seen inside the window — a tie-break only (never a block, never NLP).

## 12. New comprehension shape (Part K) + 13. Evidence semantics

`context_recognition`: the learner reads the EN sentence and picks the authored
pt-BR **situation** (context); distractors are other exemplars' authored
contexts (preferring a different sense). It reuses the `meaning_recognition`
activity kind, `comprehension/reading`, `single_choice`, `meaning_first`
attribution — **no new taxonomy, no generated text.**

Crucially it is a **presentation-only variant**: it is never scored as an
independent candidate, so it can never change which exemplar/target the adaptive
flow trains. The engine swaps a chosen reading-comprehension activity to this
shape when the standard shape would otherwise repeat (it alternates:
`meaning, meaning, context, …`). Target, exemplar, capability, modality, lane
and planned evidence are identical — only the UI varies, so no pedagogical
invariant moves. `sentence_from_context` (second optional shape) was **not**
added.

## 14. Engine / version changes (Part I)

`LESSON_ENGINE_V2_VERSION 2→3` and `LESSON_ENGINE_POLICY_VERSION 2→3` (selection
behaviour changed). Planner untouched → its versions stay 1. ActivityPlan stays
version 1 (new `presented_tokens` / `option_kind` are additive within
`presentation`).

## 15. Content audit (Part J) & 16. Exemplars added

Per-construction realization variety for still/but/yet: every construction has
4–7 exemplars, all with unique text and unique context. **No
`LOW_EXEMPLAR_VARIETY` findings → no exemplars added this slice.**

## 17. 30-session before/after · 18. repeat metrics · 19. recipe metrics

`npm run audit:practice-variety-v2` (comprehension/reading):

| metric | BEFORE (V2.18) | AFTER (V2.19) |
| --- | --- | --- |
| immediate_exemplar_repeat_rate | 0.138 | 0.034 |
| in_session_recipe_streak_max | 6 | 2 |
| context_repeat_rate | 0.138 | 0.034 |
| option_target_position | {0:180} | {0:58, 1:62, 2:60} |

Observability (Part O) lives on `trace.experience_diversity` (diagnostics, never
mastery): best/candidate score + delta, recency, context repeat,
context_recognition swap.

## 20. Controlled-seed results & 21. Simulation (Part S / R)

Determinism: `npm run simulate:pedagogy-v2 -- --scenario all --check-determinism`
→ all 7 personas, **no grave findings**; same state+evidence+seed+clock ⇒ same
ActivityPlan; different seeds vary equivalent realizations. No `Math.random` in
the engine.

## 22–33. UX, tests, validators, benchmarks, build

- Unit tests: `practice-variety-v2.test.js` (22 tests) covers the 25 minimum
  cases; full suite **1211 passed**.
- Renderer: `context_recognition` registered in `V2ActivityRenderer`; its own
  context is never shown as a prompt (it is the answer). Action-oriented
  microcopy via `instructions_pt` ("Em qual situação essa frase faria sentido?").
- Validators (content-packs, knowledge-packs, pedagogy-v2), `inspect`, both
  audits, semantic + IndexedDB benchmarks, and `npm run build` all pass. dist
  not committed.

## 34. DB_VERSION

Unchanged at **5**. Recent-exemplar usage is derived from persisted evidence; no
`exemplar_history` store.

## 38. Limitations

- With a **frozen** learner snapshot and a capability-only focus, distinct
  first-exemplar count stays bounded by the anchor-target group (~4): variety
  shows as fewer immediate repeats + unfrozen option positions rather than more
  distinct targets. Real sessions get varying planner focuses, which broadens
  it further (see simulation).
- UX polish (Part L/M) is applied narrowly (context_recognition prompt safety,
  microcopy, renderer wiring); the broader per-recipe visual redesign and the
  375px screenshot matrix (Part T) are the main deferred items.
- `sentence_from_context` (second optional shape) not implemented.

## 39. Recommendation for V2.20

- Broaden the per-recipe visual identity pass (Part L) and capture the 375px
  before/after screenshot matrix + Playwright variety runs.
- Consider a **planner-level** target-variety signal so capability-only focuses
  can spread across equally-needy targets without risking target-loop
  regressions (kept out of scope here to protect the long-horizon invariants).
- Evaluate `sentence_from_context` once evidence semantics for it are proven.
