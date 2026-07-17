# Pedagogy V2 — Learner Model + Lesson Engine (Slices V2.2 e V2.3)

Continuação direta da fundação de conteúdo da V2.1
(`docs/pedagogy-v2-content-model.md`). Esta entrega implementa as duas camadas
que faltavam para fechar o ciclo *conteúdo → aluno → seleção*:

- **Learner model V2** (`learner-contracts.js`, `learner-model.js`,
  `learner-store.js`) — evidência imutável e estados reconstruíveis por
  domínio de aprendizagem. *Nota histórica: a slice V2.2 estava planejada, mas
  nunca havia sido implementada no repositório; ela entra aqui como
  pré-requisito da V2.3, seguindo a especificação original.*
- **Lesson engine V2** (`lesson-engine.js`) — motor paralelo, puro e
  determinístico, que seleciona a próxima atividade. **O motor não gera
  frases**: ele apenas escolhe exemplares completos e autorados do pack e
  decide em qual domínio de aprendizagem o aluno vai encontrá-los.

Nada aqui é consumido pelo gerador V1, pelo corretor V1 ou pela UI — mesma
regra de isolamento da V2.1 (o namespace não importa `skill-registry.js`,
`storage.js` etc.; a persistência usa um banco IndexedDB próprio).

## 1. Learner model V2: domínio = alvo × capacidade × modalidade × apoio

Não existe mastery global de um alvo. A unidade de estado é o **domínio de
aprendizagem** completo:

| Eixo | Valores | Separação garantida |
|---|---|---|
| capacidade | `recognition`, `controlled_production`, `free_production` | reconhecimento ≠ produção; produção controlada ≠ produção livre |
| modalidade | `reading`/`listening` (reconhecimento), `writing`/`speaking` (produção) | leitura ≠ escuta; escrita ≠ fala |
| lane de apoio | `supported`, `independent` | apoiado ≠ independente |

Combinações sem sentido (ex.: `recognition` × `writing`) são rejeitadas na
validação (`EVIDENCE_DOMAIN_INVALID`).

### learner_evidence_v2 — eventos imutáveis

Um evento = uma observação de um alvo em um domínio, com `outcome`
(`correct`/`partial`/`incorrect`), timestamp, sessão e exemplar de origem. O
store rejeita reescrita de um `evidence_id` existente (`EVIDENCE_IMMUTABLE`) e
valida cada append contra o registry V2: alvo ou exemplar inexistente no pack
→ `EVIDENCE_TARGET_UNRESOLVED`/`EVIDENCE_EXEMPLAR_UNRESOLVED`. IDs de alvo sem
prefixo tipado (mistura silenciosa com V1) → rejeitados.

### learner_target_states_v2 — estados reconstruíveis

`reduceLearnerStatesV2(events)` é um fold determinístico (ordenado por
`created_at` + `evidence_id`, independente da ordem de inserção) que produz,
por domínio: tentativas, sucessos (parcial = 0,5), streak, força (EWMA α=0,35),
primeiro/último contato e último resultado. `rebuildLearnerStatesV2(profile)`
reconstrói tudo do log — o log é a fonte de verdade; o teste de store prova que
o caminho incremental e a reconstrução convergem. Retenção é lida **por
capacidade** (`retentionStatusV2` + intervalos por capacidade na policy do
motor).

Persistência: banco IndexedDB separado `app-idiomas-pedagogy-v2`, stores
`learner_evidence_v2` e `learner_target_states_v2` (índices por perfil, sessão
e alvo). O schema V1 em `storage.js` não foi tocado.

## 2. Lesson engine V2: seleção pura e determinística

```js
import { selectNextActivityV2, createLessonSessionV2, appendActivityToSessionV2 }
  from '../src/lib/pedagogy-v2/lesson-engine.js'

const decision = selectNextActivityV2({ session, pack, learnerStates, recentEvidence, policy })
```

Contrato de determinismo: função pura dos argumentos — sem relógio (o tempo
vem de `session.now`), sem aleatoriedade; entradas iguais ⇒ decisão
profundamente igual (testado). Empates são resolvidos por ordem autoral do
exemplar → escada de capacidades → ordem de modalidade → ordem de lane.

