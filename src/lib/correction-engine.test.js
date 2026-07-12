import { describe, it, expect } from 'vitest'
import {
  normalize,
  tokenize,
  similarity,
  editDistance1,
  isTypoPair,
  wordDiff,
  classifyMistake,
  analyzeAnswer,
  alignTokens,
  MISTAKE_TYPES,
  FEEDBACK_BY_TYPE,
} from './correction-engine.js'

describe('normalize — contrações', () => {
  it('expande n’t e formas irregulares', () => {
    expect(normalize("I don't know")).toBe('i do not know')
    expect(normalize("She doesn't work here")).toBe('she does not work here')
    expect(normalize("They won't come")).toBe('they will not come')
    expect(normalize("I can't do it")).toBe('i can not do it')
    expect(normalize('I cannot do it')).toBe('i can not do it')
  })

  it('expande ’m / ’re / ’ve / ’ll', () => {
    expect(normalize("I'm ready")).toBe('i am ready')
    expect(normalize("We're hiring")).toBe('we are hiring')
    expect(normalize("They've been busy")).toBe('they have been busy')
    expect(normalize("She'll call you")).toBe('she will call you')
  })

  it('aceita apóstrofos tipográficos', () => {
    expect(normalize('I don’t know')).toBe('i do not know')
  })

  it('NÃO expande ’s nem ’d (ambíguos)', () => {
    expect(normalize("the company's offices")).toBe("the company's offices")
    expect(normalize("I'd like that")).toBe("i'd like that")
  })

  it('continua removendo pontuação e normalizando espaços', () => {
    expect(normalize('  Do they have any open positions?! ')).toBe('do they have any open positions')
  })
})

describe('equivalência contração ↔ forma extensa no analyzeAnswer', () => {
  it('resposta com contração casa com esperado por extenso', () => {
    const r = analyzeAnswer({ user_answer: "I don't work there", expected_answer: 'I do not work there' })
    expect(r.verdict).toBe('correct')
    expect(r.similarity_score).toBe(1)
  })

  it('resposta por extenso casa com esperado contraído', () => {
    const r = analyzeAnswer({ user_answer: 'They are not hiring', expected_answer: "They aren't hiring" })
    expect(r.verdict).toBe('correct')
  })
})

describe('editDistance1', () => {
  it('detecta substituição, inserção, remoção e transposição', () => {
    expect(editDistance1('work', 'work')).toBe(0)
    expect(editDistance1('wark', 'work')).toBe(1) // substituição
    expect(editDistance1('positon', 'position')).toBe(1) // inserção
    expect(editDistance1('worrk', 'work')).toBe(1) // remoção
    expect(editDistance1('form', 'from')).toBe(1) // transposição adjacente
  })

  it('retorna 2 para distâncias maiores', () => {
    expect(editDistance1('salary', 'position')).toBe(2)
    expect(editDistance1('their', 'there')).toBe(2)
    expect(editDistance1('ab', 'abcd')).toBe(2)
  })
})

describe('isTypoPair — o que NÃO é typo', () => {
  it('palavras funcionais nunca são typo (in/on é erro de preposição)', () => {
    expect(isTypoPair('on', 'in')).toBe(false)
    expect(isTypoPair('the', 'them')).toBe(false)
    expect(isTypoPair('was', 'has')).toBe(false)
  })

  it('palavras curtas não são typo (he/she é vocabulário)', () => {
    expect(isTypoPair('she', 'he')).toBe(false)
  })

  it('s/d final é flexão, não typo (work/works, like/liked)', () => {
    expect(isTypoPair('works', 'work')).toBe(false)
    expect(isTypoPair('work', 'works')).toBe(false)
    expect(isTypoPair('liked', 'like')).toBe(false)
  })

  it('erro de digitação real é typo', () => {
    expect(isTypoPair('position', 'positon')).toBe(true)
    expect(isTypoPair('salary', 'salery')).toBe(true)
  })
})

describe('wordDiff — pareamento de typos', () => {
  it('separa typos de palavras realmente faltantes/extras', () => {
    const d = wordDiff('do they have any open positon', 'do they have any open position')
    expect(d.typos).toEqual([{ expected: 'position', got: 'positon' }])
    expect(d.missing_words).toEqual([])
    expect(d.extra_words).toEqual([])
  })

  it('mantém faltantes/extras que não são typos', () => {
    const d = wordDiff('they have open positon', 'do they have any open position')
    expect(d.typos).toEqual([{ expected: 'position', got: 'positon' }])
    expect(d.missing_words).toEqual(['do', 'any'])
    expect(d.extra_words).toEqual([])
  })
})

