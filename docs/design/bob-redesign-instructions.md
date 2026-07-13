# Instruções — Redesign da interface para o mockup "Bob" (Claude Code)

Estas instruções guiam a adaptação do mockup **`docs/design/bob-mockup/bob-language-app.dc.html`**
(renders em `docs/design/bob-mockup/renders/`) para a aplicação real, **sem perder o
UX/UI nem a parte divertida** — mascote, animações, mapa, celebrações e feedback afetivo.

> Leia este documento inteiro antes de escrever qualquer código. É um **reskin de UI**,
> não uma reescrita da lógica. A engine (tutor semântico, packs bilíngues, gerador de
> lições, worker, PWA offline) **não deve ser alterada**.

---

## 0. Regras inegociáveis (ler primeiro)

1. **Não tocar na lógica/engine.** Nada em `src/lib/**`, `src/workers/**`,
   `src/content/**`, `scripts/**`. Só camada de apresentação: `src/screens/**`,
   `src/components/**`, `src/styles/**`, `src/App.jsx`, `src/store.jsx` (apenas o
   necessário para remover login/idiomas e adicionar captura de nome).
2. **Preservar todos os `data-testid`, `role`, `aria-label` e textos usados pelos testes.**
   O E2E depende deles (`question-type`, `feedback-sheet` + `data-verdict`,
   `start-generated-lesson`, `theme-<id>`, `level-<A1..B2>`, `result-score`,
   `lesson-justification`, `analyzing-status`, `cancel-analysis`, `semantic-model-*`,
   `generation-card`, `generate-lesson`, `open-training-hub`, `speak-type-fallback`,
   botões "Responder/Verificar", "Próxima", "Ajustes", "Início", "Sair da aula", etc.).
   **Reestilize o elemento, mantenha o hook.** Se precisar mover um hook, atualize o teste
   no mesmo commit e rode a suíte.
3. **Manter tudo verde a cada fase:** `npm test`, `npm run build`,
   `npm run validate:content-packs`, `npm run validate:knowledge-packs` e
   `npx playwright test --retries=0`. Reskin que quebra teste não está pronto.
4. **App é PT-BR ensinando inglês.** A UI (instruções, botões, títulos) é em **português**.
   O mockup tem telas em inglês ("Good Morning", "Choose the Right Options") — use a
   **estética** do mockup com a **cópia em português** que já existe no app.
5. **Preservar** tema claro/escuro, `env(safe-area-inset-*)`, região de scroll única do
   feedback (Slice 7.4), acessibilidade (contraste, foco, alvos ≥44px) e o comportamento
   offline.
6. **Um mascote só.** O mockup mistura "Bob" e "Mieo" — padronize para **Bob**.

---

## 1. O que REMOVER (decisões do produto)

Estes elementos do mockup **não** entram no app:

| Remover | Onde aparece no mockup | Motivo |
|--------|------------------------|--------|
| Tela de **Login** (e-mail/senha, Google/Apple) | `isLogin` | Sem login |
| **Múltiplos idiomas** / "Add New Language" / lista com bandeiras | `isAccount`, seletor "English ▾" no topo do Home | Um único idioma de aprendizado (inglês) |
| **Vidas / corações** (❤ 5) no topo das lições | header de `isLesson`, `isTalk`, `isStory` | Sem limitar estudo |
| **Modal de vidas** ("Watch Ad to Earn 1 Heart", "Or Use 350 gems") | `heartsModal` | Sem ads, sem economia |
| **Gems / diamantes** (245) | headers | Sem moeda/XP |
| **XP** ("Total XP", "+5 XP", "Start +25 XP", "Re-Start 30XP") | níveis, review, detalhe | Sem XP |
| **Lições/níveis travados** e "Unlock with 350" / cadeados | `n.isLock`, `lv.locked`, `dLocked`, `dUnlock` | Sem travar lição |
| **Meta diária** e faixa manhã/tarde/noite; **streak** (ícone de fogo como progressão) | `isOb2` | Sem limitar/gamificar por meta |
| **"Pro"** e histórias travadas ("Unlock") | `isStories` (badge Get Pro / Unlock) | Sem paywall |

> Ao remover cadeados/XP, **todas as lições ficam abertas**. Onde o mockup mostrava um
> nó/cartão travado, mostre-o **aberto e clicável**.

---

## 2. O que PRESERVAR (a "parte divertida")

- **Mascote Bob** (urso laranja) — nas telas de onboarding, loading, home (espiando no
  mapa), reações do exercício ("Você está pegando fogo 🔥"), e no modo Fala.
