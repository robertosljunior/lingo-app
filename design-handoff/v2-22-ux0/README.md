# V2.22-UX0 — Handoff de design (Interactive Exercise Design)

Pacote de entrega do slice **V2.22-UX0**. É um pacote de *design*: define a experiência
recomendada dos exercícios interativos V2 e o mapa de implementação para o slice seguinte
(**V2.22-UX1**). Nenhuma linha de produção foi alterada por este pacote.

## O que tem aqui

| Arquivo | Para quem | Conteúdo |
|---|---|---|
| `HANDOFF.md` | design + eng | tela por tela: imagem, callouts, componente, estado, payload, motion, a11y |
| `IMPLEMENTATION-MAP.md` | eng | por arquivo do repo: CURRENT / PROPOSED / KEEP / STATE / PAYLOAD / A11Y / TESTS / RISK |
| `source-map.md` | eng | de qual arquivo do repo cada componente do mockup veio e o que é reaproveitável |
| `design-tokens.md` | eng + design | tokens usados e propostos, em light, dark e reduced motion |
| `sequences/sequence.md` | design + eng | a rota recomendada quadro a quadro, com duração de cada transição |
| `screenshots/` | todos | 29 estados capturados do mockup real |
| `mockup/index.html` | todos | o mockup navegável, self-contained (abre offline, sem servidor) |
| `mockup/mockup-manifest.json` | eng | telas, estados, larguras e temas que o mockup cobre |

Fonte única do mockup: `V2.22-UX0 Interaction Lab.dc.html`, na raiz do projeto de design.
Tudo em `mockup/` e `screenshots/` é **derivado** dele — nada foi redesenhado à mão para o pacote.

## PARA ABRIR O MOCKUP

Abra `mockup/index.html` em qualquer navegador (arquivo local, sem servidor, sem build).
No mockup: painel esquerdo escolhe rota, tela, largura (320/375/430), tema, reduced motion
e o tone do feedback; o telefone à direita é interativo.

Comece por **Rota → Experiência recomendada**: ela roda Word Order → Completion (duas
lacunas) → Guided Writing → Demo concluída, que é exatamente o que `HANDOFF.md` documenta.

## PARA REGERAR O MOCKUP

O mockup é gerado a partir do arquivo de design, não editado à mão:

1. Abra `V2.22-UX0 Interaction Lab.dc.html` no projeto de design.
2. Gere a versão self-contained a partir dele e grave em `design-handoff/v2-22-ux0/mockup/index.html`.

Não edite `mockup/index.html` diretamente: ele é sobrescrito na próxima geração.

## PARA REGERAR AS IMAGENS

As 29 imagens de `screenshots/` e os 12 quadros de `sequences/` saem do mockup dirigido por
script. O lab expõe, só em DEV, o hook `window.__lab` (definido em `componentDidMount`), e
cada imagem é um estado explícito:

```js
// no console do mockup aberto
__lab.setState({ screen:'wo_a', picked:[2,5,3,0,4,1], answered:true, variant:'correct' });
```

Estados de cada imagem: ver a coluna "Estado do lab" em `HANDOFF.md`.
A captura isola o telefone (elemento `#lab-device`) — as imagens não devem conter o painel
de controles do lab.

## Limites deste pacote

- Nada é gravado: sem evidence, sem Learner Model, sem sessão real. As frases são fixtures.
- O mockup usa réplicas fiéis das interações, não os componentes React de produção
  (ver `source-map.md`, coluna "NOT FOR PRODUCTION").
- A única correção de comportamento proposta é de apresentação (um slot por `expected_token`).
  Assessment, scoring e contratos de payload permanecem intocados.
