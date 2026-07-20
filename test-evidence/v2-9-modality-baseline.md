# Slice V2.9 — Fase A: baseline de modalidades (antes vs depois)

**Base:** `origin/main` = `e48cbc9` (merge do PR #31, Slice V2.8).
**V2.8:** commit `1a636e7`, mergeado via PR #31. **DB_VERSION:** 5 (inalterado).
**Packs:** `pedagogy_v2_but`, `pedagogy_v2_still` (registry_version 1).

> Comparação **V2.8 (pós-merge)** vs **V2.9 (geração genérica de modality
> gap)**. Nenhum peso pedagógico foi alterado. Mesmas seeds V2.7/V2.8 — as
> mudanças de trajetória vêm exclusivamente do Planner (geração de candidatos).

## Finding V2.8 reproduzido (antes da correção)

`writing` produção com `opportunity_coverage = 0/0` em **todas** as 7 personas
(V2.8 pós-merge). Causa: (1) a escada de capacidade introduz produção sempre
pela primeira modalidade ordenada (`speaking`); (2) a única geração de
*modality gap* existente usava uma tabela manual com um único par
(`reading↔listening`) — produção não tinha caminho de candidato algum.

## Correção estrutural (Fase A)

- **APIs de modalidades treináveis** (`getTrainableModalitiesForCapabilityV2`,
  `getTrainableDomainsForTargetV2`, `getSiblingTrainableDomainsV2`) derivadas
  de recipes + affordances + runtime — a tabela manual `MODALITY_PAIRS` foi
  removida; uma modalidade futura entra sem reescrever o Planner.
- **`buildModalityGapCandidatesV2`** (módulo puro): para cada target ×
  capability praticada, propõe cada modalidade irmã treinável sem evidência,
  com readiness = o MESMO gate de capability do engine
  (`capabilityGateMetV2`, agora compartilhado — o Planner nunca propõe o que o
  engine recusaria). Reason codes: `MODALITY_GAP` +
  `PARALLEL_MODALITY_UNPRACTICED` + específicos (`WRITING_BEHIND_SPEAKING`, …).
- **Dois eixos distintos:** capability progression (ladder, inalterada) ×
  modality expansion (novo, mesma capability). Modalidade não é nível.
- **Política de readiness documentada:** a modalidade paralela entra pela MESMA
  capability quando o gate desta modalidade está satisfeito no target
  (ex.: free/writing exige controlled/writing estabelecido — o gate do engine);
  nunca re-exige recognition; evidência jamais vaza entre modalidades.
- **Review ≠ nova modalidade:** modalidade nunca praticada → deepen/modality
  gap; deteriorada → review/remediate. O reason `MODALITY_GAP` da review queue
  permanece no capability_key PRATICADO (assimetria de cobertura), agora
  derivado genericamente das affordances.
- **Invariante nova (grave):** `FOCUS_MODALITY_HAS_NO_AFFORDANCE` (runner
  halta; analyzer detecta em trajetórias sintéticas).
- **Auditoria estática:** `auditTrainingDomainReachabilityV2` — por domínio:
  has_affordance / has_candidate_path / has_engine_path / has_assessment_path;
  domínio dependente de runtime é `conditional`, nunca unreachable absoluto.
  Warnings: `TRAINABLE_DOMAIN_WITHOUT_CANDIDATE_PATH` etc. (teria detectado o
  bug do writing=0 estruturalmente; `inspect:pedagogy-v2` agora reporta).

## Comparação por persona (mesmas seeds)


### new-learner (n=100)

| métrica | V2.8 (antes) | V2.9 (modality paths) |
|---|---|---|
| modality balance | reading:27 listening:40 speaking:33 | reading:33 listening:37 writing:9 speaking:21 |
| capability depth | recognition:56 comprehension:11 controlled_production:29 free_production:4 | recognition:52 comprehension:18 controlled_production:30 |
| writing opportunity (elig/sel) | 0/0 | 49/9 |
| unaided controlled/free | 0.4483/0 | 0.0333/null |
| review ratio | 0.1905 | 0.2346 |
| repetition (same target) | 18 | 18 |
| findings | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP |

### weak-listener (n=80)

| métrica | V2.8 (antes) | V2.9 (modality paths) |
|---|---|---|
| modality balance | reading:17 listening:63 | reading:17 listening:63 |
| capability depth | recognition:70 comprehension:10 | recognition:70 comprehension:10 |
| writing opportunity (elig/sel) | 0/0 | 0/0 |
| unaided controlled/free | null/null | null/null |
| review ratio | 0.6667 | 0.7021 |
| repetition (same target) | 9 | 9 |
| findings | EXCESSIVE_TARGET_REPETITION | EXCESSIVE_TARGET_REPETITION |

### support-dependent (n=100)

| métrica | V2.8 (antes) | V2.9 (modality paths) |
|---|---|---|
| modality balance | reading:27 listening:33 speaking:40 | reading:43 listening:26 writing:24 speaking:7 |
| capability depth | recognition:50 comprehension:10 controlled_production:39 free_production:1 | recognition:52 comprehension:17 controlled_production:31 |
| writing opportunity (elig/sel) | 0/0 | 51/24 |
| unaided controlled/free | 0.4615/0 | 0.3871/null |
| review ratio | 0.25 | 0.2195 |
| repetition (same target) | 18 | 18 |
| findings | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP, TARGET_STAGNATION |

### forgetful (n=60)

| métrica | V2.8 (antes) | V2.9 (modality paths) |
|---|---|---|
| modality balance | reading:24 listening:36 | reading:24 listening:36 |
| capability depth | recognition:53 comprehension:7 | recognition:54 comprehension:6 |
| writing opportunity (elig/sel) | 0/0 | 0/0 |
| unaided controlled/free | null/null | null/null |
| review ratio | 0.875 | 0.9355 |
| repetition (same target) | 10 | 10 |
| findings | EXCESSIVE_TARGET_REPETITION, REVIEW_STARVATION, TARGET_STAGNATION | EXCESSIVE_TARGET_REPETITION, REVIEW_STARVATION, TARGET_STAGNATION |

### fast-learner (n=100)

| métrica | V2.8 (antes) | V2.9 (modality paths) |
|---|---|---|
| modality balance | reading:29 listening:40 speaking:31 | reading:42 listening:30 writing:9 speaking:19 |
| capability depth | recognition:53 comprehension:16 controlled_production:17 free_production:14 | recognition:50 comprehension:22 controlled_production:16 free_production:12 |
| writing opportunity (elig/sel) | 0/0 | 61/9 |
| unaided controlled/free | 0.2353/0.7143 | 0.1875/0.5833 |
| review ratio | 0.0638 | 0.0309 |
| repetition (same target) | 18 | 18 |
| findings | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP |

### struggling (n=100)

| métrica | V2.8 (antes) | V2.9 (modality paths) |
|---|---|---|
| modality balance | reading:41 listening:35 speaking:24 | reading:41 listening:36 writing:8 speaking:15 |
| capability depth | recognition:67 comprehension:9 controlled_production:19 free_production:5 | recognition:69 comprehension:8 controlled_production:23 |
| writing opportunity (elig/sel) | 0/0 | 48/8 |
| unaided controlled/free | 0.3684/0 | 0/null |
| review ratio | 0.4085 | 0.4493 |
| repetition (same target) | 10 | 10 |
| findings | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, TARGET_STAGNATION |

### cross-pack (n=100)

| métrica | V2.8 (antes) | V2.9 (modality paths) |
|---|---|---|
| modality balance | reading:45 listening:46 speaking:9 | reading:49 listening:46 writing:2 speaking:3 |
| capability depth | recognition:86 comprehension:5 controlled_production:9 | recognition:86 comprehension:9 controlled_production:5 |
| writing opportunity (elig/sel) | 0/0 | 21/2 |
| unaided controlled/free | 0/null | 0/null |
| review ratio | 3.5455 | 3.5455 |
| repetition (same target) | 2 | 2 |
| findings | TARGET_STAGNATION | TARGET_STAGNATION |


## Leitura dos resultados

- **Writing ganhou caminho curricular real** onde produção está desbloqueada:
  new-learner 49/9, support-dependent 51/24, fast-learner 61/9, struggling
  48/8, cross-pack 21/2 (eligible/selected). Não há paridade 50/50 forçada — a
  distribuição segue estado, runtime e necessidades.
- **weak-listener e forgetful seguem 0/0**: essas jornadas nunca desbloqueiam
  produção no horizonte (listening fraco domina a atenção; review domina o
  forgetful). Writing não é *curricularmente elegível* — portanto NÃO é
  starvation (o analyzer, opportunity-aware, corretamente não emite
  `MODALITY_STARVATION`).
- **Efeito compositivo esperado no horizonte fixo de 100:** new-learner e
  support-dependent trocaram uma free production marginal (4 e 1 interações na
  V2.8) por cobertura de controlled em DUAS modalidades (writing começa
  supported — word_bank/model — daí a queda do unaided controlled de
  new-learner 0.45→0.03). O fast-learner continua atingindo free production
  (12 interações, 58% unaided). É redistribuição de prática dentro da mesma
  janela, não regressão de capacidade (nenhum peso mudou); os sanity checks
  §19 seguem satisfeitos.
- Findings graves: 0 em todas as personas. `MODALITY_STARVATION`: 0 ocorrências.

## Regra de decisão para a Fase B (§19)

| pergunta | resposta |
|---|---|
| candidate exists? | Sim — writing gap gerado em toda persona com produção desbloqueada |
| eligible opportunities? | Sim — 21 a 61 por jornada de 100 |
| selected opportunities? | **Sim — 2 a 24 por jornada** (writing é escolhido) |
| competing candidate? | introduce/novelty vence no início (correto: currículo fresco) |
| score difference? | writing gap 1.875 vs introduce 3.875 no passo 0; após o orçamento de novidade, writing vence |

## Decisão

**Fase B não foi necessária. Nenhum peso foi alterado.**

Writing passou a ser elegível E selecionado em todas as personas apropriadas —
o problema era de **geração de candidatos**, não de prioridade/seleção. As
policy versions permanecem: planner v1, engine v1, observability v1.
