# App Idiomas — Treino de Inglês

Aplicativo **mobile-first** para treino de inglês, construído em **React + Vite**.
Sem backend, **funciona offline** (PWA), com correção de linguagem natural rodando
localmente em um **Web Worker** com **Compromise.js**.

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
npm run build      # build de produção (dist/)
npm run preview    # serve o build
```

Abra no navegador e adicione à tela inicial para usar como app instalável.
Depois do primeiro carregamento, funciona sem internet.

## Versão compilada (mobile-ready)

Uma build de produção já vem versionada em **`dist/`** — é um PWA mobile-first,
instalável, com `base` relativa (roda em qualquer subpasta ou via `file://`).
Para atualizar: `npm run build`.

Servir localmente:

```bash
npx serve dist        # ou: npm run preview
```

**GitHub Pages**: o deploy é automático. O workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
roda `npm ci` + `npm run build` a cada push na `main` e publica o `dist/`
recém-buildado direto no Pages (`actions/deploy-pages`, source
**GitHub Actions** — não há mais branch `gh-pages`). Como a `base` é
relativa, o app funciona no caminho `usuario.github.io/lingo-app/`.

App publicado: <https://robertosljunior.github.io/lingo-app/>

O `dist/` continua versionado no repositório para uso offline/local, mas o
que vai ao ar é sempre o build feito no CI a partir do código da `main`.

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
`production-build`) — um bundle de dogfood não poderia provar isso.

As raízes learner da V2 carregam `data-experience="v2"` (marcador de
teste/DEV, invisível para o aluno) para que os E2E provem qual produto renderizou.

### Linguagem visual (V2.20)

O polish pass da V2.20 seguiu o protótipo de UX/UI: **menos container, mais
conteúdo**. A frase-alvo é a protagonista e fica direto sobre o fundo (sem card),
com escala por contexto via tokens (`--v2-sentence-exposure/completion/speaking`);
as opções de reconhecimento leem como lista de resposta (sem sombra, borda fina);
produção guiada e livre se diferenciam por régua de acento (azul/roxo) em vez de
cards preenchidos; e o painel de feedback é achatado — sem cards aninhados, só
divisórias *hairline*. Tokens em `src/styles/v2-learner.css`.

O feedback permanece **na mesma tela**, nunca em modal, e a semântica é a do
Assessment: naturalidade nunca vira erro, incompatibilidade de sentido nunca vira
"vocabulário", produção livre nunca diz "resposta correta" (e sim "uma forma
possível" / "forma de referência"), e ausência de causa estruturada vira uma
mensagem honestamente inespecífica.

## Arquitetura

Camada de domínio (`src/lib/`), independente da UI:

| Arquivo | Responsabilidade |
|---|---|
| `lesson-parser.js` | Lê o formato compacto (YAML/JSON), valida e normaliza a aula |
| `correction-engine.js` | Normalização, similaridade e classificação de `mistake_type` (puro, sem deps) |
| `nlp-worker.js` | Web Worker: análise com Compromise (auxiliar ausente, tempo verbal, etc.) |
| `nlp-client.js` | Wrapper com Promise + fallback síncrono se o worker não estiver disponível |
| `storage.js` | IndexedDB (`idb`): stores `lessons`, `questions`, `answers`, `mistakes`, `settings` |
| `export-engine.js` | Resultado compacto em YAML + prompt de nova aula + prompt de análise de nível |
| `speech.js` | TTS da resposta esperada (Web Speech API) |

UI (`src/`):

- `store.jsx` — estado global (navegação, aula ativa, sessão de exercícios, settings) sobre IndexedDB
- `screens/` — as telas: Home, Import, Exercise, Result, Review, History, Mistakes, Settings, Export
- `components/` — primitivas compartilhadas (status bar, nav, ícones, anel de score)
- `styles/tokens.css` — design system V1 portado do handoff (light/dark)
- `styles/v2-learner.css` — tokens da camada learner V2 (cor, forma, escala de
  frase, acentos por atividade, motion), escopados em `.v2lx` (light/dark)

**Diagnóstico**: erros não tratados e rejeições de promise são registrados num
log persistente (localStorage), visível em Configurações → Diagnóstico
(copiar/limpar). Um error boundary global mostra uma tela de recuperação com o
log em vez de página branca.

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

A arquitetura está pronta para adicionar **wink-nlp** depois, atrás do mesmo contrato.

## Testes

```bash
npm test                      # unit (vitest)
npm run test:e2e              # Playwright (build de produção + vite preview)

npm run validate:content-packs
npm run validate:knowledge-packs
npm run validate:pedagogy-v2
npm run simulate:pedagogy-v2 -- --scenario all --check-determinism
npm run audit:assessment-v2
npm run audit:practice-variety-v2
npm run benchmark:semantic
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

## Formato compacto de aula

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
