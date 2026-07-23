# Slice V2.17 — Learner UX/UI Foundation

## 1. Base
- SHA base: `040c5af58bb56b88eb4c8b22b14e5ac420cdd5fc` (branch from origin/main)
- Merge V2.16: PR #39, original commit `16713e3cd3d1d820ed27a5f4d8ad35581357fc5d` (contained in main)
- DB_VERSION: **5** (unchanged — no migration, no new stores)
- registry version: 1 · Planner version: 1 · Engine version: 2 · Feedback VM version: 2
- Learner Presentation version: **1** (new pure adapter)
- packs disponíveis: `still`, `but`, `yet` (32 targets, 81 exemplars)
- Design handoff usado como REFERÊNCIA (não contrato): `V2 Prototype.dc.html`, `V2 Handoff.dc.html`. Onde protótipo × arquitetura conflitaram, a arquitetura V2 real prevaleceu (nada de playlist estática, nada de `checkFree()`/string-matching, nada de fake timers de speaking).

## 2. Feature flag (§2)
`v2_learner_experience_enabled` — default **false**. Off ⇒ produto atual intacto e o card não aparece. On ⇒ card temporário “Nova experiência V2” no Training Hub → nova aula. V1, Playground, Inspector e Lab permanecem (§38).

## 3. Entry point (§2/§28)
Card `v2-learner-open` no Training Hub (flag-gated) → screen `PEDAGOGY_V2_LEARNER` (`src/screens/V2LessonExperience.jsx`). **Home NÃO foi redesenhada**; nenhuma currency/streak/gamificação foi adicionada.

## 4. Architecture mapping (§3 — CRÍTICO)
A sessão NÃO é uma playlist. O screen possui o controller V2 real e, a cada mudança de estado, deriva a apresentação:

```
controller.start() → ActivityPlan (Planner → Focus Resolver → Lesson Engine)
resposta → controller.submit() → Assessment → Evidence → Feedback VM
Continuar → controller.advance() → Planner + Resolver decidem a PRÓXIMA atividade
            com o learner state JÁ atualizado
```

Nenhum componente React escolhe target/pack/recipe/modality/próximo exercício. Provado no E2E `runs a real session … no hardcoded playlist` e no teste de integração `learner-presentation-integration.test.js` (o próximo `activity_id` só surge após `advance()`).

## 5. Presentation adapter (§4) — `learner-presentation-v2.js` (PURO)
`buildLearnerPresentationV2({ plan, response, assessment, focus, transition, registry, recordedEvidence })` → `{ presentation_version, activity, focus:{label}, feedback|null, new_use|null, transition|null, session_summary:null }`. Executa nenhuma análise linguística — consome o honesty-guardian `buildV2FeedbackViewModel` e adiciona só a camada de apresentação. `buildLearnerSessionSummaryV2` para o resumo factual.

## 6. Feedback visual variants (§5/§6)
`feedback.outcome_status` (correct/partial/incorrect/not_assessed) é o outcome factual do Assessment — **nunca alterado**. `feedback.visual_variant` é distinto, derivado SÓ de dados estruturados, precedência:
1. `unable_to_assess` — `assessment.status==='unable_to_assess'` OU `semantic_equivalence==='uncertain'`.
2. `correct` / `suggestion` — aceito, com/sem naturalness.
3. `semantic` — `semantic_relation==='not_aligned'` ou issue `semantic_context`.
4. `linguistic` — issue grammar/lexical_choice/incomplete_response.
5. `partial` — outcome partial sem categoria específica.
6. `incorrect_unspecified` — incorrect sem causa.

Invariantes: `VISUAL_VARIANT_MUST_NOT_CHANGE_ASSESSMENT_OUTCOME` (o adapter nunca muta assessment/diagnosis — teste congela e compara) e `NO_UI_INVENTED_LINGUISTIC_CLAIM` (correct_points/issues só de findings reais).

## 7. Naturalness (§12/§43)
Naturalness vai sempre para `suggestions` (tom âmbar, label “Forma mais natural”), **nunca** para `issues`, nunca coral/vermelho, nunca “erro de verbo to be”. Caso canônico `Its price is very expensive.` → variant `suggestion` + `This price is very high.` como “Forma mais natural”. Coberto por `learner-presentation-v2.test.js §39.2/§39.10` e `v2-learner-components.test.jsx`.

## 8. Semantic mismatch (§10/§39.11)
Body: “A frase expressa uma ideia diferente da atividade.” — **nunca** afirma que a gramática está correta; `correct_points` vazio a menos que exista positive finding real. Teste asserta que o body não contém “gramática/estrutura correta/verbo correto”.

