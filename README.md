# App Idiomas — Treino de Inglês

Aplicativo **mobile-first** para treino de inglês, construído em **React + Vite**.
Sem backend, **funciona offline** (PWA), com correção de linguagem natural rodando
localmente em um **Web Worker** com **Compromise.js**.

Implementa o design exportado do Claude Design (soft duolingo, acento índigo,
superfícies em creme quente, Manrope + Geist Mono) e o spec técnico completo:
importar aulas, responder exercícios, revisar erros e exportar
resultados/prompts para o tutor ChatGPT.

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
publica o `dist/` versionado na branch `gh-pages` a cada push na `main`
(o `dist/` já inclui `.nojekyll`), e o Pages serve essa branch. Como a
`base` é relativa, o app funciona no caminho `usuario.github.io/lingo-app/`.

App publicado: <https://robertosljunior.github.io/lingo-app/>

Depois de alterar o código, rode `npm run build` e commite o `dist/`
atualizado junto — é ele que vai ao ar.

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
- `styles/tokens.css` — design system portado do handoff (light/dark)

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

## Tipos de exercício suportados

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
