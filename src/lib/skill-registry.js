// skill-registry.js — canonical pedagogical skills used by the local,
// deterministic evaluation/profile pipeline. Unknown YAML f/skill_target values
// are accepted as custom skills instead of rejecting a lesson.

export const SKILL_REGISTRY_VERSION = '1'

const SKILLS = {
  question_structure: skill('question_structure', null, 'question_structure', 'Estrutura de perguntas', 'Question structure', 'Organizar perguntas em inglês com a estrutura correta.', 'high'),
  question_auxiliary: skill('question_auxiliary', 'question_structure', 'auxiliary', 'Auxiliar em perguntas', 'Question auxiliary', 'Usar o auxiliar correto no início de perguntas.', 'high'),
  missing_auxiliary: skill('missing_auxiliary', 'question_structure', 'auxiliary', 'Auxiliar ausente', 'Missing auxiliary', 'Incluir o auxiliar necessário na frase.', 'high'),
  wrong_auxiliary: skill('wrong_auxiliary', 'question_structure', 'auxiliary', 'Auxiliar incorreto', 'Wrong auxiliary', 'Escolher o auxiliar adequado ao tempo e sujeito.', 'high'),
  verb_form: skill('verb_form', null, 'verb_form', 'Forma verbal', 'Verb form', 'Usar a forma correta do verbo.', 'high'),
  verb_tense: skill('verb_tense', null, 'verb_tense', 'Tempo verbal', 'Verb tense', 'Escolher o tempo verbal adequado.', 'high'),
  present_perfect: skill('present_perfect', 'verb_tense', 'verb_tense', 'Present perfect', 'Present perfect', 'Usar have/has + particípio para experiências ou resultados.', 'high'),
  present_perfect_continuous: skill('present_perfect_continuous', 'present_perfect', 'verb_form', 'Present perfect continuous', 'Present perfect continuous', 'Usar have/has been + verbo com -ing.', 'high'),
  gerund_after_been: skill('gerund_after_been', 'present_perfect_continuous', 'verb_form', 'Verbo com -ing depois de have been', 'Verb with -ing after have been', 'Usar a forma com -ing depois de have/has been.', 'high'),
  word_order: skill('word_order', null, 'word_order', 'Ordem das palavras', 'Word order', 'Colocar as palavras na ordem natural em inglês.', 'medium'),
  preposition: skill('preposition', null, 'preposition', 'Preposições', 'Prepositions', 'Escolher preposições naturais para o contexto.', 'medium'),
  workplace_preposition: skill('workplace_preposition', 'preposition', 'preposition', 'Preposição em contexto profissional', 'Workplace preposition', 'Usar preposições naturais com empresas e trabalho.', 'low'),
  collocation: skill('collocation', null, 'collocation', 'Collocations', 'Collocations', 'Usar combinações naturais de palavras.', 'medium'),
  spelling: skill('spelling', null, 'spelling', 'Ortografia', 'Spelling', 'Escrever palavras corretamente.', 'low'),
  apostrophe_usage: skill('apostrophe_usage', 'punctuation', 'punctuation', 'Uso de apóstrofo', 'Apostrophe usage', 'Usar apóstrofos em contrações.', 'low'),
  punctuation: skill('punctuation', null, 'punctuation', 'Pontuação', 'Punctuation', 'Usar pontuação adequada.', 'low'),
  capitalization: skill('capitalization', null, 'capitalization', 'Maiúsculas e minúsculas', 'Capitalization', 'Usar capitalização adequada.', 'low'),
  vocabulary: skill('vocabulary', null, 'vocabulary', 'Vocabulário', 'Vocabulary', 'Escolher palavras adequadas ao contexto.', 'medium'),
  incorrect_choice: skill('incorrect_choice', null, 'incorrect_choice', 'Escolha da alternativa', 'Incorrect choice', 'Selecionar a alternativa correta.', 'medium'),
  // Slice 5: skills required by the multi-level content packs. Each carries
  // the CEFR level where the skill first becomes primary content.
  simple_present: skill('simple_present', 'verb_tense', 'verb_tense', 'Presente simples', 'Simple present', 'Usar o presente simples para rotinas e fatos.', 'high', 'A1'),
  verb_to_be: skill('verb_to_be', 'verb_form', 'verb_form', 'Verbo to be', 'Verb to be', 'Usar am/is/are corretamente.', 'high', 'A1'),
  there_is_are: skill('there_is_are', 'verb_to_be', 'verb_form', 'There is / there are', 'There is / there are', 'Indicar existência com there is/are.', 'medium', 'A1'),
  can_ability: skill('can_ability', null, 'modal', 'Can (habilidade)', 'Can (ability)', 'Expressar habilidade com can/can’t.', 'medium', 'A1'),
  can_request: skill('can_request', 'can_ability', 'modal', 'Can (pedido)', 'Can (request)', 'Fazer pedidos com can/could.', 'medium', 'A1'),
  article_usage: skill('article_usage', null, 'article', 'Artigos', 'Articles', 'Usar a/an/the corretamente.', 'medium', 'A1'),
  past_simple: skill('past_simple', 'verb_tense', 'verb_tense', 'Passado simples', 'Past simple', 'Usar o passado simples para eventos concluídos.', 'high', 'A2'),
  present_continuous: skill('present_continuous', 'verb_tense', 'verb_tense', 'Presente contínuo', 'Present continuous', 'Usar be + -ing para ações em andamento.', 'high', 'A2'),
  future_going_to: skill('future_going_to', 'verb_tense', 'verb_tense', 'Futuro com going to', 'Future with going to', 'Falar de planos com going to.', 'medium', 'A2'),
  comparatives: skill('comparatives', null, 'grammar', 'Comparativos', 'Comparatives', 'Comparar com -er / more ... than.', 'medium', 'A2'),
  countable_uncountable: skill('countable_uncountable', null, 'grammar', 'Contáveis e incontáveis', 'Countable / uncountable', 'Usar some/any/much/many corretamente.', 'medium', 'A2'),
  first_conditional: skill('first_conditional', null, 'grammar', 'Primeira condicional', 'First conditional', 'Usar if + presente, will + verbo.', 'high', 'B1'),
  second_conditional: skill('second_conditional', 'first_conditional', 'grammar', 'Segunda condicional', 'Second conditional', 'Usar if + passado, would + verbo.', 'high', 'B2'),
  passive_voice: skill('passive_voice', null, 'grammar', 'Voz passiva', 'Passive voice', 'Usar be + particípio para voz passiva.', 'high', 'B2'),
  reported_speech: skill('reported_speech', null, 'grammar', 'Discurso indireto', 'Reported speech', 'Relatar falas com mudança de tempo verbal.', 'high', 'B2'),
  modal_deduction: skill('modal_deduction', null, 'modal', 'Modais de dedução', 'Modal deduction', 'Deduzir com must/might/can’t.', 'medium', 'B2'),
  modal_verbs: skill('modal_verbs', null, 'modal', 'Verbos modais', 'Modal verbs', 'Usar should/must/might corretamente.', 'medium', 'B1'),
  phrasal_verbs: skill('phrasal_verbs', 'vocabulary', 'vocabulary', 'Phrasal verbs', 'Phrasal verbs', 'Usar phrasal verbs frequentes.', 'medium', 'B1'),
  relative_clauses: skill('relative_clauses', null, 'grammar', 'Orações relativas', 'Relative clauses', 'Usar who/which/that em orações relativas.', 'medium', 'B1'),
  polite_requests: skill('polite_requests', 'can_request', 'communication', 'Pedidos educados', 'Polite requests', 'Fazer pedidos educados e naturais.', 'medium', 'A2'),
  connectors: skill('connectors', null, 'grammar', 'Conectores', 'Connectors', 'Ligar ideias com conectores adequados.', 'medium', 'A2'),
}

