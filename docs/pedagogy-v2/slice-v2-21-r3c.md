# Slice V2.21-R3c — Scale-Safe Adaptive Frontier + Coverage Closure

**Problema.** O PR #52 (R3b) entregou o Active Frontier e desbloqueou a
progressão no catálogo real, mas deixou uma falha ESTRUTURAL: a política
dependia acidentalmente de existirem apenas três packs. Com catálogo sintético
maior, o MESMO learner (mesmo horizonte, mesma seed, mesmas respostas corretas)
perdia a escada:

| packs | rec | comp | controlled |
| --- | --- | --- | --- |
| 3 | 43 | 11 | **6** |
| 6 | 49 | 8 | **3** |
| 9 | 58 | 2 | **0** |
| 12 | 58 | 2 | **0** |

Isso bloqueava a V2.22, que adiciona packs.

**Base.** `ace0dcd754ba1c490dd8e6ea4d096df4d9b0491c` (merge do PR #52).

| Componente | Antes | Depois |
| --- | --- | --- |
| DB_VERSION | 5 | **5** (nenhuma alteração física) |
| LEARNER_MODEL_VERSION | 1 | 1 |
| AGGREGATION_VERSION | 2 | **2** (congelado — §1) |
| STUDY_PLANNER_V2_VERSION | 1 | **1** (contrato estrutural inalterado) |
| STUDY_PLANNER_POLICY_VERSION | 2 | **3** |
| LESSON_ENGINE_V2_VERSION | 3 | 3 |
| LESSON_ENGINE_POLICY_VERSION | 4 | **4** (recipe selection NÃO mudou — §16) |
| PEDAGOGY_V2_REGISTRY_VERSION | 1 | 1 |

Nenhum conteúdo autorado foi alterado. Nenhum pack novo entrou no produto.

---

## 1. Harness de escala (§3)

`synthetic-scale-catalog.js` clona os três packs reais em "gerações"
(`pedagogy_v2_still_sg1`, …). Cada geração é uma cópia auto-contida do grafo
curricular: todos os ids possuídos são reescritos, as dependências declaradas
apontam para os clones da própria geração, e as relações cross-pack
still↔but↔yet continuam cross-pack dentro da geração. Os clones passam pelo
MESMO validador do registry — o harness não mede um catálogo mais fraco.

- `buildSyntheticScaleRegistryV2(3)` devolve exatamente o catálogo builtin, então
  a linha "3 packs" da curva é o baseline do produto, não uma aproximação.
- Nada disso entra em `BUILTIN_PEDAGOGY_V2_PACKS` (garantido por teste).

`scripts/audit-catalog-scale-v2.mjs` (`npm run audit:catalog-scale-v2`) roda
3/6/9/12 packs e registra packs, targets, exposed, assessed, active, working
set, introductions, cross-pack, deepen, review/remediation, capability e recipe
distribution.

## 2. Primeira divergência (§4) e trace de candidatos

Primeira divergência estrutural entre 3 e 12 packs: **atividade 6**.

| | 3 packs | 12 packs |
| --- | --- | --- |
| focus_type | `deepen` | `introduce` |
| target | `construction:still.subject_still_lexical_verb` | `…_sg3` |
| recipe | `meaning_recognition` | `exposure` |

Ranking de candidatos na atividade 6:

- **3 packs** (18 considerados) — topo: `deepen … 1.688`, `deepen … 1.688`,
  `deepen … 1.688`. As introduções em frontier já haviam se esgotado.
- **12 packs** (44 considerados) — topo: `introduce … 3.875`,
  `introduce … 3.875`, `introduce … 3.875`, todos de packs clonados.

O candidato vencedor e o porquê: uma introdução com `novelty_value = 1` e
`curriculum_frontier = 1` pontua no TETO e nunca decai; um deepen decai à medida
que evidência se acumula. O número de introduções no teto cresce com o catálogo,
o deepen não. Portanto `max(introduções)` supera `max(deepen)` cada vez mais
cedo conforme N cresce — e no passo 6 a penalidade de working set nem sequer
estava ativa, porque ela só liga depois de `working_set_size` targets já
avaliados.

## 3. Classificação da causa (§5)

**F. INTRODUCTION_PRESSURE**, habilitada mecanicamente por
**B. PACK_MULTIPLICATION**, com contribuição de **D. WORKING_SET_DEFINITION**.

Refutadas por medição:

- **A. CROSS_PACK_EXEMPTION_LEAK** — `cross_pack_progression` selecionado
  **0 vezes** em 3, 6, 9 e 12 packs (§6). A isenção não é o defeito de escala.
  Por isso a semântica da isenção NÃO foi alterada e a distinção de duas classes
  de transferência (§7) NÃO foi implementada: o trace não a justifica.
- **G. PACK_COHERENCE** e **H. CROSS_PACK_RELATION_SCALING** — a divergência
  ocorre antes de qualquer switch e sem bônus de relação nos vencedores.
- **I. RESOLVER/MATERIALIZATION** — `focus resolution rate = 1`,
  `no_materializable = 0` em todos os cenários.

## 4. Auditoria da definição de ACTIVE (§8)

O working set do R3b derivava de "tem assessed evidence" e ordenava por
depth + weight histórico. Ele incluía targets sem trabalho materializável — só
aguardando retenção, ou já consolidados no rung — que ocupavam slot de
profundidade sem consumir orçamento.

**ACTIVE passa a ser**: exposto + existe trabalho pedagógico atual
materializável + o próximo avanço ainda não foi concluído. Isso é derivado dos
PRÓPRIOS candidatos do snapshot: um target é ativo sse este snapshot produziu um
candidato `deepen`/`remediate` para ele. `review` fica de fora de propósito —
quem só espera retenção não consome profundidade. Não há segunda definição para
manter em sincronia com os filtros.

Um target recém-introduzido (exposto, ainda sem avaliação) também é ativo: seu
trabalho atual é a primeira avaliação. Sem isso o planner podia abrir um target e
nunca mais praticá-lo (observado: um state com zero lanes sobrevivendo a 120
atividades).

**Ranking (§9).** Mediu-se restringir o peso ao rung aberto atual em vez do total
histórico: não mudou NENHUM resultado em 3/6/9/12 packs. A ordenação simples do
R3b foi mantida (depth, weight, id) — §9 pede não criar fórmula complexa sem
necessidade. Depth vem primeiro, então um target nunca cai do frontier por
AVANÇAR.

## 5. Correção (§23/§24)

Duas partes:

1. **Definição** — acima.
2. **Gate de largura em selection, não peso.** Enquanto o frontier ativo está em
   capacidade E existe trabalho de profundidade real DENTRO dele, abrir mais um
   target é suprimido. Nenhuma penalidade finita resolveria isso: sempre existe
   um N que faz `max(introduções)` vencer de novo. O gate depende apenas das
   alternativas internas, então é invariante ao tamanho do catálogo por
   construção.

Não pode travar (§9): a supressão só se aplica quando um candidato interno,
progress-bearing, sobreviveu aos filtros duros. Quando a profundidade acaba, as
introduções voltam a ser elegíveis no passo seguinte.
`cross_pack_progression` permanece isento (§6, medido em zero).

**Nenhum pack é escondido** (§24): o planner continua ranqueando sobre todos.
Nenhum mecanismo curricular novo foi criado (§25).

### `working_set_size` 8 → 6

A grandeza mudou de significado: sob a definição do §8 um slot é um target
genuinamente inacabado, então "8 slots" antigos valiam menos que 8 reais. O
sweep 3/4/5/6/8 × 3/6/9/12 packs mostra 6 como o maior tamanho que ainda produz
controlled production em 60 atividades (8 → 2 no catálogo real; 6 → 8) mantendo
top-target share abaixo de 0.35 no produto (3, 4 e 5 estouram). O diagnóstico
veio antes (§2), e é o gate que torna o número invariante à escala.

## 6. Escala antes/depois (§12)

**Depois:**

| packs | exposed | active mean | introductions | deepen | rec | comp | controlled |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 6 | 4.67 | 3 | 57 | 37 | 15 | 8 |
| 6 | 5 | 3.75 | 3 | 57 | 38 | 16 | 6 |
| 9 | 5 | 3.48 | 3 | 57 | 34 | 15 | 11 |
| 12 | 5 | 3.82 | 3 | 57 | 35 | 17 | 8 |

| packs | top target | unique targets | unique exemplars | immediate repeat |
| --- | --- | --- | --- | --- |
| 3 | 0.317 | 6 | 15 | 21 |
| 6 | 0.383 | 5 | 17 | 28 |
| 9 | 0.400 | 5 | 16 | 29 |
| 12 | 0.417 | 5 | 16 | 34 |

Degradação gradual, sem quebra de fase. O active frontier NÃO cresce com o
catálogo (§23): antes 9 → 19 → 23 exposed; agora 6 → 5.

## 7. adaptive-60 antes/depois (§22)

| | PR #52 | R3c |
| --- | --- | --- |
| capabilities | rec 43 / comp 11 / **ctrl 6** | rec 37 / comp 15 / **ctrl 8** |
| `word_order_reconstruction` | sim | **sim** (2) |
| `guided_production` | sim | **sim** (5) |
| `fixed_element_completion` | **não** | **sim** (1) |
| top target share | 0.317 | **0.317** |
| exposed / active mean | 9 / 7.17 | 6 / 4.67 |

Free production não é exigida em 60 e não aparece — correto.

## 8. Fixed element completion (§14) e context recognition (§17)

**`fixed_element_completion`** tinha oportunidade real (16 no adaptive-60) e
agora é servido. A ausência anterior não era starvation de recipe: era falta de
controlled production a montante. Nada mudou no Engine (§16) e
`LESSON_ENGINE_POLICY_VERSION` continua 4.

**`context_recognition`** foi **refutado** como starvation. Ele é um
*presentation variant* (`presentation_variant_of: meaning_recognition`): o Engine
o pula explicitamente ao pontuar candidatos, e ele só substitui a apresentação de
uma atividade já escolhida quando a MESMA forma repete na sessão. A métrica que
gerava o achado contava oportunidades do DOMÍNIO de capability (24–31); a
pré-condição real do recipe foi atingida no máximo uma vez em 60/120/36
atividades. O analyzer passa a emitir `RECIPE_LOW_OPPORTUNITY_BY_DESIGN`
(informativo) em vez de `RECIPE_REACHABLE_BUT_STARVED`. Context recognition não
foi forçado (§17).

## 9. Storage singular read (§18)

Auditado: `getLearnerTargetStateV2` **não tem call site de produção**. Todo fluxo
learner-facing lê pelo plural `getLearnerTargetStatesV2`, que chama
`ensureLearnerTargetStatesCurrentV2` antes. Os únicos chamadores são testes que
inspecionam a linha PERSISTIDA de propósito — inclusive o teste que degrada a
versão para provar a reconciliação no plural.

Portanto o código ficou **intacto** (§18) e a conclusão virou invariante: um
teste falha se qualquer módulo não-teste passar a chamar a leitura singular.
`DB_VERSION` continua 5.

## 10. Engine Policy documentation (§20)

`lesson-engine-contracts.js` dizia que o recipe share é medido sobre
`(capability, modality)`; `lesson-engine.js` filtra o histórico só por
capability, e é esse o comportamento aprovado pelos testes. **O comentário estava
errado, o comportamento não** — o contrato foi corrigido e o Engine não foi
tocado.

## 11. Limitações remanescentes

- Com catálogo sintético grande o top-target share sobe para 0.417 (bound do
  regression: 0.45). No catálogo do produto continua 0.317. O frontier fica mais
  estreito com mais packs porque menos targets têm trabalho atual ao mesmo
  tempo; vale reavaliar quando a V2.22 trouxer packs reais.
- `real-successful-120` passou a emitir o warning informativo
  `EXCESSIVE_TARGET_REPETITION` (não emitia antes) — é o custo de concentração
  do frontier mais estreito. Nenhum finding de severidade `error` em nenhum
  cenário.
- `word_order_reconstruction` continua com 0 seleções em `but-focused-36` e
  `yet-focused-36` (tem oportunidade, mas o share cap escolhe a alternativa
  equivalente). Não é regressão desta rodada.
