# Pedagogy V2 — Study Planner V2 (Slice V2.6)

> **O Study Planner decide o que estudar. O Lesson Engine decide como praticar.**

> **Revisão não significa repetir uma palavra. Significa recuperar um uso
> específico em uma capacidade e modalidade específicas.**

## 1. Study Planner vs. Lesson Engine

| Camada | Decide | Nunca decide |
|---|---|---|
| Study Planner (`study-planner.js`) | qual pack, qual lexema, qual alvo, qual tipo de necessidade | exemplar, recipe, apoio, opções |
| Lesson Engine (`lesson-engine.js`) | exemplar, recipe, capacidade/modalidade concreta, apoio, planned evidence | o que entra no currículo da sessão |
| Learner Model | — única fonte do estado do aluno | — |
| Registry | — única fonte de conteúdo e relações | — |

Fluxo: `Learner Model + Registry + Retention + Curriculum graph + histórico →
Study Planner → StudyFocus → (adapter) → Lesson Engine → ActivityPlanV2`.
Nenhuma lógica de recipe ou scoring de atividade subiu para o planner.

## 2. StudyFocusV2

Contrato versionado (`STUDY_FOCUS_V2_VERSION = 1`): `pack_id`, `lexeme_id`,
`focus_type` (`introduce | deepen | review | remediate | independence |
cross_pack_progression`), `target` tipado, `capability`/`modality` opcionais
(um foco `introduce` não exige capacidade — o primeiro contato é decisão do
engine), `reason_codes`, `priority { score, components }`, `planner_version`.

## 3. Modos

- **focused** — comportamento V2.5: o aluno escolhe still/but; a sessão fica no pack.
- **adaptive** — o planner escolhe entre todos os packs elegíveis, com interleaving controlado.
- **review** — regra dura: **nenhum target nunca visto**; não gasta orçamento
  de novidade; prioriza retenção, tendência em queda, falha atrasada, domínio
  apoiado sem independência e modalidade fraca (ênfase de pesos + filtros).
- **explore** — prioriza novos usos elegíveis (peso de novidade ×3), ainda
  respeitando pré-requisitos, orçamento e progressão; remediação crítica nunca
  é zerada (peso de revisão ×0.5, remediação intacta).

## 4. Geração de candidatos

`buildStudyCandidatesV2` produz, em ordem canônica: **introdução** (exemplar
de progressão com novidade não exposta e pré-requisitos V2 `met`),
**aprofundamento** (primeira prática após exposição; consolidação de uma
capacidade abaixo do bar; lacuna de modalidade pareada; próximo degrau da
escada recognition → comprehension → controlled → free → pronunciation),
**independência** (supported estabelecido, independent ausente),
**remediação** (falha recente ou trend declining), **retenção** (itens da
review queue) e **cross-pack progression** (introdução cuja prioridade vem de
relação tipada/pré-requisito de outro pack).

## 5. Filtros (hard filters)

Excluem antes do scoring: target/pack inexistente; pré-requisito obrigatório
`unmet` (e `unknown` — nunca assumido como atendido, espelhando o engine);
target novo no modo review; alvo já consolidado sem necessidade
(`already_consolidated`); foco tecnicamente impraticável
(`FOCUS_RUNTIME_UNAVAILABLE` — nenhuma atividade útil executável; o estado do
aluno nunca é alterado por indisponibilidade técnica); orçamento de novidade
excedido; espaçamento mínimo entre revisões do mesmo (target, capacidade);
limite de revisões consecutivas (com fallback determinístico documentado:
revisar de novo é melhor que travar a sessão).

## 6. Scoring

Componentes: `retention_need, recent_failure, trend_need, capability_gap,
modality_gap, independence_gap, curriculum_frontier, cross_pack_transfer,
novelty_value, diversity, recency_penalty`. Pesos centralizados em
`DEFAULT_STUDY_PLANNER_POLICY_V2` com multiplicadores por modo
(`mode_emphasis`). **Todos os valores são heurísticos e não possuem validação
científica** — codificam julgamento editorial. Não existe — e não pode
existir — mastery global por lexema: o planner produz apenas métricas
factuais separadas (construções/formas encontradas, revisões disponíveis).

## 7. Review queue (`review-queue.js`)

Calculada em runtime sobre os estados persistidos (`retention`,
`stability_estimate`, `last_retrieval_at`, delayed retrievals, lanes, trend) —
**sem store novo, sem `next_review_at` persistido**. Cada item: target,
`capability_key`, prioridade, `reason_codes` (`RETENTION_OVERDUE`,
`DELAYED_RETRIEVAL_FAILED`, `DECLINING_TREND`, `LOW_STABILITY`,
`SUPPORTED_WITHOUT_INDEPENDENT`, `MODALITY_GAP`, `RECENT_FAILURE`),
`last_retrieval_at`, `stability_estimate`. Ordenação determinística.

