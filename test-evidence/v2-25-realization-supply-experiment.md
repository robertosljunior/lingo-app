# V2.25 (#82) — BEFORE/AFTER: falsify the realization-supply hypothesis

**Verdict: INCONCLUSIVE, leaning "supply alone is not sufficient".**
The pilot focus cleared #82's supply precondition and its literal repetition
dropped sharply — but global experience variety barely moved, the single most
repeated sentence got *worse*, and the pedagogical distributions shifted beyond
"essentially stable". Per #82's own falsification gate: **STOP; do not treat
corpus expansion as the fix and do not proceed to a broad connector wave.**

## Provenance

| | |
|---|---|
| base SHA | `b79b74b` (main, merge of #110) |
| branch head | this branch, on top of the #112 scheduler fix |
| compiler flag | `licensedRealizations = { enabled: true, allow_provisional: true }` |
| personas / fixtures | one profile, adaptive mode, every assessable activity answered CORRECTLY from the response contract |
| seeds | deterministic — fixed study/lesson session ids and a fixed clock, identical in both arms |
| scope | full registry (`pedagogy_v2_but`, `pedagogy_v2_still`, `pedagogy_v2_yet`) |
| volume | 20 consecutive sessions × 12 activities = 240 interactions per arm |
| harness | real chain: `buildStudyPlannerContextV2` → `study-session-controller` → `study-focus-resolver` → `selectNextActivityV2` → assessment → persisted evidence, IndexedDB never cleared |

**One variable only.** Planner, focus resolver, `exemplar_cooldown`, score
weights, recipe policy, distractor behaviour, diversity policy / acceptable
band, `recent_exemplar_interactions`, session length and the learner fixture are
byte-identical between arms. The only difference is whether
`licensedRealizations` is forwarded.

## Why this experiment could not run before

The lesson engine has accepted `licensedRealizations` since V2.24, but **no
production path forwarded it**. `study-focus-resolver.js` called
`selectActivity()` with session/scope/focus/states/evidence/policy/runtime and
nothing else, so every real Praticar session ran with
`licensedEnabled === false` and `derivedExemplars === []`.

The compiler existed; nothing could switch it on. That is now a seam
(`study-session-controller` → `study-focus-resolver` → engine), **default
null**, pinned by `licensed-realization-supply-seam.test.js`.

## Available supply, measured (not assumed)

| pack | `allowProvisional: false` | `allowProvisional: true` |
|---|---|---|
| `pedagogy_v2_but` | 0 | 0 |
| `pedagogy_v2_still` | 0 | **12** |
| `pedagogy_v2_yet` | 0 | 0 |

All 12 descend from a single parent (`exemplar:still.002`) and land on a single
construction (`construction:still.subject_still_lexical_verb`). The `unless`
pilot's 12 realizations are unreachable: `pedagogy_v2_unless` is not in the
registry. Every allowlisted entry is `provisional_nonhuman`, so nothing
materializes at all without an explicit opt-in.

So the honest ceiling of this experiment is **+12 sentences on one construction
of one pack** — not the 112 candidates the semantic-network pilot audits, which
are not connected to the materializer (that connection is #98).

## Results

### Pilot focus — `construction:still.subject_still_lexical_verb`

| metric | OFF | ON |
|---|---|---|
| decisions on this focus | 53 | 58 |
| max same-focus eligible realizations | 5 | **17** ✅ ≥ 12 |
| mean same-focus band | 2.58 | **9.00** |
| distinct EN sentences served | 5 | **10** |
| decisions served by a licensed realization | 0 | 13 |
| **distinct licensed sentences actually served** | 0 | **5 of 12 available** |

#82's supply precondition is met and repetition *inside that focus* falls
substantially — distinct sentences double. This is the part of the hypothesis
that **holds**.

But note the last row: the pool grew from 5 to 17, and over 58 decisions the
engine still served only 10 distinct sentences, reaching **5 of the 12** new
realizations. Nominal supply and effective supply are not the same number, for a
structural reason (below).

### Why nominal supply overstates effective supply

`LICENSED_TIER1_ELIGIBLE_RECIPES` allows a derived realization to serve only
`meaning_recognition`, `listening_recognition`, `word_order_reconstruction` and
`pronunciation`. Everything that needs authored context — `exposure`,
`context_recognition`, `fixed_element_completion`, `guided_production`,
`free_production` — rejects it with `recipe_requires_context`. Pronunciation is
runtime-unavailable without an acoustic assessor.

So +12 realizations is +12 **only for the three recognition/word-order recipes**.
For controlled and free production the supply is unchanged. That asymmetry is
visible in the distribution shift below: more eligible candidates on recognition
recipes makes recognition candidates win more often, pulling the trajectory back
down the capability ladder. A supply band that counts realizations per focus
without conditioning on recipe will systematically overstate what the learner
can actually be served.

### Global experience

| metric | OFF | ON |
|---|---|---|
| activities | 240 | 240 |
| distinct EN sentences | 30 | 34 |
| distinct constructions | 6 | 6 |
| `exemplar_repeat_rate` | 0.875 | 0.858 |
| `max_exemplar_occurrences_per_session` | 4 | 4 |
| `p95_exemplar_occurrences` | 4 | 4 |
| `max_construction_occurrences_per_session` | 8 | 8 |
| **most-repeated sentence** | **17×** | **25×** ❌ |
| `opener_repeat_rate` | 0.105 | **0.211** ❌ |
| mean `unique_text_en_per_session` | 9.90 | 10.30 |

Per-session distinct sentences, all 20 sessions:

```
OFF  11 8 10 12 11 12 9 10 9 10 8 11 8 9 9 12 9 10 10 10
ON   11 12 12 12 11 12 11 8 9 10 8 11 9 8 10 9 11 12 10 10
```

The most repeated sentence in the ON arm is *"It was difficult, but I still
tried."* at 25× — an exemplar of a **different** construction
(`still.clause_but_subject_still_verb`), which the pilot does not supply. Adding
depth to one focus changed which sentence dominates without reducing dominance.
This is precisely the "no single aggregate variety score hides lexical or
structural monoculture" failure mode #98 warns about.

### Pedagogical stability — NOT within "essentially unchanged"

| distribution | OFF | ON |
|---|---|---|
| `controlled_production/writing` | 46 | **34** (−26%) |
| `recognition/listening` | 58 | 65 |
| `guided_production` | 18 | **11** (−39%) |
| `listening_recognition` | 88 | 97 |
| exposure stage A1 | 142 | 156 |
| exposure stage B1 | 35 | **21** (−40%) |
| lane supported / independent | 224 / 16 | 223 / 17 |
| `focus_type` deepen / review | 182 / 45 | 172 / 55 |
| outcomes | 232 correct, 8 observed | 232 correct, 8 observed |

Lane, outcome and new-item introduction counts are stable. Capability, recipe
and exposure-stage distributions are not: expanding supply on one A1
construction pulled the trajectory back toward A1 recognition and away from
controlled production. #82 requires these to remain within an explicitly
documented tolerance; no such tolerance would plausibly cover a 26–40% shift.

## Reading against #82's falsification gate

> If pool ≥ 12 and literal repetition remains materially concentrated above the
> theoretical/expected floor while all other variables are frozen, the supply
> diagnosis is not sufficient. STOP.

Pool reached 17. Within the pilot focus, repetition fell but did not reach the
floor: 10 distinct sentences served out of 17 eligible over 58 decisions, and
only 5 of the 12 new realizations were ever shown. Globally, concentration did
not fall at all — it moved. The gate's condition is met in substance, so the
correct action is to stop and inspect focus concentration and the per-recipe
supply asymmetry, rather than to scale the corpus.

> If the compiler reduces within-session literal repetition but the same
> exemplar still repeatedly opens sessions, record that as a distinct finding.

Recorded: `opener_repeat_rate` went 0.105 → 0.211. Session openers got *more*
repetitive, not less.

## What this means for #98

#98's design is vindicated. The experiment shows that supply expansion is only
useful when it lands on the focuses the Planner actually visits, and that a
bigger corpus without a working-set policy relocates monotony instead of
removing it. #98's three distinct populations (total eligible / active working
set / actually served) and its per-construction, per-sense, per-frame,
per-realization re-encounter metrics are load-bearing, not ceremony — this run
separated all three and they diverged sharply (17 eligible → 10 served → 5 of
12 new ones reached).

One addition #98 should absorb: **eligible supply must be counted per (focus,
recipe), not per focus.** Tier-1 derived realizations carry no authored context
and are therefore ineligible for five of the nine recipes, so a per-focus count
credits supply the learner can never be served on the production recipes.

