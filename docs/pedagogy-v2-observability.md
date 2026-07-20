# Pedagogy V2 — Observabilidade, Simulação e Learner Inspector (Slice V2.7)

Esta slice adiciona uma camada que **observa e diagnostica** o sistema
pedagógico V2 (Content, Learner Model, Review Queue, Study Planner, Lesson
Engine, Assessment/Evidence) **sem alterar a semântica de nenhum algoritmo
existente**. Ela responde à pergunta:

> O sistema pedagógico V2 produz trajetórias de aprendizagem coerentes ao longo
> do tempo?

**Princípio central:** esta slice **observa antes de recalibrar**. Nenhum peso
ou threshold pedagógico foi alterado. Diferenciamos rigorosamente:

| Conceito | O que é | Efeito |
|---|---|---|
| **Invariante** | Promessa dura do sistema | Violação **interrompe** a simulação |
| **Métrica** | Propriedade medida da trajetória | Apenas observação |
| **Finding** | Diagnóstico estrutural (info/warning/error) | Documentado, não recalibra |
| **Bug** | Erro lógico inequívoco / crash / não-determinismo | Corrigido nesta slice |
| **Heurística** | Threshold de diagnóstico (`OBSERVABILITY_POLICY_V2`) | Muda o que é sinalizado, nunca o que o planner decide |

## Arquitetura

```
src/lib/pedagogy-v2/
  observability-contracts.js   findings, invariantes, telemetry types, OBSERVABILITY_POLICY_V2
  simulation-contracts.js      SimulationScenarioV2, clock, validação, serialização determinística
  simulation-personas.js       7 personas artificiais determinísticas
  simulation-response-model.js resposta simulada determinística + SimulationAssessmentServiceV2
  simulation-runner.js         pipeline REAL planner→engine→assessment→evidence→model
  simulation-scenarios.js      catálogo de cenários (goldens/CLI)
  pedagogical-metrics.js       12 métricas puras
  trajectory-analyzer.js       métricas de trajetória + findings
  learner-inspector.js         inspeção pura + explainability + telemetry local + export
scripts/
  simulate-pedagogy-v2.mjs     npm run simulate:pedagogy-v2
  inspect-learner-v2.mjs       npm run inspect:learner-v2 (fixture/snapshot)
```

Nenhuma lógica de simulação/observabilidade entra no Study Planner, no Lesson
Engine, no Learner Model ou no runtime real — os módulos de simulação
**importam** os reais; os reais nunca importam os de simulação.

## Simulation Harness

`SimulationScenarioV2` é totalmente serializável e reproduzível: tempo, seed e
clock são **explícitos**. O núcleo nunca lê `Date.now` nem chama `Math.random`
(o "acaso" é um hash FNV-1a semeado). Estratégias de clock:
`constant_interval`, `accelerated_days` (mapa interação→dia), `custom_schedule`.

O runner executa o **pipeline real**:

```
Study Planner → StudyFocus → Lesson Engine → ActivityPlan
  → resposta simulada → Assessment → Evidence Adapter → Learner Model → novo contexto
```

O estado do aluno é reconstruído a cada interação a partir das evidências
geradas (nunca fabricado diretamente). Um `SimulationAssessmentServiceV2`
determinístico avalia produção comparando o texto à frase autorada — com
contrato explícito e **nunca usado pelo runtime de produção**.

## Personas (determinísticas, artificiais)

`new-learner`, `strong-reader-weak-listener`, `support-dependent`, `forgetful`,
`fast-learner`, `struggling`, `cross-pack-transfer`. Cada uma é um objeto de
probabilidades base por capacidade, modulado por prática (curva de
aprendizagem), apoio, independência e esquecimento. Mesma seed → mesmas
respostas.

## Invariantes (§11) — interrompem a simulação

1. review nunca introduz target novo; 2. new-item budget nunca excedido;
3. foco runtime-incompatível nunca executado; 4. target IDs resolvem;
5. evidence IDs únicos; 6. interaction IDs determinísticos; 7. isolamento de
profile; 8. lane independente sempre sem apoio; 9. exposição nunca move
domínio; 10. nenhuma mastery global; 11. engine respeita o StudyFocus;
12. pack ativo corresponde ao foco; 13. frase autorada; 14. nenhum texto
gerado; 15. nenhuma identidade V1 oculta. Violação → `SimulationInvariantError`
com diagnóstico claro.

## Métricas (§8) e trajetória (§9)