## 8. Por que NÃO é SRS

Não há agendamento: nenhuma data futura é calculada ou persistida, nenhum
algoritmo SM-2/FSRS/Leitner. A fila é uma **priorização dinâmica do estado
atual** — reavaliada a cada construção de contexto. Um agendador formal seria
uma slice futura com contratos próprios.

## 9. Interleaving e limites de switch

No modo adaptive a sessão pode alternar packs, mas nunca em ping-pong gratuito:
`max_pack_switches` (hard), `min_activities_before_switch` +
`pack_switch_min_advantage` (penalidade de coerência que prioridade forte pode
superar), `max_consecutive_same_pack` (depois disso a coerência deixa de
suprimir a troca). O trace registra `PACK_SWITCH_FOR_RETENTION`,
`PACK_SWITCH_FOR_REMEDIATION`, `PACK_SWITCH_FOR_CROSS_PACK_PROGRESSION` e
`PACK_SWITCH_SUPPRESSED_FOR_COHERENCE`.

## 10. Transferência cross-pack

Relações tipadas do registry entram no planner por papel explícito
(`RELATION_PLANNER_POLICY`): `prerequisite` pode bloquear; `extends_usage`
aumenta prioridade quando a base é conhecida; `realizes_shared_function`
aumenta prioridade de transferência; `related_construction` dá bônus leve;
`contrasts_with`/`reuses_lexeme_context` são apenas diagnósticas — **nem toda
relação é pré-requisito**. Reason codes de transferência:
`KNOWN_FUNCTION_NEW_CONSTRUCTION`, `KNOWN_CONSTRUCTION_REUSED_IN_NEW_PACK`,
`KNOWN_LEXEME_CONTEXT_EXTENDED`, `CROSS_PACK_PREREQUISITE_MET`,
`CROSS_PACK_TRANSFER_OPPORTUNITY`. Cenário canônico still/but: contraste com
`but` conhecido → `It was difficult, but I still tried.` (construção but...still,
propriedade do pack still) → base curricular para `Although it was hard, I
still tried.` — o trace evidencia cada elo.

## 11. StudySessionV2 e integração

`StudySessionV2` (modo, seed, `focus_history`, `pack_history`,
`new_target_budget`, `pack_switches`) fica ACIMA das `LessonSessionV2` — uma
por pack, nunca colapsadas. Cada foco inicia/atualiza a lesson session do seu
pack; o histórico de atividades continua na lesson session. O adapter
`studyFocusToLessonScopeV2` produz o escopo formal + a restrição
`focus { target_id, capability, modality }` que o engine aceita (o único ajuste
feito no engine — nada do algoritmo foi duplicado). A decisão de foco é
recalculada após **cada** interação avaliada (`study-session-controller.js`);
nenhuma playlist é gerada antecipadamente.

## 12. Runtime availability

O planner consulta o snapshot técnico do runtime: um foco cuja
capacidade/modalidade não tem NENHUMA atividade executável é excluído com
`FOCUS_RUNTIME_UNAVAILABLE` (ex.: lacuna auditiva sem `audio_output`;
`pronunciation` sem assessor; `free_production` sem semantic assessment).
Indisponibilidade técnica jamais altera o learner state.

## 13. Determinismo

Sem `Math.random`/`Date.now` no núcleo (verificação estática em teste); `now`
vem da StudySession; iteração canônica (packs/estados/candidatos ordenados);
a seed apenas desempata candidatos de score IGUAL. Mesmos inputs → mesmo
StudyFocus, qualquer que seja a ordem dos arrays de entrada.

## 14. Progressão sem mastery global

O planner nunca produz `still mastery = 73%`. A UI mostra fatos: "3
construções encontradas · 2 formas de uso · 1 revisão disponível". O card de
revisão mostra palavra, uso, capacidade/modalidade e um motivo humano derivado
dos reason codes — nunca score matemático nem IDs internos.

## 15. Limitações heurísticas conhecidas

- Pesos e limites são heurísticos, sem validação empírica; a política é
  versionada para permitir recalibração explícita.
- A fila de revisão herda a calibração do learner model (bar de `emerging` = 2
  de peso efetivo); com apoio médio isso significa ~4 acertos por lane antes
  de um alvo contar como consolidado.
- `catalog_order` no manifest é decisão puramente editorial de apresentação
  (still antes de but, na ordem em que entraram no produto) — não representa
  nível nem entra no planner.