- **Animações** do mockup: `bobfloat` (flutuar), `pop` (entrada da folha de feedback),
  `drift` (nuvens), `eq` (equalizador da voz), `dots` (digitando/pensando). Copie os
  `@keyframes` para `tokens.css` e reutilize.
- **Folhas de feedback afetivas:** verde para acerto ("Boa!"/"Nice…", com confete) e
  rosa/vermelho gentil para erro ("Sem problema, todo mundo erra"). Mantêm o
  `data-verdict` (`correct`/`incorrect`) e a hierarquia de conteúdo do Slice 7.3
  (resultado → explicação → sua frase → versão corrigida → alternativa → próxima ação).
- **Barra de progresso** no topo da lição (mantém, sem os corações ao lado).
- **Mapa/jornada** no Home como metáfora visual divertida (sem travas).
- **Botões "3D"** (shine diagonal + sombra interna inferior + `translateY(2px)` no press).
- **Botões de áudio (alto-falante) e dica (lâmpada)** dentro do exercício.
- **Voz do Bob / modo Fala** reaproveitando o exercício `speak_sentence` + STT existente.
- Tudo do tutor real: 7 tipos de exercício, correção estrutural/semântica, tradução
  PT→EN real, justificativa pedagógica, gestão do modelo de voz e do modelo semântico.

---

## 3. Design tokens (extrair para `src/styles/tokens.css`)

Fontes (adicionar `<link>` no `index.html`): **Baloo 2** (títulos, 700–800) e **Nunito**
(texto, 400–800).

```
/* Cores — paleta Bob */
--bob-bg:          #DDEBF3;  /* fundo do app */
--bob-sky-1:       #C3E7F9;  /* topo do gradiente "céu" */
--bob-sky-2:       #EAF7FE;
--bob-card:        #FFFFFF;
--bob-ink:         #22333E;  /* títulos */
--bob-ink-2:       #41586B;
--bob-muted:       #64798A;
--bob-muted-2:     #93A9B7;
--bob-border:      #E3EDF3;
--bob-border-2:    #C9DCE7;

--bob-primary:     #47B8F2;  /* azul principal (botões, seleção) */
--bob-primary-d:   #2E86BC;  /* sombra/hover */
--bob-link:        #1789CE;

--bob-success:     #3EBE6F;  /* acerto */
--bob-success-d:   #2E9E58;
--bob-success-bg:  #E7F8EC;

--bob-error:       #F0445C;  /* erro (uso gentil, nunca dominante) */
--bob-error-d:     #D14B42;
--bob-error-bg:    #FDECEA;

--bob-warn:        #F6A81C;  /* dica/atenção */

--bob-radius:      16px;      /* cartões/inputs */
--bob-radius-lg:   22px;      /* cartões grandes */
--bob-shadow-card: 0 2px 0 rgba(31,122,175,.12), 0 8px 24px rgba(30,60,80,.06);
```

- **Mapear para os tokens semânticos existentes** (`--feedback-*`, `--indigo-*`,
  `--surface`, `--ink*`, `--warn-*`, `--border*`) em vez de espalhar hex. Redefina os
  tokens atuais para os valores Bob e ajuste os dois temas (claro/escuro). No escuro,
  escureça `--bob-bg`/`--bob-card` e clareie o texto, mantendo o azul de destaque.
- **Botão primário Bob** (classe utilitária, ex. `.btn-bob`):
  `background:var(--bob-primary); color:#fff; border-radius:var(--bob-radius);
  font-family:'Baloo 2'; box-shadow: inset 0 -4px 0 rgba(0,0,0,.16);` + faixa de brilho
  diagonal (ver `linear-gradient(105deg,…)` no mockup) + `:active { transform:translateY(2px) }`.
  Variantes: sucesso (verde) para "Continuar" pós-acerto; erro (vermelho) para
  "Tentar de novo". **A cor de erro nunca é a cor da ação principal padrão** (regra do 7.4).

---

## 4. Navegação nova (sem login)

Fluxo de primeiro acesso:

```
Primeiro acesso  →  "Qual é o seu nome?" (uma tela, um input)  →  (opcional) nível  →  Home
Acessos seguintes →  Home direto
```

- **Remover** `Login`. **Substituir** "Criar perfil" por uma tela mínima **"Como podemos te
  chamar?"** com um único `input` de nome (sem e-mail/gênero/idade). Persistir o nome no
  perfil/`settings` existentes (reaproveitar o sistema de perfil atual; se hoje há
  múltiplos perfis, manter **um único perfil ativo** — não expor troca de perfil).
