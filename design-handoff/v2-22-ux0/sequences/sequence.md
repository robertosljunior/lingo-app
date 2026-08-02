# V2.22-UX0 — A rota recomendada, quadro a quadro

Doze quadros do mockup real, na ordem em que o learner os vê. Cada quadro é um PNG nesta pasta.
Reproduza qualquer um com `__lab.setState({...})` (ver README → PARA REGERAR AS IMAGENS).

| # | Quadro | Estado do lab | O que muda | Duração da transição |
|---|---|---|---|---|
| 01 | `sequence-01-word-order-empty.png` | `{ screen:'wo_a' }` | régua vazia com a dica de toque | — (entrada da atividade: 260ms) |
| 02 | `sequence-02-word-order-insert-gap.png` | `{ screen:'wo_a', picked:[2,5], selected:1 }` | gap de inserção ativo entre dois tokens | 160ms (`--v2-dur-token-move`) |
| 03 | `sequence-03-word-order-complete.png` | `{ screen:'wo_a', picked:[2,5,3,0,4,1] }` | frase completa, banco todo em 0.32 | 160ms por token |
| 04 | `sequence-04-word-order-submitting.png` | `{ ..., submitting:true }` | CTA em "Avaliando…", atividade intocada | imediato |
| 05 | `sequence-05-word-order-feedback.png` | `{ ..., answered:true, variant:'correct' }` | resposta assenta, feedback sobe na mesma coluna | 220ms + 260ms |
| 06 | `sequence-06-completion-empty.png` | `{ screen:'comp_b' }` | próxima atividade entra da direita: **dois** slots vazios | 220ms out / 260ms in |
| 07 | `sequence-07-completion-filled.png` | `{ screen:'comp_b', fills:{0:'not',1:'yet'} }` | um chip por lacuna; banco reversível | 180ms (`--v2-dur-slot-fill`) |
| 08 | `sequence-08-writing-empty.png` | `{ screen:'writing' }` | prompt e área de resposta ligados pela régua vertical | 220/260ms |
| 09 | `sequence-09-writing-filled.png` | `{ screen:'writing', write:'…' }` | resposta digitada, contador factual | — |
| 10 | `sequence-10-writing-model.png` | `{ ..., modelShown:true }` | modelo autoral revelado sob demanda (`onSupport`) | 180ms |
| 11 | `sequence-11-writing-feedback.png` | `{ ..., answered:true, variant:'suggestion' }` | feedback abaixo da resposta, que permanece visível | 220ms + 260ms |
| 12 | `sequence-12-demo-done.png` | `{ screen:'demo' }` | fim da demo: declara o percurso e que nada foi gravado | 220/260ms |

## Regras que a sequência demonstra

1. **Um único CTA primário** em todos os quadros. Nunca dois botões competindo.
2. **Header e footer contínuos**: só a área da atividade desliza; progresso e contador não piscam.
3. **Feedback nunca sai da tela**: sem modal, sem rota nova, resposta sempre visível.
4. **O estado "avaliando" existe** (quadro 04) — sem ele o duplo envio depende de guarda invisível.
5. **Reduced motion**: os mesmos doze quadros são alcançáveis sem nenhuma animação; a única
   diferença é que não há estados intermediários de movimento.
