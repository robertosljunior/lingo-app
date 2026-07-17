# Pedagogy V2 — Modelo de Evidência e Domínio do Aluno (Slice V2.2)

Fundação persistente e lógica pura do learner model V2: os stores
`learner_evidence_v2` (eventos) e `learner_target_states_v2` (estados
derivados), sem nenhuma integração com UI, exercícios, gerador V1, corretor V1
ou SRS V1 nesta slice.

Princípio central:

> **“Conhecer uma palavra” não é um estado único. O aluno pode reconhecer um
> uso ao ler, não reconhecê-lo ao ouvir e ainda não conseguir produzi-lo sem
> apoio.**

## 1. Evento × estado

- **Evento** (`LearnerEvidenceV2`): registro **imutável** de uma evidência sobre
  **exatamente um** alvo pedagógico. Uma mesma interação (uma resposta, uma
  atividade) pode emitir vários eventos — um por alvo realmente avaliado —
  ligados pelo mesmo `interaction_id`.
- **Estado** (`LearnerTargetStateV2`): agregado **derivado** por
  `profile_id + target_type + target_id`. Nunca é editado diretamente.

## 2. Por que o estado é reconstruível

`aggregateTargetEvidence` (`learner-model.js`) é pura e determinística: sem
I/O, sem `Date.now()` (`updated_at` = maior `occurred_at` dos eventos), com
deduplicação por `evidence_id` e ordenação canônica interna
(`occurred_at`, depois `evidence_id`). Consequências, todas testadas:

- estado incremental ≡ reconstrução completa (`rebuildLearnerTargetStateV2`);
- agregação independente da ordem de inserção;
- regravar um evento é um no-op (idempotência);
- mudar o algoritmo = bump de `AGGREGATION_VERSION` + rebuild.

## 3. Por que não existe domínio global do alvo

Um `mastery: 0.82` raiz responderia "o aluno domina still?" — pergunta que o
modelo rejeita por construção. Domínio só existe **por chave de capacidade**
(`modality_capability`) e **por lane** (`overall` / `independent` /
`supported`). O teste `has NO root-level mastery` garante que o campo raiz
nunca exista.

## 4–5. Capacidades, modalidades e matriz de compatibilidade

Capacidades: `recognition, comprehension, controlled_production,
free_production, pronunciation`. Modalidades: `reading, listening, writing,
speaking, multimodal`.

Combinações aceitas (`CAPABILITY_MODALITIES`, fonte única):

| capability \ modality | reading | listening | writing | speaking | multimodal |
|---|---|---|---|---|---|
| recognition | ✅ | ✅ | — | — | ✅ |
| comprehension | ✅ | ✅ | — | — | ✅ |
| controlled_production | — | — | ✅ | ✅ | — |
| free_production | — | — | ✅ | ✅ | — |
| pronunciation | — | — | — | ✅ | — |

`deriveCapabilityKey({capability, modality})` produz a chave inequívoca
(`reading_recognition`, `speaking_free_production`, …) ou `null` para pares
incompatíveis — evidência jamais atualiza uma chave incompatível
(`pronunciation+reading` e `free_production+listening` são rejeitados já na
validação). `ACTIVITY_KIND_RULES` também restringe quais capacidades cada tipo
de atividade pode avaliar (uma `free_production` nunca emite evidência de
`recognition`).

## 6. Reconhecimento × produção (e leitura × escuta)

Cada evento alimenta apenas a sua chave. Acertar múltipla escolha lida
(`reading_recognition`) não move `writing_controlled_production` nem
`listening_recognition`. Testes: "capability separation — no cross-talk".

## 7. Apoiado × independente

Apoio é dado estruturado (`support.features[]`, `hint_count`,
`attempt_number`); o **tier** é derivado por função pura centralizada
(`deriveSupportTier`), nunca informado pelo chamador:

| tier | gatilho |
|---|---|
| `none` | sem recursos e sem dicas |
| `low` | `audio_replay` |
| `medium` | `translation`, `image`, 1 dica |
| `high` | `word_bank`, `multiple_choice`, `model_sentence`, 2+ dicas |
| `answer_revealed` | `answer_reveal` (domina tudo) |

