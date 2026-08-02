# V2.22-UX0 — Implementation map (para V2.22-UX1)

Um bloco por arquivo do repo. `CURRENT` é o que existe hoje; `PROPOSED` é o que o slice UX1
deve fazer; `KEEP` é o que **não** pode ser tocado.

Classes: **A** = possível com o contrato atual · **B** = exige mudança de presentation contract
· **C** = exige dado que o Assessment não fornece (fora de escopo).

---

## src/components/pedagogy-v2-learner/V2LearnerActivity.jsx — classe A

**CURRENT**
- `WordOrderActivity` mantém uma lista de tokens escolhidos e só permite acrescentar ao fim
  e remover o último; a área construída lê como uma caixa de botões.
- `CompletionActivity` mantém um único `value` e desenha **um** `.v2lx-slot`; quando
  `buildMaskedCompletion` devolve mais de um `expected_token`, os gaps restantes ficam como
  `_____` literal e não são preenchíveis.
- Não há estado visível entre "Verificar" e o feedback.

**PROPOSED**
- `WordOrderActivity`: `picked: number[]` + `selected: number|null` (gap alvo). Toque em gap
  seleciona posição; toque em token do banco insere ali; toque em token da frase remove;
  "Desfazer último" e "Recomeçar" aparecem só com tokens presentes.
- `CompletionActivity`: `fills: { [gapIndex]: token }`, um slot por `expected_token`,
  cada slot com `data-gap`. Banco reversível por opacidade + `aria-label`.
- Estado `submitting` propagado ao shell enquanto a avaliação está em voo.

**KEEP**
- `presentedOrderTokens(plan)` como única fonte de ordem — nunca re-embaralhar no cliente.
- `buildMaskedCompletion(plan)` como única fonte de máscara e de `expected_tokens`.
- `onSubmittable` e `onSupport` com as assinaturas atuais.
- Nenhuma marcação de acerto por token.

**NEW LOCAL PRESENTATION STATE**
| Estado | Tipo | Onde vive | Persistido? |
|---|---|---|---|
| `picked` | `number[]` (índices da ordem apresentada) | `WordOrderActivity` | não |
| `selected` | `number \| null` | `WordOrderActivity` | não |
| `fills` | `{ [gapIndex:number]: string }` | `CompletionActivity` | não |
| `modelShown` | `boolean` | `ProductionActivity` | não (mas dispara `onSupport`) |
| `submitting` | `boolean` | shell (fonte) | não |

**PAYLOAD** — nenhuma mudança
- Word Order: `{ type:'token_sequence', payload:{ tokens: string[] } }`
- Completion: `{ type:'text', payload:{ text } }` com `masked_text` reconstituído
- Writing / fallback de fala: `{ type:'text', payload:{ text } }`

**ACCESSIBILITY**
- Gaps de inserção são `button` com nome "Inserir na posição N".
- `aria-label` de token inclui a posição, distinguindo duplicatas.
- Ordem DOM = ordem lida; alvos ≥44px; `:focus-visible` visível em chips, slots e gaps.
- Estado nunca só por cor: borda inferior, glifo, opacidade.

**TESTS**
1. Teclado completo: montar, inserir no meio, remover, desfazer, submeter.
2. Duplicatas: usar o primeiro "to" não desabilita o segundo.
3. Múltiplos gaps: com 2 `expected_tokens`, existem 2 slots preenchíveis e nenhum `_____` literal.
4. Payload byte-a-byte igual ao atual para os mesmos inputs.
5. Duplo toque em Verificar produz **um** envio.

**RISK**
- Médio. É o arquivo com mais superfície. O risco real é regressão de payload — cobrir com
  teste de snapshot de payload antes de mexer na UI.

---

## src/components/pedagogy-v2-learner/V2LessonShell.jsx — classe A

