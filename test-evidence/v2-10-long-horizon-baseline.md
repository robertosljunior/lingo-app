# Slice V2.10 — Runtime-Aware Capability Entry + Long-Horizon Validation

**Base:** `origin/main` = `d627a6b` (merge do PR #32, Slice V2.9).
**V2.9:** commit `592ce9a`, mergeado via PR #32. **DB_VERSION:** 5 (inalterado).
**Packs:** `pedagogy_v2_but`, `pedagogy_v2_still` (registry_version 1).
Baselines V2.9: `test-evidence/v2-9-post-merge-baseline.json`.

## Risco estrutural reproduzido (antes da correção)

A entrada de capability usava a primeira modalidade ordenada
(`CAPABILITY_MODALITIES[next][0]`) mesmo quando runtime-bloqueada:

| runtime | fast-learner (V2.9, 100 interações) |
|---|---|
| full | recognition 50 · comprehension 22 · controlled 16 · free 12 |
| **text-first (sem mic)** | **recognition 56 · comprehension 44 · produção 0 — writing 0** |
| **text-only** | **morre em 15 interações (só reading recognition; comprehension nunca entra por 'listening')** |

## Correção estrutural (Fase A — nenhum peso alterado)

- **`capability-entry.js`** — `getEligibleEntryDomainsForCapabilityV2` /
  `selectEntryModalityV2`: a entrada é escolhida entre modalidades com
  affordance, executáveis no runtime, com evidência avaliada e com o gate de
  capability satisfeito (o MESMO `capabilityGateMetV2` do engine). Seleção
  determinística (sorted-first entre elegíveis — sem peso novo); no runtime
  full o comportamento pré-V2.10 é preservado byte a byte.
- Reason codes internos: `ENTRY_MODALITY_SELECTED`,
  `RUNTIME_AWARE_CAPABILITY_ENTRY`, `PREFERRED_MODALITY_RUNTIME_UNAVAILABLE`,
  `ALTERNATE_MODALITY_SELECTED` (nunca exibidos ao aluno).
- **Invariante nova (grave):** `CAPABILITY_READY_BUT_NO_EXECUTABLE_ENTRY_DOMAIN`
  — verificada a cada passo do runner; nunca dispara quando o runtime não
  oferece modalidade executável.
- **Auditoria ampliada:** `has_capability_entry_path` /
  `has_modality_expansion_path` por domínio; detecções
  `CAPABILITY_WITHOUT_EXECUTABLE_ENTRY_PATH` (ex.: pronunciation sem assessor)
  e `TRAINABLE_DOMAIN_ONLY_REACHABLE_BY_UNAVAILABLE_SIBLING`.
- **Inspector:** entrada/expansão por modalidade (`sim`/`condicional`/`não`) —
  runtime unavailable nunca é déficit do aluno.
- Capability progression × modality expansion permanecem eixos separados.

## Matriz de runtimes (Fase A, 7 personas × 4 perfis, mesmas seeds)

`test-evidence/v2-10-runtime-matrix.json` — 28 execuções, **0 findings graves**:

| perfil | efeito estrutural |
|---|---|
| full | idêntico ao V2.9 em forma; produção via speaking+writing |
| text-first (sem mic) | **writing vira a entrada de produção** (ex.: new-learner writing 32; fast-learner 19); speaking 0 sem starvation falsa |
| no-audio | reading carrega recognition; produção via writing+speaking; **weak-listener passa a alcançar produção** (writing 23) |
| text-only | jornada completa por reading+writing (ex.: fast-learner writing 39, free production presente); antes morria em 15 interações |

## Long-horizon (Fase B — validação)

`test-evidence/v2-10-long-horizon.json`. Janelas: 1–50 / 51–100 / 101–200 / 201–500.

**Descoberta metodológica:** simular a jornada inteira numa ÚNICA StudySession
distorce horizontes longos — o orçamento de novidade da sessão esgota (~3
introduções) e nunca renova, produzindo `LATE_NOVELTY_STARVATION` /
`PACK_STARVATION` artificiais (só 6 de 28 targets expostos em 280 interações).
Isso é **limitação do harness**, não starvation do Planner. Correção:
`session_rotation_interactions` (novo campo OPCIONAL do cenário; default null
mantém todo cenário pré-V2.10 byte-idêntico) — a cada N interações uma nova
"sentada" recomeça StudySession + LessonSessions, como o controller real;
o estado do aluno persiste pela evidência.

**Resultados com rotação (12 = cap de atividades por sessão):**

| persona@horizonte | n | profundidade | diagnósticos |
|---|---|---|---|
| fast-learner@200r | 200 | rec 135 · comp 26 · ctrl 14 · **free 25** | (nenhum) |
| fast-learner@500r | 221 | esgota currículo elegível em 221 | (nenhum) |
| new-learner@200r | 182 | ctrl 59 | (nenhum) |
| support-dependent@200r | 200 | ctrl 84 · free 2 | LATE_NOVELTY_STARVATION |
| struggling@200r | 200 | ctrl 40 · free 3 — remediação sem loop | LATE_NOVELTY_STARVATION |
| forgetful@200r/500r | 200/500 | reviews recorrentes; free 10 em 500 | LATE_REVIEW_DOMINANCE |
| weak-listener@200r | 200 | listening dominante (persona) | LATE_NOVELTY_STARVATION |
| cross-pack@200r | 200 | transfer ativo | LATE_NOVELTY_STARVATION, LATE_REVIEW_DOMINANCE |

Perguntas do §15: review cresce sem virar permanente (exceto forgetful, onde é
**coerente com a persona**, §23); novelty flui até o teto curricular; expansão
de modalidade acontece; fast-learner produz; struggling recebe remediação sem
prender; forgetful revisa sem loop eterno; sem ping-pong (switch rate < 0.5);
transfer segue registrado em 200+.

## Saturação e repetição

`curriculum_saturation` é **fato**, não finding: com 2 packs, os targets
restantes não-vistos em horizontes longos são bloqueados por pré-requisitos
profundos ou fim de frontier — o run termina honestamente quando o planner não
tem foco elegível. `EXCESSIVE_TARGET_REPETITION` dobra o limiar sob saturação e
registra `curriculum_saturated` nos detalhes.

## Decisão da Fase B (§20)

Nenhum caso satisfaz o critério de recalibração
(candidate existe + executável + alternativas + sem saturação + sistematicamente
ignorado). Classificação dos findings remanescentes:

| diagnóstico | classificação |
|---|---|
| LATE_NOVELTY_STARVATION (sessão única) | limitação do harness → corrigida pela rotação |
| LATE_NOVELTY_STARVATION (com rotação, 200+) | limitação de conteúdo (2 packs; targets restantes gated por pré-requisitos) |
| LATE_REVIEW_DOMINANCE (forgetful) | coerência de persona (§23) — esquecimento real pede revisão |
| runs terminando antes do horizonte (221/500) | limitação de conteúdo + semântica end-on-empty-step do harness |

**Nenhum peso foi alterado. `planner_version` permanece 1** (engine v1,
observability v1). Declaração explícita: nenhuma recalibração foi necessária.
