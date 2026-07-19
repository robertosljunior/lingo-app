# Slice V2.8 — Fase A: baseline estrutural (antes vs depois)

**Base:** `origin/main` = `8c01d98` (merge do PR #30, Slice V2.7).
**V2.7:** commit `3b63eed`, mergeado via PR #30. **DB_VERSION:** 5 (inalterado).
**Packs:** `pedagogy_v2_but`, `pedagogy_v2_still` (registry_version 1).

> Comparação **V2.7 baseline** vs **V2.8 correção estrutural (Fase A)**. Nenhum
> peso pedagógico foi alterado nesta fase. Não há comparação de *mastery global*
> (o sistema nunca produz esse número). Números de `V2.7 (antes)` vêm de
> `test-evidence/v2-7-golden-baseline.json`; `V2.8` de uma execução fresca dos
> mesmos 7 golden scenarios com as mesmas seeds.

## Finding V2.7 reproduzido (antes da correção)

Todas as 7 personas ficavam presas em **recognition** (ex.: `new-learner`
recognition:94/comprehension:6; `fast-learner` recognition:100). O Study Planner
gerava focos `independence` para recognition/comprehension; o Lesson Engine só
tinha recipes com apoio (`multiple_choice`) para esses domínios, então
`deriveSupportTier ≠ none` → a lane `independent` nunca recebia evidência → o
candidato reaparecia → loop. Consequências: `SUPPORT_TRAP`, `TARGET_STAGNATION`,
`EXCESSIVE_TARGET_REPETITION`, `REVIEW_STARVATION`, `MODALITY_STARVATION` falsos.

## Causa raiz

`independence` era tratada como propriedade abstrata da *capability*, sem
verificar se existe uma **atividade executável, sem apoio (tier none) e
avaliada** para aquele `capability × modality`. Recognition/comprehension não
possuem recipe independente algum — logo o foco era estruturalmente impossível.

## Correção estrutural (Fase A)

- **`training-affordances.js`** — fonte única, derivada de `LESSON_RECIPES` +
  runtime. Declara por domínio `can_train_independent` / `can_produce_assessed_evidence`.
- **Planner** — só gera `independence` quando `canTrainIndependentV2` é verdadeiro.
- **Review queue** — `SUPPORTED_WITHOUT_INDEPENDENT` só quando há affordance
  independente executável (remove revisões falsas de recognition).
- **Engine** — `require_independent` no foco; rejeita foco impossível com
  `FOCUS_INDEPENDENCE_NOT_EXECUTABLE` (sem fallback silencioso para apoio).
- **Invariantes** — `INDEPENDENCE_FOCUS_PRODUCED_SUPPORTED_ACTIVITY` (grave),
  `FOCUS_CAPABILITY_NOT_TRAINED`, `FOCUS_MODALITY_NOT_TRAINED`.
- **Observabilidade** — `MODALITY_STARVATION` opportunity-aware; nova métrica
  `opportunity_coverage`; `TARGET_STAGNATION` deixa de acusar alvo com mastery
  já no/above the advancement bar cujo `evidence_level` apenas fica atrás
  (limitação de mensuração de domínio supported-only).

## Comparação por persona


### new-learner (n=100)

| métrica | V2.7 (antes) | V2.8 (correção estrutural) |
|---|---|---|
| capability depth | recognition:94 comprehension:6 | recognition:56 comprehension:11 controlled_production:29 free_production:4 |
| modality balance | reading:13 listening:87 | reading:27 listening:40 speaking:33 |
| review ratio | 0.1765 | 0.1905 |
| unaided controlled/free | null/null | 0.4483/0 |
| repetition (same target) | 14 | 18 |
| cross-pack transfer | 0 | 0 |
| support dependency (sup/ind) | supported-recognition dominated | reading_recognition=46/0 listening_recognition=58/0 listening_comprehension=22/0 speaking_controlled_production=28/26 speaking_free_production=4/0 |
| findings | EXCESSIVE_TARGET_REPETITION, MODALITY_STARVATION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP |

### weak-listener (n=80)

| métrica | V2.7 (antes) | V2.8 (correção estrutural) |
|---|---|---|
| capability depth | recognition:80 | recognition:70 comprehension:10 |
| modality balance | reading:54 listening:26 | reading:17 listening:63 |
| review ratio | 0.2308 | 0.6667 |
| unaided controlled/free | null/null | null/null |
| repetition (same target) | 9 | 9 |
| cross-pack transfer | 0 | 0 |
| support dependency (sup/ind) | supported-recognition dominated | listening_recognition=115/0 reading_recognition=31/0 listening_comprehension=20/0 |
| findings | EXCESSIVE_TARGET_REPETITION, MODALITY_STARVATION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION |

### support-dependent (n=100)

| métrica | V2.7 (antes) | V2.8 (correção estrutural) |
|---|---|---|
| capability depth | recognition:100 | recognition:50 comprehension:10 controlled_production:39 free_production:1 |
| modality balance | reading:87 listening:13 | reading:27 listening:33 speaking:40 |
| review ratio | 0.0753 | 0.25 |
| unaided controlled/free | null/null | 0.4615/0 |
| repetition (same target) | 14 | 18 |
| cross-pack transfer | 0 | 0 |
| support dependency (sup/ind) | supported-recognition dominated | reading_recognition=46/0 listening_recognition=46/0 listening_comprehension=20/0 speaking_controlled_production=34/36 speaking_free_production=1/0 |
| findings | EXCESSIVE_TARGET_REPETITION, MODALITY_STARVATION, REVIEW_STARVATION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP |

### forgetful (n=60)

| métrica | V2.7 (antes) | V2.8 (correção estrutural) |
|---|---|---|
| capability depth | recognition:60 | recognition:53 comprehension:7 |
| modality balance | reading:30 listening:30 | reading:24 listening:36 |
| review ratio | 0.9355 | 0.875 |
| unaided controlled/free | null/null | null/null |
| repetition (same target) | 10 | 10 |
| cross-pack transfer | 0 | 0 |
| support dependency (sup/ind) | supported-recognition dominated | listening_recognition=68/0 reading_recognition=47/0 listening_comprehension=14/0 |
| findings | EXCESSIVE_TARGET_REPETITION, MODALITY_STARVATION, REVIEW_STARVATION, SUPPORT_TRAP, TARGET_STAGNATION | EXCESSIVE_TARGET_REPETITION, REVIEW_STARVATION, TARGET_STAGNATION |

### fast-learner (n=100)

| métrica | V2.7 (antes) | V2.8 (correção estrutural) |
|---|---|---|
| capability depth | recognition:100 | recognition:53 comprehension:16 controlled_production:17 free_production:14 |
| modality balance | reading:92 listening:8 | reading:29 listening:40 speaking:31 |
| review ratio | 0.087 | 0.0638 |
| unaided controlled/free | null/null | 0.2353/0.7143 |
| repetition (same target) | 14 | 18 |
| cross-pack transfer | 0 | 0 |
| support dependency (sup/ind) | supported-recognition dominated | listening_recognition=48/0 reading_recognition=50/0 listening_comprehension=32/0 speaking_controlled_production=19/8 speaking_free_production=6/10 |
| findings | EXCESSIVE_TARGET_REPETITION, MODALITY_STARVATION, REVIEW_STARVATION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP |

### struggling (n=100)

| métrica | V2.7 (antes) | V2.8 (correção estrutural) |
|---|---|---|
| capability depth | recognition:97 comprehension:3 | recognition:67 comprehension:9 controlled_production:19 free_production:5 |
| modality balance | reading:18 listening:82 | reading:41 listening:35 speaking:24 |
| review ratio | 0.0753 | 0.4085 |
| unaided controlled/free | null/null | 0.3684/0 |
| repetition (same target) | 10 | 10 |
| cross-pack transfer | 0 | 0 |
| support dependency (sup/ind) | supported-recognition dominated | reading_recognition=83/0 listening_recognition=57/0 listening_comprehension=18/0 speaking_controlled_production=24/14 speaking_free_production=5/0 |
| findings | EXCESSIVE_TARGET_REPETITION, MODALITY_STARVATION, SUPPORT_TRAP | EXCESSIVE_TARGET_REPETITION, SUPPORT_TRAP |

### cross-pack (n=100)

| métrica | V2.7 (antes) | V2.8 (correção estrutural) |
|---|---|---|
| capability depth | recognition:86 comprehension:13 controlled_production:1 | recognition:86 comprehension:5 controlled_production:9 |
| modality balance | reading:45 listening:54 speaking:1 | reading:45 listening:46 speaking:9 |
| review ratio | 3.5455 | 3.5455 |
| unaided controlled/free | 0/null | 0/null |
| repetition (same target) | 2 | 2 |
| cross-pack transfer | 4 | 4 |
| support dependency (sup/ind) | supported-recognition dominated | listening_recognition=85/15 reading_recognition=89/15 listening_comprehension=10/0 speaking_controlled_production=18/0 |
| findings | MODALITY_STARVATION, REVIEW_STARVATION, SUPPORT_TRAP, TARGET_STAGNATION | TARGET_STAGNATION |


## Sanity checks (§19) — todos aprovados apenas com a correção estrutural

| persona | critério | resultado V2.8 |
|---|---|---|
| fast-learner | atinge controlled/free production, não fica só em recognition | ✔ recognition 53 / controlled 17 / **free 14 (71% unaided)** |
| weak-listener | listening segue recebendo atenção | ✔ listening 63/80; não bloqueia indefinidamente |
| support-dependent | oportunidades reais de independence só onde executável; falha independente não apaga sucesso supported | ✔ speaking_controlled sup/ind 34/36 (lanes independentes) |
| forgetful | recebe review; review não domina 100% | ✔ review ratio 0.88 |
| struggling | remediação/apoio; não trava no mesmo alvo | ✔ atinge controlled/free; repetição 10 (finita) |
| cross-pack | transferência but→still permanece possível | ✔ atinge controlled_production; transfer=4 |

## opportunity_coverage (diagnóstico, não entra no Planner)

`writing` (produção) aparece com `eligible/selected = 0/0` em todas as personas:
a escada de capacidade introduz produção sempre via `speaking`
(`CAPABILITY_MODALITIES.controlled_production[0] === 'speaking'`) e não há gerador
de *modality-gap* para produção. Portanto `writing` produção **nunca é uma opção
curricular elegível** — não é *pedagogical starvation* (o analyzer corretamente
não emite `MODALITY_STARVATION` para ela). É uma lacuna de **cobertura de geração**
(prioridade/currículo), candidata a V2.9 — não uma impossibilidade de execução
nem um problema de *peso*.

## Regra de decisão para a Fase B

| Finding restante | Causa observada | Por que NÃO é bug estrutural | Peso/policy candidata | Efeito esperado | Risco |
|---|---|---|---|---|---|
| `SUPPORT_TRAP` (new-learner, support-dependent, fast-learner, struggling) | Independence é tentada em domínios executáveis, mas a lane independent ainda não consolidou no horizonte | Real: para `support-dependent` (penalidade independente alta) é o sinal CORRETO; independence agora é executável e tentada | `independence_gap`/`review` | Consolidaria independent mais cedo | Mascararia o sinal legítimo de dependência de apoio |
| `EXCESSIVE_TARGET_REPETITION` (todas) | Poucos alvos (2 packs) subindo a escada de capacidade no mesmo alvo por vários passos consecutivos | Coerente: subir recognition→…→free no mesmo alvo é pedagogicamente sensato | `diversity`/`recency_penalty` | Intercalaria mais alvos | Fragmentaria a progressão coerente de um alvo; otimizar warning ≠ objetivo |
| `REVIEW_STARVATION` (forgetful) | Um alvo da fila de revisão não foi revisado o suficiente no horizonte | Real e leve: review JÁ ocorre (ratio 0.88) | `review`/`retention` | Mais revisão para forgetful | Deslocaria progressão; efeito marginal |
| `TARGET_STAGNATION` (forgetful, cross-pack) | Alvos com mastery 0.67–0.69 (logo abaixo da barra 0.7) | Real: forgetting decai mastery; cross-pack no limite | — | — | — |
| cobertura de `writing` produção = 0 | Escada introduz produção só via speaking; sem modality-gap de produção | Lacuna de **geração**, não de peso | (nenhum peso exposto) | Precisa de novo gerador de candidato | Mudança de geração ≠ calibração de peso (fora do escopo desta slice) |

## Decisão

**Nenhuma recalibração de pesos foi necessária.**

Justificativa: (1) todos os sanity checks §19 passam **apenas com a correção
estrutural**; (2) os findings restantes são sinais **reais** (ex.: `SUPPORT_TRAP`
de `support-dependent` é o comportamento correto a expor) ou artefatos leves de
haver poucos alvos; (3) a única lacuna clara de cobertura (`writing` produção) é
um problema de **geração de candidato**, não um knob de peso — recomendado para
V2.9; (4) a orientação da slice proíbe ajustar pesos apenas para zerar warnings.
Portanto a Fase B (calibração controlada) **não foi executada**.