It also confirms the dependency order stated in #98 and #97 rather than
overriding it. Every realization available today is `provisional_nonhuman`;
serving them to a learner means machine-approved sentences carrying real
evidence, which is exactly what #97's lexical-diagnosticity contract governs.
A learner meeting *"Our neighbors still need more time."* encounters
`neighbors`, `need more time` with no curricular introduction path, while the
evidence is attributed to the construction.

## Recommended order

1. **Focus concentration first.** The binding constraint is that 240 activities
   touch 6 of 18 constructions. Deepening one of them cannot fix that, as
   measured above. This belongs to the Planner frontier/working-set question,
   not to content volume.
2. **#97 diagnosticity contract**, before any licensed variant does real
   pedagogical work for a learner.
3. **#98 adapter with the working-set band**, measured with the re-encounter
   metrics the issue already specifies — and re-run this experiment with supply
   spread across several focuses rather than one.

## Limitation

This experiment tests experience variety and pedagogical stability only. It is
**not** evidence about learning outcomes. It also does not answer the capability
progression question, which #82 explicitly assigns to #106.

## Reproduction

The seam is default-off; the ON arm is produced by constructing the study
controller with `licensedRealizations: { enabled: true, allow_provisional: true }`
and driving 20 sessions with correct answers, exactly as
`e2e/practice-repetition-across-sessions.spec.js` drives the browser flow.
