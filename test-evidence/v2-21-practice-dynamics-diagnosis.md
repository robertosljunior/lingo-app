# V2.21 — diagnóstico da repetição e da trajetória travada (P0-A + P0-B)

Base: `d45d481` (merge do PR #46). Nada de pedagogia foi alterado para produzir
este documento — ele é resultado de medição.

Reprodução: `node scripts/audit-practice-dynamics-v2.mjs`
(persona `real-successful`, cenário `real-successful-60`: 5 sessões × 12
atividades, rotação de sessão a cada 12 = apertar "Praticar agora" de novo).

## 1. O bug reproduzido

60 atividades, learner acertando:

| métrica | valor |
|---|---|
| exemplares únicos | **6** em 60 atividades |
| `unique_exemplar_ratio` | 0.10 |
| `exact_text_repeat_rate` | 0.90 |
| `immediate_exact_repeat_rate` | 0.35 |
| `rolling_12_unique_exemplars` | min 3 · média 4.08 · max 5 |
| distribuição de capability | `recognition: 60` — **100%** |
| recipes que apareceram | `exposure`, `meaning_recognition`, `listening_recognition` |
| recipes que NÃO apareceram | `fixed_element_completion`, `word_order_reconstruction`, `guided_production`, `free_production` |

Frases mais frequentes: `I still live here.` (16×, 27%),
`I'm not ready yet.` (10×), `Yet another email arrived this morning.` (10×),
`I am tired, but I am happy.` (9×, 15%), `I am still tired.` (9×).

Isso reproduz exatamente o relato de uso real.

## 2. Hipóteses do brief que a medição DERRUBOU

**§6 — "o Planner escolhe continuamente o mesmo target".** Falso, e pelo motivo
oposto: `focus_switch_rate = 1.0`. O Planner troca de foco em **todas** as 60
interações. O problema não é falta de rotação de foco; é excesso.

**§9 — "o acceptable band anula a diversidade".** Falso. Em **todos** os 60
passos: `same_focus_candidates = 1` e `band_size = 1`. O band nunca cortou nada
— o pool já chegava com uma única realização. `band_collapsed_steps = 0`.
Portanto a diversidade LEVEL 2 (V2.19) não tem o que escolher, e mexer nela não
resolveria nada.

Classificação §4: a causa **não** é A, B, C, E nem F. É **D** (a Engine recebe
um foco cujo pool elegível tem exatamente 1 realização), com a causa de D sendo
a trajetória travada — abaixo.

## 3. Causa raiz (provada, um único mecanismo)

Aritmética do modelo de learner:

- atividades de recognition são múltipla escolha → support tier `high` → peso
  **0.4** por evento (`SUPPORT_TIER_WEIGHT.high`);
- o nível `emerging` exige peso efetivo ≥ **2** (`EVIDENCE_LEVEL_THRESHOLDS`);
- a barra `advancement` exige `min_mastery 0.7` **e** `min_evidence_level emerging`.

Logo são necessárias **exatamente 5** respostas certas na **mesma**
(target, capability, modality):

| eventos | peso | mastery | nível | avança? |
|---|---|---|---|---|
| 3 | 1.20 | 0.6875 | insufficient | não |
| 4 | 1.60 | 0.7222 | insufficient | **não** |
| 5 | 2.00 | 0.7500 | emerging | sim |

Estado final após as 60 atividades: **24 lanes** com evidência, apenas **5**
cruzaram a barra, e o histograma de `assessed_evidence_count` é
`{1:2, 3:1, 4:11, 5:6, 7:1, 8:1, 10:1, 13:1}` — **11 lanes paradas em
exatamente 4**, uma resposta abaixo da barra.

O mecanismo que produz isso está em `study-planner.js`: o candidato de
consolidação pontua `capability_gap = 1 - mastery`. Conforme o learner acerta, a
mastery **sobe** e o score do candidato **cai**. A lane que está a uma resposta
de avançar é a menos atraente do ranking, e o Planner rotaciona para uma lane
mais "carente". Nenhuma lane fecha.

Consequência em cadeia, que explica os dois P0 de uma vez:

```
nenhuma lane cruza a barra
  → nenhum degrau de capability abre (100% recognition)
  → os exemplares mais profundos continuam bloqueados por prerequisites
    (233 exclusões prerequisite_unmet no run)
  → cada foco chega à Engine com 1 realização elegível
  → as mesmas 6 frases reciclam para sempre
```

Exclusões da Engine no run (por que o pool é 1): `not_targeted 1261`,
`prerequisite_unmet:* 233`, `prerequisite_unknown:* 69`,
`not_focus_capability 126`, `exemplar_cooldown 42`, `not_focus_modality 18`.

## 4. Tentativa de correção e por que foi revertida

Implementei um componente `consolidation_readiness` no Planner (peso novo
`consolidation_weight`): quando a lane já **passa** da barra de mastery e está
retida só por volume de evidência, priorizar terminá-la ("termine o que você
quase sabe antes de abrir algo novo").

Varredura de peso sobre a jornada real:

| peso | lanes avançadas | exemplares únicos | capabilities | recipes novos |
|---|---|---|---|---|
| 0 (atual) | 5 | 6 | recognition 60 | — |
| 1 | 9 | 7 | + comprehension 2 | — |
| 2 | 5 | 7 | + comprehension 3 | — |
| **3** | 4 | **9** | + **controlled_production 2** | **guided_production, fixed_element_completion** |
| 4–6 | 4 | 9 | igual a 3 | igual a 3 |

Em `w=3` a produção controlada finalmente aparece no pipeline REAL — a primeira
vez que `guided_production` e `fixed_element_completion` foram selecionados.

**Mas** o golden de 200 interações da persona `struggling` passou a acusar
`LONG_HORIZON_TARGET_LOOP` (um target com **54%** de share na janela tardia).
Testei dois limites para conter isso:

1. "nearly met" restrito a uma resposta não-assistida da barra → o loop
   permanece;
2. gap mínimo de recência por lane (§7, derivado da evidência já persistida) →
   com gap 1, 2 ou 3 o loop some **mas o desbloqueio também some**: volta a
   `recognition 60`, 6 exemplares, 3 recipes.

Ou seja: **a consolidação só produzia progressão enquanto podia acampar na
lane**, que é exatamente o comportamento que o analisador de longo horizonte
condena. O ganho e o defeito eram o mesmo efeito. Revertido — não vou entregar
uma calibração que só passa porque um golden foi afrouxado.

## 5. Direção correta indicada pela evidência

O gargalo não é priorizar consolidação: é **largura**. Em 60 atividades o
Planner abre ~28 lanes (novos targets + expansão de modalidade) mais rápido do
que qualquer lane consegue acumular os 5 eventos. Enquanto a largura crescer
livremente, nenhuma profundidade fecha.

A correção deve limitar a **abertura de lanes novas** enquanto houver lanes
inacabadas — um gate sobre os candidatos de `novelty` / modality-gap, não um
bônus sobre consolidação. Isso mantém a rotação de foco (que é saudável) e
permite que as lanes existentes fechem sem acampar em nenhuma delas.

Alternativa complementar a avaliar com a mesma régua: a barra de 5 respostas
assistidas para recognition pode simplesmente ser alta demais para um pack com
poucos exemplares por target — nesse caso o ajuste é de política de evidência,
não de Planner. As duas hipóteses são mensuráveis com o mesmo harness.

## 6. Instrumentação entregue (permanente)

- persona `real-successful` e cenário `real-successful-60`;
- `experience_diversity.pool` na trace da Engine (`same_focus_candidates`,
  `band_size`, `fresh_candidates`, `band_recipes`, `band_exemplars`);
- motivos de exclusão e frontier stage por interação no simulation-runner;
- `scripts/audit-practice-dynamics-v2.mjs` — trace cronológico das 60
  atividades, métricas de repetição (§13), distribuição do band (§9),
  trajetória de capability (§15) e finding de recipe starvation (§18).

Nenhum desses itens altera decisão pedagógica: são medição.
