# Prompt template — create a semantic_knowledge pack

You are authoring a **declarative** `semantic_knowledge` content pack for the
local language-analysis engine. The pack is **pure data**. It is consumed by the
engine; it is never executed.

## Inputs (fill these in)

- **concept**: {{concept}}            <!-- e.g. "do", "at", "polite requests" -->
- **levels**: {{levels}}              <!-- subset of A1, A2, B1, B2 -->
- **related_concepts**: {{related}}
- **scope**: {{scope}}                <!-- what this pack does and does NOT cover -->
- **examples**: {{examples}}
- **known_contrasts**: {{contrasts}}

## Output — a single JSON object with these top-level keys

`manifest, concepts, usage_rules, semantic_frames, contrast_sets, patterns,
transformations, explanations_pt, natural_alternatives, retrieval_exemplars,
naturalness_hints, golden_tests, coverage`

### Hard rules (a pack that breaks any of these is rejected)

1. `manifest.schema_version` = `"1"`, `manifest.pack_kind` = `"semantic_knowledge"`,
   `manifest.analysis_compatibility` = `{ "min_version": "1", "max_version": "1" }`.
2. **No executable content anywhere**: no `eval`, no `new Function`, no `=>`,
   no `function(...)`, no regex, no serialized functions. Strings are prose only.
3. `transformations[].operation_id` MUST be one of the operations registered in
   `src/lib/language-analysis/transformation-registry.js`. Unknown ids are rejected.
4. Every `explanation_id` / `frame_id` / `concept_id` referenced must be defined
   in the same pack. All ids are globally unique.
5. `explanations_pt` are in **Brazilian Portuguese**, learner-friendly, with NO
   technical categories, severities, or jargon. Short title + clear summary.
6. `natural_alternatives` MUST preserve the original intent, entities, polarity,
   tense and person. Do not introduce disconnected content. Respect the CEFR level.
7. Provide `retrieval_exemplars` with positives AND close negatives (mark the
   negatives with `"polarity": "negative"`). Do not store embeddings.
8. `coverage` declares an honest matrix (`concepts_expected`,
   `concepts_implemented`, per-level status, `known_gaps`). Never claim "all of
   English" — only "complete_for_scope".
9. `golden_tests` are objects `{ input, mode, expect }` where `expect` may set
   `verdict`, `no_corrected_version`, `no_high_severity`, `intent`, `suggests`.
   They must pass `npm run validate:knowledge-packs`.

## Validation gate (must pass before a human marks the pack reviewed)

```
node scripts/validate-knowledge-packs.mjs
```

This checks: valid JSON, valid schema, unique ids, resolved references, known
operations, present explanations, passing goldens, no executable content, and a
declared coverage matrix. Only after this passes AND a human sets
`manifest.reviewed_by` may the pack be published to the catalog.