## 9. Uncertain (§11/§44)
`semantic_equivalence.status==='uncertain'` → `unable_to_assess`, copy “Não consegui confirmar essa resposta com segurança.”, distinta de `incorrect_unspecified` (“Essa resposta ainda não corresponde completamente…”). Não é tratado como erro do aluno.

## 10. Target form (§13)
Reference form sempre rotulada “Uma forma possível” / “Forma de referência”, **nunca** “Resposta correta”. Forma-alvo diferente com sentido alinhado ⇒ ainda `correct`/`suggestion`, com nota tranquilizadora; nunca `semantic`.

## 11–21. Componentes (novos, sem lógica pedagógica)
`src/components/pedagogy-v2-learner/`: **V2LessonShell** (orquestra header/stage/CTA/transições, máquina de estados do CTA), **V2LessonHeader** (voltar, progresso factual, focus chip), **V2ActivityStage** (slide out/in + advance-on-animationend), **V2LearnerActivity** (renderers reusando runtime real: `buildMaskedCompletion`, `presentedOrderTokens`, `MicButton`, `V2AudioButton`), **V2FeedbackPanel/Issue/Suggestion**, **V2NewUseBanner**, **V2PackTransition**, **V2ContinueButton** (CTA único no footer), **V2SessionSummary**, `useReducedMotion`.

- **Activity renderers (§19–§24):** Exposure (não-questão), Recognition (avalia no tap, marca esperada), Completion (chip → slot + Verificar), Word order (tap ≥44px, sem drag obrigatório), Guided/Free production (contexto acima, input abaixo, modelo escondido antes), Speaking. Nenhuma segunda implementação de contratos/validação/evidence.
- **New-use (§14–§16):** só de reason codes reais (`KNOWN_FUNCTION_NEW_CONSTRUCTION`, `KNOWN_LEXEME_CONTEXT_EXTENDED`, `KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK`); reforça que o uso anterior continua válido; **sem strike-through**. Mudança de ActivityPlan sozinha não infere novo uso.
- **Pack transition (§17):** estado APRESENTACIONAL do controller.transition — não gera evidence/target/Learner Model; sem tachado.
- **Cross-pack hint (§18):** só copy id-free (“Esta ideia se conecta a algo que você já praticou.”); nenhum relation id/prerequisite/score.

## 19. Speaking (§25 — CRÍTICO)
Estados idle/listening/processing/result. **Não** copia o mock que termina em “correct”. Pronunciation sem acoustic assessor ⇒ “Prática de fala — sem nota de pronúncia.”, nunca “pronúncia correta”/score/feedback verde acústico. Produção falada com Assessment semântico pode mostrar o feedback SEMÂNTICO real (nunca convertido em acoustic score).

## 20. Session progress (§26)
Sem `step/playlist.length` (não existe playlist). Header mostra contador factual “Atividade N” + barra decorativa que cresce sem denominador falso (assíntota, nunca 100%). Nenhum activity limit novo.

## 21. Session summary (§27/§47)
`buildLearnerSessionSummaryV2` — só fatos verificáveis: “Você praticou N atividades.”, modalidades praticadas, “N formas de usar ‘X’ encontradas” (derivado de constructions+senses quando um único lema domina), “Novo uso encontrado: ‘yet’.”. **Nunca** mastery %, CEFR global, palavra dominada.

## 22–24. Motion / reduced motion / responsive
- **Motion (§29):** stage out `translateX -7%`/220ms → in `translateX 7%→0`/260ms, easing `cubic-bezier(.4,0,.2,1)`; feedback `translateY 14px→0`/240ms; progressive disclosure rise+fade; barra 400ms. Advance não bloqueia no controller; guard contra double-submit e contra `animationend` duplicado (`nextRef` limpo antes de rodar).
- **Reduced motion (§30):** `@media (prefers-reduced-motion: reduce)` + hook + `data-reduced-motion`. Sem slide/pulse; troca imediata; funcionalidade idêntica. E2E com `emulateMedia({reducedMotion:'reduce'})` verde.
- **Responsive (§36):** coluna única, conteúdo centralizado ~560px, CTA fixo no footer com fade. E2E mobile 375px: overflow horizontal ≤ 1px.

## 25. Accessibility (§35)
Feedback com `role="status"` + `aria-live="polite"`; estado nunca só por cor (ícone + headline textual); touch targets ≥44px; `aria-label` (Voltar/Ouvir/Falar); `role="progressbar"` com `aria-valuetext`; textarea/inputs com label; foco não é roubado agressivamente após feedback.

## 26. Canonical expensive/high result (§43)
`Its price is very expensive.` + naturalness ⇒ variant `suggestion`, “Forma mais natural: This price is very high.”, nunca linguistic/erro to be. (adapter + component tests)

