# Slice V2.16 — Scalable Study Focus Resolution / Planner→Engine Materialization

## Base
- SHA base: `804062b4d6164190f11f10dc76068782c00ed53f`
- PR/merge V2.15: PR #38 (commit `b5252253c397aa30cfb81bca893a275afc4fa20d`)
- DB_VERSION: 5 · registry version: 1 · planner_version: 1 · engine_version: 2
- packs: still, but, yet · targets: 32 (11 senses + 18 constructions + 3 lexemes), 81 exemplars

## §2 — Cap 60 reproduzido + causa

Desde V2.11 tanto `study-session-controller.js` quanto `simulation-runner.js`
carregavam a MESMA suppression walk com um cap fixo:

```
for (let attempt = 0; attempt < 60; attempt++) { planner → engine → suppress }
```

O `60` (5→60 ao longo da V2.11) é um magic number: termina por uma constante,
não pelo universo real de candidatos. Com mais conteúdo o problema reaparece.
Prova empírica (long horizon, abaixo): `max rejected before selection` **cresce
com o horizonte** (7 em 200 interações, 13 em 500) — um cap fixo eventualmente
quebra.

## §4-9 — Arquitetura do Resolver

Novo módulo compartilhado `study-focus-resolver.js`:

```
Study Planner  → "o que é prioritário?"  (dono do ranking; sem mudança)
Study Focus Resolver → "qual pode ser materializado agora?" (SEM pesos)
Lesson Engine  → "como praticar?"  (dono da atividade; sem mudança)
```

`resolveNextStudyActivityV2(...)` → um de:
- `{ status: 'activity', focus, planner_decision, engine_decision, lesson_session, resolution_trace }`
- `{ status: 'planner_empty', planner_decision, resolution_trace }`  — nenhum foco elegível
- `{ status: 'no_materializable_focus', planner_decision, resolution_trace }` — focos existem, nenhum materializa

### Terminação (§2/§28)
O resolver itera o planner acumulando `suppressedFocusKeys` (preservando a
semântica V2.15 EXATA, inclusive o fallback reviewLimited) e termina quando o
planner retorna `no_eligible_focus` — **candidate exhaustion**, não um cap. Cada
focus key é tentada no máximo uma vez. Universo de candidatos = união das keys em
`trace.candidates ∪ trace.excluded` (o `buildStudyCandidatesV2` é
suppression-independente, então o universo é idêntico em toda a resolução).

Shape de custo (§28): `K planner calls + K engine calls`, com `K ≤ |universo|` e
**nenhuma constante fixa** — documentado, correctness > redução de planner calls
(§6/§29: comportamento V2.15 preservado; onde V2.15 achava atividade antes do 60,
V2.16 seleciona o mesmo foco/plan).

## §13 — Invariantes (erros, nunca session-complete silencioso)
`FOCUS_RESOLUTION_DUPLICATE_ATTEMPT`, `FOCUS_RESOLUTION_SELECTED_UNRANKED_CANDIDATE`,
`FOCUS_RESOLUTION_ATTEMPTS_EXCEED_UNIQUE_CANDIDATES`,
`FOCUS_RESOLUTION_STOPPED_BEFORE_CANDIDATE_EXHAUSTION` (via distinção planner_empty
vs no_materializable_focus).

## §8 — Reason codes estruturados (sem parsear texto)
`ENGINE_NO_ELIGIBLE_EXEMPLAR`, `ENGINE_NO_SAFE_RECIPE`, `ENGINE_PREREQUISITE_UNMET`,
`ENGINE_RUNTIME_UNAVAILABLE`, `ENGINE_FOCUS_INDEPENDENCE_NOT_EXECUTABLE`,
`ENGINE_FOCUS_MODALITY_NOT_EXECUTABLE`, `ENGINE_SESSION_EXHAUSTED`,
`ENGINE_NO_ELIGIBLE_ACTIVITY` — derivados dos enums estruturados do engine decision.

## §14-17/§27 — Synthetic scalability (pools 10/50/100/250/500)
Injetando planner/engine sintéticos: quando só o último candidato materializa,
`attempted_count == N` e `planner_rank == N` para N ∈ {10,50,100,250,500} — custo
cresce com candidatos, não com constante. rank 1 → `attempted_count == 1` (sem
desperdício). 100 todos rejeitados → `no_materializable_focus` (não session-complete
após 60). rank 100 selecionado (falharia sob o cap antigo). Keys únicas garantidas.

## §23/§12 — Three-pack regression + controller↔resolver
- 3 packs reais: `attempted_count < 60`, keys únicas, foco selecionado ∈ universo do planner.
- Controller apresenta o MESMO foco/plan que uma chamada direta ao resolver (mesmo snapshot).
- Determinístico: traces idênticos entre execuções.
- Golden trajectories + simulation-determinism (todas verdes) → trajetória 3-pack inalterada.

## §26 — Long horizon (fast-learner, session rotation)
| horizonte | rotation | materialization_rate | mean rank | mean rejected | **max rejected** | no_materializable | saturation |
|---|---|---|---|---|---|---|---|
| 200 | 40 | 1.0 | 3.67 | 2.67 | **7** | 0 | false (21 unseen) |
| 500 | 50 | 1.0 | 3.858 | 2.858 | **13** | 0 | false (14 unseen) |

`max rejected` cresce (7→13) com o horizonte — evidência direta de que o cap fixo
era frágil. Nenhum grave finding novo; só warnings informativos pré-existentes.

## §24 — Semantic V2.15 congelada
Nenhuma alteração em language-analysis / Semantic Bridge / equivalence thresholds /
metadata / Assessment Diagnosis / Feedback semantics. `src/lib/language-analysis`
(121 testes) e semantic-equivalence (53) permanecem verdes e inalterados.
