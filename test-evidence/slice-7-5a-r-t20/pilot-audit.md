# T20 — Semantic-frame pilot audit (travel / workplace / food_and_restaurants A1)

Model: theme → communicative intent → frame → **compatible** verb + noun → EN+PT
pair (authored together). Verb–argument compatibility is enforced at build time
(`isCompatible`), so incompatible combinations (e.g. "update the train station")
cannot be compiled — proven by the build rejecting `call + work_location` during
authoring, and by `src/lib/semantic-frames.test.js` (rejects `update+train_station`,
`review+dish`, `call+meeting_room`, `leave+report`).

## travel A1 — 8 structures, 6 verbs, 8 intents

| intent | PT | EN | structure | verb |
|--------|----|----|-----------|------|
| ask_location | Onde fica a estação de trem? | Where is the train station? | wh-be question | be |
| buy_ticket | Quero comprar uma passagem para a cidade. | I want to buy a ticket to the city. | want-to | buy |
| ask_time | Que horas o ônibus sai? | What time does the bus leave? | wh-do question | leave |
| find_platform | Você pode me mostrar a plataforma? | Can you show me the platform? | can-request | show |
| describe_luggage | Minha bagagem está muito pesada. | My luggage is very heavy. | be-complement | be |
| confirm_reservation | Tenho uma reserva para hoje à noite. | I have a reservation for tonight. | have-possession | have |
| state_destination | Estou indo para o aeroporto agora. | I am going to the airport now. | present-continuous | go |
| ask_help | Por favor, me ajude com as malas. | Please help me with my bags. | imperative | help |

Naturalness: PT and EN authored as a pair; person/tense/number/negation preserved.
CEFR A1: present simple, be, have, can, short requests and direct questions — no
conditional/passive/reported speech.

## workplace A1 — 8 structures, 6 verbs, 8 intents
Where is the meeting room? · I have a report to finish today. · What time does the
meeting start? · Can you help me with this task? · The report is ready now. · I
want to send the email now. · I am working on the project now. · Please call the
manager after the meeting. (verbs: be, have, start, help, send, work, call)

## food_and_restaurants A1 — 8 structures, 5 verbs, 8 intents
Can I have the grilled chicken, please? · Does this soup have milk? · I am allergic
to peanuts. · Could you bring the menu? · I want to book a table for two. · Where
is the restaurant? · I am waiting for my order. · What time does the restaurant
open? (verbs: have, bring, book, wait, open)

## Diversity (measured)
| pack | structures | lexical verbs | intents | noun-swaps | incompatible |
|------|-----------|---------------|---------|-----------|--------------|
| travel_a1 | 8 | 6 | 8 | 0 | 0 |
| workplace_a1 | 8 | 6 | 8 | 0 | 0 |
| food_and_restaurants_a1 | 8 | 5 | 8 | 0 | 0 |

All exceed the T20 minimums (≥6 structures, ≥5 verbs, ≥4 intents). No pair is a
noun-swap of another (distinct signature+verb). Every pair is a compatible
verb+noun combination. Content validators, 177 unit tests, and the E2E for these
three combos (hub open→run→Result, seven exercise types, PT→EN translation) all pass.
