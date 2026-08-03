# Claude Design aplicado em produção — V2.22-UX2-R

Companion to `v2-22-ux2-production-experience-redesign-brief.md` and to
`v2-22-ux2-report.md` (the slice that shipped the contextual Home).

UX2 shipped the contextual Home and the real scramble. This slice makes the
product **look like the mockup from the first second of a clean install** — and
fixes the one screen that was still the legacy product no matter what came
after it.

---

## 0. Base

| Item | Value |
|---|---|
| Base SHA | `b6692fdc2e618d34b22afa4500465f8eda34dd6b` (merge of PR #56) |
| Branch | `claude/claude-design-v2-22-production-7wyeml` |
| Visual source | `design-handoff/v2-22-ux0/mockup/index.html`, opened and driven live |
| `DB_VERSION` | **5** — unchanged (no schema change, no migration) |
| `LEARNER_HOME_PRESENTATION_VERSION` | **2** — unchanged (no adapter shape moved) |
| `LESSON_ENGINE_POLICY_VERSION` | **5** — unchanged |
| `STUDY_SCOPE_V2_VERSION` / `PRACTICE_COLLECTION_CONTRACT_VERSION` | **1** — unchanged |

No pedagogy moved. The Planner, the Engine, the Assessment, the Learner Model,
the presentation builders and the practice collections are byte-identical to
`main`. This slice is the interface and the cutover.

---

## 1. The mockup was opened, not read

`design-handoff/v2-22-ux0/mockup/index.html` was launched in a real browser and
driven through `window.__lab` across the recommended route (`wo_a → comp_b →
writing → demo`), light and dark, 320/375/430, reduced motion.

That is how the central finding of this slice was made, and it is not in any
Markdown in the handoff:

> **The mockup renders in Barlow and Barlow Condensed. Production declared
> `Nunito` / `Baloo 2`.** The two products could never have looked alike, no
> matter how the colours were tuned — the condensed heading against the
> normal-width body *is* the identity of the design.

The colour tokens, by contrast, were already identical: the mockup's `LIGHT` /
`DARK` objects match `src/styles/v2-learner.css` value for value. Reading the
token table would have concluded "nothing to do".

### MOCKUP SCREEN → PRODUCTION COMPONENT → STATUS → CHANGE

| Mockup screen | Production component | Status before | Required change | Done |
|---|---|---|---|---|
| *(no first-run in the mockup)* | — (legacy `Onboarding.jsx` ran) | **legacy product**: mascot, Kids/Adulto, CEFR | build a V2 first-run in the same language | ✅ `V2Onboarding.jsx` |
| `categories` | `V2LearnerHome.jsx` | UX2 structure correct, wrong type + gradient hero | type ramp, kicker sections, surface hero, filled cards | ✅ |
| lesson entry / progress | `V2LessonHeader` · `V2LessonShell` | correct | inherit the type roles | ✅ (tokens) |
| `wo_a` Magnetic Rail | `WordOrderActivity` · `V2SentenceRail` · `V2TokenChip` · `V2WordBank` | correct since UX1 | inherit type roles; weight 900 → shipped 800 | ✅ |
| `comp_a` / `comp_b` | `CompletionActivity` · `V2CompletionSlot` | correct since UX1 | inherit type roles | ✅ |
| `writing` | `ProductionActivity` | correct since UX1 | inherit type roles | ✅ |
| feedback (`correct`…`unknown`) | `V2FeedbackPanel` | correct | condensed headline | ✅ |
| `done` | `V2SessionSummary` | **fully inline-styled**, outside the token system | move to classes + type ramp | ✅ |
| navigation | `BottomNav` in `ui.jsx` | legacy surface + a Kids tab | V2 surface; Kids resolved away in V2 | ✅ |

### Intentional divergences from the mockup

1. **The lab chrome is not the product.** The mockup page frames the phone in a
   grey inspector with a `#5980a6` accent and its own `--color-*` ramp. That is
   the *lab*; the product is what is inside the phone. Only the phone's language
   was applied.
2. **No `Ainda, mas e já` / `Rotina e horários` cards.** Those are the mockup's
   pre-UX2 pack categories. UX2 replaced them with authored Practice
   Collections, and §5 explicitly forbids copying them back.
3. **`FOCO · STILL / BUT / YET` is not reproduced as a header chip in scoped
   sessions.** UX2 established that the lexeme stays internal inside a context;
   the chip names the context instead.
4. **Only the `latin` subset of each face is shipped.** latin-ext and vietnamese
   would add ~150 KB to the offline precache for glyphs this product never
   renders.

---

## 2. Fresh-storage first-run

Verified on the **served production build** (`npm run build` → `npm run
preview`), with a browser context that had never seen the app — empty
IndexedDB, empty localStorage, empty sessionStorage, no service worker, no
Cache Storage:

```
first paint      → V2Onboarding (data-experience="v2")
                   0 occurrences of "Bob" / "Kids" / "Adulto" / A1–B2
h1 font-family   → "Barlow Condensed", Barlow, system-ui, …
Continuar        → name step (no password field, no e-mail field)
Começar a praticar
                 → profile created → contextual Home, greeted by name
reload           → Home, first-run does not repeat
```

### The cutover defect this fixes (§3)

`App.jsx` ran its first-run branch **before** resolving which product the
learner was in, and hardcoded the legacy screen:

```jsx
if (ready && needsOnboarding) return <Onboarding />   // always V1
```

So a clean install always opened on V1 — mascot, Kids/Adulto, CEFR — and only
became V2 afterwards. The experience is now resolved first, by the same single
source of truth that decides everything else:

```jsx
if (ready && needsOnboarding) {
  const V2 = learnerExperienceV2Enabled(settings)
  return V2 ? <V2Onboarding /> : <LegacyOnboarding />
}
```

`Onboarding.jsx` was renamed `LegacyOnboarding.jsx` — it is no longer "the"
onboarding, it belongs to the legacy product and is reached only by explicit
opt-out. **No V2 module imports `BobMascot`.**

The strongest evidence is a spec that was *passing* before: `production-cutover.spec.js`
drove `onboarding-mode-adult` against a plain production build and succeeded.
It now drives `v2lx-onboarding`, and would fail if the cutover regressed.

### What the V2 first-run does not ask

Kids/Adulto, CEFR, a global level, a mascot, or which word to study. It asks
for a name, and the name is optional.

`level` is **not written at all** — `SETTINGS_DEFAULTS.level` already supplies
`'B1'` to the V1 generator that still reads it, so no CEFR value is ever
persisted as a fact about the learner. `profile_mode` is written as the neutral
marker `'v2'`; every legacy consumer tests `=== 'kids'` and otherwise takes the
adult branch, so a V2 profile degrades correctly without the V2 product ever
having asked an audience question.

---

## 3. The visual system

### Typography (the change you can see)

Barlow 400/500/600/700/800 and Barlow Condensed 600/700, **latin subset,
extracted from the mockup bundle itself** so the design source and the
production build render from the same outlines. Imported by `main.jsx`, hashed
by Vite, precached by the service worker (`globPatterns` already covered
`woff2`) — available offline on the first run. ~158 KB total.

Roles, not families, in `.v2lx`:

```
--v2-font-body     Barlow          --v2-type-display  clamp(28px, 7.4vw, 34px)
--v2-font-display  Barlow Condensed --v2-type-title    clamp(21px, 5.4vw, 25px)
--v2-display-weight 600             --v2-type-section  17px
                                    --v2-type-body     15px
                                    --v2-type-meta     13px
                                    --v2-type-kicker   11.5px
```

The display ramp is **fluid**: the mockup's 320/375/430 columns are three
samples of one ramp, not three hardcoded layouts.

`.v2lx-sentence` is deliberately excluded from the display role. It is the
activity protagonist and the mockup sets it in the body face at weight 800.
`V2Sentence` renders as a `div` in most activities but as an `h2` when the
prompt itself is the stimulus (listening), so without the `:not()` the same
component would change typeface depending on which tag it was passed.

Weight 900 was used in 13 rules for a face that is not shipped, so the browser
synthesized it. All 13 now use the real 800.

### Composition

The Home follows the mockup top to bottom: wordmark kicker → greeting →
condensed display question → a **white** hero card whose only filled element is
the CTA → kicker-labelled sections of filled surface cards. The hero used to be
an indigo gradient slab with a white button inside it, which made the CTA the
quietest thing in the loudest container; in the mockup the page is calm and the
CTA is the only saturated surface on it.

### Continuity (§9)

`App.jsx` writes `data-experience` on `.app-shell` from the same resolver that
picks the product, so the desktop device frame, the boot screen and the bottom
navigation cannot drift out of sync with what is rendered. The boot screen is
V2-toned, so a clean install never flashes the legacy ground before the
onboarding paints.

### Inline styles removed (§10)

- `V2SessionSummary.jsx` — every value was inline, including `fontWeight: 900,
  fontSize: 26`. Now classes; the values live with the rest.
- `V2LearnerHome.jsx` — `paddingBottom: 100` on the scroller, the one number
  deciding whether the last card clears the bottom nav.
- `App.jsx` — the loading screen's ad-hoc colours.

---

## 4. Responsive (§11)

No horizontal overflow at **320 / 375 / 390 / 430 / 1280**, measured on the
served production build as `phone.scrollWidth - phone.clientWidth` (0 at every
width, on both the first-run and the Home). Every touch target clears 34px at
320px, asserted in the suite.

The catalogue: the adapter slices to `CATALOG_INITIAL_VISIBLE = 6` with a single
expansion control, so 5, 8, 12 and 20 collections all render as a short list —
never a wall, never a mandatory horizontal carousel. The 4/8/12/20 data half is
already unit-tested (`practice-collections.test.js`); the rendered half is
asserted at 320px in the new suite.

---

## 5. Tests

### A — first-run (`e2e/onboarding.spec.js`)

Rewritten. It used to require the Kids/Adulto question to be the first thing a
new learner saw, which **pinned the defect in place**. Now: a clean install runs
the V2 first-run with no V1 truth on either step, no CEFR row is persisted, and
a reload does not repeat it.

### B / C — Home and scramble (`e2e/pedagogy-v2-22-ux2r.spec.js`, new)

`pedagogy-v2-22-ux2.spec.js` remains the authority on both, but it boots from
`seedFixtures`, which writes `onboarding_completed` and a pre-made profile —
and §16 rules that out as acceptance. Every test in the new suite starts from a
genuinely empty IndexedDB, runs the real first-run, and uses the profile the
product created for itself. Only learner **evidence** is seeded, which §8
permits.

The acceptance path, from a fresh install: Home → `Trabalho e estudos` →
`Montar frases` → real Planner/Engine → `word_order_reconstruction` →
`V2SentenceRail` → Verificar → feedback in place → Continuar → the same new
Home. No forced plan; the scope allow-list is checked against the served
exemplar.

### D — legacy (`e2e/onboarding.spec.js`, `e2e/stories-talk.spec.js`)

An explicit opt-out still runs the V1 onboarding unchanged and lands in the V1
hub. `stories-talk.spec.js` now pins V1 explicitly, because "Kids" is a legacy
audience split: a stored `profile_mode: 'kids'` no longer swaps a V2 learner's
Histórico tab for Histórias. A dedicated test drives a full legacy Kids
first-run and then switches that same profile to V2, asserting nothing leaks.

### The design system itself

Asserted, not assumed: `document.fonts.load()` is asked for
`600 24px "Barlow Condensed"`, `400 16px Barlow` and `800 16px Barlow` and each
must resolve to a shipped `@font-face`; the onboarding title, the Home title and
the card body are checked to be bound to the right role.

---

## 6. Screenshots (§14)

`test-evidence/v2-22-ux2r-production/` — 18 frames, every one the real
production app driven by the real pipeline. Frames 01–08 go through the real V2
first-run on empty storage. 11–16 walk a real session; `recipe_preference` is
advisory, so each recipe is captured through the format a learner would use for
it, and a recipe that never came would be a missing frame rather than a
fabricated one.

---

## 7. Limitations

- **Speaking has no written fallback.** A speaking production activity with no
  STT still has no answerable control (`§6` of the handoff classes this as B —
  it needs a presentation contract change). The E2E walks leave the session and
  re-enter rather than pretending to answer it. Unchanged by this slice, and
  visible to a real learner on a device without speech recognition.
- **The PWA install card** (`PwaInstallController`) is `position: fixed` over
  the whole app and overlaps the Home's last card until dismissed. It is
  pre-existing, outside §9's list of surfaces, and not restyled here.
- **`History.jsx` is still the V1 screen** (`ScoreRing`, %, A1–B2 chips), as the
  handoff's §8 notes. It is reachable from the V2 bottom navigation. Making it
  V2-honest needs a history presentation builder — class B, not this slice.
- **Only the `latin` subset** of each face ships; text outside it falls back to
  system-ui rather than rendering blank.