describe('analyzeAnswer — typos', () => {
  it('typo único em frase certa: correto, com typo reportado', () => {
    const r = analyzeAnswer({
      user_answer: 'Do they have any open positon?',
      expected_answer: 'Do they have any open positions?',
      accepted_answers: ['Do they have any open position?'],
    })
    expect(r.verdict).toBe('correct')
    expect(r.typos).toEqual([{ expected: 'position', got: 'positon' }])
  })

  it('typo com resto divergente: classifica pelo problema estrutural', () => {
    const r = analyzeAnswer({
      user_answer: 'they have any open positon?',
      expected_answer: 'Do they have any open position?',
    })
    expect(r.verdict).not.toBe('correct')
    expect(r.possible_mistake_type).toBe('question_structure')
  })

  it('typos pareados mas ordem errada: classifica word_order, não spelling', () => {
    const r = analyzeAnswer({
      user_answer: 'positon salary',
      expected_answer: 'salary position',
    })
    expect(r.verdict).not.toBe('correct')
    expect(r.possible_mistake_type).toBe('word_order')
    expect(r.typos).toEqual([{ expected: 'position', got: 'positon' }])
  })

  it('expõe tokens para o diff visual', () => {
    const r = analyzeAnswer({ user_answer: 'I work here', expected_answer: 'I work there' })
    expect(r.user_tokens).toEqual(['i', 'work', 'here'])
    expect(r.target_tokens).toEqual(['i', 'work', 'there'])
  })
})

describe('classifyMistake — regressões das heurísticas existentes', () => {
  it('mesmas palavras em outra ordem → word_order', () => {
    const d = wordDiff('there would work i for sure', 'i would work there for sure')
    const t = classifyMistake(
      { user: 'there would work i for sure', expected: 'i would work there for sure', missing_words: d.missing_words, extra_words: d.extra_words },
      null,
    )
    expect(t).toBe('word_order')
  })

  it('auxiliar faltando em pergunta → question_structure', () => {
    const d = wordDiff('they have openings?', 'do they have openings?')
    const t = classifyMistake(
      { user: 'they have openings?', expected: 'do they have openings?', missing_words: d.missing_words, extra_words: d.extra_words },
      null,
    )
    expect(t).toBe('question_structure')
  })

  it('preposição trocada → preposition', () => {
    const d = wordDiff('i work in google', 'i work at google')
    const t = classifyMistake(
      { user: 'i work in google', expected: 'i work at google', missing_words: d.missing_words, extra_words: d.extra_words },
      null,
    )
    expect(t).toBe('preposition')
  })
})

describe('consistência dos tipos', () => {
  it('todo mistake_type tem feedback', () => {
    for (const t of MISTAKE_TYPES) {
      expect(FEEDBACK_BY_TYPE[t], `feedback ausente para ${t}`).toBeDefined()
    }
  })
})

describe('similarity — sanidade', () => {
  it('idênticas = 1, disjuntas = 0', () => {
    expect(similarity('open positions', 'open positions')).toBe(1)
    expect(similarity('hello world', 'salary range')).toBe(0)
  })

  it('ordem errada pontua menos que ordem certa', () => {
    const right = similarity('i would work there', 'i would work there')
    const shuffled = similarity('there work would i', 'i would work there')
    expect(shuffled).toBeLessThan(right)
  })

  it('tokenize expande contrações em tokens separados', () => {
    expect(tokenize("don't")).toEqual(['do', 'not'])
  })
})

