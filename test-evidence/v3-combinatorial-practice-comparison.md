# V3 — comparação anterior de Praticar (PR #113)

> Este documento descreve a medição anterior, com apenas três bindings no currículo V2 (31 vs. 108 textos únicos). A nova trilha de 48 construções em `agent/v3-coherent-variety` exige outra comparação learner-facing de 240 atividades por braço. Não atribua os números abaixo à nova implementação. O workflow V3 publica a nova evidência como artefato do PR separado.

## Stack

Base V2: `main` em `19b6a992521d3eb178a2ddda5ecadd19bd0e7664`. Supply inicial: PR #113, `47ea550d24dfb6b6827fff4228c98673cc01503a`. Continuação na mesma branch experimental `agent/v3-combinatorial-supply-2000`. Não fazer merge nem promover o conteúdo.

React/Vite, Planner/Resolver/Engine V2, journal existente em IndexedDB, Playwright sobre build de produção. Nenhuma alteração de pesos, thresholds, mastery, progressão, remediation, cooldown ou limite de 12 atividades. O arquivo de corpus original não foi alterado para melhorar o resultado.

## Problem

Um corpus de 3.072 superfícies únicas não é um pool elegível de 3.072 atividades. O catálogo curricular ativo contém apenas still/but/yet. Unless existe como piloto fora do registro. Os outros focos gramaticais do V3 não possuem entidades V2 às quais atribuir evidência com segurança.

## Implementation

`combinatorialSupplyV3: { enabled: true, strict_unseen: true }` habilita o experimento no settings existente. Ausência da configuração ou `enabled: false` mantém a seleção V2. Enquanto habilitado, a restrição de ineditismo é obrigatória; não existe modo permissivo de reuso V3.

- `combinatorial-focus-adapter.js`: ponte explícita por IDs de parent/construction. Herda os targets, pré-requisitos e estágio pedagógico do exemplar correspondente; o estágio original do frame continua separado. Não infere targets por substrings. O catálogo continua combinatório.
- `lesson-engine.js`: adiciona realizações ao pool antes da filtragem/scoring existente. O contrato de recipe e seus pares capability/modality permanece o contrato V2. Para tuples cobertas, filtra os textos já vistos antes da escolha; V3 visto nunca retorna pelo fallback de cooldown. Guard `V3_AVOIDABLE_LITERAL_REPEAT` inclui candidatos e contexto da seleção.
- `study-focus-resolver.js`: propaga `focus_exhausted`, suprime o foco na resolução atual e solicita outro ao Planner real, sem alterar seu ranking.
- `V2LessonExperience.jsx` lê todo o journal do profile em cada contexto, em vez de depender da cauda de 100 eventos de evidência. `durable-interaction-storage.js` acrescenta realization/focus IDs ao registro já atômico de interação/evidência. Nenhum segundo histórico de produto.
- Telemetria: foco solicitado, focos V3 mapeados, materializados, vistos, candidatos após gates, IDs elegíveis/inéditos na recipe/capability/modality selecionada, motivo, bypass de cooldown, tentativas do resolver e exaustão. O trace completo do engine conserva as exclusões estruturadas.

### Cobertura real

| Foco V3 | Construção V2 | Realizações mapeadas no produto |
|---|---|---:|
| v3.still.continuity_general | still.subject_still_lexical_verb | 64 |
| v3.but.simple_contrast | but.clause_but_clause | 64 |
| v3.yet.question | yet.interrogative_clause_yet | 64 |
| v3.first_conditional.unless | unless.condition_result | 0 — pack fora do registro |
| Outros 44 focos | Nenhum target V2 compatível | 0 |

Somente 192/3.072 realizações (6,25%) são estruturalmente mapeáveis no currículo ativo. Mapeamento não ignora os gates do aluno. Nesta trajetória, 44 realizações de still e 38 de but foram utilizadas; nenhuma de yet. Nas atividades interrogativas observadas, `v3_eligible_count` foi zero. O parent `exemplar:yet.008` exige a própria construção interrogativa e o sentido temporal como pré-requisitos e não declara a função comunicativa como target pedagógico: essas restrições foram preservadas, não contornadas.

