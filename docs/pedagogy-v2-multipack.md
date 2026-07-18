# Pedagogy V2 — Registry multi-pack + lexema `but` (Slice V2.5)

Esta slice generaliza a arquitetura V2 para múltiplos packs pedagógicos e
adiciona o segundo lexema funcional (`but`). Nada aqui altera o núcleo V1
congelado, o schema do learner model (DB_VERSION continua 5) ou os IDs do pack
`still` (Slice V2.1).

## Princípio curricular (registrado e preservado)

> **Palavras funcionais frequentes entram cedo; seus sentidos, construções,
> relações e graus de autonomia são aprofundados progressivamente.**

> **O aluno não abandona uma palavra depois de "aprendê-la". Ele volta a
> encontrá-la em novas construções e funções comunicativas.**

Consequência estrutural: o lexema `but` — como `still` — **não possui nível
CEFR global** (o validador rejeita qualquer chave de nível no lexema). O que
carrega recomendação de estágio é sempre o uso: sentido, construção, exemplar.

## 1. Registry multi-pack (`src/lib/pedagogy-v2/registry.js`)

Substitui o `pack-registry.js` de pack único. API:

| Função | Retorno |
|---|---|
| `loadPedagogyV2Registry()` | registry validado, congelado e canônico dos packs builtin |
| `buildPedagogyV2Registry(packs)` | idem, para uma lista explícita (testes) |
| `getPedagogyPack(packId)` / `getAllPedagogyPacks()` | packs por id / todos |
| `getLexemeAcrossRegistry(lexemeId)` | `{ pack_id, lexeme }` |
| `resolvePedagogyTarget(target)` | `{ pack_id, kind, entity }` com checagem de tipo |
| `resolvePedagogyExemplar/Construction(id)` | resolução tipada global |
| `resolvePedagogyPrerequisite(prereq)` | V2 → entidade; `grammar_skill_v1` → bridge não resolvido |
| `getPacksForLexeme(lexemeId)` | packs ancorados no lexema |
| `getPedagogyEntityOwner(id)` | pack proprietário |

Garantias: ordem canônica por `pack_id` (o resultado independe da ordem de
importação), IDs globalmente únicos, validação **antes** do uso (registry
inválido lança), deep-freeze após validação (engine e UI não conseguem mutar),
nenhuma importação de packs V1 e nenhuma conversão para skill V1.

## 2. Propriedade de entidades

A propriedade é **estrutural**: o pack que define a entidade em suas seções é
o único proprietário. O validador de registry rejeita dois packs definindo o
mesmo ID (`GLOBAL_DUPLICATE_ID`) e dois lexemas distintos para o mesmo
(lemma, language) (`LEXEME_ALIAS_AMBIGUOUS`). Um pack pode **referenciar**
entidade de outro pack — nunca redefini-la.

```text
pack pedagogy_v2_still owns: lexeme:still, sense:still.*, construction:still.*, function:express_continuation, …
pack pedagogy_v2_but   owns: lexeme:but,   sense:but.*,   construction:but.*,   function:express_simple_contrast, …
```

Referências externas exigem **dependência declarada** no manifest:

```json
"dependencies": [{
  "pack_id": "pedagogy_v2_still",
  "required_schema_version": "1",
  "reason": "Reutiliza a construção concessiva construction:still.clause_but_subject_still_verb …"
}]
```

Um pack **sem** dependências mantém o comportamento estrito de pack único
(qualquer referência não local é erro). Com dependências, o validador por pack
coleta os candidatos externos (`external_refs`) e o validador de registry os
resolve contra os packs declarados — referência a pack não declarado é
`CROSS_PACK_DEPENDENCY_UNDECLARED`; inexistente é `CROSS_PACK_REF_UNRESOLVED`.

Validação global adicional: pack IDs duplicados, versão de schema incompatível
(`required_schema_version` vs. schema do alvo), dependência circular de packs,
ciclos de pré-requisito atravessando packs, lexema principal obrigatório
(`manifest.primary_lexeme_id`, possuído localmente), mistura V1 rejeitada e
elementos fixos de construção cross-pack verificados no texto do exemplar.

## 3. Relações tipadas (`pack.relations`)

Relação = `{ relation_type, from, to, description_pt }`, sempre **dirigida** e
tipada (nunca array de strings soltas). Semântica documentada em
`PEDAGOGY_V2_RELATION_TYPES` (contracts.js):

| Tipo | Semântica (from → to) |
|---|---|
| `prerequisite` | from é aprendido depois de to (ordem curricular) |
| `related_construction` | relação pedagógica não bloqueante |
| `realizes_shared_function` | construção from realiza função to de outro pack |
| `extends_usage` | from estende/aprofunda o padrão de to |
| `contrasts_with` | from deve ser distinguido de to no ensino |
| `reuses_lexeme_context` | construção from embute lexema to sem possuí-lo |

As relações não criam dependências circulares de packs: apenas o manifest
`dependencies` participa do grafo de dependências.

## 4. Modelagem do pack `but`

- **1 lexema** (`lexeme:but`, conjunção/preposição, banda qualitativa
  `high_frequency_functional`, glosas pt-BR, sem nível).