### Filtros duros (com razão de exclusão declarada)

1. **Pré-requisitos V2** — todo pré-requisito do exemplar precisa estar
   "conhecido" (qualquer domínio com força ≥ limiar; produzir implica
   conhecer). Razão: `prerequisite_unmet:<ref>`.
2. **Pontes V1** — aplicadas somente se o chamador fornecer
   `session.v1_mastered_skill_ids`; sem a lista, são assumidas atendidas
   (opt-in, como na V2.1).
3. **Orçamento de itens novos** — só contam como novos os
   `intended_new_items` que o aluno nunca viu; o total da sessão é limitado
   por `new_item_budget_per_session` (default 2).
4. **Cooldown de exemplar** — sem repetição dentro da janela; levantado em
   fallback quando bloquearia a sessão inteira (repetir > travar).

### Domínios candidatos por exemplar

- Alvo primário **nunca visto** → só o domínio de introdução
  (`recognition`/`reading`/`supported`).
- Escada de capacidades: `controlled_production` abre quando `recognition`
  está consolidado (força ≥ 0,65, ≥ 2 tentativas) para todos os alvos
  primários; `free_production` idem sobre `controlled_production`.
- Lane `independent` abre **por capacidade × modalidade**: sucesso apoiado em
  leitura não libera escuta independente.

### Score (componentes 0–1 × pesos da policy)

`need` (fragilidade no domínio candidato) · `retention` (revisão vencida pelo
intervalo da capacidade) · `progression` (proximidade da fronteira curricular
de estágios — estágios seguem sendo recomendações, nunca bloqueio) ·
`capability_gap` (domínio defasado vs. melhor domínio do alvo) ·
`independence` · `novelty` (novos itens dentro do orçamento) · `diversity`
(variação de construção/modalidade na sessão) · `remediation` (erro recente em
`recentEvidence` puxa o alvo de volta à lane apoiada).

### Decisão

`status: 'activity'` com: exemplar completo (texto EN/PT autorado, contexto,
construção, sentidos), domínio escolhido, `activity_kind` (mapeamento fixo
capacidade×modalidade, ex.: `listen_and_recognize`, `controlled_write`),
alvos primários/secundários, `new_item_refs`, `score_breakdown`, razões em
pt-BR, alternativas ranqueadas, exclusões com motivo e orçamento restante.
Demais estados: `session_complete` (teto de atividades) e
`no_eligible_activity` (tudo excluído, com os motivos).

A sessão é dado puro: `createLessonSessionV2` cria, `appendActivityToSessionV2`
evolui imutavelmente (histórico + itens novos introduzidos).

## 3. O piloto progressivo `still` (provado em teste)

`lesson-engine.test.js` percorre o arco desejado — *"eu já conheço still,
agora estou aprendendo uma nova maneira de usá-la"*:

1. Aluno novo → `exemplar:still.001` ("I still live here.") em
   reconhecimento/leitura/apoiado, introduzindo sentido + construção (orçamento
   2 → 0).
2. Continuidade consolidada → o motor avança para a construção com `be`
   (`006`, "I am still tired."): mesmo sentido, estrutura nova, 1 item novo.
3. `011` (but + still, 2 itens novos) não cabe em orçamento 1; `015`
   (although) e `019` (marcador discursivo) ficam gateados até as bases
   existirem — e destravam quando o sentido contra-expectativa e a construção
   com `but` são conhecidos.
4. Sem itens novos permitidos, o motor aprofunda: reconhecimento →
   produção controlada (nunca direto para produção livre); lane independente
   abre por modalidade; capacidades sem prática recente voltam por retenção;
   erro recente traz o alvo de volta com apoio.

## 4. Fora de escopo (deliberado)

Assessment V2 (pipeline `language-analysis` nos modos guiado/livre) · UI/rotas
· feature flag · gravação automática de evidência a partir do corretor ·
packs V2 múltiplos/instaláveis · migração de usuários · qualquer alteração no
núcleo V1.

Testes: `npm test` (unidade; `learner-model.test.js`, `learner-store.test.js`,
`lesson-engine.test.js`). Conteúdo: `npm run validate:pedagogy-v2`.