| Recipe auditada | Supply V3 por foco ativo, antes dos gates do aluno/runtime |
|---|---:|
| exposure | 0 |
| meaning_recognition | 64 |
| listening_recognition | 64 |
| context_recognition | 0 |
| word_order_reconstruction | 64 |
| fixed_element_completion | 0 |
| guided_production | 0 |
| free_production | 0 |
| pronunciation | 64 — indisponível no runtime sem speech input |

As cinco recipes com zero exigem contexto autorado no contrato de variantes derivadas existente. Não foi copiado um contexto do parent para 64 frases diferentes, nem fabricado contexto a partir da tradução. `v3-combinatorial-supply-audit.json` contém a matriz completa dos 48 focos × recipes × capability/modality, inclusive os zeros e seus motivos.

## Baseline

240 atividades, 31 textos EN distintos, 209 slots repetidos (87,08%). Dez sessões sem texto novo. A frase mais repetida foi `It was difficult, but I still tried.` — 21 ocorrências. Foram 230 respostas avaliadas como corretas e 10 exposições observadas.

## V3 result

240 atividades, 108 textos EN distintos, 132 slots repetidos (55%). Nenhuma sessão sem texto novo. 82 realizações V3 distintas, todas usadas uma única vez. Foram 231 respostas avaliadas como corretas e 9 exposições observadas.

A mesma frase autorada `It was difficult, but I still tried.` chegou a **23 ocorrências**. A frequência máxima piorou. Ainda houve 8 repetições consecutivas. **Não atingiu 200 nem 220 textos distintos e não passou no critério de sucesso do produto.**

## Comparison

| Metric | V2 OFF | V3 ON |
|---|---:|---:|
| total_activities | 240 | 240 |
| distinct_exact_EN_texts | 31 | 108 |
| exact_repeat_slots | 209 | 132 |
| exact_repeat_rate | 0.8708333333333333 | 0.55 |
| most_repeated_text_count | 21 | 23 |
| distinct_realization_IDs | 0 | 82 |
| distinct_exemplar_IDs | 31 | 108 |
| distinct_focuses | 89 | 92 |
| distinct_constructions | 9 | 9 |
| distinct_recipes | 7 | 7 |
| distinct_modalities | 3 | 3 |
| distinct_capabilities | 4 | 4 |
| max_occurrences_one_text_per_session | 4 | 4 |
| max_occurrences_one_text_across_20_sessions | 21 | 23 |
| sessions_with_zero_new_text | 10 | 0 |
| session_opener_repeat_rate | 0.85 | 0.55 |
| consecutive_exact_repeats | 11 | 8 |
| avoidable_exact_repeats | 1 | 6 |
| v3_compatible_avoidable_exact_repeats | 0 | 0 |
| cooldown_bypass_count | 24 | 24 |
| focus_exhausted_count | 0 | 0 |
| focus_switches_caused_by_exhaustion | 0 | 0 |
| minimum_eligible_supply_per_focus | 1 | 1 |
| median_eligible_supply_per_focus | 3 | 4 |
| minimum_unseen_supply_at_selection | 0 | 0 |
| repeated_texts_2x | 2 | 1 |
| repeated_texts_3x | 0 | 9 |
| repeated_texts_4x_plus | 22 | 10 |
| top_focus_share | 0.05 | 0.04583333333333333 |
| top_3_focus_share | 0.13333333333333333 | 0.12916666666666668 |
| top_construction_share | 0.3125 | 0.2833333333333333 |
| top_3_construction_share | 0.7833333333333333 | 0.7458333333333333 |
| activities_using_V3 | 0 | 82 |

As taxas da tabela estão em frações de 0 a 1. `distinct_focuses` conta a chave completa do Planner (pack, tipo, target, capability, modality), não os 48 focos do corpus V3. Por isso 92 focos de planejamento não significam 92 famílias de conteúdo.

