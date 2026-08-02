# V2.22-UX2 — Production Learner Experience Redesign

> **Este brief substitui as direções anteriores de Home por pack/lexema e qualquer proposta com mascote.**
>
> A entrega deste slice é **código de produção**, não apenas mockup, screenshots ou handoff.

## 0. Base

Partir da `main` contendo o merge do PR #54:

- merge commit esperado: `742ea735159ae8ab919c1a521bf66ab8b1575586`
- confirmar SHA real antes de iniciar
- criar branch nova a partir da `main`

Registrar no relatório:

- base SHA;
- DB_VERSION;
- versões de Planner, Engine, ActivityPlan, Learner Presentation e Home Presentation;
- commit de deploy/build gerado.

## 1. Decisão de produto — não expor packs técnicos

A Home atual expõe `Still`, `But` e `Yet` como escolhas learner-facing. Isso está errado como modelo de UX.

O learner não deve precisar decidir:

- qual palavra funcional estudar;
- qual pack técnico abrir;
- qual construction interna praticar;
- qual lexema o Planner deve priorizar.

`still`, `but` e `yet` continuam existindo **internamente** como content packs e nós do grafo curricular. Eles não devem aparecer como categorias principais na Home.

Remover da experiência learner-facing a seção que deriva uma entrada por `pack.manifest` em `buildPracticeCategoriesV2()`.

Não apagar os packs, seus IDs, seus relations ou focused-mode diagnóstico.

## 2. Categorias learner-facing devem representar contextos

A nova Home deve organizar prática por **situações e intenções reconhecíveis**, por exemplo:

- Conversas do dia a dia;
- Trabalho e estudos;
- Viagens e deslocamentos;
- Escolhas e decisões;
- Ideias e opiniões;
- Revisar o que já apareceu.

Esses nomes são ponto de partida editorial, não lista hardcoded obrigatória. O implementador deve auditar o conteúdo real e escolher categorias que tenham cobertura honesta.

Uma categoria não é:

- um target type;
- um pack;
- um nível;
- um curso;
- uma skill V1;
- uma nova verdade de mastery.

É uma camada editorial de navegação que reúne conteúdo V2 já existente em um contexto útil.

## 3. Nova camada editorial: Practice Collections V2

Criar uma camada aditiva e genérica, sugerida como:

- `practice_collections_v2`;
- `PracticeCollectionV2`;
- `PracticeScopeV2`.

O nome final deve seguir as convenções do repo.

A collection deve declarar somente presentation/scope, por exemplo:

```js
{
  collection_id: 'collection:daily_conversations',
  title_pt: 'Conversas do dia a dia',
  description_pt: 'Responda, contraste ideias e mantenha a conversa fluindo.',
  catalog_order: 10,
  icon_role: 'conversation',
  authored_scope: {
    exemplar_ids: [...],
    construction_ids: [...],
    communicative_function_ids: [...]
  }
}
```

Não é necessário usar todos esses campos. Escolher a menor forma honesta após auditar o pipeline.

Regras:

1. nenhuma collection cria evidence própria;
2. nenhuma collection recebe mastery;
3. nenhuma collection vira target;
4. nenhuma collection duplica o Learner Model;
5. nenhuma collection inventa frases;
6. cada membro precisa existir no Registry;
7. a mesma construction/exemplar pode aparecer em mais de uma collection quando editorialmente verdadeiro;
8. collections não podem ser derivadas automaticamente apenas de `pack_id`.

## 4. Conteúdo contextual precisa ser autorado, não inferido por React

Não classificar contexto por regex de palavras dentro do componente.

Não fazer:

```js
if (text.includes('work')) category = 'Trabalho'
```

O vínculo entre conteúdo e collection precisa ser autorado e validado.

Pode ser:

- manifest dedicado de collections;
- metadata aditiva nos exemplars;
- registry editorial separado;
- outra solução pequena e genérica.

Documentar por que a solução escolhida é a menor que preserva honestidade.

## 5. Escopo da sessão contextual

Ao tocar em uma categoria, abrir o **mesmo controller real** usado por `Praticar agora`.

Não criar controller paralelo.

O Planner continua escolhendo:

- target;
- capability;
- modality;
- recipe;
- exemplar;
- próxima atividade.

A categoria apenas limita ou prefere um escopo autorado.

Implementar de forma genérica no pipeline. Possíveis soluções:

- `StudyScopeV2` opcional passado ao controller/resolver;
- allowed target/construction/exemplar IDs;
- filtro editorial materializável no Focus Resolver/Engine.

Não simplesmente mapear collection para um único pack.

Uma categoria deve poder atravessar vários packs internos. Exemplo: uma prática de “Conversas do dia a dia” pode usar conteúdo de `still`, `but` e `yet` sem mostrar esses nomes ao learner.

