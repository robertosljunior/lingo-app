# V2.22-UX1 — Mockup ↔ production comparison

Every recommendation in `design-handoff/v2-22-ux0/` against what actually
shipped. `STATUS` is one of **MATCH**, **INTENTIONAL_DEVIATION**,
**NOT_IMPLEMENTED**. No difference is left silent.

The mockup was opened and driven for real (`window.__lab.setState(...)` plus
live clicking of its chips), not read from the Markdown: the recommended route
Word Order → Completion (two gaps) → Guided Writing → Demo was walked, at 320 /
375 / 430px, light and dark, with reduced motion on and off.

Frames referenced below are the PNGs in this directory, all rendered from the
REAL app driven by the REAL pipeline.

---

## 1. Word Order — Option A, Magnetic Rail (HANDOFF §3)

### 1.1 The rail is a sentence in formation, not a box of buttons

- **HANDOFF**: callout 1 — "a área construída é **uma frase em formação**"; a
  single accent rule under the line, no bordered box.
- **IMPLEMENTADO**: `.v2lx-rail` — flex line, `border-bottom: 2px solid
  var(--v2-primary)`, no box, no inset shadow. `01-word-order-empty.png`,
  `03-word-order-complete.png`.
- **DIFERENÇA**: none.
- **STATUS**: **MATCH**

### 1.2 Insertion gaps are real buttons

- **HANDOFF**: callout 2 — "é um `button` real ('Inserir na posição 3'), não um
  alvo invisível".
- **IMPLEMENTADO**: one `<button class="v2lx-rail-gap">` per position, accessible
  name `Inserir na posição N`, `aria-pressed` for the targeted gap, a 2px mark
  that grows when active.
- **DIFERENÇA**: the gap's hit area is 24px wide (34px when active), not 44px.
- **JUSTIFICATIVA**: **accessibility trade, deliberate.** A gap sits between two
  ≥44px targets; widening it to 44px would overlap them and steal the taps that
  remove a word. Nothing depends on hitting it: tap-to-remove-and-replace,
  "Desfazer último", "Recomeçar" and the ←/→ keys all reach the same result at
  full size. The gap is 44px tall, and the mockup's own gap is 8px wide — this is
  three times larger.
- **STATUS**: **INTENTIONAL_DEVIATION**

### 1.3 Tapping a placed word returns it to the bank

- **HANDOFF**: callout 3 — "retira o token e devolve ao banco — reversível sem
  penalidade".
- **IMPLEMENTADO**: `wordOrderRemove`; E2E asserts remove → bank chip un-fades →
  re-place. No support is recorded, no evidence is touched.
- **STATUS**: **MATCH**

### 1.4 Undo / Restart appear only with tokens present

- **HANDOFF**: callout 4 — "só aparecem quando há tokens; nunca ocupam espaço
  vazio".
- **IMPLEMENTADO**: `actions` is empty while `picked.length === 0`; regression in
  `v2-interactive-ux1.test.jsx` ("EMPTY state … shows no actions yet").
- **STATUS**: **MATCH**

### 1.5 Used bank chips fade to 0.32 and say "já usada"

- **HANDOFF**: callout 5 — "não desabilita sem explicação".
- **IMPLEMENTADO**: `.v2lx-chip[data-used="true"] { opacity: .32 }`, accessible
  name `<word>, já usada`, `aria-disabled` — **never** the native `disabled`
  attribute, which would drop the chip from the tab order and throw focus to
  `<body>`. E2E asserts the name and that focus survives.
- **STATUS**: **MATCH**

### 1.6 No per-token correctness

- **HANDOFF**: callout 6 — "nenhuma palavra é marcada como certa/errada: o
  Assessment não fornece essa granularidade". Mockup class **C**.
- **IMPLEMENTADO**: nothing in `v2-interaction-state.js` or the rail can express
  it; two regressions assert no `data-result` on a placed token and that no
  rail/bank item carries a correctness word. `05-word-order-feedback-non-correct.png`
  shows a wrong answer with the rail unmarked.
- **STATUS**: **MATCH**

### 1.7 Payload

- **HANDOFF**: `{ type:'token_sequence', payload:{ tokens } }` — **unchanged**.
- **IMPLEMENTADO**: identical. A regression re-computes the pre-V2.22 renderer's
  payload from the same state and asserts byte equality for three orders.