Repetição evitável é calculada contra o pool observado de mesmo foco/recipe/capability/modality antes da seleção, não apenas a banda de scores. As seis repetições evitáveis do braço ON são autoradas, sem supply V3 elegível na tuple. O guard específico de V3 não as disfarça: são registradas como falha residual do produto. Bypass conta seleção efetiva de um exemplar em cooldown após o fallback; 24 em cada braço, zero em realizações V3.

O mínimo/mediana por foco usa o maior pool elegível observado em cada chave de Planner e então agrega essas chaves. Não é uma promessa de 64 candidatos disponíveis a cada turno. O mínimo de conteúdo inédito na seleção foi zero em ambos os braços. A distribuição 2×/3×/4×+ conta textos distintos em cada faixa, não slots.

As três construções mais frequentes ainda concentraram 74,58% das atividades V3 (78,33% no baseline). A maior chave completa do Planner caiu de 5% para 4,58%; fragmentar um mesmo conteúdo em capacidades/modalidades reduz essa porcentagem sem resolver a concentração por construção.

## Verification plan

Execução concluída, sem planos forçados nem chamadas diretas ao engine na comparação:

1. Dois contextos de browser independentes, mesmo profile inicial `profile-a` e seed 20260927; cada braço mantém seu IndexedDB por 20 sessões.
2. Navegação Home → Praticar → 12 atividades → resumo → concluir. Reload entre sessões; nenhum reset/reseed do aluno dentro do braço.
3. Relógio inicial 2026-09-27 12:00 UTC; sessões diárias simuladas, um minuto por atividade. Mesma programação temporal em ambos os braços. Os IDs iniciais de study/lesson session coincidem.
4. Respostas lidas do response contract (opção correta, tokens canônicos, completion esperada, texto de referência). Toda atividade assessável foi efetivamente avaliada como `correct`; não basta “não incorreta”.
5. Runtime declara a ausência real de STT; speaking/pronunciation não são simulados artificialmente. Reading/writing/listening foram exercitados. Resultado descreve esse runtime, não todos os dispositivos.
6. 240 registros duráveis por braço; 20 study session IDs por braço. IDs/textos V3 reconciliados contra o journal. Dados completos em `v3-practice-off.json`, `v3-practice-on.json` e respectivos `-journal.json`.
7. 1.071 testes aprovados em 72 arquivos V2/V3. Incluem consumo das 64 realizações no engine, `focus_exhausted`, troca pelo Planner real, guard de repetição, flag OFF e reabertura do journal com isolamento por profile.
8. A execução learner-facing com a instrumentação final terminou com ambos os testes aprovados, zero retries. Isso valida a coleta e os invariantes V3; não significa que as metas de variedade passaram.

Reprodução:

```bash
npm ci
npx playwright install --with-deps chromium
npm run audit:combinatorial-supply-v3
npm run audit:combinatorial-practice-supply-v3
npm run simulate:combinatorial-practice-v3
# Só recalcular relatório das evidências já produzidas:
node scripts/simulate-combinatorial-practice-v3.mjs --report-only
```

O teste sempre gera o build utilizado. O `dist` pré-existente não é fonte de evidência nem recebe promoção neste PR experimental. Localmente foi usado Chromium 153 via override de executável porque o download padrão retornou ZIP inválido; o CI usa o browser fixado pelo Playwright. Nenhuma dependência ou configuração de segurança do produto foi alterada por esse override.

## Remote verification

O workflow dedicado `.github/workflows/v3-combinatorial-supply.yml` executa unidades V3, auditorias e comparação learner-facing, com upload das evidências mesmo em falha. O resultado remoto do HEAD e o link do run são registrados no PR #113, separadamente dos números locais deste documento.

O gate global continua falhando antes dos testes: **4 high > baseline high 0** (também 3 moderate). `check-dependency-audit.mjs`, baseline de segurança e workflow global não foram alterados. Aprovação do workflow experimental não significa gate global verde.