- **Onboarding de nível (opcional, manter a diversão):** as 4 opções ("Não sei nada",
  "Sei palavras básicas", "Converso mas não falo bem", "Discussão básica") mapeiam para o
  **nível CEFR inicial** que o app já usa (A1–B2). É a única tela de onboarding que fica.
  **Remover** a tela de **meta diária/streak**.
- **Loading "Carregando seu curso"** com o Bob: manter como splash curto e alegre.
- Ao entrar, o Home é o mapa.

Atualize `src/store.jsx` (`SCREENS`, navegação inicial) apenas para: (a) decidir
primeiro-acesso vs. retorno pelo nome salvo; (b) remover rotas de login/idiomas.

---

## 5. Mapeamento tela-a-tela (mockup → app real)

| Mockup (`data-screen-label`) | Vira no app | O que muda |
|---|---|---|
| **Login** | — | Remover |
| **Criar perfil** | Tela de nome (nova, mínima) | Só nome; salvar no perfil ativo |
| **Onboarding — nível** | Onboarding de nível (novo, opcional) | Define nível CEFR inicial |
| **Onboarding — meta diária** | — | Remover (sem meta/streak) |
| **Carregando curso** | Splash de loading | Manter, Bob animado |
| **Início — mapa** | `src/screens/Home.jsx` | Reskin como mapa/jornada com Bob; **nós todos abertos**; remover gems/hearts/idioma no header; saudação usa o **nome** |
| **Explorar níveis** | `src/screens/TrainingHub.jsx` (lista de temas/níveis) | Cartões com arte; **sem cadeado, sem "Unlock"**; manter `data-testid="theme-<id>"` e `level-<A1..B2>` |
| **Detalhe do nível** | Detalhe de tema/nível no TrainingHub | "Sobre este nível" ok; **performance sem XP** — usar métricas reais (acertos %, questões praticadas, histórico); remover "Total XP" e "Unlock with 350" |
| **Lição — exercício** | `src/screens/Exercise.jsx` | Reskin: barra de progresso (sem corações), imagem/tema, botões áudio+dica, folhas verde/rosa, reação do Bob. **Manter os 7 tipos e todos os testids/labels**. `exIsChoice`→múltipla escolha; `exIsBlocks`→`build_sentence` |
| **Lição concluída** | `src/screens/Result.jsx` | Celebração com Bob; **sem XP** — mostrar acurácia/encorajamento e a `lesson-justification`; manter `result-score` |
| **Fale com o Bob** | Modo Fala (reusar `speak_sentence`/STT) | Cena do Bob no microfone, waveform (`eq`), feedback verde/rosa; **sem corações**; degrada para digitar quando não há mic (mantém `speak-type-fallback`) |
| **Histórias** | **Opcional/《futuro》** | O app **não tem conteúdo de histórias**. Não inventar engine nova. Ou (a) ocultar a aba por enquanto, ou (b) stub claramente marcado "em breve". **Sem "Pro"/Unlock.** |
| **História — player** | idem | idem |
| **Revisar erros** | `src/screens/Mistakes.jsx` / `Review.jsx` | Reskin da lista de erros; **remover "+X XP" e "Review All 200 gems"**; ação "Revisar tudo" gratuita |
| **Perfil e idiomas** | `src/screens/Settings.jsx` | **Remover lista de idiomas e "Add New Language"**. Manter: nome, nível, voz/áudio (Piper/Fabiola), modelo semântico, exportar/importar, diagnóstico. Cabeçalho com o nome do usuário |
| **Bottom nav** | `src/components/ui.jsx` (`BottomNav`) | 5 abas reestilizadas → **Início (mapa)**, **Níveis (Hub)**, **Fale**, **Revisar**, **Perfil**. (Histórias fica de fora ou como 6ª só se decidirem manter.) Ícones no estilo do mockup; manter navegação existente |

---

## 6. Detalhes por área

### Home (mapa)
- Cabeçalho: "Bom dia/Boa tarde, {nome}" (sem seletor de idioma, sem gems/hearts).
- Trilha/mapa com nós de lição — **todos abertos**. Um nó "atual" em destaque (pulse).
  Ao tocar, gerar/abrir a lição via o fluxo real (`generateAdaptiveLesson`/`startLesson`).
  Manter `data-testid="open-training-hub"` onde leva ao Hub.
- Bob espiando/flutuando (`bobfloat`) como enfeite, sem bloquear toque.