## 6. Sem novo Study Mode quando não for necessário

Preservar os modos reais:

- adaptive;
- explore;
- review;
- focused.

Preferência arquitetural:

- `adaptive + optional practice scope` para categorias contextuais;
- `review` continua revisão;
- `explore` continua descoberta.

Não adicionar `context_mode`, `category_mode` ou scheduler novo se um scope opcional resolver.

Se o contrato precisar mudar, versionar explicitamente.

## 7. Home totalmente nova — código de produção

Redesenhar e implementar em produção:

- `src/screens/V2LearnerHome.jsx`;
- presentation builder correspondente;
- catálogo contextual;
- navegação;
- light/dark;
- responsive;
- reduced motion;
- estados vazios;
- integração com BottomNav;
- retorno da sessão.

A entrega não é um Lab.

Pode existir um Lab auxiliar, mas a nova Home precisa estar ativa no build learner-facing após merge.

## 8. Sem mascote e sem estética infantil

Proibido:

- ursinho;
- mascote;
- personagem;
- animal;
- avatar infantil;
- caminho de bolinhas;
- clone visual do Duolingo;
- dashboard corporativo genérico;
- excesso de cards iguais;
- gamificação inventada.

A personalidade deve vir de:

- tipografia;
- ritmo;
- hierarquia;
- movimento;
- iconografia abstrata;
- superfícies;
- qualidade das interações.

## 9. Hierarquia da nova Home

A Home precisa responder imediatamente:

1. O que posso fazer agora?
2. Onde escolho um contexto de prática?
3. Onde encontro revisão?
4. Onde exploro conteúdo novo?

Hierarquia mínima:

### A. Praticar agora

CTA principal, modo adaptive, sem prometer “retomar sessão”.

### B. Praticar por contexto

Collections contextuais reais, visíveis sem parecer rodapé esquecido.

### C. Revisão e Explorar

Ações secundárias, claramente distintas.

### D. Fatos reais opcionais

Somente dados verificáveis. Nenhum mastery, CEFR, XP ou porcentagem.

## 10. Catálogo escalável

Projetar e implementar para:

- 4 collections;
- 8 collections;
- 12 collections;
- 20 collections.

Não usar uma lista infinita de cards idênticos.

Não esconder tudo em carrossel horizontal obrigatório.

Não criar busca antes de ser necessária.

A estrutura pode usar:

- destaques editoriais;
- grid/lista responsiva;
- seções compactas;
- expansão progressiva;
- agrupamento por intenção.

Mas todo agrupamento deve vir de metadata autorada, não de IDs técnicos.

## 11. O scramble precisa ser visível no produto real

O PR #54 implementou Magnetic Rail, mas a experiência não pode continuar existindo apenas em screenshots/E2E.

Esta slice deve provar que um learner real consegue chegar ao scramble no produto.

Há dois problemas distintos:

1. **discoverability** — o learner não sabe que “montar frases” existe;
2. **reachability** — o Planner pode não selecionar a recipe cedo o suficiente para o perfil atual.

Resolver os dois sem mover pedagogia para React.

## 12. Formatos de prática — controle secundário, não categoria principal

As categorias principais são contextos.

Dentro de uma collection ou em uma área secundária da Home, pode existir uma escolha de formato:

- Misturar atividades;
- Montar frases;
- Completar;
- Escrever.

Isso não deve substituir o contexto.

Exemplo learner-facing:

```text
Conversas do dia a dia
[Praticar misturado]
Também posso: Montar frases · Completar · Escrever
```

Auditar se uma preferência de recipe pode ser adicionada como **advisory practice preference** sem criar um novo Planner.

## 13. Preferência de recipe precisa ser honesta

Se o learner escolhe “Montar frases”:

- usar o mesmo Planner/Engine;
- priorizar `word_order_reconstruction` quando capability, runtime e conteúdo permitem;
- não forced-plan uma atividade impossível;
- não pular prerequisites;
- não conceder evidence falsa;
- não fabricar um scramble com conteúdo não elegível.

Se ainda não houver oportunidade materializável:

- explicar de forma neutra;
- oferecer prática preparatória no mesmo contexto;
- não mostrar botão morto;
- não fingir que a atividade foi servida.

## 14. Acceptance humano para scramble

Adicionar uma trajetória learner-facing real que prove:

1. abrir a Home nova;
2. escolher uma collection contextual;
3. escolher “Montar frases” ou uma prática mista elegível;
4. entrar no mesmo controller real;
5. receber `word_order_reconstruction` sem forced-plan;
6. usar o Magnetic Rail do PR #54;
7. verificar;
8. receber feedback na mesma tela;
9. continuar;
10. retornar à Home nova.

O teste pode semear evidence válida, como os E2E existentes, mas não pode injetar um ActivityPlan.

## 15. Não confundir contexto e recipe