## Remaining risks

- Conteúdo permanece `provisional_nonhuman`. Auditoria limitada de regras não substitui revisão humana. Os 480 exemplos (10 por foco, amostragem determinística com seed identificável) estão em `v3-combinatorial-editorial-sample.json`, com ambos os slots bilíngues.
- Foram encontrados 141 apontamentos em 77 realizações: 64 com `next to to` (cada uma recebe códigos de preposição e combinação gramatical inválida), 6 combinações semanticamente suspeitas, 3 trajetos com origem igual ao destino e 4 referentes sem contexto. Esses últimos são pendências editoriais, não provas automáticas de incorreção. Não houve “aprovação automática” do restante.
- O defeito das 64 frases `next_to` já existia no corpus e está fora dos focos ativos. Combinações de but também têm pendências de naturalidade; não promover o experimento.
- Materialização das 3.072: 34,13 ms; delta de heap aproximado 6.233.056 bytes; JSON 1.607.833 bytes; seleção mediana 0,337 ms e p95 0,564 ms no Node local. Não é benchmark de celular. A leitura integral do journal a cada turno merece medição em histórico longo; nenhum segundo índice/store foi introduzido.
- Este protocolo mede interações concluídas, não abandono antes de submeter nem concorrência entre abas. Não generaliza o resultado para speaking/STT ou todos os perfis/seeds.
- Exaustão e troca de foco foram comprovadas em teste dedicado, mas não ocorreram nas 240 atividades ON: nenhum dos pools V3 usados chegou a 64. Contagens da simulação permanecem zero.

## Verdict

**C — Supply existe, mas cobertura de recipes e gates pedagógicos impedem seu uso suficiente. Há também o gargalo estrutural F: a maior parte dos focos V3 não existe no currículo ativo do Planner.**

A integração melhora a variedade agregada em 77 textos e elimina sessões sem novidade, mas não elimina a experiência repetitiva. Não há evidência nesta execução de falha de persistência (D) ou descarte de variedade no renderer (E): as 82 realizações selecionadas chegaram como 82 textos distintos, com 82 IDs no journal. A concentração curricular continua, mas alterar pesos agora esconderia o problema de cobertura.

Próximos pontos concretos, sem implementação nesta etapa:

| Gargalo observado | Arquivos responsáveis | Próximo trabalho |
|---|---|---|
| 45/48 focos V3 fora do currículo ativo | `src/content/pedagogy-v2/index.js`, `src/lib/pedagogy-v3/combinatorial-focus-adapter.js` | Definir entidades/contratos pedagógicos próprios para o novo currículo; não mapear gramática a targets lexicais incorretos |
| still contraexpectativa repetida 23×, yet negativo com be 59 atividades e nenhuma ponte V3 | `src/content/pedagogy-v2/still.json`, `yet.json`, catálogo V3 | Supply compatível para essas construções reais; revisão editorial |
| Cinco recipes sem contexto compatível | `src/lib/pedagogy-v2/licensed-realization-contracts.js`, `lesson-engine.js`, adapter V3 | Contextos e contratos específicos de recipe, com auditoria de tradução/distratores |
| V3 yet mapeado mas zero realizações selecionadas | `yet.json` (`exemplar:yet.008`), `lesson-engine.js` (pré-requisitos e target) | Inspecionar a progressão do parent e criar frames introdutórios compatíveis; não remover gates |
| Reuso autorado/cooldown permanece nas tuples não cobertas | `src/lib/pedagogy-v2/lesson-engine.js`, `study-planner.js` | Reavaliar somente depois de ampliar supply compatível e repetir este protocolo |
| Preposição duplicada e combinações pouco naturais | `src/content/pedagogy-v3/combinatorial-catalog.js` | Correção editorial separada, mantendo versionamento/IDs rastreáveis |

**Não recomendado para merge como solução do problema de repetição.** O resultado do experimento é a identificação verificável dos gargalos, não a aprovação do V3 como produto pronto.