**Decisão de independência** (documentada e testada): apenas tier `none`
alimenta a lane `independent`; `low/medium/high` alimentam `supported`;
`answer_revealed` alimenta `supported` com peso mínimo (0.15) e **nunca**
`independent` — resposta após revelação é prática acompanhada, não recuperação
independente. `support_summary` mantém desempenho esparso por recurso
(`evidence_count`, `success_estimate` suavizado, `last_used_at`).

## 8. Exposição × recuperação

`attribution: "exposure"` (e outcomes `observed`/`not_assessed`) atualizam
somente os contadores de exposição (`exposure.count`,
`exposure_only_count`, `first/last_seen_at`) — peso de domínio **zero**.
Encontrar a frase não é recuperá-la da memória.

## 9. Atribuição direta × indireta

`direct` (o alvo era o foco da avaliação) pesa 1; `indirect` (alvo presente com
evidência secundária) pesa 0.5; `exposure` pesa 0. Além do peso, apenas eventos
`direct` contam como *retrievals* de retenção.

## 10. Fórmula de peso (heurística pedagógica v1 — sem validação científica)

```
weight = atribuição (1 / 0.5 / 0)
       × tier de apoio (none 1, low .85, medium .6, high .4, answer_revealed .15)
       × tentativa (1ª 1, 2ª .5, 3ª+ .25)
       × assessment_confidence (0..1)
```

Ordenações garantidas por teste:
`correto direto sem apoio (1.0) > com word_bank (0.4) > indireto com word_bank
(0.2) > após answer_reveal (0.15) > exposição (0)` e `1ª > 2ª > 3ª tentativa`.
`assessment_confidence` é a confiança do **motor avaliador**, não a
autoavaliação do aluno.

## 11. Fórmula de domínio (por lane, suavização bayesiana)

```
score: correct = 1, partial = partial_score, incorrect = 0
mastery_estimate = (Σ weight·score + 1) / (Σ weight + 2)    [null sem evidência]
```

Prior de Laplace (1 sucesso / 2 observações ≙ 0.5): uma única resposta correta
sem apoio dá 0.667, nunca 1.0. Limitada a [0,1] por construção; sem divisão por
zero (lane sem evidência → `mastery_estimate: null`).

## 12. Evidence levels

Dependem do **peso efetivo acumulado**, não do valor de domínio:
`< 2 → insufficient`, `< 5 → emerging`, `≥ 5 → established`. Uma resposta
correta (peso 1) permanece `insufficient`.

## 13. Tendência

Sobre os últimos 10 eventos avaliados da lane (ordem cronológica): exige ≥ 6;
compara a média dos 3 mais recentes com a dos 3 anteriores; diferença ≥ ±0.15
decide `improving`/`declining`, senão `stable`; abaixo de 6 eventos,
`insufficient`.

## 14. Retenção e delayed retrieval

Mantida **por chave de capacidade** (retenção auditiva ≠ produção livre).
*Retrieval* = evento avaliado, `direct`, tier ≠ `answer_revealed`. *Delayed* =
intervalo ≥ `DELAYED_RETRIEVAL_MS` (24h, constante central testada) desde o
retrieval anterior **da mesma chave**.

Campos: `assessed/successful/failed_retrievals`,
`delayed/successful_delayed/failed_delayed_retrievals`,
`last/previous_retrieval_at`, `last_retrieval_interval`,
`maximum_successful_interval`, `stability_estimate`.

Estabilidade (heurística v1, em dias): nula até a primeira recuperação
atrasada bem-sucedida; sucesso atrasado sobre intervalo I →
`I` (primeira) ou `max(prev × 1.2, (prev + I)/2)` (cresce estritamente);
falha atrasada → `prev × 0.5`; eventos em intervalo curto não a movem; teto de
365. **Nenhuma data de próxima revisão é criada nesta slice** — isso é o SRS V2
(fatia futura).

## 15. Limitações heurísticas

