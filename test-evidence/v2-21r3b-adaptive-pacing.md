# V2.21-R3b — Adaptive Depth Pacing

Base: `598448a` (merge do PR #51). Nenhuma alteração em pesos de evidência,
thresholds de advancement, fórmulas de mastery, rollups de capability, semântica
de support tier ou prerequisite de free production (§1). `AGGREGATION_VERSION` e
Engine Policy 4 intocados (§20). `STUDY_PLANNER_POLICY_VERSION` 1 → **2**.

## §4 — a hipótese de pacing foi REFUTADA na forma proposta

O brief supunha que "adaptive abre targets mais rápido do que consegue
aprofundá-los". A medição diz o contrário:

| | valor (PR #51) |
|---|---|
| targets expostos em 60 atividades | **9** |
| seleções de novo target | **5** |
| seleções de deepen | **55** |
| razão new/deepen | **0.09** |
| introduções após a janela 3 | **0** |

Adaptive quase não abre largura. O gargalo é **latência por target**: 55 slots
de deepen divididos por 9 targets ativos dão ~6 atividades cada, e um degrau
exige 5 acertos na MESMA lane. A latência média entre a primeira exposição e
comprehension era **42.75 atividades**.

Diluição, não novidade.

## §6 — Active Frontier (working set)

Implementado como política do Planner, derivada do learner state (§8: sem store
novo, `DB_VERSION` inalterado — a sessão 2 reconstrói o mesmo conjunto que a
sessão 1 deixou em progresso).

Ranking determinístico e pedagógico: targets ativos ordenados por profundidade,
depois peso de evidência, depois id. Os `working_set_size` primeiros formam o
conjunto. Fora dele:

- candidatos de **deepen** são penalizados (diluem o orçamento de profundidade);
- **introduções** são penalizadas quando o conjunto está cheio — foi isso que
  fez o pacing sobreviver a um catálogo maior (§16);
- **cross-pack transfer é isento**: encontrar uma ideia conhecida num pack novo
  é o retorno pedagógico de um currículo multi-pack, não largura gratuita. O
  golden do `yet` concessivo prova que precisa sobreviver.

Nunca exclusão, sempre penalidade — o Planner jamais trava, e a §9 mantém
novidade alcançável quando não há profundidade disponível.

## §7 — calibração por medição

| working_set_size | recognition | comprehension | controlled | recipes controlled | uniq ex | top target | imediata | loops |
|---|---|---|---|---|---|---|---|---|
| off (PR #51) | 53 | 7 | **0** | — | 21 | 0.20 | 0.033 | 1 |
| 3 | 37 | 13 | 10 | guided, completion | 18 | **0.40** ✗ | 0.000 | 2 |
| 4 | 39 | 14 | 7 | guided, completion | 19 | **0.42** ✗ | 0.017 | 2 |
| 6 | 44 | 10 | 6 | guided, completion | 23 | 0.33 | 0.000 | 3 |
| **8** | 43 | 11 | **6** | guided, word order | 19 | **0.32** | **0.000** | **1** |

`8` é o único que atende o §13 (top target < 0.35, repetição imediata ≤ 0.06,
top exemplar 0.117 < 0.30) **e** mantém os loops no nível do baseline. Os
tamanhos 3 e 4 dão mais profundidade, mas compram-na com concentração de target
acima do limite — rejeitados.

## §21 — before / after (adaptive 60)

| métrica | PR #51 | final |
|---|---|---|
| recognition | 53 | 43 |
| comprehension | 7 | **11** |
| controlled_production | **0** | **6** |
| free_production | 0 | 0 (posterior, correto) |
| word_order_reconstruction | ausente | **3** |
| guided_production | ausente | **3** |
| fixed_element_completion | ausente | ausente neste run |
| latência até comprehension | 42.75 | **33** |
| latência até controlled | — | 45 |
| exemplares únicos | 21 | 19 |
| repetição imediata | 0.033 | **0** |
| top exemplar share | — | 0.117 |
| top target share | 0.20 | 0.32 |

## §11 — acceptance parcial, declarada

Aparecem em 60: recognition, comprehension, controlled_production,
`word_order_reconstruction`, `guided_production`.
**Não aparece: `fixed_element_completion`.**

Com apenas 6 atividades de produção controlada em 60 e três recipes elegíveis, a
cobertura das três é parcial por construção. Não forcei cadência (§12): em
`size=6` a completion aparece e o word order some — é a mesma escassez vista de
outro ângulo. Em `real-successful-120` os três aparecem.

## §15 — focused preservado

| cenário | recognition | comprehension | controlled |
|---|---|---|---|
| still-focused-36 | 21 | 7 | **8** |
| but-focused-36 | 15 | 11 | **10** |
| yet-focused-36 | 24 | 7 | **5** |

Nenhuma regressão; os três chegam a produção controlada dentro de 36.

## §16 — teste sintético de escala: PARCIAL

Clonando os packs autorados sob ids novos (só no harness, nada learner-facing):

| packs no registry | capabilities em 60 | recipes controlled |
|---|---|---|
| 3 (real) | r43 c11 **cp6** | guided, word order |
| 6 | r50 c6 **cp4** | guided, completion |
| 9 | r58 c2 **cp0** | nenhum |

Antes da penalidade de introdução, 6 packs já zerava a produção controlada —
essa parte foi corrigida. **Com 9 packs o pacing ainda degrada para
recognition-only.** É exatamente o risco que a V2.22 traz, e está aberto: o
working set atual limita quem recebe deepen, mas com catálogo grande demais o
Planner ainda encontra introduções suficientes para diluir.

Recomendo tratar isso antes de adicionar os packs da V2.22, e não depois.

## §14 — goldens

`LONG_HORIZON_TARGET_LOOP` no mesmo nível do baseline (1). Nenhum
`PREMATURE_FREE_PRODUCTION`. Nenhum threshold de finding afrouxado, nenhum teste
alterado — a suíte inteira (1320) passa sem edição.

## Pendências não feitas nesta rodada

- **§17** context_recognition starvation — não reexecutei a análise de
  reachability depois do pacing;
- **§18** auditoria de `getLearnerTargetStateV2` (leitura singular);
- **§19** correção da inconsistência documental da Engine Policy 4;
- **§22** a trajetória legível das 60 atividades é impressa por
  `node scripts/audit-adaptive-pacing-v2.mjs`, mas não foi colada aqui.