## 27. Semantic uncertainty result (§44)
equivalence `uncertain` ⇒ `unable_to_assess`, copy de incapacidade, não incorrect/partial/punitivo. (adapter test)

## 28. Cross-pack / new-use result (§45)
Known lexeme + new construction ⇒ NewUseBanner; uso anterior visualmente válido; sem strike-through; sem reason codes vazando. (adapter + component tests)

## 29–33. Integração (controller / Resolver / Assessment / evidence / learner-state)
`learner-presentation-integration.test.js` roda o controller REAL sobre o storage real: feedback aparece sem trocar o ActivityPlan; próximo plan só após `advance()`; ≥1 variant válido por sessão; presentation nunca vaza id interno; evidence continua sendo persistida pelo pipeline atual (sem novo store, sem backend). Learner-state atualizado antes de cada re-planejamento (o próximo foco reflete a evidência recém-gravada).

## 34–36. Tests
- **Unit (§39):** `learner-presentation-v2.test.js` — 21 testes cobrindo os 12 casos + exposure/new-use/transition/summary.
- **Components (§40):** `v2-learner-components.test.jsx` — 21 testes (feedback variants, banners, header sem denominador falso, stage reduced-motion, cada recipe id-free, pronunciation sem score).
- **Integration/motion (§41/§42):** `learner-presentation-integration.test.js` — 3 testes de pipeline real.
- **Playwright (§42/§46/§36):** `e2e/pedagogy-v2-learner.spec.js` — 7 cenários (gating, real pipeline + no hardcoded playlist, feedback same-screen, reduced motion, mobile overflow, V1 coexistence). Verde no `chromium-desktop`.

## 37–40. Validação (§50) — tudo verde
- `npm test`: **1155** passed (75 files).
- `npx vitest run src/lib/pedagogy-v2`: 813 passed · `src/lib/language-analysis`: verde/inalterado (V2.15 congelada).
- validate:content-packs / knowledge-packs / pedagogy-v2: OK.
- inspect:pedagogy-v2 · audit:assessment-v2: OK.
- simulate:pedagogy-v2 --scenario all --check-determinism: 7 cenários, **no grave findings** (só warnings pré-existentes).
- benchmark:semantic · benchmark:indexeddb: 0 cross-profile leaks.
- `npm run build`: OK. **dist não commitado** (revertido).
- Playwright learner spec: 7 passed (desktop) — mobile viewport coberto no próprio spec.

## 41. Git status
Modificados: `src/App.jsx`, `src/main.jsx`, `src/store.jsx`, `src/screens/TrainingHub.jsx`, `e2e/v2-helpers.js`. Novos: `src/lib/pedagogy-v2/learner-presentation-v2.js` (+ 2 testes), `src/screens/V2LessonExperience.jsx`, `src/styles/v2-learner.css`, `src/components/pedagogy-v2-learner/*`, `e2e/pedagogy-v2-learner.spec.js`, este relatório.

## 43. Frozen diff (§49)
**Zero** alteração em: Planner weights/ranking, Resolver ranking, Lesson Engine selection, Semantic Bridge, Semantic Equivalence thresholds, Assessment policy, Evidence mappings, Learner Model. `git status` confirma `study-planner.js`, `study-focus-resolver.js`, `lesson-engine.js`, `semantic-*`, `assessment-*`, `learner-model.js`, `src/lib/language-analysis/`, `src/content/pedagogy-v2/` **intocados**. DB_VERSION 5, sem novo store, sem migração.

## 44. Limitations
- **Exit/resumability (§32):** local-first, sem backend. Ao sair com resposta não submetida, ela é descartada após `confirm()`. Não há retomar-do-mesmo-passo (nenhum store novo prometido).
- Naturalness/semantic/uncertain com atividade específica (free_production) são provados por adapter + component tests (fixtures reais), pois uma sessão real para um perfil novo não materializa deterministicamente um `free_production` cedo — forçar isso exigiria uma playlist, o que a arquitetura proíbe. A E2E cobre o pipeline real + honestidade dos variants renderizados.
- `feedback.issues[].span` (§14 NEW) não é inventado na UI; fica `null` até o backend fornecer.
- Progressive-disclosure `detail` só aparece quando o diagnosis traz título+resumo distintos (conteúdo real).

## 46. Recommendation for V2.18
Home learner-facing completa (substituindo o card temporário) — “Continuar onde parou” + Explorar + Revisão — reusando este shell; definir contrato de produto para progresso/streak antes de qualquer gamificação; e um `span` learner-facing autorado no diagnosis para destacar o trecho no estado `linguistic`.