Todos os números (pesos de tier, fatores de tentativa, prior, thresholds,
janela de tendência, 24h, crescimento/decaimento de estabilidade) são
**heurísticas pedagógicas versionadas**, escolhidas por plausibilidade e
testabilidade — não há validação empírica. `partial` usa `partial_score` como
score contínuo; retenção considera sucesso apenas `correct` (conservador).

## 16. Versionamento

`LEARNER_EVIDENCE_SCHEMA_VERSION = 1` (forma do evento),
`LEARNER_MODEL_VERSION = 1` (semântica do modelo),
`AGGREGATION_VERSION = 1` (algoritmo de agregação, gravado em cada estado).
Mudanças de fórmula exigem bump + rebuild (`rebuildLearnerTargetStatesV2`).

## 17. Fronteira com skill_profiles V1

Os stores V1 (`skill_events`, `skill_profiles`) permanecem intocados e
continuam alimentando as telas atuais. O modelo V2 não lê, não escreve e não
reinterpreta dados V1. Alvos V2 usam os IDs tipados do `content_v2` — nunca
`skill_id`s (o validador rejeita `TARGET_V1_SKILL_FORBIDDEN`). O `source_type:
"legacy_answer_bridge"` apenas **reserva o nome** para um import futuro de
respostas V1; nada é migrado nesta slice e o boot não reconstrói nada.

## 18. Futuro: uma resposta → vários eventos

Quando o `lesson_engine_v2` existir, uma única resposta a um exemplar como
`exemplar:still.015` ("Although it was hard, I still tried.") será mapeada pelo
adaptador de avaliação para um batch com o mesmo `interaction_id`:
evidência `direct` para a construção-alvo, `indirect` para o sentido e para a
função comunicativa (conforme `pedagogical_targets` do exemplar). O batch
atômico já suporta exatamente esse formato.

## 19. Exemplo completo com "still"

Coberto por testes reais (`learner-model.test.js › still pack integration`):

1. `sense:still.continuity` acumula evidência separada em
   `reading_recognition`, `listening_recognition`,
   `writing_controlled_production` e `speaking_free_production` — uma
   modalidade não move as outras.
2. `construction:still.subject_still_lexical_verb` ("I still live here.") e
   `construction:still.subject_be_still_complement` ("I am still tired.") são
   estados independentes, embora compartilhem o sentido de continuidade.
3. Uma interação concessiva com `exemplar:still.015` gera três eventos
   (`direct` construção + `indirect` sentido + `indirect` função) que viram
   **três** estados distintos — nunca um registro único.

## 20. Fora de escopo desta slice (deliberado)

UI · cards no Hub · feature flag · lesson engine V2 · seleção de próxima
atividade · SRS V2 e datas de revisão · migração automática de respostas V1 ·
integração com `submitAnswer`/`Exercise.jsx` · adaptação do motor semântico ·
segundo pack pedagógico · registry multi-pack · sincronização remota · backend
· alterações em `dist/`.

## Persistência (referência rápida)

Stores (IndexedDB v5, incremental, preservando todos os stores V1):

- `learner_evidence_v2` — keyPath `evidence_id`; índices: `profile_id`,
  `interaction_id`, `occurred_at`, `exemplar_id`, `target.target_id`,
  `target.target_type`, `['profile_id','target.target_id']`.
- `learner_target_states_v2` — keyPath `key`
  (`profile:target_type:target_id`, convenção de chave serializada do repo);
  índices: `profile_id`, `target.target_id`, `target.target_type`.

APIs (`storage.js`, que apenas coordena persistência — validação em
`learner-evidence-validator.js`, matemática em `learner-model.js`):
`recordLearnerEvidenceV2`, `recordLearnerEvidenceBatchV2` (validação prévia de
tudo; transação única; idempotente), `getLearnerEvidenceV2(profile, filtros)`,
`getLearnerTargetStateV2`, `getLearnerTargetStatesV2`,
`rebuildLearnerTargetStateV2`, `rebuildLearnerTargetStatesV2`. `wipeAll`
inclui os dois stores.
