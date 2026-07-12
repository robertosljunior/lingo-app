import { getSkill, getRuleSkill } from './skill-registry.js'

const FALLBACK = {
  title: 'Compare com a forma esperada',
  summary_pt: 'A resposta não corresponde à forma esperada.',
  explanation_pt: 'Compare sua resposta com a forma correta e observe a parte destacada.',
  learner_tip_pt: 'Leia as duas frases em voz alta e procure a primeira diferença importante.',
}

const EXPLANATIONS = {
  'choice.wrong_collocation': {
    title: ({ expected }) => `Use “${expected}” nesta expressão`,
    summary_pt: 'Algumas palavras aparecem juntas de forma fixa em inglês.',
    explanation_pt: ({ actual, expected }) => `Neste caso, a combinação natural usa “${expected}”, não “${actual}”.`,
    learner_tip_pt: 'Quando estudar vocabulário, memorize a expressão completa, não só a palavra isolada.',
  },
  wrong_collocation: {
    title: ({ expected }) => `Use “${expected}” nesta expressão`,
    summary_pt: 'Algumas palavras aparecem juntas de forma fixa em inglês.',
    explanation_pt: ({ actual, expected }) => `Neste contexto, a collocation natural usa “${expected}”, não “${actual}”.`,
    learner_tip_pt: 'Pense na combinação inteira como uma unidade.',
  },
  'choice.wrong_question_auxiliary': {
    title: ({ expected }) => `Use “${expected}” para iniciar a pergunta`,
    summary_pt: 'A alternativa escolhida muda o auxiliar da pergunta.',
    explanation_pt: ({ expected }) => `No presente simples, perguntas com “you”, “we” e “they” normalmente começam com “${expected}”.`,
    learner_tip_pt: 'Pense na estrutura: Do + sujeito + verbo base.',
  },
  wrong_question_auxiliary: {
    title: 'Escolha o auxiliar da pergunta',
    summary_pt: 'A pergunta precisa do auxiliar adequado ao tempo verbal e ao sujeito.',
    explanation_pt: 'Em inglês, o auxiliar geralmente aparece antes do sujeito em perguntas.',
    learner_tip_pt: 'Identifique primeiro o tempo verbal; depois escolha Do/Does/Did/Have/Has/Is/Are.',
  },
  missing_auxiliary: { title:'Inclua o auxiliar da pergunta', summary_pt:'Faltou uma palavra estrutural para formar a pergunta.', explanation_pt:'Em muitas perguntas em inglês, usamos um auxiliar antes do sujeito.', learner_tip_pt:'Use: auxiliar + sujeito + verbo principal.' },
  wrong_auxiliary: { title:'Ajuste o auxiliar', summary_pt:'O auxiliar usado não combina com esta frase.', explanation_pt:'O auxiliar precisa concordar com o tempo verbal e com o sujeito.', learner_tip_pt:'Confira se a frase fala de presente, passado ou present perfect.' },
  word_order: { title:'A ordem da pergunta precisa mudar', summary_pt:'As palavras principais estão presentes, mas precisam ser reorganizadas.', explanation_pt:'Em perguntas no present perfect, o auxiliar “have” vem antes do sujeito.', learner_tip_pt:'Pense na estrutura: Have + sujeito + particípio + complemento.' },
  question_structure: { title:'A estrutura da pergunta precisa mudar', summary_pt:'A frase precisa seguir a ordem natural de pergunta em inglês.', explanation_pt:'Em perguntas, o auxiliar costuma vir antes do sujeito.', learner_tip_pt:'Procure o auxiliar, depois o sujeito e o verbo principal.' },
  gerund_after_been: { title:'Depois de “have been”, use -ing', summary_pt:'A forma verbal precisa continuar a estrutura do present perfect continuous.', explanation_pt:'Quando usamos “have/has been”, o verbo principal normalmente vem com “-ing”.', learner_tip_pt:'Use: have/has been + working/studying/waiting.' },
  workplace_preposition: { title:'Soa mais natural com “at”', summary_pt:'A frase está compreensível, mas a preposição pode soar mais natural.', explanation_pt:'Para falar de uma empresa como local de trabalho, “at this company” costuma soar natural.', learner_tip_pt:'Use “at” para o lugar/instituição onde alguém trabalha.' },
  wrong_preposition: { title:'Revise a preposição', summary_pt:'A preposição escolhida muda a naturalidade ou o sentido da frase.', explanation_pt:'Preposições em inglês dependem muito da expressão e do contexto.', learner_tip_pt:'Compare a expressão completa com a forma correta.' },
  verb_tense: { title:'Revise o tempo verbal', summary_pt:'A ideia está próxima, mas o tempo verbal precisa mudar.', explanation_pt:'O tempo verbal mostra quando a ação acontece ou como ela se conecta ao presente.', learner_tip_pt:'Procure marcadores de tempo como yesterday, already, yet, since e for.' },
  verb_form: { title:'Revise a forma do verbo', summary_pt:'O verbo precisa de outra forma nesta estrutura.', explanation_pt:'Algumas estruturas pedem verbo base, particípio ou forma com -ing.', learner_tip_pt:'Observe a palavra que vem antes do verbo.' },
  spelling: { title:'Atenção à grafia', summary_pt:'A palavra esperada está quase lá, mas a escrita precisa de ajuste.', explanation_pt:'Pequenas mudanças de letras podem alterar a correção da resposta.', learner_tip_pt:'Compare letra por letra com a forma correta.' },
  apostrophe_usage: { title:'Atenção ao apóstrofo', summary_pt:'A contração precisa do apóstrofo.', explanation_pt:'Em contrações como “I’ve”, o apóstrofo marca letras omitidas.', learner_tip_pt:'Confira contrações com I’m, I’ve, don’t e can’t.' },
  punctuation: { title:'Revise a pontuação', summary_pt:'A frase precisa de um ajuste de pontuação.', explanation_pt:'Pontuação ajuda a marcar pergunta, pausa e fim de frase.', learner_tip_pt:'Confira especialmente ponto final e interrogação.' },
  capitalization: { title:'Revise maiúsculas e minúsculas', summary_pt:'A frase precisa de ajuste de capitalização.', explanation_pt:'Em inglês, nomes próprios e o início da frase usam letra maiúscula.', learner_tip_pt:'Confira a primeira palavra da frase e nomes próprios.' },
  vocabulary: { title:'Revise a escolha de palavras', summary_pt:'Uma palavra não corresponde à forma esperada.', explanation_pt:'A resposta usa uma palavra diferente da que melhor completa este contexto.', learner_tip_pt:'Compare o trecho diferente com a frase correta.' },
  incorrect_choice: FALLBACK,
}

