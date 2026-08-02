# Slice V2.22-UX1 — Interactive Exercise Production Implementation

Turns the approved V2.22-UX0 design into the real learner interface, on the real
contracts and the real pipeline. No pedagogy moved into React.

---

## 0. Base

| Item | Value |
|---|---|
| Base SHA | `0dc103a6541fe5a22ad9df5e82136d18e0e17e31` (merge of PR #53 / V2.21-R3c) |
| V2.22-UX0 PR | **none — the slice was never merged** (see §0.1) |
| Handoff path | `design-handoff/v2-22-ux0/` — vendored by THIS slice from the delivered ZIP |
| `DB_VERSION` | **5** (`src/lib/storage.js`) — unchanged |
| `LESSON_ENGINE_V2_VERSION` | 3 — unchanged |
| `LESSON_ENGINE_POLICY_VERSION` | 4 — unchanged |
| `ACTIVITY_PLAN_V2_VERSION` | 1 — unchanged |
| `ACTIVITY_RESPONSE_VERSION` | 1 — unchanged |
| `LEARNER_PRESENTATION_VERSION` | 1 — unchanged |
| Branch | `claude/v2-22-ux1-interactive-exercises-production` |

### 0.1 The base was not what the brief assumed

The brief says to start from a `main` that already contains the V2.22-UX0 merge
and the handoff files. It does not:

- there is no `design-handoff/` directory on `main` and none in any remote branch;
- there is no UX0 commit, branch or PR (`git log --all --grep=UX0` is empty);
- `docs/pedagogy-v2/v2-22-ux0-interactive-exercise-design.md` — cited by
  `HANDOFF.md` as the home of the acceptance criteria — **does not exist**, and
  the ZIP does not contain it either;
- `V2InteractionDesignLab` (brief §29) does not exist. The only V2 lab surface is
  `src/screens/PedagogyV2Lab.jsx`, which is untouched by this slice.

The handoff package itself was supplied directly as a ZIP, so the design source
of truth was available and complete apart from that one cross-referenced
document. This slice vendors the package into `design-handoff/v2-22-ux0/` so the
implementation and its source can be reviewed together, and reads the acceptance
criteria from the brief instead of from the missing file.

---

## 1. What the handoff recommends, and what shipped

| Area | Handoff recommendation | Shipped |
|---|---|---|
| Word order | Option A — **Magnetic Rail**: `picked[]` + `selected` gap, real insertion targets, undo/restart, bank fades to 0.32 | yes |
| Word order | Option B (inline slots), per-token marking, drag | **not** shipped — B was discarded by the handoff, per-token marking is class C, drag is marked optional |
| Completion | **One slot per `expected_token`**, `fills{}` per gap, reversible, punctuation stays in the text | yes |
| Completion | Free input stays a real `<input>`, IME not intercepted | yes |
| Guided writing | Model **on demand**, answer preserved after assessment, factual word count | yes |
| Feedback | Same screen, continuity rule tinted by tone, semantics untouched | yes |
| Transition | Unchanged 220/260ms slide, single CTA, `onAdvance` at the same moment | unchanged |
| Evaluating state | Visible `Avaliando…`, activity untouched | yes |

Frame-by-frame comparison with justification for every difference:
`test-evidence/v2-22-ux1-production/mockup-comparison.md`.

---

## 2. The one place the handoff was wrong, and why the code won

`HANDOFF.md` §4 states the completion payload is *"`type:'text'` with the
reconstituted `masked_text`"*, and calls it unchanged. Both halves are false
against the real contract.

`activity-assessment.js` splits `payload.text` on whitespace and compares it
**positionally** against `expected_tokens`:

```js
const given = String(response.payload.text || '').trim().split(/\s+/)
const matches = expected_tokens.filter((t, i) => normalize(given[i]) === normalize(t)).length
```

Measured against the real assessor for a two-gap plan
(`She has not finished it yet`, fixed elements `['not','yet']`):

| payload.text | outcome |
|---|---|
| `"not yet"` — the gap fills, in gap order | **correct** |
| `"She has not finished it yet"` — the handoff's stated payload | **incorrect** |
| `"not"` — what the pre-V2.22 UI could send | **partial** (0.5) |

So the shipped payload is **the gap fills joined by a single space, in gap
order**. With one gap that is byte-identical to the pre-V2.22 payload. The
priority ladder in the brief §2 (real contracts first) decided this; the proof
runs on every CI run in `v2-interaction-state.test.js`.

### The defect this fixes is real and shipping

`buildMaskedCompletion` already returned several `expected_tokens`; the renderer
drew one slot and re-joined the rest as a literal `_____`. **24 authored
exemplars** across `but`, `still` and `yet` mask two elements
(`not…but`, `but…still`, `although…still`, `yet…to`, `and…yet`, `yet…another`).
For every one of them the learner could fill the first gap only, and the
assessor scored `partial` for an answer the UI never permitted.

---

## 3. Contracts

Unchanged, and asserted:

- `ActivityPlanV2` — read only; no field added, removed or reinterpreted.
- Response types — `token_sequence` for word order, `text` for completion and
  writing. Payload shapes identical.
- Assessment — untouched. No file under `src/lib/pedagogy-v2/` changed behaviour.
- Evidence / Learner Model / Planner / Study Focus Resolver — untouched.
- `DB_VERSION` — 5, unchanged. No schema, no migration.
- Support usage — `answer_reveal`, `hint` and `model_sentence` still route
  through `onSupport`. `model_sentence` is already part of the plan's *baseline*
  support, so gating it behind "Ver um modelo" cannot lower recorded support:
  `finalizeSupportUsage` unions baseline ∪ used.

---

## 4. Reaching the production recipes in E2E

Slice V2.20 recorded a real gap: its visual matrix never captured completion,
word order or production, because the harness answered recognition by tapping
the first option — usually wrong — so Capability Entry never opened controlled
production. It named two ways out: *"a harness that can answer correctly (or a
DEV-only forced-plan route)"*. The brief forbids the forced-plan route, so this
slice built the other one:

1. `window.__e2e.v2Activity` publishes the current plan's `text_en` and
   `correct_option_id`, gated behind the existing `__e2e` object (which only
   exists when a spec sets `sessionStorage['e2e:enabled']`). It **publishes**;
   the Planner still chooses every activity and the Assessment still judges every
   answer.
2. The specs remove `SpeechRecognition` from the runtime. Runtime-aware
   Capability Entry (V2.10) picks the first *executable* modality, and `speaking`
   sorts before `writing`; a headless browser advertises speech input it cannot
   actually use. Telling the runtime the truth makes production enter through
   writing — the policy working as designed, not a plan being forced.

With those two, `word_order_reconstruction`, `fixed_element_completion` and
`guided_production` are reachable from a real planner-driven session for the
first time, and the V2.20 matrix gap is closed.

---

## 4.1 A pre-existing breakage found on the way

`e2e/v2-helpers.js` `openV2Home()` reached the V2 Home by clicking
`open-training-hub` — a card that lives only in `LegacyHome.jsx`. The V2.20-R
cutover (`c8dfb06`) made the ROOT Home the V2 Learner Home and moved the V1 Home
into `LegacyHome.jsx`, so with V2 active that button never renders. The helper
was last touched in `8328f1e`, which **predates** the cutover:

```
$ git merge-base --is-ancestor c8dfb06 <last commit touching e2e/v2-helpers.js>
helper commit is BEFORE the cutover -> never updated
```

Consequence: every V2 learner spec entering through `openV2Home` — in
`pedagogy-v2-20-polish`, `pedagogy-v2-learner`, `pedagogy-v2-learner-home` — has
been spending a 180s timeout waiting for a removed button since that merge.

Repaired here, minimally: the helper (and the two specs with their own copy of
the click) now use the legacy entry only when it is actually present, so both the
V2 root-home world and the pinned-V1 opt-out keep working. Nothing about what
those tests assert changed. It is fixed in this slice because §40 requires a
green Playwright run, which was not reachable otherwise.

---

## 5. Out of scope, and untouched

Study Planner, Active Frontier, capability progression, Learner Model, evidence
weights, thresholds, introduction groups, content packs, Assessment semantics,
semantic equivalence, naturalness, DB schema, audio, ASR, collocations.

---

## Next slice

V2.22-A — Collocation Foundation.
