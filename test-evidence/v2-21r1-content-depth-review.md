# V2.21-R1 — Target-Aware Content Depth: medição e descoberta estrutural

Base: `924f397` (merge do PR #47). Branch: `claude/v2-21r1-target-content-depth`.

Hipótese sob teste (§25): *"mais densidade materializável resolve a tensão
profundidade × variedade sem mudar a política de evidência."*

**Resultado: refutada na forma proposta.** Adicionar exemplares funciona — e o
ganho medido é grande — mas não é possível fazê-lo dentro das invariantes atuais
do modelo de packs. O detalhe está na §4.

Nenhum peso, threshold, gate, scoring ou semântica de evidência foi alterado.
`npm test` fica em 1259 passando na árvore entregue.

## 1. Instrumento novo (§3/§20)

`scripts/audit-target-content-depth-v2.mjs` — mede profundidade
**materializável** por target, não contagem bruta, e replica os snapshots do
`real-successful-60`. Para cada passo com uma única realização, classifica o
porquê nas categorias da §4.

Uso: `node scripts/audit-target-content-depth-v2.mjs [--json]`

Findings `TARGET_CONTENT_DEPTH_V2` com severidade `critical` / `warning` /
`info` (targets fora do horizonte observado nunca são inflados para bater
quota, conforme §6).

## 2. Gargalos identificados (§5)

Na linha de base, **60 dos 60 passos** chegam à Engine com uma única realização.
Por quê:

| motivo | passos |
|---|---|
| `PREREQUISITE_BLOCKED` | 48 |
| `ONLY_ONE_AUTHORED_PRIMARY_EXEMPLAR` | 12 |

Ranking dos gargalos (passos com realização única):

| target | passos | singleton | primários autorados |
|---|---|---|---|
| `construction:still.subject_still_lexical_verb` | 9 | 9 | 5 |
| `construction:still.subject_be_still_complement` | 9 | 9 | 5 |
| `sense:still.continuity` | 7 | 7 | **1** |
| `construction:yet.subject_be_not_complement_yet` | 7 | 7 | 4 |
| `construction:yet.yet_another_np` | 6 | 6 | 4 |
| `construction:but.clause_but_clause` | 5 | 5 | 4 |
| `sense:but.contrast` | 4 | 4 | **1** |
| `sense:yet.temporal_pending` | 3 | 3 | **16** |

A última linha é a mais informativa: `yet.temporal_pending` tem **16**
exemplares primários e ainda assim entrega uma única realização. Contagem bruta
não prediz nada — só materializabilidade importa (§7).

## 3. O padrão de autoria que causa tudo

Todo item dos três packs segue a mesma estrutura:

- **exatamente um** exemplar de primeiro contato (prerequisites só de
  `grammar_skill_v1`);
- todos os demais exigem como prerequisite **o próprio sense/construction que
  está sendo praticado**.

Exemplo (`construction:still.subject_still_lexical_verb`):

| exemplar | prerequisites |
|---|---|
| `still.001` "I still live here." | `grammar_skill_v1:simple_present` |
| `still.002`–`005` | `sense:still.continuity` **+ `construction:still.subject_still_lexical_verb`** |

A barra de prerequisite é `min_mastery 0.6` + `min_evidence_level emerging` — a
mesma barra que o diagnóstico do PR #47 provou inalcançável na fase inicial. Ou
seja: **durante toda a fase pré-consolidação, cada target tem matematicamente
uma única realização servível.** É exatamente essa a origem de
"I am tired, but I am happy." aparecer sem parar: `sense:but.contrast` tem um
único exemplar primário, o `but.001`.

## 4. Por que conteúdo sozinho não fecha o problema

Testei as duas rotas de conteúdo possíveis e medi ambas.

**Rota A — adicionar exemplares de primeiro contato** (23 novos: 8 still, 5 but,
10 yet, todos com variação proposicional real, não noun swap):

| métrica | antes | depois |
|---|---|---|
| exemplares únicos em 60 | 6 | **24** |
| `unique_exemplar_ratio` | 0.10 | **0.40** |
| `exact_text_repeat_rate` | 0.90 | **0.60** |
| `immediate_exact_repeat_rate` | 0.35 | **0** |
| `rolling_12_unique` min / média | 3 / 4.08 | **9 / 10.8** |
| `target_streak_max` | 6 | **3** |
| "I am tired, but I am happy." | 9× (0.15) | **4× (0.067)** |
| passos com realização única | 60 | **20** |
| capability | recognition 60 | recognition 60 |

O ganho de P0-A é grande e real. **Mas** essa rota exige que os novos
exemplares sejam servíveis no primeiro contato, e aí há um beco sem saída:

- se declaram `intended_new_items`, violam a invariante do pack *"cada
  sense/construction é introduzido exatamente uma vez"* (dois testes de pack
  falham, corretamente);
- se declaram `[]`, passam pelo `new_item_budget` sendo na prática um primeiro
  encontro — conteúdo desonesto, e os testes de orçamento falham (também
  corretamente: `expected 'activity' to be 'no_eligible_activity'`).

**Rota B — re-gatear as consolidações existentes** do construction para o sense
(sem adicionar nada):

| métrica | antes | depois |
|---|---|---|
| exemplares únicos | 6 | **11** |
| `unique_exemplar_ratio` | 0.10 | 0.183 |
| capability | recognition 60 | recognition 60 |

Ganho menor, e quebra a semântica de prerequisite assertada em
`V2 prerequisites: assessed-but-weak reports unmet` e mais quatro testes.

Nenhuma das duas cabe dentro de "só adicionar exemplares".

## 5. Descoberta estrutural (§8 autoriza documentar)

> O modelo de packs permite **uma única realização de primeiro contato por
> item**. Combinado com a barra de prerequisite, isso garante por construção que
> `same_focus_candidates = 1` durante toda a fase inicial — que é exatamente a
> fase onde o learner real passou as 60 atividades.

Não é um bug de dados, é a forma do modelo. Corrigir exige uma das duas
mudanças, ambas fora do que esta rodada autoriza:

1. **permitir múltiplas realizações de primeiro contato por item** — a
   invariante "introduzido exatamente uma vez" passaria a ser "introduzido por
   exatamente um *grupo* de realizações equivalentes", com o `new_item_budget`
   contando o item e não o exemplar. É uma mudança de modelo de conteúdo,
   pequena e bem delimitada, e resolveria P0-A inteiro;
2. **baixar a barra de prerequisite** para consolidações — política de
   evidência, explicitamente vetada nesta rodada.

## 6. P0-B: conteúdo não destrava a progressão (§24/§37)

Em **todas** as configurações medidas — inclusive a Rota A com 24 exemplares
únicos e 20 passos singleton — a distribuição de capability permaneceu
`recognition: 60`. Zero comprehension, zero produção.

Isso confirma a separação que a §37 antecipou:

- **P0-A é problema de densidade de conteúdo** — mensurável, com correção
  identificada e ganho já quantificado (6 → 24 exemplares únicos);
- **P0-B é problema de política de evidência/progressão** — independente, e
  nenhuma quantidade de conteúdo o resolve.

## 7. O que está na entrega

Só o instrumento de medição (`scripts/audit-target-content-depth-v2.mjs`) e este
documento. As duas rotas de conteúdo foram medidas e revertidas porque ambas
quebram invariantes existentes, e a §26 é explícita: não afrouxar golden nem
teste para passar.

Recomendação: aprovar a mudança de modelo descrita em §5.1 — é pequena, é
puramente estrutural, não toca em pedagogia nem em política de evidência, e o
ganho de P0-A já está quantificado acima. O P0-B volta para decisão separada.
