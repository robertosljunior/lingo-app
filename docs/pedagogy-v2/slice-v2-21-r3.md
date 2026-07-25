# Slice V2.21-R3 — Capability Progression & Exercise Reachability

**Problema (P0-B).** Um learner que acerta ficava preso indefinidamente em
recognition. No cenário real `real-successful-60` a distribuição de capability
era literalmente `{ recognition: 60 }`: word order, completion, guided writing
e free production nunca apareciam.

**Base.** `2c2bf3b6916a8be2a99fc46fecd3a2945fea5b0c` (merge do PR #50).

| Componente | Antes | Depois |
| --- | --- | --- |
| DB_VERSION | 5 | **5** (schema físico inalterado) |
| LEARNER_MODEL_VERSION | 1 | 1 |
| AGGREGATION_VERSION | 1 | **2** |
| LEARNER_EVIDENCE_SCHEMA_VERSION | 1 | 1 (evidence é imutável) |
| STUDY_PLANNER_V2_VERSION | 1 | 1 |
| STUDY_PLANNER_POLICY_VERSION | 1 | 1 (nenhum peso do Planner mudou) |
| LESSON_ENGINE_V2_VERSION | 3 | 3 |
| LESSON_ENGINE_POLICY_VERSION | 3 | **4** |
| PEDAGOGY_V2_REGISTRY_VERSION | 1 | 1 |

Nenhum conteúdo autorado foi alterado nesta slice.

---

## 1. Instrumento antes de política (§1/§2)

`scripts/audit-capability-progression-v2.mjs` + `capability-progression-analyzer.js`
rodam o pipeline REAL (sem mocks, sem forced-plan, contrato de resposta real) e
produzem §3 trace por interação, §4 fragmentação, §5 introduction groups,
§7 modalidade, §8 support, §9 opportunity trace, §10 causa, §11 funil,
§12 primeiro bloqueio, §27 matriz de reachability, §28 findings.

Nenhum threshold, weight ou gate foi tocado antes desse diagnóstico.

## 2. Diagnóstico medido (baseline pós-PR #50)

Funil de `real-successful-60` **antes** de qualquer mudança:

```
exposed                    12
recognition evidence       12
recognition advancement     4   ← todos os 4 eram SENSES
comprehension evidence      0
controlled evidence         0
free evidence               0
```

### §5 — attribution dos introduction groups (pergunta obrigatória)

Sim, membros de um mesmo grupo distribuem `plan.primary_target` entre targets
diferentes (`intro:but.contrast_clause` alterna entre `sense:but.contrast` e
`construction:but.clause_but_clause`). **Mas o efeito sobre a progressão é
nulo**, e isso é o achado: a evidência DIRETA não segue `plan.primary_target`,
segue o `attribution_rule` da recipe. Em `meaning_first`, sense/function
recebem `direct` e construction recebe `indirect` — em TODOS os membros do
grupo, independentemente da ordem. A ordenação do PR #50 é portanto neutra
aqui. Classificação: **neutra, não fragmentante**. Nada a corrigir.

### §10 — causa do primeiro bloqueio: `MODALITY_FRAGMENTATION` (categoria C)

5 dos 12 targets tinham peso agregado ≥ 2.0 em recognition com 100% de acertos
e **nenhuma lane isolada acima da barra**:

| target | reading | listening | agregado |
| --- | --- | --- | --- |
| `construction:yet.yet_another_np` | 1.2 | 1.2 | 2.4 |
| `construction:still.subject_still_lexical_verb` | 1.0 | 1.4 | 2.4 |
| `construction:but.clause_but_clause` | 1.0 | 1.2 | 2.2 |
| `construction:yet.subject_be_not_complement_yet` | 1.0 | 1.0 | 2.0 |
| `function:signal_unexpected_repetition` | 1.2 | 1.2 | 2.4 |

Praticar as DUAS modalidades punia o learner: cada lane recebia metade da
evidência e nenhuma alcançava `emerging` (peso 2.0). Não era "a barra é alta" —
a barra estava sendo aplicada à população errada de evidência.

## 3. Correção 1 — advancement é uma pergunta sobre a CAPABILITY (§13)

`AGGREGATION_VERSION 2` adiciona `capability_rollups`: as MESMAS lanes,
dobradas por capability através das suas modalidades. As fórmulas, os pesos e
os números do threshold são **idênticos** — muda apenas o conjunto de evidência
ao qual a barra se aplica.

Uma única cláusula do gate mudou:

```
comprehension:  ANTES  exposure && lane[modality_recognition] ≥ advancement
                AGORA  exposure && rollup[recognition] ≥ advancement
                       && lane[modality_recognition].assessed_count > 0
```

`controlled_production` já era cross-modality (`anyKeyMeets` sobre as chaves de
recognition); o rollup apenas enuncia isso diretamente.

**O que NÃO mudou, deliberadamente:**

- **§6** Lexeme / Sense / Construction / Communicative Function continuam
  unidades distintas. Não existe mastery global da palavra. Rollup é por
  capability DENTRO de um target, nunca entre targets.
- **§7** As lanes por modalidade continuam existindo e continuam governando
  modality expansion, independence unlock, retention e review queue. O learner
  que só leu **não** entra em listening comprehension — a modalidade precisa ter
  evidência própria, só não precisa carregar a barra sozinha.
- **§24** `free_production` mantém o prerequisite de MESMA modalidade
  (`writing_controlled_production` para escrever). Modalidades produtivas são
  habilidades separadas: ter falado não libera escrever.
- **§17** A barra não foi reduzida. Para quem pratica uma só modalidade o
  resultado é idêntico. O mastery smoothed continua ≥ 0.7 sobre a evidência
  agregada, então `struggling` continua não avançando (regressão §17).

## 4. Correção 2 — recipe share dentro da capability (§21/§22/§28)

Após a correção 1, controlled production passou a existir — mas
`guided_production` tomava **todos** os slots e `word_order_reconstruction`
nunca era servida, emitindo `RECIPE_REACHABLE_BUT_STARVED`.

Causa (categoria H, `RECIPE_STARVATION`): o controle de monotonia existente
media apenas STREAK consecutivo sobre a mesma construction. Com as constructions
rodando, o streak nunca acumulava, embora a recipe dominasse a capability.

Correção: a monotonia passa a ser medida **também como share** sobre as últimas
`recipe_share_window` (8) atividades da capability do anchor; se a recipe do
anchor detém mais de `recipe_share_max` (0.5) delas com pelo menos
`recipe_share_min_observations` (3) ocorrências, e existe alternativa
equivalente na banda aceitável, a alternativa é preferida.

Não é cadência forçada: sem alternativa na banda nada muda, e o FOCO (target,
capability, modality, lane) nunca é alterado — apenas a realização.
`LESSON_ENGINE_POLICY_VERSION 3 → 4`.

## 5. Resultado (§11/§25/§26)

| cenário | funil (exposed → rec.ev → rec.adv → comp.ev → comp.adv → ctrl.ev → ctrl.adv → free.ev) |
| --- | --- |
| real-successful-60 | 10 → 10 → 7 → 5 → 0 → 0 → 0 → 0 |
| real-successful-120 | 12 → 12 → 10 → 8 → 4 → 7 → 3 → 0 |
| real-successful-200 | 15 → 15 → 14 → 12 → 10 → 12 → 9 → 2 |
| still-focused-36 | 3 → 3 → 2 → 2 → 1 → 2 → 1 → 0 |
| but-focused-36 | 3 → 2 → 2 → 2 → 2 → 2 → 1 → 0 |
| yet-focused-36 | 7 → 7 → 3 → 2 → 1 → 2 → 0 → 0 |

Recipes servidas em `real-successful-120`:
`listening_recognition 44, meaning_recognition 45, guided_production 13,
fixed_element_completion 7, word_order_reconstruction 4, context_recognition 1,
exposure 6`.

O usuário agora **vê** scramble, completion e escrita guiada.

### Desvio explícito do §26

`real-successful-60` alcança recognition e comprehension, mas **não**
controlled production. Isso não é bloqueio de conteúdo nem de gate — é
aritmética de horizonte, e ela é demonstrável:

- a barra `emerging` exige peso efetivo 2.0;
- toda recognition assistida (multiple_choice = tier `high`) vale 0.4;
- logo são necessários 5 eventos DIRETOS corretos por target;
- o modo adaptive espalha 60 atividades por 3 packs / 12 targets, ou seja
  ~5 eventos diretos por target — exatamente no limiar.

Por isso o primeiro target só cruza a barra por volta da atividade 40 e sobra
pouca pista. Em 120 atividades (≈ 10 sessões) controlled production aparece com
as três recipes. Nos cenários FOCUSED — que é o que o Home oferece em "Escolher
prática" — controlled production já aparece dentro de 36 atividades.

Comprar esse resultado em 60 atividades exigiria ou baixar a barra (proibido
pelo §17) ou concentrar prática em menos targets (target camping, proibido pelo
§18). Nenhuma das duas foi feita.

### §19 — variedade preservada

| cenário | unique exemplars | immediate repeat |
| --- | --- | --- |
| still-focused-36 | 8 | 0.000 |
| but-focused-36 | 8 | 0.000 |
| yet-focused-36 | 10 | 0.028 |
| real-successful-60 | 21 / 60 | 0.033 |

A repetição imediata melhorou ou empatou em todos os casos. A contagem de
exemplares únicos caiu ligeiramente (9→8, 11→8, 11→10, 24→21) porque a jornada
agora gasta atividades em rungs superiores, que têm menos exemplares elegíveis
— redistribuição legítima prevista pelo §19. Continua muito acima do colapso
proibido (6 únicos / 60, uma frase dominando).

`LONG_HORIZON_TARGET_LOOP` e `PREMATURE_FREE_PRODUCTION` continuam ativos e
não foram afrouxados.

## 6. Estado persistido (§15/§16)

`capability_rollups` é dado DERIVADO; `learner_evidence_v2` não mudou de schema
nem de conteúdo. Como a interpretação da evidência mudou,
`ensureLearnerTargetStatesCurrentV2()` reconstrói determinísticamente
`learner_target_states_v2` a partir da evidence imutável sempre que encontra
uma linha com `aggregation_version` antigo, na leitura do perfil.

Nunca há delete de evidence, reset de perfil ou "começar do zero" (§16). A
regressão `upgrade → rebuild` prova que o perfil migrado é idêntico ao
reconstruído do zero sob a política nova. `DB_VERSION` permanece 5 porque
nenhum store ou índice mudou.

## 7. Findings remanescentes (não silenciados)

- `RECIPE_REACHABLE_BUT_STARVED:context_recognition` — continua sendo emitido.
  `context_recognition` só é alcançada pelo swap de apresentação em
  comprehension/reading e raramente vence. Fica registrado como próximo alvo,
  não corrigido nesta slice (uma mudança por hipótese, §13).
- `real-successful-200` ainda mostra `free_production_evidence` baixo (2 de 9
  targets com controlled advancement). Free production é posterior por design
  (§24) e não foi perseguida como sucesso isolado.
