# Slice V2.17-R — Learner Presentation Honesty Fix

Correção pós-V2.17 (PR #40 mergeado). **Nenhuma** funcionalidade pedagógica nova;
**nenhuma** alteração em Planner, Resolver, Lesson Engine, Assessment, Evidence
ou Learner Model. Apenas a camada learner-facing (adapter + componentes de UI).

## Base
- SHA base: `f323cb25f20e8fb12cf066437b504a7fefe36110` (origin/main)
- Merge V2.17: PR #40, commit original `50c6c639093b2ac84f0d8b1757525974072820c0` (contido no main)
- DB_VERSION 5 · registry 1 · Planner 1 · Engine 2 · Feedback VM 2 · Learner Presentation 1
- packs: still, but, yet

## Os quatro problemas — before / after

### 1. Progresso artificial (§1)
- **Antes:** `V2LessonHeader` calculava `fillPct = 1 - 1/(completed+1)` e renderizava
  uma `role="progressbar"` cuja largura crescia com `activityNumber` — um denominador
  implícito de uma sessão sem total real.
- **Depois:** removidos o cálculo, a progressbar, o fill e `aria-valuetext`. Resta só
  o fato verificável **“Atividade N”** + um divisor estático (largura fixa, não cresce).
  CSS `.v2lx-progress-track/fill` removido; adicionados `.v2lx-head-spacer` (neutro) e
  `.v2lx-head-divider` (estático).
- **Testes:** removido o teste que tratava a barra assintótica como “honesta”. Novos:
  header não contém `role="progressbar"`, nenhum `aria-valuenow/max/text`, nenhum
  `v2lx-progress-fill`, nenhum `width:%`; e o markup para `activityNumber=1` vs `9` só
  difere no contador (nenhum fill cresce).

### 2. “Você já conhece {word}” sem prova (§2)
- **Antes:** qualquer código em `NEW_USE_REASON_CODES`
  (`KNOWN_FUNCTION_NEW_CONSTRUCTION`, `KNOWN_LEXEME_CONTEXT_EXTENDED`,
  `KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK`) produzia “Você já conhece {lexema atual}.”.
  Um código de RELAÇÃO prova conhecimento da função/construção — não do lexema atual.
- **Depois:** a afirmação exige `lexemeIsFamiliarV2` — evidência estruturada real de que
  um target do pack do foco (senses/constructions próprios) já tem `exposure.count > 0`
  no learner state construído ANTES desta atividade. Sem prova ⇒ copy neutra
  **“Veja uma nova forma de expressar esta ideia.”** (`known_word: null`), nunca
  afirmando familiaridade. `learnerStates` passa do screen (`context.learner_states`)
  ao adapter.
- **Teste crítico:** `lexeme=new_word`, `reason=[KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK]`,
  sem evidência ⇒ **não** mostra “Você já conhece new_word.” (`known_word` null, headline
  neutra). Também: função conhecida relacionada não implica palavra atual conhecida.

### 3. Pack switch ≠ new use + provenance do cross-pack (§3)
- **Antes:** `buildTransition` usava subhead “Uma nova maneira de usar uma palavra…”
  (afirma novo uso sem sinal) e derivava o cross-pack hint de `transition.code`, que vem
  da família `PACK_SWITCH_*` — provenance incompatível com `CROSS_PACK_REASON_CODES`. O
  componente `V2PackTransition` ainda exibia um chip “✦ Novo uso”.
- **Depois:** copy **neutra** — headline “Agora vamos praticar ‘{word}’.”, subhead
  “Vamos continuar sua prática.”, **sem** claim de novo uso; chip “Novo uso” removido do
  componente. O cross-pack hint agora deriva de `focus.reason_codes ∩ CROSS_PACK_REASON_CODES`
  (provenance correta), nunca de `transition.code`.
- **Testes:** A) `PACK_SWITCH_FOR_RETENTION` → neutra, sem hint. B) `PACK_SWITCH_FOR_REMEDIATION`
  → neutra. C) foco com `CROSS_PACK_TRANSFER_OPPORTUNITY` → hint suave. D) código
  `PACK_SWITCH_*` sozinho (sem cross reason no foco) → **sem** hint (prova a provenance).

### 4. Sense + construction somados como “formas” (§4)
- **Antes:** `usesCount = constructions_practiced + senses_encountered` virava
  “N formas de usar X encontradas.” — sense e construction são dimensões distintas que
  podem descrever o mesmo uso; a soma não é uma contagem verificável.
- **Depois:** removida. O resumo mantém só fatos comprováveis: atividades praticadas,
  modalidades praticadas, e novos usos realmente introduzidos. (Uma “usage unit”
  learner-facing precisa ser definida antes de qualquer “N formas de usar”.)
- **Teste:** 1 construction + 1 sense (lema único) **não** gera “2 formas de usar”.

## Preservado (§5) — inalterado e verde
visual_variant semantics (correct/suggestion/partial/linguistic/semantic/
incorrect_unspecified/unable_to_assess), naturalness, target form, Feedback VM,
feedback na mesma tela, motion horizontal, reduced motion, activity renderers,
feature flag, V1. Regressões existentes de naturalness e de `uncertain → unable_to_assess`
continuam passando.

## §6 — Testes adicionados/atualizados
1. no fake progress bar ✔ · 2. new-use requires actual lexeme familiarity ✔ ·
3. related known function ≠ known word ✔ · 4. reused construction ≠ known word ✔ ·
5. ordinary pack switch neutral ✔ · 6. review pack switch neutral ✔ ·
7. cross-pack hint from valid focus reason ✔ · 8. sense+construction not summed ✔ ·
9. naturalness regression remains ✔ · 10. uncertain remains unable_to_assess ✔.

## §7 — Validação (tudo verde)
- `npm test`: **1163** passed (75 files). `src/lib/pedagogy-v2`: verde · `src/lib/language-analysis`: 121 passed (inalterada).
- validate:content-packs / knowledge-packs / pedagogy-v2: OK.
- inspect:pedagogy-v2 · audit:assessment-v2: OK.
- simulate:pedagogy-v2 --scenario all --check-determinism: 7 cenários, no grave findings.
- benchmark:semantic · benchmark:indexeddb: 0 cross-profile leaks.
- `npm run build`: OK · **dist não commitado**.
- Playwright: learner UX + V2 existing (playground) + V1 smoke — verdes.

## Arquivos
Modificados: `src/lib/pedagogy-v2/learner-presentation-v2.js` (+ testes),
`src/screens/V2LessonExperience.jsx`, `src/components/pedagogy-v2-learner/V2LessonHeader.jsx`,
`V2PackTransition.jsx`, `V2NewUseBanner.jsx`, `V2LessonShell.jsx`, `src/styles/v2-learner.css`,
`src/components/pedagogy-v2-learner/v2-learner-components.test.jsx`. Novo: este relatório.

## Acceptance
- a UI não simula progresso percentual inexistente ✔
- “você já conhece X” exige evidência real sobre X ✔
- pack switch não significa automaticamente new use ✔
- cross-pack hint usa provenance correta (focus reason codes) ✔
- sense + construction não são somados como “formas” ✔
- todo o restante da V2.17 permanece equivalente ✔
