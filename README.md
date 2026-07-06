# App Idiomas — Treino de Inglês

Aplicativo **mobile-first** para treino de inglês, construído em **React + Vite**.
Sem backend, **funciona offline** (PWA), com correção de linguagem natural rodando
localmente em um **Web Worker** com **Compromise.js**.

Implementa o design exportado do Claude Design (soft duolingo, acento índigo,
superfícies em creme quente, Manrope + Geist Mono) e o spec técnico completo:
importar aulas geradas por IA, responder exercícios, revisar erros e exportar
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
- `screens/` — as telas: Home, Import, Exercise, Result, Review, History, Mistakes, Settings, Export, **Chat (tutor IA)**
- `components/` — primitivas compartilhadas (status bar, nav, ícones, anel de score)
- `styles/tokens.css` — design system portado do handoff (light/dark)

### Tutor IA no dispositivo (WebLLM) — `src/ai/`

Um **SLM (small language model) roda 100% no navegador** via [WebLLM](https://github.com/mlc-ai/web-llm)
(WebGPU), sem servidor. Uma nova tela de **chat dinâmico** conversa com o aluno e
**cria aulas automaticamente** (gera o YAML compacto, valida e oferece salvar+iniciar).

| Arquivo | Responsabilidade |
|---|---|
| `engine.js` | Ciclo de vida do modelo (worker WebLLM), estado reativo, registro de capacidades. web-llm é carregado sob demanda (`import()` dinâmico) para não pesar no bundle inicial |
| `webllm-worker.js` | Web Worker que roda a inferência fora da main thread |
| `capabilities.js` | **Seam de extensibilidade**: registro de capacidades. Hoje `chat`; o manifesto já reserva `image` (imagens de quiz) e `embeddings` (agrupar erros) como *em breve* |
| `lesson-generator.js` | Gera + valida uma aula a partir do modelo (testável com um `chat` fake) |
| `models.js` | Catálogo curado de modelos eficientes (padrão **Phi-4-mini**, + Llama 3.2, Qwen2.5) |
| `useAI.js` | Binding React (`useSyncExternalStore`) |

**Modelos**: configuráveis em Configurações → Inteligência artificial. Padrão
`Phi-4-mini-instruct-q4f16_1-MLC` (~3.4 GB), com alternativas mais leves
(Llama 3.2 1B ~880 MB, Qwen2.5 1.5B, etc.). Requer **WebGPU** (Chrome/Edge
recentes); degrada com uma mensagem clara onde não há suporte.

**Offline + PWA**: o download inicial dos pesos precisa de internet e é cacheado
pelo próprio web-llm (Cache Storage). Os chunks grandes de JS do web-llm ficam
**fora do precache** do service worker e são cacheados em runtime (CacheFirst),
mantendo o *app shell* leve; o tutor passa a funcionar offline após a primeira
ativação. O resto do app funciona offline desde o primeiro carregamento.

#### Estendendo para novas capacidades (ex.: imagens)

O `capabilities` registry é o ponto de extensão. Uma capacidade futura registra-se
sob um nome e expõe métodos assíncronos; os consumidores fazem
`getCapability('image')?.generate(...)` e degradam se ausente. Nada nas telas
existentes precisa mudar.

### Contrato do Web Worker

```js
// entrada
{ type: 'analyze_answer', id, payload: {
    user_answer, expected_answer, accepted_answers, exercise_type, mistake_focus } }
// saída
{ id, result: {
    normalized_user_answer, normalized_expected_answer, similarity_score,
    missing_words, extra_words, possible_mistake_type,
    is_probably_correct, verdict, target, feedback } }
```

A arquitetura está pronta para adicionar **wink-nlp** depois, atrás do mesmo contrato.

## Tipos de exercício suportados

`translate_natural` · `build_sentence` · `rewrite_natural` · `fill_blank` ·
`choose_best` · `answer_question`

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