- **STATUS**: **MATCH**

### 1.8 Drag

- **HANDOFF**: "Drag: aprimoramento **opcional** de pointer. Tap-to-place é o
  caminho principal e suficiente."
- **IMPLEMENTADO**: not implemented.
- **JUSTIFICATIVA**: the handoff marks it optional and states tap is sufficient;
  the brief forbids a heavy library for a few chips (§38) and forbids drag ever
  being the only path (§7). Reorder is covered three ways without it —
  remove-and-reinsert, insertion gaps, and ←/→ on a focused word.
- **STATUS**: **NOT_IMPLEMENTED**

### 1.9 Keyboard reorder controls

- **BRIEF §10**: "Caso o handoff recomende controles de mover: usar rótulos
  claros … sem poluir a interface visual principal."
- **IMPLEMENTADO**: ←/→ on a focused placed word, no visible buttons.
- **DIFERENÇA**: no on-screen "Mover para a esquerda/direita" buttons.
- **JUSTIFICATIVA**: the handoff's rail has none, and the mockup's `move()`
  helper is never rendered. Two visible buttons per word would triple the tab
  stops (30 for a six-word sentence) and break the clean line the design is built
  around. The arrow-key path is verified by E2E, including that nothing is lost
  or duplicated by a move.
- **STATUS**: **INTENTIONAL_DEVIATION**

### 1.10 Option B — inline slots / duplicates screen

- **HANDOFF §3.6**: B explicitly **descartada**; the duplicates screen documents
  a RULE, not a screen to build.
- **IMPLEMENTADO**: B not built. The duplicate rule is implemented (identity is
  the position in the presented order) and regression-tested — using one "to"
  leaves the other free, and their accessible names differ by position.
- **STATUS**: **MATCH** (rule) / **NOT_IMPLEMENTED** (Option B, as designed)

---

## 2. Evaluating state (HANDOFF §3.4)

- **HANDOFF**: the activity stays visible and untouched; only the CTA changes to
  "Avaliando…" and goes inert.
- **IMPLEMENTADO**: `V2LessonShell` renders `Avaliando…` while
  `status === 'submitting'` (it previously said "Processando…"), the button is
  disabled, and `check()` still guards `busy || answered || !pending`.
- **DIFERENÇA**: the CTA uses the native `disabled` attribute; the
  IMPLEMENTATION-MAP suggests `aria-disabled` instead.
- **JUSTIFICATIVA**: the map's concern is the button being *removed* — it is not;
  it keeps a stable accessible name and its place in the layout. Native
  `disabled` is the stronger guarantee for the double-submit rule (§34), which is
  a hard requirement, and the E2E double-tap regression relies on it.
- **STATUS**: **INTENTIONAL_DEVIATION**

---

## 3. Completion — one slot per gap (HANDOFF §4)

### 3.1 The audited gap

- **HANDOFF**: callouts 1–2 — `buildMaskedCompletion` may return several
  `expected_tokens`, the renderer drew one slot and left the rest as literal
  `_____`; the fix is one slot per gap, indexed by `data-gap`.
- **IMPLEMENTADO**: `completionView(plan)` splits the mask into chunks and
  renders `chunks.length - 1` slots, each with `data-gap`. Regressions assert two
  slots for a two-element mask and that **no** `_{3,}` survives in the DOM.
  `23-completion-multi-gap.png`.
- **STATUS**: **MATCH**

### 3.2 The payload — the one place the handoff was wrong

- **HANDOFF**: "`type:'text'` com o `masked_text` **reconstituído** — inalterado."
- **IMPLEMENTADO**: `type:'text'` with **the gap fills joined by a single space,
  in gap order**.
- **DIFERENÇA**: fundamental — not the reconstituted sentence.
- **JUSTIFICATIVA**: **contract.** `activity-assessment.js` splits `payload.text`
  on whitespace and compares it positionally against `expected_tokens`. Measured
  against the real assessor on `She has not finished it yet` /
  `fixed_elements:['not','yet']`:

  | payload.text | real outcome |
  |---|---|
  | `"not yet"` (shipped) | **correct** |
  | `"She has not finished it yet"` (handoff) | **incorrect** |
  | `"not"` (pre-V2.22 UI could send nothing else) | **partial**, 0.5 |

  Following the handoff would have broken every completion in the product,
  including the single-gap ones that work today. Brief §2 priority 1 (real
  contracts and safety) decides it. With one gap the shipped payload is
  byte-identical to the pre-V2.22 one. The whole table is re-proven on every CI
  run in `v2-interaction-state.test.js`.

  The mockup is itself inconsistent here: its `answerText()` returns the
  reconstituted sentence for the word-bank screens but the raw fill for
  `comp_input`, so no single reading of it is implementable.