**CURRENT** — CTA único, guarda de duplo envio, confirmação ao sair.
**PROPOSED** — nenhuma mudança de contrato; apenas (a) confirmar `pending` com o novo payload
de completion e (b) refletir `submitting` no rótulo/estado inerte do CTA.
**KEEP** — CTA único (nenhuma tela ganha um segundo botão primário); guarda de duplo envio; confirmação ao sair.
**NEW LOCAL PRESENTATION STATE** — `submitting: boolean` (já existe como guarda; passa a ser visível).
**PAYLOAD** — inalterado.
**ACCESSIBILITY** — CTA mantém nome acessível estável; `aria-disabled` em vez de remover o botão.
**TESTS** — CTA habilita só quando **todos** os gaps estão preenchidos; permanece inerte durante `submitting`.
**RISK** — baixo.

---

## src/components/pedagogy-v2-learner/V2ActivityStage.jsx — classe A

**CURRENT** — slide horizontal com `phase in/out` e `onStageEnd`.
**PROPOSED** — nada estrutural. Só confirmar que `reducedMotion` troca a tela sem slide.
**KEEP** — `phase in/out`, `onStageEnd`, header e footer contínuos entre atividades.
**NEW LOCAL PRESENTATION STATE** — nenhum.
**PAYLOAD** — n/a.
**ACCESSIBILITY** — foco não deve saltar para o topo a cada troca de atividade.
**TESTS** — regressão de double advance (um `onStageEnd` por transição).
**RISK** — baixo, mas é o ponto histórico de double advance: manter o teste.

---

## src/components/pedagogy-v2-learner/V2FeedbackPanel.jsx — classe A

**CURRENT** — painel com semântica de tone, labels do adapter e disclosure.
**PROPOSED** — régua vertical de continuidade tingida pelo tone, ligando resposta e feedback
na mesma coluna. Sem modal, sem troca de rota.
**KEEP** — semântica de tone, labels vindos do adapter, disclosure, e o gate de
"nenhuma causa inventada" (o painel não explica o que o Assessment não disse).
**NEW LOCAL PRESENTATION STATE** — nenhum.
**PAYLOAD** — n/a.
**ACCESSIBILITY** — live region apenas aqui; glifo por tone além da cor; `unknown` declara que não é erro.
**TESTS** — gate de causa inventada; contraste dos 5 tones em light e dark.
**RISK** — baixo.

---

## src/components/pedagogy-v2-learner/V2Sentence.jsx — classe A

**CURRENT** — um slot inline por frase, variantes de tamanho.
**PROPOSED** — aceitar **N** slots inline, mantendo pontuação no texto e sem separar
slot e pontuação em quebra de linha.
**KEEP** — variantes de tamanho e a escala de fonte por largura.
**NEW LOCAL PRESENTATION STATE** — nenhum (recebe `fills` por prop).
**PAYLOAD** — n/a.
**ACCESSIBILITY** — cada slot com nome "Lacuna N" e o valor atual.
**TESTS** — 320px sem overflow com 2 slots; pontuação nunca órfã.
**RISK** — baixo/médio (layout).

---

## src/styles/v2-learner.css — classe A

**CURRENT** — tokens de motion e breakpoints existentes; `.v2lx-slot` único.
**PROPOSED** — novos tokens de motion (ver `design-tokens.md`), `.v2lx-rail`,
`.v2lx-slot[data-gap]`, e o par slot+pontuação como unidade que não quebra.
**KEEP** — tokens existentes, breakpoints, e o bloco `prefers-reduced-motion` como
**redução real** (não só duração menor).
**NEW LOCAL PRESENTATION STATE** — n/a.
**PAYLOAD** — n/a.
**ACCESSIBILITY** — reduced motion completo; nenhuma função dependente de movimento.
**TESTS** — dark e reduced motion em todas as telas novas.
**RISK** — baixo.

---

## src/lib/pedagogy-v2/activity-runtime-contracts.js — classe A (sem mudança)

**CURRENT** — `presentedOrderTokens`, `buildMaskedCompletion` e os helpers de runtime.
**PROPOSED** — **nenhuma mudança.** `buildMaskedCompletion` já devolve `expected_tokens`
plural; o defeito está na apresentação, não aqui.
**KEEP** — tudo. Nenhum cálculo novo deve ser adicionado ao React.
**TESTS** — nenhum novo; os existentes cobrem a máscara.
**RISK** — nenhum, desde que ninguém "conserte" o helper por engano.
