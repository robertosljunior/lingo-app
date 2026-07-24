# Slice V2.18 — Learner Training Home + Real Study Mode Entry

Navegação + apresentação + integração de produto. **Nenhuma** inteligência
pedagógica nova; a Home apenas apresenta os modos reais e encaminha ao pipeline V2.

## 1. Base
- SHA base: `f7fd50a9b03679d6cfdd9c3002445a2d65b32bae` (origin/main, pós-PR #41)
- Merge PR #41 (V2.17-R): `f7fd50a` contém o commit original `77af45b…` como ancestral — confirmado.
- Branch nova: `claude/pedagogy-v2-18-learner-home` (a partir da main atualizada; **não** sobre `claude/pedagogy-v2-17r-honesty-fix`).
- DB_VERSION **5** (inalterado) · registry 1 · Planner 1 · Engine 2 · Feedback VM 2 · Learner Presentation 1 · **Learner Home Presentation 1** (novo)
- packs: still, but, yet

## 2/5. TrainingHub split + LegacyTrainingHub
`TrainingHub.jsx` virou um **router fino**: flag OFF → `LegacyTrainingHub` (V1
extraído verbatim, semanticamente equivalente: themes, níveis A1–B2, generated
lessons, skills, "Domínio estimado"); flag ON → `V2LearnerHome`. O card temporário
"Nova experiência V2" foi removido — quando a flag está ON, Training **é** a Home
V2, então os dois mundos pedagógicos nunca dividem a mesma superfície (§21). O card
"Laboratório V2" (diagnóstico) permanece no LegacyHub sob seu gate atual.

## 3. Feature flag
`v2_learner_experience_enabled` (default **false**) — a MESMA flag, nenhuma nova.
OFF → Hub V1 intacto. ON → V2LearnerHome como experiência principal.

## 4/7. V2LearnerHome
Screen learner-facing (`V2LearnerHome.jsx`) usando os tokens `.v2lx`: greeting +
hero com CTA único + grid de ações (Explorar/Revisão) + link discreto "Ferramentas
V2" (quando diagnostics/dev). **Não** escolhe target/pack/capability/modalidade,
**não** calcula mastery, **não** roda Planner. Cada botão apenas inicia uma sessão
real no modo correspondente.

## 8. Home Presentation Adapter (§15)
`buildLearnerHomePresentationV2({ profileName })` PURO/determinístico →
`{ presentation_version:1, greeting, subhead, primary_action{mode:'adaptive'},
actions[{mode:'explore'},{mode:'review'}], facts:[] }`. Todo `mode` é um Study mode
canônico real (validado contra `STUDY_MODES`). Não roda Planner; `facts` vazio (Home
enxuta, §23).

## 6/9/24. Hero + greeting
"Bom te ver, {nome}." quando o perfil tem nome real; senão "Bom te ver de novo."
(placeholder "Você" tratado como sem-nome; nenhuma propriedade nova). Subcopy do CTA:
"O próximo exercício parte do que você já praticou." (§6).

## 7/23. Resumability — decisão explícita
**Existe:** iniciar uma NOVA StudySession a partir do Learner Model já acumulado.
**Não existe:** retomar uma StudySession antiga. Portanto a Home NÃO usa "Continuar
onde parou / Retomar sua sessão / Voltar para a atividade N". Protegido por teste
(§38.9 + copy regression E2E).

## 10–12. Mode routing (§11) — mesmo controller
`resolveLessonModeV2(params)` (puro): `mode` explícito vence; `pack` sem `mode` →
focused (compat). **Erros estruturais seguros** (sem fallback silencioso para
adaptive): `focused` sem pack → `FOCUSED_REQUIRES_PACK`; modo inválido →
`MODE_INVALID`. Todos os modos convergem para o MESMO
`createStudySessionControllerV2({ mode })` — nenhum controller paralelo (§12).

## 13. Session context label
`SESSION_CONTEXT_LABELS` (adaptive→"Prática", explore→"Explorar", review→"Revisão",
focused→"Prática") exportado para apresentação. Optamos por NÃO alterar o Lesson
Header (§13 permite) — o mode técnico nunca é mostrado ao aluno.

## 14/17. Navegação + close
Praticar agora → Lesson adaptive · Explorar → explore · Revisão → review. Lesson
`✕`/Session Summary "Concluir" → `setTab(TRAINING)` que, com flag ON, renderiza a
V2LearnerHome (nunca o LegacyHub). E2E prova ambos (§45).

## 18. Zero-interaction / empty states
`buildLearnerSessionResultV2({ interactions, mode })` → `kind:'completed'` (resumo
factual, reusa V2.17-R) OU `kind:'empty'` quando 0 atividades. Empty NUNCA vira
"Você praticou 0 atividades." Copies mode-aware (§17):
- review: "Nada para revisar agora." + ações [Praticar agora, Explorar]
- explore: "Nada novo disponível agora." + [Praticar agora]
- adaptive: "Não há uma prática disponível agora." (neutra — sem "terminou o curso/
  dominou tudo/100%")
`V2SessionSummary` foi estendido para renderizar completed vs empty (reuso visual,
sem fingir sessão).

## 19. Session summary
Sessões reais preservam V2.17-R: nº real de atividades, modalidades, novos usos
comprovados. Continua proibido mastery/CEFR/palavra dominada/sense+construction=N
formas/percentual. "Concluir" → V2 Home.

## 20/21/22. Sem métricas V1 na Home
A Home V2 não mostra "Domínio estimado", A1–B2, themes, skills, generated lesson,
CEFR, barras percentuais. Uma verdade só do learner state por superfície. Themes/
Theme→Level→lesson permanecem exclusivamente V1 (§22).

## 25. Bottom nav
Reutilizada a `BottomNav` existente com V2LearnerHome como conteúdo de Training —
sem tabs falsas/rotas vazias. Explorar/Revisão são ações/cards na Home (§25).

## 26. Diagnostics
Playground/Inspector/Lab intactos sob seus gates. Link secundário discreto
"Ferramentas V2" na Home quando pilot/diagnostics/DEV — sem hierarquia
"experimental/laboratório" para o aluno comum.

## 27/28/29. Loading / error
Home renderiza instantaneamente a partir de dados puros (não pré-roda Planner, §16),
então não há spinner artificial. Lesson mantém "Preparando sua prática…". Modo
inválido/focused-sem-pack → tela learner-facing "Não foi possível abrir esta
prática." + Voltar, sem fallback arbitrário (§29). Nenhum fallback silencioso para V1.

## 30/31/32. Accessibility / responsive / tokens
Heading hierarchy (`<h1>`), CTA primário inequívoco, cards `<button>` com focus
visível (`:focus-visible`), touch targets ≥44px, dark/light via tokens `.v2lx`,
sem depender só de cor. Testado 320/375 sem overflow horizontal. Nenhum hex novo
inline — apenas variáveis CSS `.v2lx`.

## 33/34/35. Sem gamificação / SRS / resume store
Nenhum XP/streak/moeda/badge; nenhum scheduler/SM-2/FSRS/fila SRS; nenhum store novo
(`v2_active_session` etc.). DB_VERSION permanece **5**. Nova prática = nova
StudySession do learner state atual.

## 36/37. Frozen core + V2.17-R preservada
`git status` confirma intocados: Study Planner, Focus Resolver, Lesson Engine,
Training Affordances, Capability Entry, Modality Gap, Semantic Bridge/Equivalence,
Assessment/Diagnosis, Evidence, Learner Model, `learner-presentation-v2.js`,
`src/lib/language-analysis`, `src/content/pedagogy-v2`. Todas as 10 regressões
V2.17-R continuam verdes (progressbar/familiaridade/relation-code/pack-switch
neutro/cross-pack provenance/sem soma/naturalness/semantic/uncertain/target form).

## 38/39. Testes unitários
- `learner-home-presentation.test.js` (15): greeting nome/fallback, adaptive/explore/
  review actions, sem métrica global/CEFR/skill, sem falsa resumability, determinístico,
  empty states mode-aware, zero-interaction ≠ "0 atividades".
- `learner-mode-routing.test.js` (11): `resolveLessonModeV2` (adaptive/explore/review/
  focused+pack/focused-sem-pack→erro/invalid→erro) **e** o controller REAL recebendo o
  mode (studySession.mode === mode; focused sem pack → status error).

## 40–45. Playwright (`pedagogy-v2-learner-home.spec.js`, 10 cenários — todos verdes)
Coexistência OFF (Hub V1)/ON (V2 Home sem verdades V1 nem falso resume); adaptive
real (data-mode="adaptive", sem playlist); explore real (data-mode="explore",
atividade ou empty); review empty ("Nada para revisar agora.", nunca "0 atividades");
close→Home; summary/empty→Home; mobile 320 sem overflow; dark mode. Preservados:
learner-lesson E2E, Playground E2E, V1 hub-lessons, mobile-smoke (33 verdes).

## 46. Copy regression
E2E verifica na superfície renderizada da V2 Home a ausência de "Escolha o que
treinar / Domínio estimado / mastery / CEFR / A1– B2 / Continuar onde parou /
Retomar sua sessão".

## 47. Screenshots
`test-evidence/v2-18-screens/`: home-375-light, home-375-dark, home-320,
explore-entry, review-empty, summary-return-home.

## 48/49. Validação — tudo verde
- `npm test`: **1189** passed (77 files). pedagogy-v2 e language-analysis verdes.
- validate:content-packs/knowledge-packs/pedagogy-v2: OK.
- inspect:pedagogy-v2 · audit:assessment-v2: OK.
- simulate --scenario all --check-determinism: 7 cenários, no grave findings.
- benchmark:semantic · benchmark:indexeddb: 0 cross-profile leaks.
- `npm run build`: OK. **dist não commitado**.
- Node pure imports do adapter: OK.

## 50/44. Frozen-core diff + git status
Zero diff nos cores pedagógicos. Arquivos: novos `learner-home-presentation.js`
(+2 testes), `V2LearnerHome.jsx`, `LegacyTrainingHub.jsx`, `pedagogy-v2-learner-home.spec.js`,
`pedagogy-v2-home-screens.spec.js`, este relatório, screenshots; modificados
`TrainingHub.jsx` (router), `V2LessonExperience.jsx` (mode routing + empty),
`V2SessionSummary.jsx` (empty view), `styles/v2-learner.css` (Home + botões),
`e2e/v2-helpers.js` + `e2e/pedagogy-v2-learner.spec.js` (nova entrada).

## 48. Limitations
- Explore-empty não é acionável determinísticamente num perfil novo (explore sempre
  tem conteúdo novo a introduzir); coberto por unit test, e o E2E aceita atividade OU
  empty (§43).
- Não há retomada de sessão (por design, §7/§35) — sair descarta a atividade não
  submetida (local-first).
- Home não mostra histórico/facts nesta slice (preferimos menos informação a métricas
  frágeis, §23).

## 49. Recommendation para V2.19
Uma **learner-facing usage unit** de progresso que o modelo V2 sustente (para
substituir honestamente a ausência de progresso na Home), + facts reais opcionais na
Home (ex.: "Você praticou escrita recentemente.") derivados objetivamente do recent
evidence; e, se desejado, um contexto de tema como *cenário de prática* (não eixo
curricular V1) alimentando o modo focused.