const ALIASES = {
  ing_after_have_been: 'gerund_after_been',
  verb_ing_after_been: 'gerund_after_been',
  have_been_ing: 'gerund_after_been',
  wrong_question_auxiliary: 'question_auxiliary',
  question_with_do: 'question_auxiliary',
  naturalness: 'workplace_preposition',
  missing_been: 'missing_auxiliary',
  apostrophe_missing: 'apostrophe_usage',
  punctuation_only: 'punctuation',
  case_only: 'capitalization',
}

export const RULE_SKILLS = {
  'verb.have_been_requires_ing': { skill_id: 'gerund_after_been', parent_skill_id: 'present_perfect_continuous' },
  'preposition.work_at_company': { skill_id: 'workplace_preposition', parent_skill_id: 'preposition' },
  'preposition.token_replacement': { skill_id: 'preposition', parent_skill_id: null },
  'auxiliary.missing': { skill_id: 'missing_auxiliary', parent_skill_id: 'question_structure' },
  'auxiliary.wrong_question_auxiliary': { skill_id: 'question_auxiliary', parent_skill_id: 'question_structure' },
  'tokens.same_words_different_order': { skill_id: 'word_order', parent_skill_id: null },
  'spelling.edit_distance_one': { skill_id: 'spelling', parent_skill_id: null },
  'punctuation.apostrophe_missing_contraction': { skill_id: 'apostrophe_usage', parent_skill_id: 'punctuation' },
  'choice.exact_match': { skill_id: 'incorrect_choice', parent_skill_id: null },
}

function skill(skill_id, parent_skill_id, category, label_pt, label_en, description_pt, default_severity, recommended_level = 'B1') {
  return { skill_id, parent_skill_id, category, label_pt, label_en, description_pt, default_severity, recommended_level, custom: false }
}

export function isRegisteredSkill(skillId) {
  const id = normalizeSkillId(skillId)
  return !!id && Object.prototype.hasOwnProperty.call(SKILLS, id)
}

export function normalizeSkillId(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const snake = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return ALIASES[snake] || snake || null
}

export function getSkill(skillId) {
  const id = normalizeSkillId(skillId)
  if (!id) return null
  return SKILLS[id] || customSkill(id)
}

export function getRuleSkill(ruleId) {
  const meta = RULE_SKILLS[ruleId]
  return meta ? { ...meta, skill: getSkill(meta.skill_id) } : null
}

export function listSkills() {
  return Object.values(SKILLS)
}

function customSkill(id) {
  const label = id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return {
    skill_id: id,
    parent_skill_id: null,
    category: 'custom',
    label_pt: label,
    label_en: label,
    description_pt: `Habilidade personalizada: ${label}.`,
    default_severity: 'medium',
    custom: true,
  }
}