- **4 sentidos**: `contrast` (A1), `counter_expectation` (A2, extensão
  convencionalizada do contraste via `related_sense_ids` — **mesma decisão de
  modelagem usada em `sense:still.counter_expectation`**), `correction`
  (not X but Y, B1) e `exception` (preposicional, B1-B2).
- **Decisão 7.2 (documentada)**: contra-expectativa é um sentido próprio;
  a leitura plena emerge da **combinação** sentido + construção + função.
  Sem `still` ela usa a construção coordenada do próprio pack
  (`I was tired, but I finished the work.`); com `still` usa a construção
  `construction:still.clause_but_subject_still_verb`, que **permanece
  propriedade do pack `still`** e é referenciada (nunca duplicada) — a opção
  que preserva IDs, não invalida evidência, não exige migration e evita
  redefinição.
- **6 funções comunicativas** próprias; a leitura contra-expectativa também
  declara `realizes_shared_function → function:express_result_despite_obstacle`
  (propriedade de still), exatamente o padrão do exemplo do briefing.
- **5 construções próprias** (`clause_but_clause`, `adjective_but_adjective`,
  `not_x_but_y`, `universal_but_exception`, `polite_marker_but_clause`) + a
  construção referenciada `still.clause_but_subject_still_verb`. A construção
  de exceção declara `contrasts_with` o coordenador de orações (distinção
  exigida pela seção 7.3).
- **27 exemplares** bilíngues completos (≥4 por construção, incluindo 4 novos
  exemplares para a construção referenciada), todos com alvos, pré-requisitos,
  contexto e intended new items; nenhuma frase gerada, nenhuma palavra isolada.
- **Progressão**: A1 contraste → A1-A2 consolidação em passado → A2
  contra-expectativa (sem still) → A2 but...still (referência cross-pack) →
  A2-B1 adjetivos → B1 correção e objeção educada → B1-B2 exceção.

### Pré-requisitos entre `but` e `still` (casos da seção 11)

1. **but sem still**: contraste simples não exige still; os exemplares da
   construção but...still declaram pré-requisitos reais no lado still
   (`sense:still.continuity`, `construction:still.subject_still_lexical_verb`)
   e ficam bloqueados (`prerequisite_unknown/unmet`) até que existam.
2. **still sem but**: os alvos de but começam desconhecidos — conhecer still
   nunca implica conhecer but; a sessão de but começa na exposição A1.
3. **contraste conhecido**: o motor pode introduzir `It was difficult, but I
   still tried.` (exemplares `but.008–011`) reutilizando a construção/função
   relacionadas quando o lado still estiver atendido.
4. **but...still conhecido**: continua sendo a base curricular de
   `although … still` no pack still (pré-requisito V2.1 preservado).

## 5. Engine, contexto e learner model

- `selectNextActivityV2` recebe o **escopo formal**
  `{ registry, pack_id, lexeme_id }` (nunca arrays informais). Sessão normal
  seleciona apenas exemplares do pack ativo; pré-requisitos resolvem no
  registry completo; estados de qualquer pack são consultados; o trace anota
  `external: true, owner_pack_id` quando o pré-requisito pertence a outro
  pack. Determinismo, orçamento de novidades e runtime availability
  preservados. O plano declara `pack_id`, `lexeme_id` e `lexeme_lemma` (fonte
  única dos textos da UI).
- `buildLessonEngineContextV2` (context_version 2) declara registry version,
  pack/lexema ativos, dependências e targets externos usados como
  pré-requisito, e **filtra** estados/evidências para os alvos relevantes ao
  pack ativo em vez de carregar todo o histórico. Continua somente leitura.
- Learner model: **schema intocado** (sem bump de DB, sem stores novos). Só a
  resolução de targets passou a usar o registry
  (`createRegistryTargetResolver`), aceitando alvos de qualquer pack
  registrado. Estados continuam keyed por target id global — still e but nunca
  colapsam; alvos compartilhados (a construção but...still) somam evidência de
  ambas as jornadas no mesmo estado, por construção.

## 6. UI genérica

`PedagogyV2Lab` (substitui a tela específica de still): seleção de pack
(palavra, descrição curta, contagens, progresso **factual** — nunca nível,
porcentagem única ou "palavra concluída") → sessão parametrizada pelo escopo.
Feature flag única `pedagogy_v2_pilot_enabled`; pack inexistente mostra erro e
volta ao laboratório. Textos de feedback e resumo derivam do lexema ativo do
plano. Nenhum componente compartilhado contém hardcode pedagógico de `still`
(teste automatizado §26.65).

## 7. Tooling

- `npm run validate:pedagogy-v2` — valida cada pack, o registry completo e as
  referências cross-pack; imprime a auditoria de alternativas como warning.
- `npm run inspect:pedagogy-v2` — inspeção somente leitura e determinística:
  packs, dependências, entidades, progressão, referências cross-pack, IDs sem
  uso, targets sem exemplares, funções sem construção, construções sem
  progressão, orçamento de novidades e duplicações de tradução.
- `auditRecognitionOptionsV2` (options-audit.js) — auditoria estrutural das
  alternativas autoradas (idênticas, normalizadas idênticas, distrator igual à
  tradução alvo, opções insuficientes, fonte de pack incorreto). Sem sinonímia
  profunda por regex; sem alternativas seguras o runtime mantém o
  comportamento: outro exemplar → outro recipe → `no_eligible_activity`.
