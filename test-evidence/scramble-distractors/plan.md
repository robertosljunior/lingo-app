# Scramble semantic distractors

## Goal

Make word-order reconstruction require grammatical and semantic choice instead of photographic memorization. The word bank includes a small number of plausible but incorrect tokens mixed with the real sentence tokens.

## Product rules

- Keep every token required by the authored target sentence.
- Add 1 distractor for 1–5 target tokens, 2 for 6–9, and at most 3 for 10+.
- Never exceed roughly 30% extra tokens relative to the target sentence.
- Prefer locally plausible contrasts: discourse markers (`yet`, `but`, `still`), prepositions, pronouns, auxiliaries, determiners and nearby nouns.
- Never duplicate a target token, including punctuation-only variants such as `yet` vs `yet.`.
- Distractors are level-aware and never obscure/random vocabulary.
- Selection and insertion are deterministic for the same authored activity.
- Target tokens preserve the Engine's existing presented relative order; distractors are only interleaved.
- The learner submits after constructing exactly one target-sentence length. Choosing a fake word necessarily leaves a true word unused.
- A selected distractor can be removed/reordered through the same reversible interaction state as a real token.
- Unused distractors are never reported as separate learner errors; Assessment still evaluates only the final token sequence.
- `semantic_distractors: false` provides an explicit plan-level escape hatch.

## Implementation

- `wordOrderDistractors()` derives a bounded deterministic candidate set.
- Candidate priority comes from grammatical families present in the sentence, then nearby noun contrasts, then CEFR-level fallbacks.
- `wordOrderBank()` interleaves distractors without changing `text_en` or canonical answer data.
- `wordOrderTargetCount()` keeps submission length tied to the authored target rather than total bank size.
- Existing low-level fixture plans without a real `pack_id` retain the legacy exact-bank behavior; shipped learner plans receive distractors.

## Acceptance tests

- Deterministic short/medium/long plans receive 1/2/3 bounded distractors.
- Extra tokens remain within the 30% guardrail and hard cap of 3.
- Target relative order is preserved.
- Target duplicates/punctuation variants are excluded from distractors.
- The correct sentence remains buildable using target tokens only.
- A sentence-length selection containing a distractor is submittable for normal Assessment and differs from the target.
- Selecting/removing a distractor is reversible.
- Explicit plan opt-out preserves the original bank.
- Existing no-reshuffle, keyboard/tap, reduced-motion and mobile contracts remain covered by the full suite.
