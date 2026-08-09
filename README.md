# App Idiomas — Treino de Inglês

Aplicativo **mobile-first** para treino de inglês, construído em **React + Vite**.
Sem backend, **funciona offline** (PWA), com toda a análise de linguagem rodando
localmente no dispositivo.

O app tem hoje **dois produtos de aprendizagem** convivendo no mesmo binário:

- **V1 (legado)** — importar aulas, responder exercícios, revisar erros e
  exportar resultados/prompts para o tutor ChatGPT. Design exportado do Claude
  Design (soft duolingo, acento índigo, superfícies em creme quente,
  Manrope + Geist Mono). Mantido para regressão.
- **V2 (Pedagogia V2)** — a experiência atual de aprendizagem, construída sobre
  um pipeline pedagógico próprio (Planner → Focus Resolver → Lesson Engine →
  Assessment → Evidence → Learner Model). É o produto em que o desenvolvimento
  acontece. Ver [Pedagogia V2](#pedagogia-v2) abaixo.

## Rodando

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção (dist/) + gate de orçamento de bundle
npm run preview    # serve o build
```

Abra no navegador e adicione à tela inicial para usar como app instalável.
Depois do primeiro carregamento, funciona sem internet.

## Versão compilada (mobile-ready)

Uma build de produção vem versionada em **`dist/`** — é um PWA mobile-first,
instalável, com `base` relativa (roda em qualquer subpasta ou via `file://`).
Para atualizar: `npm run build`.

Servir localmente:

```bash
npx serve dist        # ou: npm run preview
```

> **Atenção:** o `dist/` versionado só é regenerado quando alguém roda o build e
> commita. Ele pode estar atrás da `main`. O que vai ao ar **sempre** é o build
> feito pelo CI a partir do código da `main`; o `dist/` do repositório serve
> apenas para uso local/offline sem toolchain. Confira a data do último commit
> em `dist/` antes de tratá-lo como espelho da `main`.

**GitHub Pages**: o deploy é automático. O workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
roda `npm ci` + `npm run build` a cada push na `main` e publica o `dist/`
recém-buildado direto no Pages (`actions/deploy-pages`, source
**GitHub Actions** — não há mais branch `gh-pages`). Como a `base` é
relativa, o app funciona no caminho `usuario.github.io/lingo-app/`.

App publicado: <https://robertosljunior.github.io/lingo-app/>

## Pedagogia V2

A V2 substitui a ideia de "palavra aprendida/não aprendida" por **usos** de uma
palavra que o aluno já conhece. Nenhuma decisão pedagógica vive no React: a UI
apenas apresenta estruturas prontas.

```
Study Planner → Study Focus Resolver → Lesson Engine → ActivityPlan
  → resposta → Assessment → Evidence → Learner Model → próximo planejamento
                                    ↘ Presentation Adapter → React
```

Código em `src/lib/pedagogy-v2/` (núcleo pedagógico, puro e testado) e
`src/components/pedagogy-v2-learner/` + `src/screens/V2*.jsx` (apresentação).
Documentação detalhada em [`docs/`](docs/) — content model, learner model,
lesson engine, study planner, multipack e observabilidade.

### Receitas de atividade (V2)

O Lesson Engine escolhe entre nove receitas, combinadas com capacidade,
modalidade e faixa de apoio:

`exposure` · `meaning_recognition` · `context_recognition` ·
`listening_recognition` · `fixed_element_completion` ·
`word_order_reconstruction` · `guided_production` · `free_production` ·
`pronunciation`

Packs de conteúdo em `src/content/pedagogy-v2/`: `still`, `but`, `yet`
(produção) e `unless` (piloto, **fora** do catálogo builtin).

### Qual experiência o app abre (cutover V2.20-R)

**A V2 é o produto.** A raiz do app (`SCREENS.HOME`) e a rota de Treino são
roteadores finos (`src/screens/Home.jsx`, `src/screens/TrainingHub.jsx`) que
resolvem **um** dos dois produtos, nunca os dois juntos
(`src/lib/pedagogy-v2/learner-experience-mode.js`):

| `v2_learner_experience_enabled` | dev / dogfood | build de produção |
|---|---|---|
| `true` (escolha explícita) | V2 | V2 |
| `false` (escolha explícita) | V1 legado | V1 legado |
| não definido | **V2** | **V2** |

Ou seja: abrir o app publicado — sem flag, sem query parameter, sem DevTools —
entra direto na V2, em qualquer ambiente. A ausência da configuração nunca
significa V1. O `false` explícito continua existindo como *escape hatch* de
rollback e é o que os testes de regressão da V1 usam para fixar o legado.

A V1 não foi destruída: a Home antiga vive em `src/screens/LegacyHome.jsx` e o
hub antigo em `src/screens/LegacyTrainingHub.jsx`, alcançáveis apenas pelo
opt-out explícito. O mascote Bob pertence ao legado — ele não aparece em
nenhuma superfície V2.

`VITE_V2_DOGFOOD=1` **não decide mais qual produto é o padrão**; ele só liga
ferramentas de desenvolvimento. Em dev/dogfood há um seletor visível na Home da
V2 (**DEV · Experiência de aprendizagem: V2 / Legado V1**) que grava a escolha
explícita — o caminho de regressão da V1 fica a um toque, e o aluno do build
público nunca vê esse seletor.

O cutover é provado de ponta a ponta por `e2e/production-cutover.spec.js`, que
roda contra um `vite build` **normal** (sem dogfood, projeto Playwright
`production-build`).

As raízes learner da V2 carregam `data-experience="v2"` (marcador de
teste/DEV, invisível para o aluno) para que os E2E provem qual produto renderizou.

### Fronteira de linguagem sintetizada

O Lesson Engine **não gera linguagem**: ele apresenta apenas material autorado, e
as opções de reconhecimento vêm de traduções autoradas.

Essa garantia vale para o motor, **não para o produto inteiro**. A camada de
interação (`src/components/pedagogy-v2-learner/v2-interaction-state.js`) sintetiza
tokens distratores no banco de palavras do `word_order_reconstruction` — palavras
que não existem em nenhum pack. Como essa receita usa
`attribution_rule: 'form_first'`, um erro causado por um token sintetizado gera
evidência **direta** contra `sense` e `construction` autorados.

A formulação honesta é: *o planner não fabrica material-alvo; determinadas
camadas de apresentação podem sintetizar material não-alvo sob regras
controladas, e esse material pode influenciar avaliação.* O contrato completo
está em [`docs/pedagogy-v2/synthetic-presentation-evidence.md`](docs/pedagogy-v2/synthetic-presentation-evidence.md).

### Compilador de realizações licenciadas (V2.24 — piloto)

Expande material autoral por **combinação licenciada**, nunca por substituição
cega. Roda em build (`npm run compile:licensed-realizations-v2`), com aprovação
humana obrigatória antes de qualquer uso em produção.

```
banco de fillers/frames → compilador → candidatas → validação →
  revisão humana → allow-list de assinaturas → materialização em runtime
```

Código em `licensed-realizations.js`, `licensed-realization-contracts.js` e
`licensed-realization-validator.js`. Catálogo do piloto em
`src/content/pedagogy-v2/licensed/`.

Invariantes de contrato: `intended_new_items` sempre vazio; nunca elegível para
`exposure` nem para `introduction_group`; `exposure_stage` **calculado** pelo
máximo das fontes; `prerequisites` **compostos**; `eligible_recipes` derivado e
validado; `realization_id` é hash de assinatura de conteúdo, nunca sequencial.

**Estado atual: `human_approved = 0`.** Com `allowProvisional: false` o
compilador materializa **zero** realizações. Os dois pilotos — `still`
(lexical-slot) e `unless` (clause-frame) — estão marcados
`provisional_nonhuman` / `needs_review` aguardando a revisão humana e econômica.
O pack `unless` permanece deliberadamente fora de
`BUILTIN_PEDAGOGY_V2_PACKS`: com o compilador desligado, o produto continua
exatamente com `still`/`but`/`yet`.

### Léxico semântico (L1/L2 — piloto, isolado do runtime)

Camada de vocabulário reutilizável, separada dos packs pedagógicos. O léxico é
**semanticamente autoritativo e pedagogicamente neutro**: ele descreve o que a
língua contém e como combina; quem decide o que é alvo curricular é o content
registry, nunca o léxico.

| Arquivo | Conteúdo |
|---|---|
| `src/content/lexicon/places.v1.json` | 45 lugares (35 seed + 10 grupo de controle não-workplace) |
| `src/content/lexicon/entities.pilot.v1.json` | 12 entidades semânticas |
| `src/content/lexicon/verbs.pilot.v1.json` | 8 verbos, 9 sentidos, 11 argument frames |
| `src/lib/pedagogy-v2/semantic-lexicon.js` | seletor semântico e renderer por relação |
| `src/lib/pedagogy-v2/semantic-network-pilot.js` | composição de `proposition_plan` e licenciamento |

Princípios: superfícies **não** são autoradas por unidade — o léxico declara
afordâncias (`location_relations`, `article_profile`, `countability`) e o
renderer produz `at/in/on/to/from`, com exceções em `surface_overrides`
bilíngues. `argument_frame` pertence ao sentido do verbo; `construction`
pertence à pedagogia; a interface entre os dois é uma `proposition_plan` tipada,
e conflito de features produz `PROPOSITION_FEATURE_CONFLICT` em vez de reduzir o
pool em silêncio.

`crosslingual_error_patterns` registra formas que a interferência do português
produz (`*arrive the airport`, `*wait the train`, `*an information`) como
**proibições testáveis**: o compilador precisa provar que não consegue gerá-las.

Ambos os módulos estão **sem nenhuma integração com o runtime** — não são
importados pelo Lesson Engine, pelo scheduler nem por `buildRecognitionOptions`.

## Arquitetura

Camada de domínio (`src/lib/`), independente da UI:

| Arquivo | Responsabilidade |
|---|---|
| `lesson-parser.js` | Lê o formato compacto (YAML/JSON), valida e normaliza a aula (V1) |
| `correction-engine.js` | Normalização, similaridade e classificação de `mistake_type` (puro) |
| `nlp-worker.js` | Web Worker: análise estrutural (Compromise + wink-nlp) |
| `nlp-client.js` | Wrapper com Promise + fallback síncrono se o worker não estiver disponível |
| `language-analysis/` | Adaptadores de NLP estrutural e ponte semântica |
| `skill-registry.js` | Registro canônico de habilidades gramaticais V1 (ponte para os pré-requisitos da V2) |
| `lexical-bank.js` · `lesson-generator.js` · `lesson-template-registry.js` | Geração de aulas V1 |
| `adaptive-planner.js` · `srs.js` · `skill-profile.js` | Planejamento adaptativo e repetição espaçada (V1) |
| `content-pack-loader.js` · `content-pack-validator.js` · `content-rule-registry.js` | Packs de conteúdo V1 |
| `storage.js` | IndexedDB (`idb`): stores `lessons`, `questions`, `answers`, `mistakes`, `settings` |
| `device-storage-manager.js` · `profile-data-lifecycle.js` | Cota de armazenamento e ciclo de vida do perfil |
| `export-engine.js` | Resultado compacto em YAML + prompts de nova aula e de análise de nível |
| `speech.js` · `speech-router.js` | TTS (Web Speech API) |
| `pwa-install-controller.js` · `pwa-update-integrity.js` | Instalação e integridade de atualização do PWA |
| `error-log.js` | Log de diagnóstico persistente |

`src/lib/pedagogy-v2/` (~70 módulos) concentra o núcleo da V2. Os principais:
`lesson-engine.js` (seleção de atividade), `study-planner.js` e
`study-focus-resolver.js` (o que treinar), `activity-assessment.js` e
`assessment-to-evidence.js` (avaliação), `learner-model.js` (evidência
agregada), `experience-diversity.js` (variedade de apresentação),
`validator.js` (invariantes de conteúdo) e `registry.js` (multipack).

UI (`src/`):

- `store.jsx` — estado global (navegação, aula ativa, sessão de exercícios, settings) sobre IndexedDB
- `screens/` — telas V1 (Home, Import, Exercise, Result, Review, History, Mistakes, Settings, Export) e V2 (`V2*.jsx`)
- `components/` — primitivas compartilhadas; `components/pedagogy-v2-learner/` para a camada learner V2
- `styles/tokens.css` — design system V1 portado do handoff (light/dark)
- `styles/v2-learner.css` — tokens da camada learner V2, escopados em `.v2lx`

**Diagnóstico**: erros não tratados e rejeições de promise são registrados num
log persistente (localStorage), visível em Configurações → Diagnóstico
(copiar/limpar). Um error boundary global mostra uma tela de recuperação com o
log em vez de página branca.

### Stack de análise de linguagem

Toda a análise roda no dispositivo, sem rede:

| Camada | Uso |
|---|---|
| **Compromise** | Análise leve no Web Worker (auxiliar ausente, tempo verbal) |
| **wink-nlp** + `wink-eng-lite-web-model` | POS e morfologia estrutural |
| **harper.js** (WASM) | Lint gramatical |
| **Universal Sentence Encoder** (TFJS) | Similaridade semântica, com fallback para encoder de hashing |

Harper e TFJS são os maiores assets do bundle; o carregamento é sob demanda e o
orçamento é vigiado por `npm run check:bundle` a cada build.

### Contrato do Web Worker

```js
// entrada
{ type: 'analyze_answer', id, payload: {
    user_answer, expected_answer, accepted_answers, exercise_type, mistake_focus } }
// saída
{ id, result: {
    normalized_user_answer, normalized_expected_answer, similarity_score,
    missing_words, extra_words, typos, user_tokens, target_tokens,
    possible_mistake_type, is_probably_correct, verdict, target, feedback } }
```

## Testes e ferramentas

```bash
npm test                      # unit (vitest)
npm run test:e2e              # Playwright (build de produção + vite preview)
npm run test:e2e:visual       # matriz visual
npm run check:bundle          # orçamento de bundle (roda junto do build)
npm run audit:dependencies    # auditoria de dependências
```

**Validação de conteúdo**

```bash
npm run validate:content-packs
npm run quality:content-packs
npm run validate:knowledge-packs
npm run validate:pedagogy-v2
```

**Simulação e inspeção**

```bash
npm run simulate:pedagogy-v2 -- --scenario all --check-determinism
npm run inspect:pedagogy-v2
npm run inspect:learner-v2
```

**Auditorias pedagógicas**

```bash
npm run audit:assessment-v2                # qualidade da avaliação
npm run audit:practice-variety-v2          # variedade e repetição (intra e entre sessões)
npm run audit:practice-dynamics-v2
npm run audit:practice-collections-v2
npm run audit:capability-progression-v2
npm run audit:adaptive-pacing-v2
npm run audit:catalog-scale-v2
npm run audit:authored-confusability-v2    # pares pt-BR semanticamente confundíveis
```

**Compilação e benchmark**

```bash
npm run compile:licensed-realizations-v2   # candidatas do compilador (build-time)
npm run benchmark:semantic
npm run benchmark:structural-nlp
npm run benchmark:indexeddb
```

A matriz visual da V2 é regenerada sob demanda:

```bash
V2_SHOTS=1 npx playwright test pedagogy-v2-20-screenshots --project=chromium-desktop
# PNGs em test-evidence/v2-20-visual/
```

## Tipos de exercício suportados (V1)

`translate_natural` · `build_sentence` · `rewrite_natural` · `fill_blank` ·
`choose_best` · `answer_question` · `listen_type` (ditado: o app fala a frase
via TTS e o aluno digita o que ouviu)

## Formato compacto de aula (V1)

```yaml
lesson_id: eng_007
level: B1
focus: jobs_companies
q:
  - id: 1
    t: translate_natural
    pt: Eles têm vagas abertas?
    a: Do they have any open positions?
    alt: [Are they hiring?, Do they have any openings?]
    f: question_structure
```

Uma aula de exemplo já vem embutida (`src/lib/sample-lesson.js`) e é semeada no
IndexedDB na primeira execução.
