# Pedagogy V2 — Modelo de Conteúdo (Slice V2.1)

Decisão arquitetural aprovada (auditoria de 2026-07): **preservar interface e
infraestrutura, congelar o núcleo pedagógico V1 e criar um núcleo V2 paralelo.**
Esta slice implementa somente a fundação do `content_v2`: contratos, schema
versionado, validador, registry de leitura e o primeiro pack autorado
(lexema **still**). Nada aqui é consumido pelo gerador V1, pelo corretor V1 ou
pela UI.

## Regra curricular central

> **Palavras frequentes entram cedo; sentidos, construções e autonomia são
> aprofundados progressivamente.**

Experiência desejada para o aluno:

> **“Eu já conheço "still". Agora estou aprendendo uma nova maneira de usá-la.”**

## 1. Por que o lexema não possui nível

No modelo V1, o nível CEFR é atributo do pack (tema×nível) e da skill
(`cefr_start`). Isso força "uma palavra = um nível" — falso para palavras
funcionais frequentes: *still* aparece em produção A1 ("I still live here.") e
em uso discursivo B1/B2 ("Still, we need to be careful."). No V2:

- o **lexema** carrega lema, classe, glosas e banda de frequência — nunca nível;
- o validador **rejeita** qualquer chave de nível no lexema
  (`LEXEME_GLOBAL_LEVEL_FORBIDDEN`; chaves proibidas em
  `FORBIDDEN_LEXEME_LEVEL_KEYS`, `src/lib/pedagogy-v2/contracts.js`);
- o que carrega recomendação de estágio é o **uso**: `first_exposure_stage` no
  sentido, `recommended_stage` na construção, `exposure_stage` no exemplar.

Estágios (`EXPOSURE_STAGES`): `A1, A1-A2, A2, A2-B1, B1, B1-B2, B2`. Bandas
("A2-B1") expressam transições que o currículo pode agendar de um lado ou do
outro. São **recomendações de exposição**, não medidas de domínio do aluno.

## 2. Entidades: lexema, sentido, construção e função comunicativa

| Entidade | O que é | O que NÃO é |
|---|---|---|
| `lexeme` | A palavra canônica (lema, classe, glosas) | Um nível; uma unidade de domínio |
| `sense` | Um núcleo de significado/função semântica do lexema | Uma frase; uma estrutura sintática |
| `construction` | Uma estrutura reutilizável com elementos fixos + slots restritos | Um template de substituição cega |
| `communicative_function` | O que o aluno aprende a expressar/compreender | Uma categoria gramatical |
| `exemplar` | Frase completa, natural, bilíngue, com declarações pedagógicas explícitas | Uma palavra isolada; um item de vocabulário |

IDs são tipados por prefixo (`lexeme:`, `sense:`, `construction:`, `function:`,
`exemplar:`), o que torna a mistura silenciosa com `skill_id`s V1 (snake_case
puro) estruturalmente impossível — o validador rejeita IDs sem prefixo
(`ID_PREFIX_INVALID`) e referências V1 não marcadas.

## 3. Relação muitos-para-muitos entre sentidos e construções

- Um **sentido em várias construções**: `sense:still.continuity` é realizado por
  `construction:still.subject_still_lexical_verb` e por
  `construction:still.subject_be_still_complement`.
- Uma **construção com mais de uma função**:
  `construction:still.although_clause_subject_still_verb` declara
  `introduce_concession` **e** `express_result_despite_obstacle`.
- Uma **função em várias construções**: `express_result_despite_obstacle` é
  realizada pelas construções com *but* e com *although*.

O schema codifica isso com `sense_ids[]` e `communicative_function_ids[]` em
cada construção (ambos obrigatórios e não vazios — invariante
`CONSTRUCTION_WITHOUT_SENSE`/`CONSTRUCTION_WITHOUT_FUNCTION`).

## 4. Por que "I still live here" e "I am still tired" compartilham um sentido

Nas duas frases, a contribuição semântica de *still* é a mesma: **algo continua
verdadeiro** — uma ação em curso na primeira, um estado persistente na segunda.
O que muda é a **estrutura**: posição pré-verbal com verbo lexical vs. posição
pós-*be* com complemento. Modelar isso como dois sentidos duplicaria o
significado; modelar como uma construção só apagaria a diferença estrutural que
o aluno precisa adquirir separadamente. Por isso: **um sentido
(`sense:still.continuity`), duas construções**, cada uma com sua função
comunicativa dominante (`express_continuation` vs `express_persistent_state`).
Há teste automatizado provando exatamente este par
(`still-pack.test.js › sense vs construction`).

### Decisão: "persistência apesar de obstáculo"