- **STATUS**: **INTENTIONAL_DEVIATION**

### 3.3 Reversible selection

- **HANDOFF**: callout 4 — "tocar no slot devolve o chip ao banco e deixa aquele
  gap como alvo".
- **IMPLEMENTADO**: exactly that (`completionClear` + the gap becomes `selected`).
  E2E asserts fill → `data-filled` → tap → not filled.
- **STATUS**: **MATCH**

### 3.4 Punctuation

- **HANDOFF**: callout 5 — punctuation belongs to the masked text, and slot and
  punctuation never split across a line break.
- **IMPLEMENTADO**: punctuation stays in the text chunks (regression on
  `I have not seen it yet, but I will`), and each slot is wrapped in
  `.v2lx-slot-hold { white-space: nowrap }` with the text that follows it.
- **STATUS**: **MATCH**

### 3.5 Free input

- **HANDOFF**: callout 6 — real input, no `contenteditable`, no local
  autocomplete, IME not intercepted.
- **IMPLEMENTADO**: a real `<input>` styled as the slot itself;
  `Enter` submits only when `isComposing` is false (and `keyCode !== 229`), and
  routes through the shell's guarded `check()`, never a second submit path.
  `08-completion-input-focused.png`.
- **DIFERENÇA**: the empty width is a fixed 3.2em measure rather than one derived
  from the expected token.
- **JUSTIFICATIVA**: sizing a slot from `expected_tokens[i]` leaks the length of
  the answer. The input grows with what the LEARNER typed instead. Regression
  asserts the size attribute never matches the expected token's length.
- **STATUS**: **INTENTIONAL_DEVIATION**

### 3.6 No distractors

- **HANDOFF**: the bank is only the plan's tokens.
- **IMPLEMENTADO**: `completionBankItems(expectedTokens, …)` — nothing else can
  enter it. A chip is spent once *per copy*, so a sentence masking the same word
  twice keeps both chips usable.
- **STATUS**: **MATCH**

### 3.7 Answer reveal

- **HANDOFF / BRIEF §15**: revealing must register support.
- **IMPLEMENTADO**: unchanged — `onSupport('answer_reveal')` fires before the
  reveal renders, and the copy states plainly that this is the answer. The reveal
  is hidden once answered, and absent when there is no gap.
- **STATUS**: **MATCH**

---

## 4. Guided Writing (HANDOFF §5)

### 4.1 Continuity rule

- **HANDOFF**: callout 1 — a vertical rule ties prompt, answer and feedback into
  one column.
- **IMPLEMENTADO**: `.v2lx-write-area` carries a 3px left rule continuing the
  prompt's accent rule, and `.v2lx-fb` carries a tone-tinted one.
  `12-guided-writing-feedback.png`.
- **DIFERENÇA**: the answer-area rule stays NEUTRAL after assessment; the mockup
  tints it with the tone.
- **JUSTIFICATIVA**: **architecture.** Tinting it by outcome means the activity
  renderer knows the verdict. It must not (§4/§18) — the tone belongs to the
  feedback panel, which owns it. The continuity is preserved; only the colour
  source differs.
- **STATUS**: **INTENTIONAL_DEVIATION**

### 4.2 "Ver um modelo"

- **HANDOFF**: callout 2 — exists only when `support.features` includes
  `model_sentence`; reveals on demand; registers `onSupport('model_sentence')`.
- **IMPLEMENTADO**: exactly that. Previously the model was rendered
  unconditionally and for free.
- **NOTE**: `model_sentence` is already in the plan's **baseline** support, and
  `finalizeSupportUsage` unions baseline ∪ used — so the recorded interaction is
  identical whether or not the learner taps it. The change cannot inflate or
  deflate evidence; it only lets the learner try first.
- **STATUS**: **MATCH**

### 4.3 Answer preserved after assessment

