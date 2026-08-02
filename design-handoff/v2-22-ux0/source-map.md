# V2.22-UX0 — Source map

De onde cada parte do mockup veio e o que dela é aproveitável em produção.
Repo: `robertosljunior/lingo-app` (branch `main`). Ver `github.md` na raiz do projeto.

| Componente do mockup | Arquivo de origem no repo | Reusado como está | Envelopado | Experimental | Candidato a produção | NÃO usar em produção |
|---|---|---|---|---|---|---|
| Shell de lição (header, progresso, CTA único) | `src/components/pedagogy-v2-learner/V2LessonShell.jsx` | contrato do CTA | sim, réplica inline | — | padrão de CTA único | a réplica HTML do shell |
| Transição de atividade | `V2ActivityStage.jsx` | `phase in/out` | sim | — | timings de 220/260ms | as classes `lab-stage-*` |
| Word Order (rail magnético) | `V2LearnerActivity.jsx` → `WordOrderActivity` | `presentedOrderTokens` | sim | rail + gaps de inserção | **sim** — é a proposta central | o handler de clique do lab |
| Completion (slot por lacuna) | `V2LearnerActivity.jsx` → `CompletionActivity` | `buildMaskedCompletion` | sim | `fills` por gap | **sim** — corrige a lacuna auditada | o parser de máscara do lab |
| Frase com slots inline | `V2Sentence.jsx` | variantes de tamanho | sim | N slots | sim | escala de fonte hard-coded do lab |
| Guided Writing | `V2LearnerActivity.jsx` → `ProductionActivity` | payload `text` | sim | modelo sob demanda | sim | o `textarea` do lab |
| Feedback | `V2FeedbackPanel.jsx` | semântica de tone, labels do adapter | sim | régua de continuidade | régua tingida pelo tone | os textos de feedback do lab (fixtures) |
| Áudio | `V2AudioControl.jsx` | `variant="hero"`, `speakSegment` | sim | "Ouvir devagar" | segunda taxa de fala | o `setTimeout` que simula reprodução |
| Fala | `SpeakingControl` + `MicButton` | `capabilities.speech_input` | sim | fallback escrito (classe B) | fallback escrito | a transcrição falsa do lab |
| Categorias | `src/screens/V2LearnerHome.jsx` | `buildPracticeCategoriesV2` | sim | meta factual por categoria | meta factual | os packs fixos do lab |
| Resumo da sessão | `V2SessionSummary.jsx` | `facts[]` do builder | sim | "Ver progresso" secundário | ação secundária | os `SUMMARY_FACTS` do lab |
| Histórico | `src/screens/History.jsx` | — (é V1) | sim | proposta V2-honesta (classe B) | o modelo de dados proposto | **toda** a tela: precisa de builder V2 |
| Helpers de runtime | `src/lib/pedagogy-v2/activity-runtime-contracts.js` | **sim, sem mudança** | não | — | já é produção | — |
| Tokens visuais | `src/styles/v2-learner.css` | tokens existentes | sim | novos tokens de motion | os novos tokens | os objetos `LIGHT`/`DARK` do lab |

## Como ler isto

- **Reusado como está**: contrato ou helper que o mockup consumiu sem alterar. Vai para produção intacto.
- **Envelopado**: o mockup recriou a superfície em HTML/inline styles para poder iterar sem build.
  A *decisão* vale; o *código* não.
- **NÃO usar em produção**: fixtures, simulações (`setTimeout` de áudio, transcrição falsa) e
  réplicas HTML. Existem só para a demo.
