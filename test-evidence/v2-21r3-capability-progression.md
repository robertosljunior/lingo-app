# V2.21-R3 — evidência de execução

Comandos reais executados nesta slice (nenhum mock, nenhum forced-plan):

```
npm test                                      # 83 files, 1320 tests, all pass
npm run audit:capability-progression-v2 -- --scenario <id>
npm run audit:practice-dynamics-v2 -- --scenario <id>
npm run build
```

## Funil de completude de target (§11) — antes → depois

`real-successful-60`, pipeline real:

| estágio | antes (base 2c2bf3b) | depois |
| --- | --- | --- |
| exposed | 12 | 10 |
| recognition evidence | 12 | 10 |
| recognition advancement | 4 | 7 |
| comprehension evidence | 0 | 5 |
| comprehension advancement | 0 | 0 |
| controlled evidence | 0 | 0 |

Distribuição de capability: `{ recognition: 60 }` → `{ recognition: 53, comprehension: 7 }`.

## Horizontes maiores (§25)

| cenário | capabilities servidas |
| --- | --- |
| real-successful-120 | recognition 64, comprehension 32, controlled_production 24 |
| real-successful-200 | recognition 86, comprehension 57, controlled_production 55, free_production 2 |
| still-focused-36 | recognition 21, comprehension 7, controlled_production 8 |
| but-focused-36 | recognition 15, comprehension 11, controlled_production 10 |
| yet-focused-36 | recognition 24, comprehension 7, controlled_production 5 |

Recipes em `real-successful-120`: listening_recognition 44, meaning_recognition 45,
guided_production 13, fixed_element_completion 7, word_order_reconstruction 4,
context_recognition 1, exposure 6.

Antes da slice, as recipes servidas em QUALQUER horizonte eram apenas
`exposure`, `meaning_recognition` e `listening_recognition`.

## Variedade (§19)

| cenário | unique exemplars | immediate repeat |
| --- | --- | --- |
| still-focused-36 | 8 | 0.000 |
| but-focused-36 | 8 | 0.000 |
| yet-focused-36 | 10 | 0.028 |
| real-successful-60 | 21 | 0.033 |

Ver `docs/pedagogy-v2/slice-v2-21-r3.md` §5 para o diagnóstico completo, a
classificação de causa (§10) e o desvio explícito do §26.
