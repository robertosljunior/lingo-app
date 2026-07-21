# Slice V2.13 — Typed Assessment Diagnosis + Cause Coverage

## Base

- SHA base: `852cd776f996b835e6c41fd3f7d06f08a4e26035`
- PR/merge da V2.12: PR #35 (commit original `66e6c93431ac9edb8a38d5f3ae0381ac2d83425f`)
- DB_VERSION: 5 (inalterado)
- registry version: 1
- packs: `pedagogy_v2_but`, `pedagogy_v2_still`, `pedagogy_v2_yet`
- Assessment version: 1 → mantida 1 (campo `diagnosis` aditivo, com `diagnosis_version` próprio)
- Feedback View Model version: 1 → 2 (passa a consumir `diagnosis`, com fallback ao raw)

## §5 — Auditoria do resultado real de `analyzeProduction(...)`

Shape retornado por `analyzeUserProduction` (ANALYSIS_VERSION `'1'`), via `analyzeProduction`,
para `assessmentMode` `guided` e `free` (o único caminho usado pelo pipeline V2):

| campo | origem | significado | confiabilidade | pode sustentar qual diagnosis |
|---|---|---|---|---|
| `verdict` | fusão (`fuseVerdict`) | `valid` / `valid_with_suggestions` / `needs_revision` / `unable_to_assess` | alta (decisão do motor) | outcome (via Assessment Policy), `semantic_relation` grosseira |
| `confidence` | fusão | número 0..1 | média (heurística versionada) | `primary_cause.confidence` (quando há causa) |
| `detected_errors[]` | regras determinísticas + Harper + packs + fusão | lista de erros estruturados | alta (cada item tem `source`) | **fonte principal de causa tipada** |
| `detected_errors[].category` | ver tabela abaixo | classe do erro | alta | mapeada para categoria typed |
| `detected_errors[].subtype` | regra/origem | ex. `subject_verb_agreement`, `context_preference`, `usage_rule` | alta | preserva provenance |
| `detected_errors[].severity` | mapeamento | `low` / `medium` / `high` (`critical` possível) | alta | `severity` da causa |
| `detected_errors[].source` | builder | `grammar` / `semantic_equivalence` / `guided_intent` / `deterministic_rule` / pack | alta | `primary_cause.origin` |
| `detected_errors[].explanation_pt` | builder | `{ title, summary }` pt-BR | alta | texto da causa |
| `detected_errors[].confidence` | builder | 0..1 | média | confiança da causa |
| `corrected_version` | fusão | forma corrigida (quando há fix) | média | sugestão/positive finding |
| `natural_alternatives[]` | `buildAlternatives` | `{ text, tone, ... }` | média | **naturalness** (sugestão) |
| `detected_intents[]` | estrutura + semântica | intents detectados | média | corrobora `semantic_relation` |
| `matched_concepts[]` | frame semântico | frame_id casado | média | corrobora `semantic_relation` |
| `semantics.top_frame` / `top_score` | USE/hashing | frame + similaridade | **baixa isolada** (§9: nunca sozinha) | NÃO sustenta causa sozinha |
| `verdict === 'unable_to_assess'` | fusão/empty | não avaliável | alta | `unknown` / `not_assessed` |
| `engines` / `fallback_events` | relatório | motor efetivo | alta | observabilidade (não é causa) |

### Categorias de `detected_errors.category` que o motor realmente emite

| category (motor) | subtype típico | severity | source | → diagnosis category |
|---|---|---|---|---|
| `verb_form` | `subject_verb_agreement` / harper agreement | high | grammar/deterministic | **grammar** |
| `grammar` | `usage_rule`, `grammar.repeated_word` | medium/low | grammar/pack | **grammar** |
| `spelling` | harper `Spelling` | medium | grammar | **grammar** (code SPELLING) |
| `capitalization` | `capitalization.sentence_start` | low | grammar | **grammar** (code CAPITALIZATION) |
| `punctuation` | `punctuation.*` | low | grammar | **grammar** (code PUNCTUATION) |
| `vocabulary` | harper `WordChoice` | low | grammar | **lexical_choice** |
| `naturalness` | `context_preference` | low | pack hint | **naturalness** |
| `meaning` | `equivalent_meaning` | high | `semantic_equivalence` | **semantic_context** |
| `task` | `requested_intent` | medium | `guided_intent` | **semantic_context** |

## Achado de plumbing (§30) — documentado, NÃO recalibrado

`activity-assessment.js` chama o serviço semântico com `equivalentTarget: plan.text_en`
(string) e `context`. Porém:

1. os wrappers `analyzeSemantics` nos controllers/Playground repassam apenas
   `{ text, assessmentMode }` — `equivalentTarget`/`context` são descartados;
2. `analyzeUserProduction` só usa `equivalentTarget` no modo **`equivalent`**
   (e como **objeto** `{ text, essential_words }`), nunca em `guided`/`free`;
3. o modo usado é `guided`/`free`, e `guided` só emite `intent_not_met` quando
   recebe `requestedIntent` — que **nunca é passado** pelo adapter.

Consequência real: os erros estruturados `meaning` (`equivalent_meaning`) e `task`
(`requested_intent`) — que sustentariam `semantic_context` — **não são alcançáveis**
hoje para produção guiada/livre. Logo, uma produção fora de contexto (ex.:
`I like bananas.` num exercício de preço) tende a **`valid`** (sem erro de
gramática) e não gera causa semântica.

**Decisão (§6/§29/§30):** isto NÃO é um bug de plumbing simples de "campo
descartado no caminho" — recuperar `semantic_context` exigiria (a) mapear o plano
para o vocabulário de `requestedIntent` (inferência nova) ou (b) trocar o modo para
`equivalent` com `equivalentTarget` objeto (recalibração de comportamento). Ambos
são fora de escopo da Fase A. Registrado como **limitação do semantic engine para
V2.14**. O adapter classifica fielmente o que o motor emite e retorna `unknown`
quando não há causa — que é o comportamento honesto e esperado (§28/§29).

## §16/§28 — Resultados A/B/C/D (fixtures controladas, `npm run audit:assessment-v2`)

Cada caso injeta um resultado semântico **canônico representativo** (o que o motor
PODE emitir) no serviço `analyzeSemantics` e roda o `evaluateActivityResponseV2`
real + `AssessmentDiagnosisV2`. Isso testa a CLASSIFICAÇÃO do adapter de forma
determinística, sem carregar o modelo USE, e sem fabricar causa dentro do adapter.

| caso | resposta | outcome | primary cause | code | source | coverage |
|---|---|---|---|---|---|---|
| A — grammar | `This price are very high.` | incorrect | **grammar** | AGR.1 | structured_error | specific |
| B — naturalness | `The price is very expensive.` | correct | — (sugestão) | — | — | specific |
| B2 — válido diferente | `Its price is very expensive.` | correct | — | — | — | specific |
| C — aceitável / forma-alvo | `The price is too high.` | correct | — (nota target_form) | — | — | specific |
| D — semantic COM evidência | `I like bananas.` | incorrect | **semantic_context** | MEANING_MISMATCH | structured_error | specific |
| D2 — semantic grosseiro (gap real) | `I like bananas.` | partial | **unknown** | SEMANTIC_OUTCOME_WITHOUT_STRUCTURED_CAUSE | semantic_engine | none |

### Comparação V2.12 → V2.13

| caso | V2.12 (outcome / cause) | V2.13 (outcome / cause) |
|---|---|---|
| A grammar | incorrect / (raw detected_error, sem contrato tipado) | incorrect / **grammar** tipado, com `source` |
| B naturalness | correct / naturalness em sugestão | correct / naturalness tipada (`naturalness`), permanece sugestão |
| C target-form | correct / forma-alvo só como referência | correct / `target_form_relation` explícito + nota |
| D com evidência | incorrect / "sem causa específica" | incorrect / **semantic_context** tipado |
| D2 grosseiro | partial / "sem causa" | partial / **unknown** explícito + `cause_coverage: none` |

### Casos que permanecem `unknown` (esperado e correto — §28/§29)

- **D2** e, na prática, **toda produção guiada/livre com o motor real** quando o
  verdict é `needs_revision`/`valid` **sem** `detected_errors` estruturados. Como
  documentado na seção de plumbing, os erros `meaning`/`task` (que sustentariam
  `semantic_context`) **não são alcançáveis** hoje para os modos `guided`/`free`.
  O adapter mantém `unknown` / `cause_coverage: none` — honesto, sem invenção.
- **Recomendação V2.14:** habilitar a evidência semântica estruturada para
  produção guiada (passar `requestedIntent`/`equivalentTarget` no shape correto,
  ou modo `equivalent`) — mudança de comportamento do motor, fora do escopo desta
  slice (§6/§29).

Métricas do audit (fixtures): `assessed_production_count: 6`,
`specific_cause_count: 5`, `unknown_cause_count: 1`, `cause_coverage_rate: 0.83`.
Warning esperado: `SEMANTIC_OUTCOME_WITHOUT_TYPED_CAUSE: D2` (advisory — não falha CI).
