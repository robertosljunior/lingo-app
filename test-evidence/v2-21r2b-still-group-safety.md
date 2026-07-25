# V2.21-R2b — por que os introduction groups de Still quebravam a progressão

Base: `3f860c8` (merge do PR #49). Nenhum peso, threshold, gate, fórmula de
mastery ou política de evidência alterado — P0-B segue congelado.

## A. Primeiro passo divergente

Reproduzi a tentativa que falhou na R2 aplicando os grupos experimentais de
Still e comparando passo a passo com a baseline (`new-learner`, 100 interações).

A primeira divergência é no **passo 0**, e é **benigna**:

| | baseline | com grupos |
|---|---|---|
| target | `sense:still.continuity` | igual |
| construction | `still.subject_still_lexical_verb` | igual |
| capability / recipe | recognition / exposure | igual |
| `new_item_refs` | sense + construction | igual |
| exemplar | `still.001` | `still.002` |

Só a realização mudou — exatamente o que um introduction group deve fazer.

Isolando os dois grupos separadamente:

| grupos aplicados | goldens |
|---|---|
| só o be-group (`still.006/007/008/010`) | **CLEAN** |
| só o lexical (`still.001/002/003/005`) | `PREMATURE_FREE_PRODUCTION` |
| ambos | `PREMATURE_FREE_PRODUCTION` |

O culpado é o grupo **lexical**.

## B/C. Qual state mudou e qual gate abriu cedo

Rastreando `construction:still.subject_still_lexical_verb` ao longo do run com o
grupo lexical aplicado, o alvo aparece **uma única vez em 100 interações** — no
passo 62, direto como `free_production`.

Ele nunca recebeu recognition/comprehension/controlled **como alvo primário**.

O motivo: `plan.primary_target` é o **primeiro** item de `pedagogical_targets`
com role `primary`. Na baseline, `still.002/003/005` eram autorados com a
**construction primeiro** (primary) e o sense como secondary. Ao promovê-los eu
reescrevi a lista como `[sense, construction]`, copiando a ordem do seed
`still.001`. Resultado: aquelas atividades passaram a reportar o **sense** como
primary target, e a construction perdeu todas as suas evidências primárias
iniciais. Quando ela finalmente reapareceu como primary — num exemplar fora do
grupo — a trajetória já estava adiante, e o passo servido foi produção livre.

## D/E. Classificação

Categoria **C** da §5: *primary targets adicionais/reordenados fazem a evidência
ser atribuída a um alvo diferente do anterior.*

Não foi group membership vazando para elegibilidade (H), nem prerequisite (E),
nem bridge (F), nem stage (G), nem budget (D). O `new_item_budget` já contava o
item e não a realização, e isso continua verdadeiro.

## F. Correção mínima aplicada

**A promoção nunca reordena os primary targets autorados.** Um membro promovido
mantém a construction — o degrau curricular que o grupo introduz — como primeiro
primary target; o sense vem em seguida. Os seeds mantêm a ordem original.

A mesma regra foi aplicada aos grupos de But e Yet que a R2 já tinha mergeado
(eles sofriam a mesma inversão silenciosamente): os membros promovidos passaram
a foregroundear a construction. Goldens continuam limpos e a variedade não
regrediu — Yet até melhorou.

Nada de exceção por pack, nada de desativar free production, nada de afrouxar
golden.

## Before / after — Still focused 36

| métrica | antes (R2) | depois |
|---|---|---|
| `unique_exemplars` | 4 | **9** |
| `unique_exemplar_ratio` | 0.111 | **0.25** |
| `immediate_exact_repeat_rate` | 0.444 | **0.056** |
| `exact_text_repeat_rate` | 0.889 | **0.75** |
| `rolling_12_unique` min / média | 1 / 2.36 | **4 / 7.28** |
| top text share | — | 0.194 |

## Goldens

| golden | baseline R2 | experimental (grupos ingênuos) | final |
|---|---|---|---|
| `new-learner` | CLEAN | `PREMATURE_FREE_PRODUCTION` | **CLEAN** |
| `support-dependent` | CLEAN | `PREMATURE_FREE_PRODUCTION` | **CLEAN** |

## But e Yet preservados (§22)

| cenário | `unique_exemplars` | `immediate_exact_repeat_rate` |
|---|---|---|
| but-focused-36 | 11 (igual à R2) | 0.028 |
| yet-focused-36 | 11 (igual à R2) | **0.028** (era 0.056) |
| real-successful-60 | **24** (era 18) | **0.033** |

"I am tired, but I am happy." não aparece no top-5 de nenhum dos quatro
cenários.

## P0-B (§24)

A distribuição de capability continua dominada por recognition. Registrado, não
mascarado — é o escopo da V2.21-R3.
