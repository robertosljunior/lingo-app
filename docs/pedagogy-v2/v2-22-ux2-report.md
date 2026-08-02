# V2.22-UX2 — Production Learner Experience Redesign · delivery report

Companion to `v2-22-ux2-production-experience-redesign-brief.md`.

This slice **audited, completed and shipped** the UX2 implementation. The design
delivery was code-only: it changed 13 production files and added 4, but left the
build, `dist/`, Playwright, screenshots, the audit wiring and the deploy path
untouched, and shipped several defects that would only have surfaced in front of
a learner. Everything below the "Divergences" heading is what this slice fixed.

---

## 0. Base

| Item | Value |
|---|---|
| Base SHA | `742ea735159ae8ab919c1a521bf66ab8b1575586` (merge of PR #54) |
| Branch | `claude/v2-22-ux2-production-experience` |
| Brief | PR #55, incorporated into this branch |
| `DB_VERSION` | **5** — unchanged (no schema change, no migration) |
| `STUDY_PLANNER_V2_VERSION` | unchanged |
| `LESSON_ENGINE_V2_VERSION` | 3 — unchanged (plan shape did not move) |
| `LESSON_ENGINE_POLICY_VERSION` | 4 → **5** (advisory `recipe_preference` score component) |
| `ACTIVITY_PLAN_V2_VERSION` | 1 — unchanged |
| `LEARNER_PRESENTATION_VERSION` | 1 → **2** (scoped sessions suppress the pack interstitial) |
| `LEARNER_HOME_PRESENTATION_VERSION` | 1 → **2** (contextual catalogue) |
| `PRACTICE_COLLECTION_CONTRACT_VERSION` | **1** (new) |
| `STUDY_SCOPE_V2_VERSION` | **1** (new) |

---

## 1. What the learner sees now

The Home no longer asks *"do you want to study `still`, `but` or `yet` today?"*.
It asks *"what kind of situation do you want to practise?"* — five authored
contexts, each of which draws on **all three** internal packs without ever naming
them:

| Context | exemplars | constructions | internal packs |
|---|---|---|---|
| Conversas do dia a dia | 26 | 8 | 3 |
| Trabalho e estudos | 30 | 13 | 3 |
| Viagens e deslocamentos | 12 | 9 | 3 |
| Escolhas e decisões | 13 | 5 | 3 |
| Ideias e opiniões | 22 | 9 | 3 |

85/85 authored exemplars belong to at least one context; no content was added
(§24 — the three pack JSONs are byte-identical to `main`).

---

## 2. How a context reaches the pipeline

`StudyScopeV2` is an **optional allow-list**, not a mode, not a scheduler and not
a truth:

```
collection → buildStudyScopeFromCollectionV2 → { allowed_exemplar_ids,
                                                  allowed_target_ids,
                                                  allowed_pack_ids }
```

It is enforced at exactly **two** points, both of which every candidate must pass
through, so no generator can leak past them:

- `study-planner.js` → `addCandidate()`: a scoped session may only plan targets
  the collection declares;
- `lesson-engine.js` → the exemplar universe: a scoped session may only
  materialize sentences the collection declares.

`focused` mode already pins a pack; a scope **intersects** with it rather than
overriding, so the two compose in either order. Absence of a scope is `null` and
takes the pre-UX2 path byte for byte.

Nothing else moved: no new controller, no new study mode, no new target type, no
evidence, no mastery.

---

## 3. How "Montar frases" became honest

`recipe_preference` is a **score component**, weight 2 — below `need` (3) and
`retention` (2.5) — applied *after* every gate (prerequisites, runtime, recipe
gate, independence). It can reorder activities the engine already judged legal;
it cannot create one.

Proven in `practice-scope-integration.test.js` against the real Planner + Engine
with a Learner Model built from real evidence:

| learner rung | no preference | "Montar frases" |
|---|---|---|
| recognition | `meaning_recognition` | `meaning_recognition` — **identical** |
| comprehension | `meaning_recognition` | `meaning_recognition` — **identical** |
| controlled_production | completion / guided production | **`word_order_reconstruction`** in all 5 contexts |

So the preference buys no rung. Below controlled production the decision is
byte-identical with and without it; the learner sees a neutral notice ("Montar
frases ainda não está disponível aqui") and a real preparatory session in the
same context, never a dead button and never a faked scramble.

**Discoverability** is solved separately, and that is the point: the format chips
sit inside every context card on the Home, so the learner can see that the format
exists before the Planner ever offers it.

---

## 4. Divergences found in the delivered code

Each was verified against the real repo, not the report.

| # | Defect | Impact | Fix |
|---|---|---|---|
| 1 | `PRACTICE_FORMATS` named recipes `masked_completion` and `guided_writing` — **neither exists**; the real ids are `fixed_element_completion` and `guided_production` | 2 of 3 format chips permanently dead: the preference scored 0 forever and the learner always saw "ainda não está disponível" even when the format *was* available — the exact dead button §13 forbids | corrected, plus a regression asserting every format maps to a recipe in the engine's own `RECIPE_NAMES` |
| 2 | the context banner was a **sibling** of `.v2lx-shell` (`height:100%`) inside `.phone { overflow:hidden }` | the footer was pushed past the viewport: **Verificar/Continuar unreachable in every contextual session** | moved into the shell's flex column as a `flex:none` strip; E2E asserts `toBeInViewport()` on the CTA |
| 3 | `import … from '…json'` without `with { type: 'json' }` | every `scripts/*.mjs` importing the module crashed under plain Node ESM — the audit could not run at all | attribute added (the repo already documents this in `src/content/pedagogy-v2/index.js`) |
| 4 | `practice-collections.json` placed directly in `src/content/pedagogy-v2/` | `validate:pedagogy-v2` globs every `*.json` there as a pack → **`MANIFEST_REQUIRED`, registry reported INVALID**, `inspect:pedagogy-v2` refused to run | moved to `collections/`; the pack-glob safety property is preserved |
| 5 | the collections audit had **no runner and no npm script** | the audit the brief mandates (§29) was unreachable | `scripts/audit-practice-collections-v2.mjs` + `npm run audit:practice-collections-v2`, hard-failing (exit 1); also wired into `validate:pedagogy-v2` |
| 6 | inside a scoped session the pack-transition interstitial still rendered **"Agora vamos praticar “still”."**, and the header chip read `still` | direct violation of §18 and §33.3 — the lexeme the Home stopped exposing came straight back on the lesson screen | `buildLearnerPresentationV2` takes the scope: transition suppressed, chip renamed to the context. `LEARNER_PRESENTATION_VERSION` → 2 |
| 7 | 5 unit tests left failing (widened `resolveLessonModeV2` shape, policy version) | red suite | updated, with the new contract fields asserted explicitly |
| 8 | **no tests** for collections, scope, audit or the home presentation additions | the whole layer was unguarded | 30 new tests across 2 files |
| 9 | catalogue slicing (`CATALOG_INITIAL_VISIBLE`) lived in the component | §21 — React deciding presentation; untestable without a DOM | moved into `buildPracticeCollectionCatalogV2`, tested at 4/8/12/20 |
| 10 | `contextEntry.format_label` computed and never rendered | dead value | rendered as the format echo in the context strip |

No divergence was found in the *architecture*: the scope-not-a-mode decision, the
two enforcement points, the advisory weighting and the authored-membership rule
are all sound and were kept as delivered.

---

## 5. Files

**Delivered by the design, applied and reviewed**

- `src/content/pedagogy-v2/collections/practice-collections.json` *(new, relocated)*
- `src/lib/pedagogy-v2/practice-collections.js` *(new)*
- `src/lib/pedagogy-v2/practice-collections-audit.js` *(new)*
- `src/lib/pedagogy-v2/study-scope.js` *(new)*
- `src/lib/pedagogy-v2/learner-home-presentation.js`
- `src/lib/pedagogy-v2/lesson-engine.js`
- `src/lib/pedagogy-v2/lesson-engine-contracts.js`
- `src/lib/pedagogy-v2/study-planner.js`
- `src/lib/pedagogy-v2/study-focus-resolver.js`
- `src/lib/pedagogy-v2/study-session-controller.js`
- `src/screens/V2LearnerHome.jsx`
- `src/screens/V2LessonExperience.jsx`
- `src/styles/v2-learner.css`

**Added or corrected by this slice**

- `src/lib/pedagogy-v2/learner-presentation-v2.js` — §18 scope awareness
- `src/components/pedagogy-v2-learner/V2LessonShell.jsx` — `contextBanner` slot
- `scripts/audit-practice-collections-v2.mjs`, `scripts/validate-pedagogy-v2.mjs`, `package.json`
- `src/lib/pedagogy-v2/practice-collections.test.js` (23 tests)
- `src/lib/pedagogy-v2/practice-scope-integration.test.js` (7 tests)
- `src/lib/pedagogy-v2/learner-mode-routing.test.js`, `practice-variety-v2.test.js` — updated contracts
- `e2e/pedagogy-v2-22-ux2.spec.js`, `e2e/pedagogy-v2-22-ux2-screenshots.spec.js`, `e2e/v2-helpers.js`
- `test-evidence/v2-22-ux2-production/` — 16 frames
- `dist/` — rebuilt

---

## 6. Limitations, stated plainly

1. **Only 5 contexts are authored**, so the "catalogue with 8 collections"
   screenshot in brief §27 has no honest source. §24 forbids inventing content to
   fill cards, so the scaling rule is proven by test instead
   (`buildPracticeCollectionCatalogV2` at 4/8/12/20, including the expansion
   control) rather than by a fabricated screenshot. The `Ver mais contextos`
   control therefore does not appear in any real frame yet — it activates at 7.
2. **"Montar frases" is only reachable at controlled production.** That is the
   correct pedagogy, not a gap, but it means a new learner tapping the chip gets
   the notice rather than a scramble. Discoverability is solved; reachability is
   still governed by the ladder, exactly as §13/§30 require.
3. `buildPracticeCategoriesV2DevOnly` is retained but has **no caller**. It is
   kept for focused-mode diagnostics per §22; if that never materialises it
   should be deleted rather than left as decoration.
4. Review/explore accept no contextual filter yet (§19/§20 allow one "when there
   is content"); they remain global. No copy promises otherwise.
