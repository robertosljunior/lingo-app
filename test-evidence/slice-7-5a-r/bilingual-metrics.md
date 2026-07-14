# Slice 7.5A-R — T13/T17 Bilingual Metrics & Diversity Audit

## T13 — Coverage metrics (measured from the compiled packs)

Per **theme** pack (all 24 identical in shape):

| field | value |
|-------|-------|
| templates_total | 8 |
| translation_templates | 8 (every template offers `translate_natural`) |
| ordering_templates | 8 (every template offers `build_sentence`) |
| listening_templates | 8 (`listen_type` + `speak_sentence`) |
| production_templates | 8 (`translate_natural` + `rewrite_natural`) |
| recognition_templates | 8 (`fill_blank` + `choose_best`) |
| unique_pt_sources | 8 |
| unique_en_targets | 8 |

Core packs (`core_a1..b2`): 12 templates each.

### Why the headline numbers look the way they do

- **"8 per pack" (validator):** every one of a theme pack's 8 templates declares
  all seven `exercise_types` and carries a real `source_text_pt`, so the coverage
  counter reports 8 for translation/ordering/listening/production/recognition.
  Coverage counts **templates that can produce a type**, not materialized questions.
- **Templates declared vs. questions possible vs. materialized:**
  - *Declared*: 8 templates/theme pack (+12 core).
  - *Possible*: each template can materialize as any of its 7 types → 8×7 = 56
    candidate questions per theme pack (before de-duplication).
  - *Materialized*: a generated 30-question lesson runs the **family-balanced
    planner**, which caps each type; it emits ~4 `translate_natural` questions.
  - *Unique*: the 8 distinct PT sources cap unique translations per pack at 8.
- **"96 translations across the 24 combinations":** 24 theme×level combos × **4**
  materialized `translate_natural` questions per 30-question lesson = **96**
  (measured). It is a property of the *generated lessons*, not of the packs; the
  packs themselves hold 24×8 = 192 translation-capable templates.
- **How core and theme are combined:** generation builds a snapshot from
  `core_<level>` **+** `<theme>_<level>` (see `builtinSnapshot`), so the template
  pool for a lesson is 12 (core) + 8 (theme) = **20 templates**, from which the
  planner selects and materializes questions.

## T17 — Diversity audit (measured) — DEFECT CONFIRMED

Per theme×level pack (8 templates), measured distinct sentence **structures**
(pattern_id) and distinct main **verbs**:

| pack (sample) | distinct patterns | distinct verbs |
|---------------|-------------------|----------------|
| daily_life_a1 | 4 | 4 |
| daily_life_a2 | 4 | 6 |
| daily_life_b1 | 4 | 7 |
| daily_life_b2 | 4 | 4 |
| food_and_restaurants_a1 | 4 | 4 |

Sample sentences (workplace_a1 vs travel_a1) — **identical structures, noun-swapped**:

```
workplace_a1: The company is important. / We check the project every day. /
              When do you need the client? / I can update the support team today.
travel_a1:    The ticket is important.  / We check the hotel every day.  /
              When do you need the passport? / I can update the train station today.
```

### Findings vs. the T17 criteria

| criterion | target | current | verdict |
|-----------|--------|---------|---------|
| ≥6 structures per theme×level | 6 | **4** | ❌ FAIL |
| ≥5 verbs per theme×level | 5 | 4 (at A1/B2) | ❌ FAIL (A1, B2) |
| no "only a noun changed" between themes | — | sentences are noun-swaps of the same 4 patterns | ❌ FAIL |
| theme adequacy (T19) | theme-specific | generic ("check the hotel", "update the train station") | ❌ FAIL |

**Root cause:** `scripts/content-packs/build-content-packs.mjs` uses a single verb
per pattern (mostly "check"/"review"/"update") and only the 4 `levelPatterns` per
level, inserting a theme noun. This yields low structural diversity, low verb
diversity, and theme-mismatched sentences (a grammar scaffold, not situated
language).

### Fix direction (content, not validator relaxation)

Per the slice rule ("corrigir o conteúdo; não relaxar silenciosamente o
validator"), the fix is to author, deterministically, **theme-situated,
verb-diverse, structure-diverse** sentence sets per theme×level: ≥6 structures,
≥5 verbs, sentences that actually belong to the theme, keeping the real PT source
+ gender/agreement machinery already in place. This is a focused content-authoring
task on the pack builder — no new engine, no broad expansion beyond raising the
existing 8 templates/pack to the diversity bar.

## Status

- T13 (metrics + explanation): **complete**.
- T17/T18/T19 (audit): **complete — defects confirmed and quantified above**.
- T20 (content fix to meet the bar): **remaining** — see classification in the checklist.
