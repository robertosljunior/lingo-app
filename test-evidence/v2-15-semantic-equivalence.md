# Slice V2.15 — Semantic Equivalence: Meaning Preservation Beyond Essential Tokens

## Base
- SHA base: `9fb781e7e32bbc8541ee331f4770d4f477bd95d2`
- merge V2.14: PR #37 (commit `7aa6fe869f97baf02dda7fb6f402aae9d97dda2c`)
- DB_VERSION: 5 · Assessment version: 1 · Diagnosis version: 1 · semantic bridge version: 1

## §2 — Auditoria dos sinais existentes

| sinal | origem | confiável para equivalência? |
|---|---|---|
| essential-word presence | `fuseVerdict` equivalent mode | **necessário quando declarado, NUNCA suficiente** (§5) |
| polarity / negation | structural-nlp `negations` + `hasNegation` | sim, mas o alvo pode ser semanticamente negativo sem token NEG (ex.: "yet") → exige polaridade **autorada** |
| semantic similarity (cosine) | encoder `rank(resp, [target])` | **evidência, nunca autoridade** (§10) |
| top_frame / intent | `retrieveSemantics` | ranqueia contra KB, não contra o alvo → não usado para equivalência |
| structural NLP | `analyzeStructure` | sentence_type/negations úteis; sem NLI (§25) |
| hashing fallback | `HashingSemanticEncoder` | overlap de tokens; **não discrimina significado** |
| USE (quando instalado) | `UseSemanticEncoderAdapter` | embeddings reais; mais informativo |

### Prova: similaridade hashing NÃO discrimina significado (cosseno resp × alvo)

Alvo "The coffee is still hot.": `remains hot` 0.504 · `is warm` **0.630** · `is cold` **0.630** ·
`not hot anymore` 0.603 · `I like coffee` 0.149 · `tea is still hot` 0.667.
Alvo "The plan is simple but effective.": `simple and effective` 0.727 · `terrible` 0.603 ·
`very good` 0.502 · `cancelled` 0.502 · `I have a plan` 0.228 · `idea is simple but effective` 0.727.

`warm` == `cold` (0.630) e `terrible` ≈ `very good` (0.6/0.5): **hashing não pode
sozinho aprovar/reprovar significado** → política engine-aware, conservadora no hashing (§11).

### Problema V2.14 reproduzido (§23)

"The plan is simple but effective." + essential `["plan"]` + resposta `The plan is very good.`
→ hoje NÃO gera MEANING_MISMATCH porque `plan` está presente. Isto **não prova**
equivalência. Passa a ser resolvido pela evidência composta (→ `uncertain`, não `aligned`).

## §5/§27 — Semântica de essential + extensão de metadata

`essential_words` = "conceitos que não podem desaparecer"; ausência = evidência negativa
forte → `not_aligned`. Presença é só condição necessária. Extensão opcional autorada:
`polarity: "affirmative" | "negative"` (necessária para alvos com negação implícita como
"yet"). Validada; usada só quando autorada. Sem campos especulativos.

## §9-13 — Política de combinação (ordem) + decisão de threshold

1. resposta normalizada == alvo → **aligned** (conf 0.95).
2. polaridade autorada conhecida e contradição (resposta negada vs alvo afirmativo, ou vice-versa)
   → **not_aligned** (POLARITY_CONTRADICTION, conf 0.85). Sem polaridade autorada, a inferida
   é conservadora (conf menor, só contribui — nunca decide sozinha).
3. qualquer essential ausente → **not_aligned** (MISSING_ESSENTIAL_ENTITY, conf 0.8).
4. essential presente + polaridade ok:
   - similarity ≥ ALIGN_HIGH[engine] → **aligned** (HIGH_SEMANTIC_OVERLAP + ESSENTIAL_PRESERVED)
   - senão → **uncertain** (INSUFFICIENT_EVIDENCE)
5. default → **uncertain**.

**Thresholds (engine-aware, §12/§13):** decididos APÓS rodar a combinação sobre a golden
matrix (abaixo). `hashing ALIGN_HIGH = 0.85` (só quase-reprodução — similarity hashing é fraca,
§11); `use ALIGN_HIGH = 0.70` (paráfrases passam). `uncertain` NUNCA vira erro (§4/§29).

Justificativa por caso (por que o threshold é responsável): sob hashing, paráfrases legítimas
("coffee remains hot" 0.504) ficam abaixo de 0.85 → `uncertain` (conservador, correto §11);
sob USE a mesma paráfrase supera 0.70 → `aligned` (§36.4). "warm"/"cold" (0.630) < 0.85 → nunca
`aligned` por hashing; sob USE, embeddings distinguem e mantêm `uncertain`/`not_aligned` conforme
o modelo — nunca por similaridade isolada.

_(Matriz golden e resultados A/B/C/D preenchidos após implementação — ver seções finais.)_