Contexto responde:

> “Em que tipo de situação quero praticar?”

Recipe preference responde:

> “Como quero interagir agora?”

O learner pode escolher:

- contexto sem escolher formato;
- formato sem expor pack técnico;
- prática adaptive geral.

Não usar `Still`, `But`, `Yet` como resposta para nenhuma dessas perguntas.

## 16. Continuidade visual com os exercícios do PR #54

A nova Home precisa formar um sistema com:

- Magnetic Rail;
- completion multi-gap;
- guided writing;
- feedback conectado;
- transição horizontal;
- session summary.

Atualizar visualmente shell/header/summary quando necessário para que a Home nova não pareça outro produto.

Não reimplementar a lógica interna dos exercícios já aprovada.

## 17. Estado de entrada contextual

Ao escolher uma collection:

- mostrar seleção clara e breve;
- entrar diretamente na sessão;
- não abrir modal de confirmação obrigatório;
- não gerar playlist;
- não prometer quantidade específica de exercícios;
- não mostrar pack técnico.

O header da lição pode mostrar o título da collection, desde que seja factual e venha do scope selecionado.

## 18. Transições entre contexts internos

O Planner pode atravessar packs internos dentro da mesma collection.

Não mostrar banners como:

- “Agora: But”;
- “Mudando para Yet”.

Se houver transição learner-facing, ela deve falar do contexto/função de forma neutra e autorada, ou não aparecer.

Preservar markers técnicos apenas para DEV/E2E.

## 19. Revisão

`Revisão` continua sendo um modo real.

Pode permitir filtro contextual quando houver conteúdo previamente encontrado naquela collection.

Não dizer:

- “você esqueceu”;
- “corrija seus erros”;
- “domínio caiu”.

Empty state honesto.

## 20. Explorar

`Explorar` continua priorizando novos usos.

Pode ser apresentado como descoberta dentro de contextos, sem expor packs.

Não prometer que todo clique terá item novo se o Planner não tiver materialização.

## 21. Presentation contracts

Criar builders puros para:

- Home;
- collection catalog;
- selected collection;
- recipe preference labels;
- contextual empty states;
- session summary contextual.

React não deve inventar copy linguística ou contar targets diretamente.

Versionar qualquer contrato novo.

## 22. Migração da Home atual

Remover da UI de produção:

- `buildPracticeCategoriesV2()` como lista por pack;
- cards learner-facing `Still`, `But`, `Yet`;
- descrições centradas em palavra/pack.

Pode manter uma função diagnóstica DEV para navegar por pack, fora da Home learner-facing.

## 23. Context metadata inicial

Antes de autorar, auditar todos os exemplars existentes de Still/But/Yet e propor collections com cobertura real.

Não criar uma categoria com apenas uma frase.

Cada collection inicial precisa ter:

- cobertura em múltiplos exemplars;
- idealmente múltiplas constructions;
- materialização em mais de uma recipe ao longo da progressão;
- traduções/contextos coerentes;
- variedade suficiente para focused/contextual-36.

## 24. Sem content inflation

Não adicionar dezenas de frases apenas para preencher cards.

Reutilizar conteúdo atual quando realmente cabe no contexto.

Adicionar conteúdo somente quando uma collection importante não tem profundidade mínima e documentar por quê.

## 25. Design exploration curto, implementação obrigatória

Pode explorar até 3 direções rapidamente, mas escolher uma antes de alterar produção.

Não terminar com:

- mockup apenas;
- ZIP apenas;
- screenshots apenas;
- handoff apenas;
- “próximo Claude implementa”.

Este slice só fecha com a direção escolhida implementada no app real.

## 26. Build e deploy

Obrigatório:

- alterar código-fonte de produção;
- rodar `npm run build`;
- atualizar `dist/` conforme convenção;
- confirmar que Pages vai publicar a nova Home;
- incluir E2E contra build de produção;
- verificar cache/service worker quando necessário;
- registrar asset hash novo.

## 27. Visual matrix de produção

Gerar screenshots da aplicação real, não do mockup:

- `home-320-light`;
- `home-375-light`;
- `home-430-light`;
- `home-375-dark`;
- catálogo com 4 collections;
- catálogo com 8 collections fixture/dev;
- collection selected;
- contextual session entry;
- scramble magnetic rail;
- completion;
- guided writing;
- feedback;
- summary;
- review empty;
- explore empty;
- reduced motion.

Salvar em:

`test-evidence/v2-22-ux2-production/`

## 28. E2E obrigatórios

### Home

1. não mostra `Still`, `But`, `Yet` como cards principais;
2. mostra collections contextuais;
3. `Praticar agora` inicia adaptive real;
4. collection inicia sessão real com scope;
5. review/explore continuam reais;
6. nenhum pack_id aparece na tela;
7. nenhum mascote aparece;
8. light/dark/mobile funcionam.