- **HANDOFF**: callout 4. **BRIEF §17**: never silently replaced by the reference.
- **IMPLEMENTADO**: the textarea keeps its value and is disabled, never cleared
  and never refilled with `plan.text_en`. E2E asserts `toHaveValue` after the
  feedback appears; a static regression asserts the textarea survives `answered`.
- **STATUS**: **MATCH**

### 4.4 Word count

- **HANDOFF**: callout 5 — factual, no imposed minimum, no alert.
- **IMPLEMENTADO**: `N palavra(s)`, hidden while empty, no threshold anywhere.
  Regression asserts no "mínimo"/"pelo menos"/"muito curto" copy.
- **STATUS**: **MATCH**

### 4.5 Separate "SUA RESPOSTA" echo block

- **HANDOFF**: the mockup renders an answer echo above the feedback **in
  addition** to the textarea, so the learner's text appears twice.
- **IMPLEMENTADO**: not built. The real textarea keeps the answer visible; the
  continuity rule connects it to the feedback.
- **JUSTIFICATIVA**: **mobile behaviour.** At 320px the answer would occupy two
  blocks and push the feedback and the CTA below the fold for no added
  information. The requirement ("the answer stays visible above the feedback") is
  met by the textarea itself.
- **STATUS**: **INTENTIONAL_DEVIATION**

---

## 5. Feedback (HANDOFF §3.5)

### 5.1 Same screen, connected by a tinted rule

- **HANDOFF**: emerges below the answer in the same column, joined by a vertical
  rule tinted by the tone; no modal, no route change.
- **IMPLEMENTADO**: `.v2lx-fb` gains `border-left: 3px solid var(--v2-fb-accent)`.
  It was already in-place and non-modal. `04`, `09`, `12`.
- **STATUS**: **MATCH**

### 5.2 Semantics untouched

- **HANDOFF / BRIEF §18–§20**: the visual change must not touch what the feedback
  is allowed to say or which variant it is.
- **IMPLEMENTADO**: `V2FeedbackPanel` still renders only what
  `buildLearnerPresentationV2` produced. A dedicated regression
  (`VISUAL_VARIANT_MUST_NOT_CHANGE_ASSESSMENT_OUTCOME`) walks all seven variants
  and asserts `data-variant` / `data-tone` / `data-outcome` are unchanged, that a
  suggestion is never dressed as an error, and that `unable_to_assess` never
  reads as learner blame.
- **STATUS**: **MATCH**

### 5.3 Tones

- **HANDOFF**: mockup covers `correct`, `suggestion`, `partial`, `semantic`,
  `unknown`.
- **IMPLEMENTADO**: all of those plus `linguistic` and `incorrect_unspecified`,
  which production already had and the mockup did not exercise. Nothing was
  removed to match the mockup's smaller set.
- **STATUS**: **MATCH**

---

## 6. Transition (BRIEF §21)

- **HANDOFF**: current activity → feedback in place → Continuar → out to the
  left → next in from the right, 220/260ms, header and footer stable.
- **IMPLEMENTADO**: **unchanged.** `V2ActivityStage`, the phase machine,
  `onStageEnd` and the double-advance guard were not modified.
  `13-transition-out.png`, `14-transition-in.png`.
- **DIFERENÇA**: the two frames were captured with the motion TOKENS temporarily
  slowed to 2400ms via an injected stylesheet.
- **JUSTIFICATIVA**: **capture only.** A 220ms slide cannot be photographed
  deterministically. Distance, easing, direction and the DOM under test are the
  shipped ones; only the duration variable differs, and only inside that one
  screenshot test.
- **STATUS**: **MATCH** (behaviour) / **INTENTIONAL_DEVIATION** (capture method)

---

## 7. Motion tokens (design-tokens.md)

| Token | Handoff | Shipped |
|---|---|---|
| `--v2-dur-token-move` | 160ms | 160ms — **MATCH** |
| `--v2-dur-token-remove` | 140ms | 140ms — **MATCH** |
| `--v2-dur-slot-fill` | 180ms | 180ms — **MATCH** |
| `--v2-dur-answer-settle` | 220ms | 220ms — **MATCH** |
| `--v2-distance-token-lift` | 2px | 2px — **MATCH** |
| `--v2-ease-spring-soft` | `cubic-bezier(.34,1.36,.64,1)` | identical — **MATCH** |