## §14 — Golden matrix (classificação ANTES da calibração; per-engine)

Status esperado = o que a evidência LOCAL consegue provar (§15 sem laundering).
`hashing` é conservador (overlap fraco → mais `uncertain`); `use` (encoder controlado)
distingue paráfrases. Provas reais via `analyzeProduction` (hashing) confirmam a coluna hashing.

### still — "The coffee is still hot." (essential ["coffee"], polarity affirmative)
| resposta | hashing | use | motivo |
|---|---|---|---|
| The coffee is still hot. | aligned | aligned | EXACT_MATCH |
| The coffee remains hot. | uncertain | aligned | paráfrase (hashing 0.504 < 0.85; USE 0.90) |
| The coffee is warm. | uncertain | uncertain | mudança de estado, sem prova |
| The coffee is cold. | uncertain | uncertain | antônimo não provável localmente |
| The coffee is not hot anymore. | **not_aligned** | **not_aligned** | POLARITY_CONTRADICTION (§24) |
| I like coffee. | uncertain | uncertain | presente mas off-topic; sim baixa não reprova (§36.2) |
| The tea is still hot. | **not_aligned** | **not_aligned** | MISSING_ESSENTIAL_ENTITY (entidade diferente) |

### but — "The plan is simple but effective." (essential ["plan"], polarity affirmative)
| resposta | hashing | use | motivo |
|---|---|---|---|
| exact | aligned | aligned | EXACT_MATCH |
| The plan is simple and effective. | uncertain | aligned | paráfrase |
| The plan works well despite being simple. | uncertain | aligned | paráfrase |
| The plan is terrible. | uncertain | uncertain | sentimento não provável (documentado) |
| The plan was cancelled. | uncertain | uncertain | idem |
| I have a plan. | uncertain | uncertain | sim baixa não reprova |
| The idea is simple but effective. | **not_aligned** | **not_aligned** | MISSING_ESSENTIAL_ENTITY (sinônimo → FN documentado) |
| The plan is very good. | **uncertain** | **uncertain** | §23 — NÃO mais aligned por conter "plan" |

### yet — "She has yet to reply to the invitation." (essential ["invitation"], polarity negative)
| resposta | hashing | use | motivo |
|---|---|---|---|
| exact | aligned | aligned | EXACT_MATCH |
| She still hasn't replied to the invitation. | uncertain | aligned | negada == negative (sem contradição) — a polaridade AUTORADA resolve o "yet" |
| She hasn't answered the invitation yet. | uncertain | aligned | idem |
| She replied yesterday. | **not_aligned** | **not_aligned** | MISSING_ESSENTIAL_ENTITY |
| The invitation hasn't arrived. | uncertain | uncertain | invitation presente, negada==negative; sim baixa |
| She likes the invitation. | **not_aligned** | **not_aligned** | POLARITY_CONTRADICTION (afirmativa vs alvo negativo) |

## Cobertura (audit:assessment-v2 §19)
`hashing`: aligned 1 · not_aligned 4 · uncertain 5 · **false_positive 0 · false_negative 0**.
`use_controlled`: aligned 4 · not_aligned 4 · uncertain 2 · **false_positive 0 · false_negative 0**.

## §36 — Critérios de aceite
1. presença de essential não basta p/ aligned ✓ ("plan is very good" → uncertain)
2. similaridade isolada não reprova ✓ ("I have a plan" 0.228 → uncertain)
3. contradição de polaridade não passa ✓ ("not hot anymore" → not_aligned)
4. paráfrases legítimas passam (USE) ✓
5. target form separado de meaning ✓ (aligned + different_form coexistem)
6. naturalness separado ✓
7. uncertainty representável ✓ (→ unable_to_assess/not_assessed, nunca partial §29)
8. fallback hashing conservador ✓
9. semantic_context só com evidência suficiente ✓ (not_aligned)
10. V1 intacto ✓ (121 language-analysis + 98 E2E verdes)

## §37.35 — Limitações / §37.36 recomendação V2.16
- Sem sentimento/antônimos/NLI, contradições NÃO-polares ("terrible", "cancelled",
  "cold") ficam `uncertain` (honesto, nunca falso-aprova). Sinônimo que substitui a
  entidade essencial ("idea" por "plan") vira `not_aligned` (falso-negativo documentado).
- **V2.16:** avaliar meaning por embeddings de sentença (aceitar variação lexical),
  detecção segura de antonímia/estado, e `essential_concepts` autorados (conjuntos de
  sinônimos aceitáveis). Mantém a regra: nenhum sinal isolado decide.

## Engine (§12/§30)
`semantic_effective` reportado em cada resultado (`hashing` no CI; `use` quando o modelo
estiver instalado). Correctness NÃO depende de USE (§11): hashing → mais `uncertain`.
