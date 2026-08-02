# V2.22-UX0 — Design tokens

Tokens usados pelo mockup, com o estado de cada um. `existente` = já em `src/styles/v2-learner.css`;
`proposto` = novo neste slice; `fixture` = só do lab, não vai para produção.

## Motion

| Token | Valor | Uso | Status |
|---|---|---|---|
| `--v2-dur-token-move` | 160ms | token entra na régua / muda de posição | proposto |
| `--v2-dur-token-remove` | 140ms | token volta ao banco | proposto |
| `--v2-dur-slot-fill` | 180ms | chip assenta no slot de completion | proposto |
| `--v2-dur-answer-settle` | 220ms | resposta assenta antes do feedback | proposto |
| `--v2-distance-token-lift` | 2px | elevação do token ao ser tocado | proposto |
| `--v2-ease-spring-soft` | `cubic-bezier(.34,1.36,.64,1)` | assentamento de token e slot | proposto |
| `--v2-ease` | `cubic-bezier(.4,0,.2,1)` | transições gerais | existente |
| `--v2-dur-stage-out` | 220ms | atividade sai à esquerda | existente |
| `--v2-dur-stage-in` | 260ms | próxima atividade entra da direita | existente |
| `--v2-dur-feedback` | 260ms | rise do painel de feedback | existente |

Os tokens propostos **coexistem** com os existentes; nenhum valor atual é redefinido.

## Cor — papéis (light / dark)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--v2-bg` | ground da tela | ground escuro | fundo do telefone |
| `--v2-surface` | superfície de chip, cartão, opção | superfície elevada | chips, cartões, opções |
| `--v2-surface-alt` | superfície recuada | idem | CTA inerte, barra vazia |
| `--v2-ink` | texto principal | texto claro | frases, títulos |
| `--v2-muted` | texto secundário | idem | instruções, ações de texto |
| `--v2-muted-2` | texto terciário | idem | slot vazio, contadores |
| `--v2-line` | hairline | idem | bordas de chip e cartão |
| `--v2-primary` | accent | accent claro | régua, slot preenchido, CTA |
| `--v2-on-primary` | texto sobre accent | idem | rótulo do CTA |
| `--v2-kicker-color` | kicker | idem | rótulo de seção |

Todos existentes. O lab reproduz os dois conjuntos em objetos `LIGHT` / `DARK` — isso é
**fixture**: em produção os valores vêm do CSS.

## Cor — tones de feedback

| Token | Tone | Glifo | Status |
|---|---|---|---|
| `--v2-fb-correct` / `-bg` | acerto | ✓ | existente |
| `--v2-fb-suggestion` / `-bg` | aceito, há forma mais natural | ✦ | existente |
| `--v2-fb-partial` / `-bg` | parcial | ◑ | existente |
| `--v2-fb-semantic` / `-bg` | sentido diferente | ↔ | existente |
| `--v2-fb-linguistic` / `-bg` | desvio de forma | ✕ | existente |
| `--v2-fb-unknown` / `-bg` | não avaliado (não é erro) | … | existente |

Regra: **todo tone tem glifo**. Cor nunca é o único portador de estado.

## Tipografia

| Token | Valor | Uso |
|---|---|---|
| `--v2-sentence-completion` | 23px @320 · 25px @375 · 29px @430 | frase de completion |
| família | Barlow (corpo) | todo o app |
| peso de frase | 800 | frase alvo e chips |

Nenhum texto de interface abaixo de 13px; alvos de toque ≥44px independentemente da fonte.

## Reduced motion

Com `prefers-reduced-motion: reduce` (ou o toggle do lab):

| O que normalmente anima | Comportamento reduzido |
|---|---|
| token entrando na régua | aparece direto no destino, com mudança de borda |
| chip assentando no slot | aparece preenchido, sem spring |
| feedback | aparece no lugar final, sem rise |
| troca de atividade | troca direta, sem slide |
| estado "avaliando" | imediato (sem espera artificial) |

Nenhuma função depende de movimento: cada estado é legível por borda, glifo ou opacidade.