All six are new and coexist with the existing tokens; **no existing value was
redefined**. The `LIGHT`/`DARK` JS objects from the lab are fixtures and were not
promoted — production colours come from the CSS, as `design-tokens.md` requires.

---

## 8. Reduced motion (design-tokens.md, BRIEF §24)

- **HANDOFF**: a REAL reduction, not a shorter duration; every state legible from
  a border, a glyph or an opacity; the "avaliando" state immediate.
- **IMPLEMENTADO**: both `@media (prefers-reduced-motion: reduce)` and
  `[data-reduced-motion="true"]` zero every new transition and the token lift, on
  top of the existing animation kills. `21`, `22`. E2E asserts the advance still
  completes with motion reduced — the flow never waits on an animation ending
  (`goNext` runs the intent immediately when `reducedMotion`).
- **STATUS**: **MATCH**

---

## 9. Robustness matrix (HANDOFF §10)

| Axis | Handoff frame | Production frame | Status |
|---|---|---|---|
| Dark | 26 | `15`, `16`, `17` | **MATCH** — tones and rail legible, no fixed hex in components |
| 320px | 27 | `18`, `19`, `20` | **MATCH** — no horizontal overflow (asserted, not eyeballed) |
| 430px | 28 | covered by the 390px frames + the desktop reading column | **MATCH** |
| Reduced motion | 29 | `21`, `22` | **MATCH** |

---

## 10. Things in the mockup that are NOT product

Per `source-map.md`'s "NÃO usar em produção" column, none of these were carried
over: the HTML replica of the shell, the `lab-stage-*` classes, the lab's click
handlers, its mask parser, its `LIGHT`/`DARK` objects, its hard-coded font scale,
its `setTimeout` audio simulation, its fake transcript, its fixed packs, its
`SUMMARY_FACTS`, and its feedback copy.

One more, not listed there but present in every mockup frame:

- **Header progress bar.** The mockup's phone header shows a filling bar and
  "4/12". Production deliberately has neither: V2.17-R §1 removed the artificial
  denominator, and `v2-learner-components.test.jsx` actively asserts no
  `role="progressbar"`, no `aria-valuenow`, no width driven by the activity
  number and no "N de M" text. The session length is not known in advance, so the
  bar would be a fiction.
  **STATUS**: **INTENTIONAL_DEVIATION** — an existing, tested product decision
  outranks an undiscussed mockup detail (brief §2 priority 1).

---

## 11. Out of scope in this slice (handoff class B)

| Handoff section | Why not now |
|---|---|
| §6 Falar com fallback escrito | class **B** — needs the plan to declare the alternative modality in the presentation contract. The handoff itself says "não começar por aqui". |
| §8 Histórico V2-honesto | class **B** — needs a history presentation builder. No calculation may live in React. |
| §1 Categorias, §7 Resumo | already shipped in V2.18/V2.21-R2; unchanged here. |

**STATUS**: **NOT_IMPLEMENTED**, by the handoff's own sequencing.

---

## 12. Frame index

| Frame | What it proves |
|---|---|
| `01-word-order-empty` | rail EMPTY; no actions in empty space |
| `02-word-order-partial` | PARTIAL; used chips faded; hint + actions appear |
| `03-word-order-complete` | COMPLETE_UNCHECKED; CTA live |
| `04-word-order-feedback-correct` | ANSWERED_CORRECT, feedback in place, rail unmarked |
| `05-word-order-feedback-non-correct` | ANSWERED_NON_CORRECT from a real wrong sequence; still no per-token marking |
| `06-completion-bank-empty` / `07-…-filled` | slot as part of the sentence; bank reversible |
| `08-completion-input-focused` | free input is a real input inside the sentence |
| `09-completion-feedback` | feedback connected, answer visible |
| `10`–`12` guided writing | EMPTY → FILLED → FEEDBACK_VISIBLE with the answer preserved |
| `13`/`14` | the unchanged out/in transition |
| `15`–`17` | dark theme across all three recipes |
| `18`–`20` | 320px, overflow asserted absent |
| `21`/`22` | reduced motion; advance does not depend on an animation |
| `23-completion-multi-gap` | **the audited defect, fixed**: two fillable slots, no literal `_____` |
