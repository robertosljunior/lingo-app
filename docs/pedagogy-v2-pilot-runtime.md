# Pedagogy V2 — Pilot runtime (Slice V2.4)

O piloto vertical "Laboratório V2 — still" liga, pela primeira vez, as camadas
aprovadas nas slices anteriores (content V2.1, learner model V2.2, lesson
engine V2.3-R) a uma jornada executável no navegador:

```
abrir o laboratório → construir LessonEngineContextV2 → selectNextActivityV2
→ renderizar ActivityPlanV2 → coletar ActivityResponseV2 → assessment adapter
→ evidence adapter → recordLearnerEvidenceBatchV2 (atômico) → recarregar
contexto → selecionar a próxima atividade
```

Tudo fica atrás da flag experimental `pedagogy_v2_pilot_enabled`
(default `false`, mecanismo de settings existente, sem migration e sem bump de
`DB_VERSION`). O fluxo V1 não é tocado.

## Módulos

| Módulo | Papel |
| --- | --- |
| `runtime-capabilities.js` | Snapshot técnico (`text_input`, `audio_output`, `speech_input`, `pronunciation_assessment`, `semantic_assessment`) e mapeamento → recipes não executáveis com reason codes `RUNTIME_*_UNAVAILABLE` (aparecem no selection trace). |
| `activity-runtime-contracts.js` | Tipos de resposta (`continue`, `single_choice`, `text`, `token_sequence`, `speech_transcript`, `pronunciation_attempt`), support runtime real, IDs determinísticos, helpers puros de máscara/tokens compartilhados entre UI e assessment. |
| `activity-runtime-validator.js` | Validação estrutural da resposta contra o plano ANTES de avaliar. |
| `activity-assessment.js` | `evaluateActivityResponseV2` — assessment adapter versionado; nunca grava evidência. |
| `assessment-policy.js` | Política versionada verdict→outcome do motor semântico + regras de confiança. |
| `assessment-to-evidence.js` | `buildLearnerEvidenceBatchFromInteractionV2` — planned evidence → eventos reais. |
| `pilot-session-controller.js` | Máquina de estados do runtime (impura: relógio e session_id vivem aqui; o engine continua puro). |

## Máquina de estados

`idle → loading → presenting → submitting → feedback → advancing → presenting…`
com terminais `complete` e `error` (recuperável). Garantias:

- `submit()` é no-op fora de `presenting` → double-click não duplica;
- a sessão só avança após `recordLearnerEvidenceBatchV2` retornar; falha de
  persistência leva a `error` mantendo `pendingResponse` — `retry()` reusa o
  MESMO objeto de resposta (mesmos IDs), e a idempotência do storage garante
  zero duplicação;
- "Tentar novamente" (pós-feedback) incrementa `attempt_number` → novos IDs;
- refresh perde apenas a sessão em memória; a próxima sessão parte das
  evidências persistidas.

## Identidade e idempotência

```
interaction:<session_id>:<activity_id>:<attempt_number>
evidence:<interaction_id>:<target_type>:<target_id>
```

IDs sanitizados (`[^a-zA-Z0-9:._-] → _`), independentes da ordem de
`planned_evidence`.

## Decisão sobre pronúncia (obrigatória — §8 da spec)

Investigação: o único mecanismo de "pronúncia" no código V1
(`Exercise.jsx`, tipo `speak_sentence`) usa o transcript do Web Speech API e o
`similarity_score` textual como `pronunciation_score`. Isso mede
reconhecimento de conteúdo, não qualidade fonética — não há avaliador
acústico real (sem score fonético, sem confiança acústica, sem distinção entre
falha de reconhecimento e falha de pronúncia).

Decisão (combinação das opções 1 e 2 da spec):

1. `pronunciation_assessment` é **sempre `false`** nesta slice; o recipe
   `pronunciation` é filtrado da seleção com
   `RUNTIME_PRONUNCIATION_ASSESSMENT_UNAVAILABLE` no trace.
2. O renderer existe (completude/testes) e declara claramente a
   disponibilidade; se executado, a prática produz somente
   `observed`/`not_assessed`. **Nunca** grava-se `correct` em
   `speaking_pronunciation` com base em transcript. O adapter mantém um seam
   (`assessmentServices.assessPronunciation`) para um futuro avaliador
   acústico com contrato testável.

## Integração com o motor semântico

Somente a API pública `analyzeProduction({ text, assessmentMode })`
(`src/lib/language-analysis/index.js`) é usada — thresholds internos não foram
tocados. Mapeamento centralizado em `assessment-policy.js`:

| verdict | outcome |
| --- | --- |
| `valid` | `correct` (confiança real do motor) |
| `valid_with_suggestions` | `partial` (0.75) se houver issue de severidade ≥ medium; senão `correct` com a confiança (reduzida) do motor |
| `needs_revision` | `incorrect` se houver erro high; senão `partial` (0.5) |
| `unable_to_assess` | status `unable_to_assess`, sem outcome avaliado |

Guided production usa `assessmentMode: 'guided'`; free production usa `'free'`
(o modo não compara com resposta-modelo oculta — diferença textual nunca vira
erro automaticamente).

## Assessment confidence

- comparações exatas (option_id, completion, word order): `1.0`;
- semântico: confiança real do motor; fallback conservador documentado `0.5`
  quando ausente;
- fala: `confiança_STT × confiança_semântica` (STT default conservador `0.6`);
  abaixo de `0.3` → `unable_to_assess`;
- `unable_to_assess`/exposição: nenhuma confiança fabricada.

## Completion — heurística documentada

Máscara: apenas os `fixed_elements` da construção (via plano). Normalização
limitada: Unicode NFC, espaços, caixa, pontuação periférica. Vários elementos:
`partial_score` = proporção exata de tokens corretos. Sem correções
linguísticas expansivas.

## Planned evidence → eventos (política única)

- `exposure` → `observed` sempre;
- `direct` sem condição → outcome avaliado quando o assessment declara o alvo
  em `target_assessments`; senão `not_assessed` (mantido por valor
  diagnóstico);
- `indirect` → outcome da interação quando avaliada (a relação é justificada
  pelo recipe: mesmo exemplar); o peso reduzido vem da própria atribuição
  (V2.2);
- condição `only_if_target_assessed` → evento **omitido** quando o alvo não
  foi declarado avaliado (escolha documentada: em free production todos os
  alvos são condicionais e uma enxurrada de `not_assessed` não teria valor
  diagnóstico).

Support real: `baseline do plano ∪ recursos acionados` (audio_replay,
translation, hint, answer_reveal…), tier sempre via `deriveSupportTier` —
`answer_reveal` nunca alimenta a lane independent (regra V2.2).

## Limitações conhecidas / adiado para V2.5+

- sessão V2 somente em memória (sem retomada de sessão);
- word order binário; sem análise parcial de sequência;
- sem avaliador acústico de pronúncia;
- multi-pack, SRS V2, sincronização remota: fora do escopo por especificação;
- testes de componentes usam render estático (`react-dom/server`) — interação
  real coberta pelos specs Playwright.