### Scramble

1. escolher uma collection;
2. escolher ou alcançar “Montar frases”;
3. Planner/Engine servem word order elegível;
4. Magnetic Rail aparece;
5. resposta usa `token_sequence` real;
6. Assessment/Evidence reais;
7. feedback no mesmo contexto;
8. nenhuma correção por token inventada.

### Scope

1. collection atravessa mais de um pack interno;
2. só materializa membros autorados;
3. não stalla quando um target está bloqueado;
4. fallback é honesto;
5. determinismo preservado.

## 29. Métricas e auditoria

Criar audit para collections:

- collection coverage;
- exemplars por collection;
- constructions por collection;
- packs internos por collection;
- recipe reachability;
- contextual-36 diversity;
- immediate exemplar repeat;
- top exemplar share;
- blocked materializations;
- empty collections;
- orphan exemplars, advisory only.

Hard fail:

- referência inexistente;
- collection sem conteúdo;
- pack técnico exposto como label learner-facing;
- scope que materializa conteúdo fora da collection;
- duplicate collection IDs.

## 30. Segurança pedagógica

Preservar:

- Introduction Groups;
- Active Frontier;
- capability rollups;
- progression order;
- PREMATURE_FREE_PRODUCTION protections;
- LONG_HORIZON_TARGET_LOOP protections;
- evidence imutável;
- DB local-first;
- Assessment semantics;
- V2.22-UX1 interactions.

Não reduzir thresholds para mostrar scramble.

## 31. Versionamento

Se adicionar `StudyScopeV2` ou mudar StudySession/StudyFocus contract:

- bump da versão correspondente;
- testes de compatibilidade;
- não aumentar DB_VERSION sem mudança física.

Se apenas presentation catalog mudar:

- bump `LEARNER_HOME_PRESENTATION_VERSION`;
- versionar collection contract.

## 32. Arquivos esperados

Prováveis alterações:

- `src/screens/V2LearnerHome.jsx`;
- `src/lib/pedagogy-v2/learner-home-presentation.js`;
- novo contract/registry de practice collections;
- `src/screens/V2LessonExperience.jsx`;
- `src/lib/pedagogy-v2/study-session-controller.js`;
- `src/lib/pedagogy-v2/study-focus-resolver.js` ou Engine query, somente onde o scope realmente pertence;
- `src/components/pedagogy-v2-learner/V2LessonHeader.jsx`;
- `src/components/pedagogy-v2-learner/V2SessionSummary.jsx`;
- `src/styles/v2-learner.css`;
- E2E/helpers;
- validators/audits;
- docs/evidence;
- `dist/`.

Não espalhar checks por `collection_id` em vários componentes.

## 33. Acceptance final

V2.22-UX2 fecha somente quando:

1. a Home de produção mudou visivelmente;
2. não existe mascote;
3. Still/But/Yet não aparecem como escolhas learner-facing;
4. categorias são contextuais;
5. collections atravessam packs internos;
6. Praticar agora continua principal;
7. review/explore continuam reais;
8. catálogo escala;
9. nenhuma métrica falsa aparece;
10. código de produção foi alterado;
11. build/dist foram atualizados;
12. deploy de Pages serve a nova Home;
13. scramble é descobrível;
14. scramble aparece em trajetória real elegível;
15. Magnetic Rail do PR #54 é usado;
16. completion e guided writing permanecem;
17. feedback continua honesto;
18. nenhuma pedagogia foi movida para React;
19. nenhum target type novo foi criado;
20. scope não vira mastery;
21. E2E do build de produção passa;
22. screenshots vêm do produto real;
23. DB_VERSION só muda se necessário;
24. testes, audits, simulations e build ficam verdes.

## 34. Relatório final obrigatório

Começar por:

```text
# V2.22-UX2 — produção entregue

Production URL:
...

Home before/after:
...

Context collections:
...

Scramble real path:
...
```

Depois incluir:

1. direção visual escolhida;
2. arquivos de produção alterados;
3. collections criadas;
4. como collections mapeiam para conteúdo interno;
5. por que Still/But/Yet não aparecem;
6. como o scope entra no controller;
7. como scramble se tornou descobrível;
8. prova de reachability sem forced-plan;
9. screenshots;
10. E2E;
11. build/dist;
12. Pages/deploy;
13. versões;
14. limitações reais.

## 35. Princípio final

A pessoa não abre o app pensando:

> “Hoje quero estudar `yet`.”

Ela pensa:

> “Quero praticar uma conversa.”
>
> “Quero me expressar melhor no trabalho.”
>
> “Quero montar frases.”
>
> “Quero revisar.”

Os packs continuam organizando o currículo internamente.

A interface organiza a experiência pelo que faz sentido para quem aprende.
