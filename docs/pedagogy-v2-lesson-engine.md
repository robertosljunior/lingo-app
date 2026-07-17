# Pedagogy V2 — Lesson Engine (Slice V2.3-R)

Reconciliação arquitetural: esta slice **recupera a V2.2 aprovada**
(`db352d0`, learner model com lanes overall/independent/supported, exposure,
retenção por chave de capacidade, agregação bayesiana versionada) e porta por
cima o motor de seleção prototipado em `7038d70`, adaptado integralmente aos
contratos aprovados. A implementação alternativa da V2.2 (banco separado
`app-idiomas-pedagogy-v2`, força por EWMA, enums próprios) foi removida por
revert — **não existe segunda fonte de verdade**: toda taxonomia do motor é
importada de `learner-model-constants.js` / `learner-evidence-contracts.js`.

## 1. O que o motor é

`selectNextActivityV2({ session, pack, learnerStates, recentEvidence, policy })`
(`src/lib/pedagogy-v2/lesson-engine.js`) — função pura e determinística que
seleciona a próxima atividade sobre:

- conteúdo autorado V2 (pack `still`);
- estados `learner_target_states_v2` aprovados (lidos por queries próprias em
  `lesson-engine-state-queries.js`: `capabilities[capKey].{overall,independent,
  supported}`, `exposure`, `retention[capKey]`, `evidence_level`,
  `mastery_estimate`, `trend`);
- evidência recente (remediação de erro);
- sessão imutável e policy versionada.

Garantias (testadas): sem `Math.random`, sem `Date.now` no núcleo — o tempo
vem de `session.now`/contexto; empates exatos são resolvidos por hash
determinístico com seed (seed diferente só permuta candidatos de score igual);
**o motor nunca gera linguagem** — apresenta exemplares autorados; opções de
reconhecimento vêm de traduções autoradas com `source_exemplar_id`; nada de
distratores fabricados. Sem alternativa segura → outro exemplar, outro recipe
ou `no_eligible_activity`.

## 2. Contratos versionados (`lesson-engine-contracts.js` + validador)

`LessonEnginePolicyV2` · `LessonSessionV2` · `ActivityPlanV2` ·
`LessonDecisionV2` · `LessonEngineContextV2` · `PrerequisiteAssessmentV2` ·
`SelectionTraceV2` — todos com versão própria e validador estrutural
(`lesson-engine-validator.js`), que re-deriva o tier de apoio e re-checa cada
taxonomia contra a V2.2 (um plano com `answer_reveal`, tier divergente, par
capacidade×modalidade incompatível ou atribuição inexistente é rejeitado).

### ActivityPlanV2

`activity_id` determinístico, `session_id`, `sequence_index`, `activity_kind`
(taxonomia V2.2), `capability`, `modality`, `exemplar_id`, `construction_id`,
`sense_ids`, `communicative_function_ids`, `primary_target`,
`secondary_targets`, `support.features` + `support.derived_tier` (via
`deriveSupportTier`), `presentation`, `response_contract`, `planned_evidence`,
`selection_trace`, `policy_version`.

## 3. Recipes (8, todos seguros)

| recipe | activity_kind | capacidade×modalidade | variantes de apoio |
|---|---|---|---|
| `exposure` | exposure | recognition×reading | translation |
| `meaning_recognition` | meaning_recognition | recognition/comprehension × reading | multiple_choice |
| `listening_recognition` | listening_recognition | recognition/comprehension × listening | multiple_choice + audio_replay |
| `fixed_element_completion` | controlled_completion | controlled_production×writing | word_bank · **independente** |
| `word_order_reconstruction` | controlled_transformation | controlled_production×writing | word_bank (nunca independente) |
| `guided_production` | guided_production | controlled_production × writing/speaking | model_sentence+translation · **independente** |
| `free_production` | free_production | free_production × writing/speaking | hint · **independente** |
| `pronunciation` | pronunciation | pronunciation×speaking | model_sentence+audio_replay · **independente** |

Uma variante só é `independent` quando `deriveSupportTier(features) === 'none'`
(invariante checado em import e no validador). `answer_reveal` nunca aparece em
plano. A lane independente destrava **por alvo × capacidade × modalidade**:
sucesso apoiado em writing não libera independent em speaking (correção
descoberta no protótipo, preservada e testada — cenário 20).

## 4. Progressão e lacunas

Ordem inicial recomendada (heurística, nunca cadeia rígida — componente
`ladder` do score): exposure → recognition → comprehension → produção
controlada apoiada → controlada independente → produção livre → pronunciation.
Gates suaves: primeiro contato só por exposure; recognition exige exposure;
comprehension exige recognition da mesma modalidade; produção exige recepção
consolidada; free exige controlled da mesma modalidade; pronunciation exige
alguma produção. O score detecta lacunas específicas (cenários 3–7): leitura
forte/escuta ausente, reconhecimento forte/compreensão fraca, apoiado
forte/independente ausente, controlada forte/livre ausente, produção
forte/pronúncia ausente.

Demais componentes: `need` (lacuna no domínio treinado), `retention`
(revisão vencida por `retention[capKey]`/`stability_estimate`), `progression`
(fronteira curricular de estágios — recomendação, nunca bloqueio),
`capability_gap`, `independence`, `novelty` (crédito só no primeiro contato;
o orçamento de `intended_new_items` vale para qualquer recipe que apresente
item novo), `diversity`, `remediation` (erro recente volta com apoio).

## 5. Pré-requisitos tri-state

`met` / `unmet` / `unknown` (`PrerequisiteAssessmentV2`). V2: resolvidos pelo
pack e avaliados pelo estado (met = alguma lane overall ≥ limiar); unmet e
unknown bloqueiam, com razão distinta no trace. Ponte `grammar_skill_v1`:
resolver opcional (`resolveV1Skill`); sem resolver → `unknown`; **advisory por
padrão** (registrada, nunca assumida atendida); bloqueante apenas com
`v1_bridge_mode: 'strict'`.

## 6. Planned evidence (declarada, nunca gravada)

Cada plano declara os eventos futuros possíveis com exatamente
`direct`/`indirect`/`exposure` da V2.2: exposure → `exposure`/`observed` para
os alvos apresentados; reconhecimento de sentido → sentido/função `direct`,
construção `indirect`; completion/reconstrução/guiada → construção `direct`,
sentido `indirect`; produção livre → `direct` apenas condicional
(`only_if_target_assessed`) — nunca todos os alvos viram evidência direta.

## 7. Integração somente de leitura

`buildLessonEngineContextV2(profileId, { now, … })`
(`lesson-engine-context.js`) lê `getLearnerTargetStatesV2` /
`getLearnerEvidenceV2` de `storage.js` e monta o `LessonEngineContextV2`.
Exige `now` explícito, não escreve eventos, não reconstrói estados, não acessa
`skill_profiles` V1, não altera o boot — teste prova contagens inalteradas
após construir o contexto e selecionar.

## 8. Fora de escopo (deliberado)

UI · feature flag · avaliação/correção · gravação automática de evidência a
partir dos planos (V2.4) · múltiplos packs · shuffle de opções na interface
(ordem de apresentação declarativa e determinística).

Testes: `npm test` — cenários da progressão `still` em
`lesson-engine.test.js` (20 cenários obrigatórios da slice), contratos em
`lesson-engine-validator.test.js`, integração em `lesson-engine-context.test.js`.