### Exercício
- Topo: botão voltar + barra de progresso (`{i}/{n}`). **Sem corações.**
- Corpo por tipo (mantendo componentes atuais `TranslateBody`, `ChoiceBody`, `BuildBody`,
  `DictationBody`, `SpeakBody`, `RewriteBody`): só troca o **estilo** (cartões, cores,
  botões áudio/dica em azul, blocos de palavra arredondados).
- Ação: "Verificar"/"Responder" (azul 3D). Pós-resposta: folha `pop` de baixo — verde
  (`data-verdict="correct"`, "Boa!") com "Continuar", ou rosa (`incorrect`, gentil) com
  "Tentar depois/Entendi". **Não** revelar resposta antes do envio (contrato de idioma 7.5).
- Reação do Bob em acertos seguidos ("Pegando fogo 🔥") — puramente cosmético.

### Result / Lição concluída
- Bob comemorando, frase de incentivo, **acurácia** (mantém `result-score`), a
  justificativa pedagógica (`lesson-justification`) e botões "Continuar"/"Início".
  Sem contagem de XP.

### Perfil (Settings)
- Cabeçalho com nome + avatar do Bob.
- Seções: **Aprendizado** (nível, tema preferido) · **Áudio & voz** (voz inglesa Piper,
  voz PT-BR Fabiola, velocidade) · **Tutor semântico** (baixar/remover modelo) ·
  **Meus dados** (exportar/importar, histórico, diagnóstico) · **Sobre**.
- **Nada de idiomas múltiplos.**

---

## 7. Ordem de implementação (fases pequenas, cada uma verde)

1. **Tokens & fontes:** adicionar Baloo 2/Nunito; introduzir os tokens Bob e remapear os
   tokens semânticos existentes; classe `.btn-bob` e keyframes. Rodar `npm test` + build.
2. **Nav + fluxo de entrada:** remover login; tela de nome; ajustar `store.jsx` e
   `BottomNav`. Garantir que testes de navegação/boot passam.
3. **Exercício** (maior impacto na diversão): reskin de `Exercise.jsx` preservando testids
   e os 7 tipos. Rodar Playwright dos fluxos de lição.
4. **Home (mapa)** e **Result**. Rodar hub/exercícios/result E2E.
5. **TrainingHub** (níveis/detalhe) sem cadeados/XP. Rodar `training-hub-lessons.spec`.
6. **Settings** sem idiomas; **Mistakes/Review** sem XP/custo.
7. **Modo Fala** (reskin do speak). **Histórias**: decidir ocultar vs. stub.
8. Passe final de acessibilidade/tema escuro/safe-area + suíte completa
   (`npx playwright test --retries=0` e `--repeat-each=3`).

Faça **um commit por fase**, com a suíte verde. Não empilhe o reskin todo num commit só.

---

## 8. Critérios de aceite

- [ ] Sem tela de login em lugar nenhum; primeiro acesso pede **só o nome**.
- [ ] **Um único idioma**; nenhuma UI de múltiplos idiomas/"Add New Language".
- [ ] **Sem** corações/vidas, gems, XP, cadeados, "Unlock", ads, meta diária ou streak.
- [ ] Todas as lições/níveis **abertos e jogáveis**.
- [ ] Estética Bob aplicada (fontes, cores, botões 3D, mascote, animações, mapa,
      folhas de feedback verde/rosa) — a "diversão" preservada.
- [ ] Cópia da UI **em português**; ensino de **inglês** intacto.
- [ ] **Todos os `data-testid`/roles/labels preservados**; `npm test`, build, validadores,
      e `npx playwright test --retries=0` **verdes**.
- [ ] Tema claro/escuro, safe-area, acessibilidade e offline mantidos.
- [ ] `src/lib/**`, `src/workers/**`, `src/content/**`, `scripts/**` **inalterados**.

---

## 9. Referências no repositório

- Mockup navegável: `docs/design/bob-mockup/bob-language-app.dc.html`
  (formato DesignCode: `<sc-if>` = telas condicionais, `{{ }}` = dados/handlers — é só
  referência visual, não código para copiar).
- Renders: `docs/design/bob-mockup/renders/01…08*.png`.
- Telas reais: `src/screens/*.jsx`; navegação/estado: `src/store.jsx`; nav/ui:
  `src/components/ui.jsx`, `src/components/icons.jsx`; estilos: `src/styles/tokens.css`.

> Dica final: trate o mockup como **direção de arte**, não como fonte de verdade de
> conteúdo. Onde o mockup e a realidade do app divergirem (idioma da UI, XP, travas,
> idiomas múltiplos), **a realidade do app + estas instruções vencem**.
