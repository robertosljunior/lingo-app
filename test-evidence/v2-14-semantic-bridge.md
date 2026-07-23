# Slice V2.14 — Plan-Aligned Semantic Assessment Bridge

## Base

- SHA base: `4543f93cafb38b1ffc24cd5a3a864528175dc09c`
- PR/merge da V2.13: PR #36 (commit original `572a6fd2f521d3e222a4b2de3448a0e796789664`)
- DB_VERSION: 5 (inalterado) · registry version: 1 · packs: still, but, yet
- ASSESSMENT_VERSION: 1 · DIAGNOSIS_VERSION: 1 · Feedback View Model version: 2

## §2 — Gap V2.13 reproduzido

Os wrappers `analyzeSemantics` nas telas (Lab focused, Study Session, Playground)
eram `async ({ text, assessmentMode }) => analyzeProduction({ text, assessmentMode })`
— descartavam `equivalentTarget`/`requestedIntent`. Além disso `activity-assessment`
passava `equivalentTarget: plan.text_en` (string) e `context`, shapes que o
`analyzeUserProduction` não consome em `guided`/`free`. Logo `semantic_context`
era inalcançável para produção. Teste de regressão (§28) prova a perda no fluxo
antigo e a preservação no serviço compartilhado novo.

## §3 — Contrato público real do language-analysis (`analyzeProduction` → `analyzeUserProduction`)

| assessmentMode | parâmetros consumidos | comportamento | pode gerar |
|---|---|---|---|
| `free` (default) | `text` | gramática/estrutura/naturalness; **similaridade nunca reprova**; sem alvo semântico | grammar / naturalness |
| `guided` | `text`, `requestedIntent` | verifica presença do intent/frame; só age quando `requestedIntent` casa o vocabulário real; sem intent presente → erro `task/requested_intent` | grammar / semantic (task) |
| `equivalent` | `text`, `equivalentTarget: { text, essential_words }` | short-circuit exato; senão checa content words essenciais ausentes; **similaridade isolada nunca reprova** | grammar / `meaning` (meaning_mismatch) |

`analyzeProduction` faz spread de `...params`, então TODOS os campos suportados
chegam a `analyzeUserProduction` — a única perda estava nos wrappers das telas.

### Vocabulário real de `requestedIntent` (frames + intent_signals)

Extraído dos `semantic_frames[].intent` dos knowledge-packs + sinais estruturais:
`ability, action, description, location, obligation, past_experience,
polite_request, possession, question, request, time, future_plan`.

Nenhum casa bem com still/but/yet → **`guided_intent` não é adequado a estes packs**;
a estratégia autorada usada é `equivalent_meaning`. O contrato/validator suportam
`guided_intent` para uso futuro, validando contra este vocabulário.

## §4 — `context` não é mecanismo de verdict

`analyzeUserProduction` não consome um parâmetro genérico `context` para verdict.
O bridge preserva `context` apenas para diagnóstico; **nunca** influencia o verdict.

## Prova de comportamento (engine efetivo: hashing fallback, sem USE)

`equivalent_meaning`, `equivalentTarget = { text: 'She still works at the hospital.', essential_words: ['hospital'] }`:

| resposta | verdict | detected_errors | diagnosis |
|---|---|---|---|
| `I like bananas.` | needs_revision | `meaning/high` | **semantic_context** |
| `She still works at that hospital.` | valid | — | correct |
| `She continues working at the hospital.` | valid | — | correct (mantém "hospital") |
| `She still work at the hospital.` | needs_revision | `verb_form/high` | **grammar** |

Confirma: alcançável de forma determinística sem USE; a palavra essencial (substantivo
concreto) captura resposta claramente fora do tópico e aceita variações que a preservam.

### Limitação documentada (§17/§19)

A checagem `equivalent` é por **presença literal de token** — é um proxy grosseiro:
um sinônimo do essencial ("clinic" por "hospital") daria falso `meaning_mismatch`, e
manter a palavra com sentido trocado daria falso positivo. Por isso as `essential_words`
são **curadas manualmente e mínimas** (só o conteúdo obrigatório, preferindo substantivos
concretos). Recomendação V2.15: checagem por embeddings/paráfrase para variação lexical.

## §16-20 — Casos A/B/C/D (chain real: bridge → analyzeProduction (hashing) → diagnosis)

Atividade autorada `exemplar:still.007` "The coffee is still hot.",
`semantic_assessment = { strategy: equivalent_meaning, essential_words: ["coffee"] }`,
materializada de forma determinística (free_production/writing):

| caso | resposta | outcome | strategy / mode | primary cause | semantic_relation |
|---|---|---|---|---|---|
| A — semanticamente fora | `I like bananas.` | incorrect | equivalent_meaning / equivalent | **semantic_context / MEANING_MISMATCH** | not_aligned |
| B — variação aceitável | `The coffee is still warm.` | correct | equivalent_meaning / equivalent | — | aligned |
| C — naturalness/variação | `The coffee stays hot.` | correct | equivalent_meaning / equivalent | — | aligned |
| D — forma-alvo | (meaning correto, sem a construção) | correct/aligned | equivalent_meaning | — | aligned + `target_form_relation` separado |

Confirma os critérios: (16) semantic_context alcançável só com alvo autorado e
evidência estrutural real; (17) variação aceitável que preserva a palavra
essencial NÃO gera meaning mismatch; (18) naturalness não vira grammar nem
meaning mismatch; (20) forma-alvo permanece separada de meaning.

### Exemplares anotados (curadoria mínima, §9)

- `exemplar:still.007` "The coffee is still hot." → essential `["coffee"]`
- `exemplar:but.012` "The plan is simple but effective." → essential `["plan"]`
- `exemplar:yet.014` "She has yet to reply to the invitation." → essential `["invitation"]`

Todos com `strategy: equivalent_meaning`. `guided_intent` fica suportado no
contrato/validator, mas NÃO é usado (o vocabulário real de intents do motor —
ability/action/description/location/… — não casa com still/but/yet). Registrado
como limitação; recomendação V2.15: frames/intents próprios do currículo V2.

### Backward compatibility (§30)

Exemplares SEM `semantic_assessment` → `strategy: free` (fallback), comportamento
idêntico ao V2.13 (todos os 727 testes pedagogy-v2 continuam verdes).
