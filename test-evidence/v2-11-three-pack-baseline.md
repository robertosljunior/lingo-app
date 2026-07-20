# Slice V2.11 — Third Functional Lexeme `yet` + Three-Pack Curriculum Graph

**Base:** `origin/main` = `f2c5e5a` (merge do PR #33, Slice V2.10).
**V2.10:** commit original `143e600` (contido no main — `git merge-base --is-ancestor` confirma).
**DB_VERSION:** 5 (inalterado). **registry_version:** 1 (inalterado).
**Packs antes:** `pedagogy_v2_still`, `pedagogy_v2_but` (2 packs, 28 targets).
**Packs depois:** `pedagogy_v2_still`, `pedagogy_v2_but`, `pedagogy_v2_yet` (3 packs, 46 targets).
**Baseline long-horizon V2.10 (2-pack):** `test-evidence/v2-10-long-horizon.json`.

Nenhum peso recalibrado. `planner_version` permanece 1. Sem novos stores, sem SRS,
sem scheduler, sem backend, sem frases geradas, sem dist commitado.

## Pack `yet` — modelagem linguística

| núcleo de uso (sentido) | stage entrada | tradução por sentido |
|---|---|---|
| `sense:yet.temporal_pending` (esperado ainda não ocorrido) | A1 | *ainda* (neg.) / *já* (interrog.) |
| `sense:yet.concessive` (contraste concessivo) | B1 | *porém* / *mesmo assim* (and yet) |
| `sense:yet.maximal_so_far` (máximo até agora) | B1-B2 | *até agora* |
| `sense:yet.additive_repetition` (repetição além do esperado) | B1-B2 | *mais um* |

- **4 sentidos · 6 funções comunicativas · 8 construções · 32 exemplares · 8 relações.**
- **Temporal e concessivo são semanticamente distintos** — sentidos separados,
  não a mesma entidade em construções diferentes.
- **Tradução por sentido, nunca global:** o teste §38.18 verifica que nenhuma
  palavra pt-BR (`ainda`, `ja`, `porem`, `mais`) aparece em TODAS as traduções.
- Construções (com progressão): `subject_be_not_complement_yet` (A1) →
  `interrogative_clause_yet` (A1-A2) → `negative_perfect_yet` (A2) →
  `have_yet_to_infinitive` (A2-B1) → `clause_yet_clause` (B1) →
  `and_yet_clause` (B1-B2) → `superlative_yet` (B1-B2) → `yet_another_np` (B1-B2).

## Distinção de conceitos (§48)

- **Novo sentido:** `sense:yet.concessive` vs `sense:yet.temporal_pending` — mesmo
  lexema, sentidos distintos; conhecer um não implica o outro (golden §40.39).
- **Nova construção:** `construction:yet.interrogative_clause_yet` e
  `construction:yet.have_yet_to_infinitive` REUTILIZAM `sense:yet.temporal_pending`
  com construção própria (decisão documentada — não multiplicar sentidos).
- **Função compartilhada:** `construction:yet.clause_yet_clause` →
  `realizes_shared_function` → `function:express_unexpected_result` (função do
  pack `but`). Construção própria, função canônica reutilizada.
- **Relação semântica:** `sense:yet.temporal_pending` `contrasts_with`
  `sense:still.continuity` — relacionados mas distintos (nenhum funde).
- **Transferência cross-pack:** `but→yet` (concessivo elegível quando o contraste
  de `but` está consolidado) e `still→yet` (relação temporal).
- **Prerequisite:** exemplar concessivo `yet.017` tem prerequisites cross-pack
  `sense:but.contrast` + `construction:but.clause_but_clause` (o unlock real).

## Grafo N-para-N (§14, §39.27)

- `construction:still.clause_but_subject_still_verb` recebe relações de **`but` E
  `yet`** (uma entidade existente, dois packs).
- `yet` relaciona-se com **ambos** os outros packs: `still` (temporal, ≥2 refs) e
  `but` (concessivo, ≥2 refs, incl. `function:express_unexpected_result`).
- `and yet` conecta a `but...still` E `although...still` — dois caminhos
  curriculares distintos ao mesmo espaço funcional.
- **DAG:** `still` (sem deps) ← `but` ← `yet` → `still`. Verificação DFS de ciclo.
- **Ownership único:** cada entidade tem exatamente um owner pack.

## Compatibilidade retroativa (§12)

Teste `three-pack-graph.test.js` §30-32: gravadas evidências de `still`/`but`,
carregado o registry de três packs, todos os IDs antigos resolvem, os learner
states reconstruídos são **logicamente iguais** a uma reagregação pura
(`JSON.stringify` idêntico), e uma nova sessão vê o progresso anterior intacto
(`assessed_evidence_count` preservado). Nenhum ID de `still`/`but` mudou.

## Saturação curricular — teto ampliado (§27-28)

`test-evidence/v2-11-three-pack-long-horizon.json`. Comparação factual
(total_targets / remaining_eligible_unseen / saturation):

| persona/horizonte | 2-pack (V2.10) | 3-pack (V2.11) |
|---|---|---|
| new-learner 100 | 28 / 22 / false | **46 / 39 / false** |
| new-learner 200 | 28 / 22 / false | **46 / 39 / false** |
| weak-listener 100 | 28 / 20 / false | **46 / 38 / false** |
| support-dependent 200 | 28 / 22 / false | **46 / 39 / false** |
| fast-learner 100 | 28 / 22 / false | **46 / 37 / false** |
| struggling 200 | 28 / 18 / false | **46 / 39 / false** |
| cross-pack 200 | 28 / 20 / false | **46 / 34 / false** |

**Rotacionado (session_rotation 12, inclui 500):**

| persona/horizonte | 2-pack | 3-pack | xfer | lex | graves |
|---|---|---|---|---|---|
| new-learner 200r | 28 / 12 | **46 / 31** | 0 | 3 | 0 |
| weak-listener 200r | 28 / 12 | **46 / 19** | 5 | 3 | 0 |
| forgetful 200r | 28 / 8 | **46 / 18** | 5 | 3 | 0 |
| forgetful 500r | 28 / 8 | **46 / 16** | 5 | 3 | 0 |
| fast-learner 500r | 28 / 12 | **46 / 24** | 0 | 3 | 0 |
| struggling 200r | 28 / 15 | **46 / 17** | 1 | 3 | 0 |
| cross-pack 200r | 28 / 12 | **46 / 23** | 5 | 3 | 0 |

O teto subiu de 28 para 46 targets. Em **todos** os pontos de trajetória há mais
targets elegíveis ainda não vistos com três packs — a saturação foi ampliada, não
antecipada. **0 findings graves** em todos os horizontes; transferência cross-pack
presente. Nenhuma mudança de trajetória veio de pesos — apenas do novo conteúdo e
grafo.

## Matriz de runtime (§36) — `test-evidence/v2-11-runtime-matrix.json`

Full × 7 personas + text-first (fast) + text-only (fast) + no-audio (weak-listener).
**10 execuções, 0 findings graves.** Runtimes reduzidos degradam corretamente:

| perfil | efeito |
|---|---|
| fast-learner / text-first (sem mic) | produção por writing (W30), speaking 0 sem starvation falsa |
| fast-learner / text-only (sem áudio+mic) | reading+writing carregam tudo (W54, free production 34), listening 0 |
| weak-listener / no-audio | reading+writing+speaking (W29 S26), listening 0, alcança produção |

Todos com 3 lexemas rastreados — o terceiro pack não quebra runtime-aware entry.

## Correção estrutural (§37 — sem recalibrar)

O pool de candidatos de três packs excede o antigo teto de tentativas de supressão
de foco (5 no `study-session-controller.js`, 6 no `simulation-runner.js`), o que
famintava sessões de fast-learner por volta de 60–84 interações com ~40 candidatos
viáveis ainda disponíveis. Cada tentativa suprime UMA chave de foco não-servível, e
a caminhada sobre o pool termina naturalmente — o teto é apenas um guard rígido.
Elevado para 60 em ambos. **Nenhum peso, threshold, tier ou mapeamento alterado.**

## Bateria de validação (§46)

- `npm test` (vitest): **943 testes, 62 arquivos, todos passam.**
- `validate:pedagogy-v2`: 3 packs válidos (yet: 9 cross-pack refs); registry válido.
- `validate:content-packs` / `validate:knowledge-packs`: todos válidos.
- `inspect:pedagogy-v2`: yet auto-listado; 0 unreachable targets; 0 recognition
  hazards; toda domínio treinável reachable.
- `simulate:pedagogy-v2 --scenario all --check-determinism`: 7 cenários
  determinísticos, 0 graves.
- `benchmark:indexeddb`: 0 cross_profile_leaks.
- `build`: sucesso (dist NÃO commitado — restaurado).
- Node pure import: `BUILTIN packs: still, but, yet`.
- Playwright: `pedagogy-v2-yet.spec.js` (5) + suites V2 existentes (27) + inspector
  — todas passam. V1 smoke preservado.