"It was difficult, but I still tried." foi modelado como **sentido próprio**
(`sense:still.counter_expectation`), documentado como extensão concessiva
convencionalizada da continuidade (`related_sense_ids` aponta para
`continuity`). Justificativa: a paráfrase muda de "ainda" para "mesmo assim" —
a contribuição de *still* deixa de ser temporal e passa a assertar o resultado
contra uma expectativa. A leitura concessiva **plena** emerge da combinação
sentido + construção (*but*/*although*) + função comunicativa — ou seja, é uma
combinação entre sentido e função suportada pelo schema, não um rótulo único.

## 5. Como "although… still…" é modelado como construção

`construction:still.although_clause_subject_still_verb`:

- `fixed_elements: ["although", "still"]` — os dois são **solidários**: o
  validador rejeita exemplar desta construção sem qualquer um deles
  (`EXEMPLAR_FIXED_ELEMENT_MISSING`);
- `semantic_relation: { relation: "result_despite_obstacle", cause_slot:
  "obstacle_clause", result_slot: "result_verb" }` — a relação
  *obstáculo/expectativa contrária → resultado que acontece mesmo assim* é
  propriedade da construção, não das palavras isoladas;
- slots com papéis declarados (`obstacle_or_contrary_expectation`,
  `achieved_result`) — o contrato mínimo para que nenhum motor futuro precise
  de substituição cega para instanciá-la;
- `prerequisite_construction_ids` referencia a construção com *but* — a versão
  coordenada é pré-requisito curricular da subordinada.

## 6. Primeira exposição × complexidade da atividade × domínio do aluno

Três eixos deliberadamente separados:

1. **Primeira exposição** (`first_exposure_stage` / `recommended_stage` /
   `exposure_stage`) — recomendação curricular de *quando apresentar* aquele
   uso. Vive no conteúdo (esta slice).
2. **Complexidade da atividade** — quanta autonomia a atividade exige
   (reconhecimento → produção guiada → produção livre). Vive no
   `lesson_engine_v2` (slice futura); o conteúdo apenas fornece alvos e
   pré-requisitos para que a atividade seja calibrada.
3. **Domínio do aluno** — evidência acumulada por sentido × construção ×
   modalidade × apoio. Vive no `learner_model_v2` (slice futura); **nenhum**
   campo deste schema afirma o que o aluno sabe.

## 7. Fronteira entre V1 e V2

- Namespace de dados: `src/content/pedagogy-v2/` (novo), separado de
  `src/content/packs/` (V1) e `src/content/knowledge-packs/` (motor de análise).
- Namespace de código: `src/lib/pedagogy-v2/` (novo). Não importa
  `skill-registry.js`, `lesson-template-registry.js`, `lexical-bank.js` nem os
  contratos de lição gerada. Nada do V1 importa deste namespace.
- Identidade: `pack_kind: "pedagogical_v2"` + IDs prefixados. Alvos V2 **não**
  são registrados como custom skills da V1.
- Ponte explícita e opcional: pré-requisito
  `{ "type": "grammar_skill_v1", "ref": "<skill_id>", "compat_bridge": true }`.
  O flag é obrigatório (`PREREQ_V1_BRIDGE_FLAG_REQUIRED`) e o acesso é apartado
  na API (`getV1BridgePrerequisites`), para que integrações futuras com o
  planner V1 sejam opt-in, nunca identidade do conteúdo.

## 8. Fora de escopo desta slice (deliberado)

Stores IndexedDB V2 · learner model V2 · lesson engine V2 · feature flag ·
telas/rotas · integração com `Exercise.jsx` · migração de usuários · qualquer
alteração no gerador V1, no corretor V1 ou no roteamento de motores de
avaliação · packs V2 instaláveis em runtime · resolução de referências entre
packs (pré-requisitos lexicais externos usam `context_items` declarativos até a
V2.2 introduzir um registry multi-pack).

## 9. Como learner_model_v2 e lesson_engine_v2 consumirão este schema

O schema foi desenhado para responder às quatro perguntas do sistema:

| Pergunta | Campo que responde |
|---|---|
| O que está sendo ensinado? | `pedagogical_targets` (união discriminada `{target_type, target_id, role}`) |
| O que o aluno já deveria conhecer? | `prerequisites` (refs V2 + pontes V1 marcadas) |
| O que é apenas contexto? | `context`, `context_items` |
| Qual evidência deverá ser coletada? | alvos `primary` × construção × sentido do exemplar — a chave natural do evento de evidência V2 |

Fluxo previsto: `lesson_engine_v2` seleciona exemplares por
`exposureProgression` filtrando pré-requisitos já dominados (consulta ao
`learner_model_v2`) e limitando `intended_new_items` por sessão;
`learner_model_v2` grava evidência keyed por `target_id` + modalidade + apoio;
`assessment_v2` reutiliza o pipeline `language-analysis` existente nos modos
`equivalent`/`guided`/`free`.

## 10. Exemplo completo: o pack "still"

`src/content/pedagogy-v2/still.json` — 1 lexema, 3 sentidos, 5 funções
comunicativas, 5 construções, 22 exemplares bilíngues (≥4 por construção):

| Estágio | Construção | Exemplo |
|---|---|---|
| A1 | `subject + still + lexical verb` | "I still live here." |
| A1-A2 | `subject + be + still + complement` | "I am still tired." |
| A2 | `clause + but + subject + still + verb` | "It was difficult, but I still tried." |
| A2-B1 | `although + clause, subject + still + verb` | "Although it was hard, I still tried." |
| B1-B2 | `Still, + clause` | "Still, we need to be careful." |

Cada exemplar declara: alvo primário/secundário, pré-requisitos (V2 e pontes
V1), novidades pretendidas (máx. 2; exemplares de consolidação declaram zero),
contexto situacional, itens contextuais, notas de uso, status de naturalidade e
estágio de exposição.

Validação: `npm run validate:pedagogy-v2` (estrutural; naturalidade linguística
é responsabilidade da autoria e dos testes de conteúdo —
`src/lib/pedagogy-v2/still-pack.test.js`).
