# Scramble semantic distractors

## Goal

Make word-order reconstruction require grammatical and semantic choice instead of photographic memorization. The word bank must include a small number of plausible but incorrect tokens mixed with the real sentence tokens.

## Product rules

- Keep every token required by the authored target sentence.
- Add at most 2 distractors for short sentences and at most 3 for longer sentences.
- Never exceed roughly 30% extra tokens relative to the target sentence.
- Prefer distractors that are locally plausible: discourse markers (`yet`, `but`, `still`), prepositions, pronouns, auxiliaries, determiners and nearby nouns.
- Do not use a distractor that produces another fully valid accepted answer for the same activity.
- Do not duplicate a target token unless the sentence itself requires that duplicate.
- Distractors must match the learner level and should not introduce obscure vocabulary.
- Selection and shuffle must remain deterministic for the same authored activity/seed.
- The learner must be able to remove a selected distractor and continue normally.
- Feedback must explain the final sentence, not treat unused distractors as separate errors.

## Initial sizing

- Target with 1–5 tokens: 1 distractor.
- Target with 6–9 tokens: 2 distractors.
- Target with 10+ tokens: up to 3 distractors.
- Mobile word bank must remain usable at 320 px without horizontal overflow.

## Acceptance tests

- A deterministic `word_order_reconstruction` fixture receives plausible distractors.
- The correct sentence remains buildable exactly once.
- Selecting a distractor cannot produce a correct submission.
- A distractor can be removed and replaced using tap and keyboard flows.
- Existing no-reshuffle and deterministic-order contracts remain green.
- 320 px and reduced-motion E2E checks remain green.
- No activity renders more than the configured distractor limit.

## Delivery note

This PR is intentionally isolated from RX-8B. It starts from `main` and will not depend on the performance branch.