12 métricas: isolamento de alvo, carga de novos itens, produção sem apoio,
dependência de apoio (por capability key, **sem colapsar em score global**),
balanço de modalidades, profundidade de capacidade, razão de revisão, pressão
de repetição, taxa de troca de pack, transferência cross-pack, retenção
atrasada, profundidade lexical. **Nenhuma porcentagem global de mastery.**
Findings de trajetória: stagnation, premature free production, review/novelty
starvation, support trap, modality/pack starvation, ping-pong, budget
violation, review-introduced-new-target, runtime-unavailable, global-mastery.
Thresholds em `OBSERVABILITY_POLICY_V2` (diagnóstico, não pedagogia).

## Learner Inspector e Explainability

Funções puras somente leitura: `buildLearnerInspectorSnapshotV2`,
`inspectTargetV2`, `inspectLexemeV2`, `inspectReviewNeedsV2`,
`inspectPlannerEligibilityV2`. O snapshot mostra por lexema (senses/
constructions/functions/last contact), por target (exposure, lanes overall/
supported/independent, evidence level, trend, retention) e o planner
(candidatos, filtrados+motivo, componentes de score, foco selecionado).
**Nunca** uma mastery global; **nunca** ação de "marcar como dominado".

`explainStudyFocusV2(focus, context)` produz `{ headline, reasons, evidence }`
a partir de **templates determinísticos por reason code** — sem LLM, sem texto
livre.

## Telemetria local (§19) e export (§20)

`createTelemetryCollectorV2` é **opt-in, em memória**: tipos
`STUDY_FOCUS_SELECTED`, `ACTIVITY_PLAN_SELECTED`, `INTERACTION_ASSESSED`,
`EVIDENCE_RECORDED`, `PACK_SWITCHED`, `CROSS_PACK_TRANSFER_SELECTED`,
`REVIEW_SELECTED`. **Nenhum store novo, nada persistido, nada enviado à rede.**
O export (`buildObservabilityExportV2`) contém métricas agregadas, trajetória,
findings, versões de política e do registry.

## Política de privacidade (§21)

- A observabilidade é **100% local**; **nenhum dado é enviado** para a rede.
- O export é **manual** (acionado pelo usuário no Inspector/CLI).
- **Respostas textuais digitadas pelo aluno não entram** no relatório agregado
  — o shape do export não possui campo para isso.
- **Transcrições de voz não entram** no relatório.
- `profile_id` é **omitido por padrão** no export.
- O objetivo é exclusivamente **calibração pedagógica**.

## Findings observados (não recalibrados nesta slice)

Executando os 7 goldens com as políticas atuais, o harness revelou:

1. **Trajetória presa em recognition (warning: `TARGET_STAGNATION`,
   `EXCESSIVE_TARGET_REPETITION`, `SUPPORT_TRAP`).** O Study Planner gera
   candidatos de foco `independence` para capacidades de **recognition/
   comprehension**, que **não possuem variante independente** no lesson engine
   (só produção tem). Um foco de independência sobre recognition é servido como
   uma atividade de recognition **com apoio** (multiple choice), então a lane
   independente nunca é construída e o candidato se **regenera indefinidamente**,
   dominando a seleção e mantendo o aluno em recognition. Consequência: mesmo o
   `fast-learner` raramente passa de recognition (chega a comprehension, quase
   nunca a produção), e writing/speaking podem ficar sem prática
   (`MODALITY_STARVATION`).
2. **`REVIEW_STARVATION` frequente:** alvos entram na review queue (por
   `SUPPORTED_WITHOUT_INDEPENDENT`) mas raramente são selecionados como revisão
   porque os focos de aprofundamento/independência os superam em score.

Ambos são **findings de qualidade de trajetória**, não violações de invariante.
Conforme §22, **não foram recalibrados** — ficam registrados para a Slice V2.8.

> **Atualização — resolvido na Slice V2.8 (correção estrutural, sem recalibrar
> pesos).** A causa raiz era estrutural: `independence` era tratada como
> propriedade abstrata da capability. A V2.8 introduziu
> `training-affordances.js` (fonte única derivada de `LESSON_RECIPES` + runtime):
> um foco `independence` só existe onde há recipe executável, sem apoio e
> avaliado. Recognition/comprehension deixaram de gerar `independence` e
> `SUPPORTED_WITHOUT_INDEPENDENT`; o engine rejeita foco impossível
> (`FOCUS_INDEPENDENCE_NOT_EXECUTABLE`) e uma nova invariante grave
> (`INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY`) impede regressão. Resultado:
> as trajetórias progridem recognition → comprehension → controlled → free
> production; **nenhuma recalibração de peso foi necessária**. Ver
> `test-evidence/v2-8-structural-baseline.md`.

## Bugs reais corrigidos nesta slice

- **Colisão de IDs por reuso de lesson-session:** ao recriar a `LessonSessionV2`
  de um pack após atingir o teto, o harness precisava de um id de sessão
  **determinístico e único** por criação (contador monotônico), senão
  `activity/interaction/evidence` ids colidiam. Isso é uma correção **do
  harness**, não do sistema pedagógico. Nenhum peso/threshold pedagógico foi
  alterado.