describe('analyzeAnswer v2 — reliable multi-error evaluation', () => {
  const expectedCompany = "I've been working at this company for three years."

  it('detecta forma verbal como erro principal e preposição como secundário', () => {
    const r = analyzeAnswer({
      user_answer: "I've been worked in this company for three years.",
      expected_answer: expectedCompany,
      mistake_focus: 'missing_auxiliary',
    })
    expect(r.verdict).not.toBe('correct')
    expect(r.engine_version).toBe('2')
    expect(r.detected_errors.length).toBeGreaterThanOrEqual(2)
    expect(r.primary_error).toMatchObject({
      category: 'verb_form',
      subtype: 'gerund_after_been',
      actual: 'worked',
      expected: 'working',
      severity: 'high',
      rule_id: 'verb.have_been_requires_ing',
    })
    expect(r.detected_errors.some((e) => e.subtype === 'missing_auxiliary')).toBe(false)
    expect(r.detected_errors[1]).toMatchObject({
      category: 'preposition',
      subtype: 'workplace_preposition',
      actual: 'in',
      expected: 'at',
    })
    expect(r.possible_mistake_type).toBe('verb_form')
  })

  it('aceita forma expandida equivalente à contração', () => {
    const r = analyzeAnswer({ user_answer: 'I have been working at this company for three years.', expected_answer: expectedCompany })
    expect(r.verdict).toBe('correct')
    expect(r.detected_errors).toEqual([])
  })

  it('trata apóstrofo ausente como baixa severidade, não estrutural', () => {
    const r = analyzeAnswer({ user_answer: 'Ive been working at this company for three years.', expected_answer: expectedCompany })
    expect(r.detected_errors[0]).toMatchObject({ category: 'punctuation', subtype: 'apostrophe_missing', severity: 'low' })
    expect(r.detected_errors.some((e) => ['verb_form', 'auxiliary'].includes(e.category))).toBe(false)
  })

  it('detecta auxiliar realmente ausente', () => {
    const r = analyzeAnswer({ user_answer: 'I working here for two years.', expected_answer: "I've been working here for two years." })
    expect(r.detected_errors[0]).toMatchObject({ category: 'auxiliary', subtype: 'missing_auxiliary', severity: 'high' })
    expect(r.detected_errors[0].evidence).toMatchObject({ expected_auxiliary_present: true, actual_auxiliary_present: false })
  })

  it('detecta been ausente como estrutura auxiliar', () => {
    const r = analyzeAnswer({ user_answer: "I've working here for two years.", expected_answer: "I've been working here for two years." })
    expect(r.detected_errors[0]).toMatchObject({ category: 'auxiliary', subtype: 'missing_auxiliary', expected: 'been' })
  })

  it('detecta forma base após been como verb_form', () => {
    const r = analyzeAnswer({ user_answer: "I've been work here for two years.", expected_answer: "I've been working here for two years." })
    expect(r.primary_error).toMatchObject({ category: 'verb_form', subtype: 'gerund_after_been', actual: 'work', expected: 'working' })
  })

  it('detecta somente preposição/naturalidade com menor severidade', () => {
    const r = analyzeAnswer({ user_answer: "I've been working in this company for three years.", expected_answer: expectedCompany })
    expect(r.primary_error).toMatchObject({ category: 'preposition', subtype: 'workplace_preposition' })
    expect(['low', 'medium']).toContain(r.primary_error.severity)
    expect(r.detected_errors.some((e) => e.subtype === 'missing_auxiliary')).toBe(false)
  })

  it('não usa skill_target como erro detectado em pergunta incorreta', () => {
    const r = analyzeAnswer({
      user_answer: 'Are they have any open positions?',
      expected_answer: 'Do they have any open positions?',
      mistake_focus: 'collocation',
    })
    expect(r.primary_error.category).toBe('auxiliary')
    expect(r.primary_error.subtype).toBe('wrong_auxiliary')
    expect(r.primary_error.category).not.toBe('collocation')
  })
})

describe('alignTokens — positional edit script', () => {
  it('representa replace, insert e delete', () => {
    expect(alignTokens('i worked there', 'i work there').map((a) => a.operation)).toEqual(['equal', 'replace', 'equal'])
    expect(alignTokens('i really work there', 'i work there').map((a) => a.operation)).toEqual(['equal', 'insert', 'equal', 'equal'])
    expect(alignTokens('i work', 'i work there').map((a) => a.operation)).toEqual(['equal', 'equal', 'delete'])
  })

  it('preserva repetições e posições em palavras iguais deslocadas', () => {
    const a = alignTokens('a b b c', 'a b c b')
    expect(a).toHaveLength(4)
    expect(a[1]).toMatchObject({ operation: 'equal', expected_token_index: 1, actual_token_index: 1 })
    expect(a.filter((x) => x.operation === 'replace')).toHaveLength(2)
  })

  it('mantém duas substituições na mesma frase', () => {
    const a = alignTokens("i have been worked in this company", "i have been working at this company")
    expect(a.filter((x) => x.operation === 'replace').map((x) => [x.expected, x.actual])).toEqual([
      ['working', 'worked'],
      ['at', 'in'],
    ])
  })
})

describe('closed exercises — neutral incorrect choice', () => {
  it('não transforma skill_target em erro detectado para escolha errada', async () => {
    const { buildIncorrectChoiceEvaluation } = await import('./correction-engine.js')
    const r = buildIncorrectChoiceEvaluation({ user_answer: 'as', expected_answer: 'like', skill_target: 'collocation' })
    expect(r.primary_error).toMatchObject({ category: 'incorrect_choice', subtype: 'incorrect_choice', rule_id: 'choice.exact_match' })
    expect(r.skill_target).toBe('collocation')
    expect(r.possible_mistake_type).toBe('incorrect_choice')
  })
})