function render(value, ctx) { return typeof value === 'function' ? value(ctx) : value }

export function explainFeedback({ error, question, selectedOption, expectedAnswer, skillTarget } = {}) {
  const invalid = question?.metadata?.distractors?.[selectedOption]?.invalid_rule_id || question?.metadata?.selected_distractor?.invalid_rule_id || question?.selected_distractor?.invalid_rule_id
  const ctx = { actual: error?.actual || selectedOption || '', expected: error?.expected || expectedAnswer || question?.expected_answer || '' }
  const keys = [error?.rule_id, invalid && `choice.${invalid}`, invalid, error?.subtype, skillTarget, getRuleSkill(error?.rule_id)?.skill_id, error?.category].filter(Boolean)
  for (const k of keys) {
    const x = EXPLANATIONS[k]
    if (x) return { title: render(x.title, ctx), summary_pt: render(x.summary_pt, ctx), explanation_pt: render(x.explanation_pt, ctx), learner_tip_pt: render(x.learner_tip_pt, ctx), source: k }
  }
  const sk = getSkill(skillTarget)
  if (sk && !sk.custom) return { title: sk.label_pt, summary_pt: sk.description_pt, explanation_pt: FALLBACK.explanation_pt, learner_tip_pt: FALLBACK.learner_tip_pt, source: `skill:${sk.skill_id}` }
  return { ...FALLBACK, source: 'fallback' }
}