## Tooling

- `npm run simulate:pedagogy-v2 -- --scenario <id|all> [--interactions N] [--seed S] [--format text|json]`
- `npm run inspect:learner-v2 -- --fixture <path> [--target ID] [--lexeme ID]`
  ou `-- --scenario <id>`.
- CI smoke: `simulate:pedagogy-v2 --scenario new-learner --interactions 20` —
  falha **apenas** por crash, não-determinismo ou finding grave (invariante);
  warnings de trajetória nunca falham o CI.

## Recomendações para a Slice V2.8

1. Corrigir a geração de candidatos `independence` para restringi-la às
   capacidades com variante independente (produção/pronúncia), eliminando o
   loop de recognition.
2. Rebalancear pesos de `capability_gap`/`independence_gap`/`review` para que a
   progressão avance de recognition → comprehension → produção.
3. Reavaliar `MODALITY_STARVATION` de writing/speaking uma vez desbloqueada a
   produção.
4. Usar as métricas desta slice como baseline antes/depois de qualquer
   recalibração.

> **Atualização — Slice V2.9 (modality path completeness).** Após a V2.8, o
> harness revelou que `writing` produção ficava com `opportunity_coverage 0/0`:
> a escada introduz produção por `speaking` e o único *modality gap* era a
> tabela manual `reading↔listening`. A V2.9 generalizou a geração
> (`modality-gap.js` + APIs de modalidades treináveis derivadas das
> affordances; tabela manual removida), compartilhou o gate de capability entre
> Planner e Engine (`capabilityGateMetV2`), adicionou a invariante grave
> `FOCUS_MODALITY_HAS_NO_AFFORDANCE` e a auditoria estática
> `auditTrainingDomainReachabilityV2` (exposta em `inspect:pedagogy-v2`).
> Resultado: writing elegível E selecionado em toda persona com produção
> desbloqueada (ex.: support-dependent 51/24), zero starvation, **nenhum peso
> alterado**. Ver `test-evidence/v2-9-modality-baseline.md`.

> **Atualização — Slice V2.10 (runtime-aware entry + long horizon).** A entrada
> de capability deixou de ser a primeira modalidade ordenada: `capability-entry.js`
> escolhe entre modalidades executáveis e curriculum-ready (sem mic, produção
> entra por writing; sem áudio, comprehension entra por reading — antes o
> text-only morria em 15 interações). Invariante grave nova
> `CAPABILITY_READY_BUT_NO_EXECUTABLE_ENTRY_DOMAIN`; auditoria com
> entry/expansion paths; matriz de 4 perfis de runtime (28 execuções, 0 graves);
> métricas por janela temporal, `curriculum_saturation` (fato, não finding),
> diagnósticos long-horizon (`LATE_REVIEW_DOMINANCE` etc.) e rotação opcional de
> sessão no harness (`session_rotation_interactions`) para horizontes 200–500.
> **Nenhum peso alterado; planner_version permanece 1.** Ver
> `test-evidence/v2-10-long-horizon-baseline.md`.

> **Atualização — Slice V2.11 (terceiro lexema `yet` + grafo de três packs).**
> O registry passou a carregar `still`, `but` e `yet` (registry_version 1
> inalterado; ordem de import irrelevante). O pack `yet` é servido pela MESMA
> observabilidade: aparece automaticamente em `lexical_depth` (3 lexemas) e nas
> métricas de transferência cross-pack — nenhuma lógica por lexema. O grafo
> deixou de ser cadeia: `construction:still.clause_but_subject_still_verb`
> recebe relações de `but` E de `yet` (N-para-N), e `yet` declara dependências
> dirigidas a `still` e `but` (DAG, sem ciclo). O **teto curricular subiu de 28
> para 46 targets** — em cada persona/horizonte, `remaining_eligible_unseen_targets`
> é maior no mesmo ponto de trajetória que o baseline de dois packs, com **0
> findings graves** e transferência cross-pack observada (`still→yet`, `but→yet`).
> Matriz de runtime revalidada (full × 7 personas + text-first/text-only fast
> learner + no-audio weak-listener, 0 graves). **Nenhum peso recalibrado;
> planner_version permanece 1.** A única correção estrutural foi elevar o teto
> de tentativas de supressão de foco do controlador/runner (o pool de
> candidatos de três packs excede o antigo limite de 5–6 e famintava sessões
> sem isso — cada tentativa suprime uma chave, então a caminhada termina
> naturalmente). Ver `test-evidence/v2-11-three-pack-long-horizon.json` e
> `test-evidence/v2-11-runtime-matrix.json`.
