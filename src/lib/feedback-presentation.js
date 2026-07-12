import { explainFeedback } from './feedback-explanation-registry.js'
import { getSkill, getRuleSkill } from './skill-registry.js'

const VERSION = '1'
const structural = new Set(['vocabulary', 'spelling', 'punctuation', 'capitalization'])

function errorsOf(evaluation) { return evaluation?.detected_errors?.length ? evaluation.detected_errors : (evaluation?.primary_error ? [evaluation.primary_error] : []) }
function pickPrimary(errors) { return errors.find(e => e.role === 'primary') || errors.find(e => e.category === 'word_order') || errors[0] || null }
function skillLabel(error, skillTarget) { const s = getRuleSkill(error?.rule_id)?.skill || getSkill(error?.skill_id || skillTarget || error?.subtype || error?.category); return s?.label_pt || null }
function isDerivedFromWordOrder(e) { return e?.category === 'word_order' || e?.subtype === 'word_order' || e?.rule_id === 'tokens.same_words_different_order' }
function groupSecondary(errors, primary) {
  if (!primary) return []
  return errors.filter(e => e !== primary).filter(e => !(isDerivedFromWordOrder(primary) && structural.has(e.category))).slice(0, 2)
}
export function buildFeedbackPresentation({ evaluation, question, userAnswer, expectedAnswer, selectedOption, skillTarget, locale = 'pt-BR' } = {}) {
  const verdict = evaluation?.verdict || 'incorrect'
  const errors = errorsOf(evaluation)
  const primary = pickPrimary(errors)
  const expected = expectedAnswer || evaluation?.target || question?.expected_answer || ''
  const user = userAnswer || evaluation?.user_answer || evaluation?.normalized_user_answer || selectedOption || ''
  const primaryExpl = verdict === 'correct'
    ? { title: 'Muito bem', summary_pt: 'Sua resposta corresponde à forma esperada.', explanation_pt: 'Continue praticando para ganhar fluência.', learner_tip_pt: 'Ouça a frase correta e repita em voz alta.', source: 'correct' }
    : explainFeedback({ error: primary, question, selectedOption, expectedAnswer: expected, skillTarget })
  return {
    presentation_version: VERSION, locale,
    tone: verdict === 'correct' ? 'correct' : verdict === 'partial' ? 'almost' : 'incorrect',
    title: primaryExpl.title,
    summary_pt: primaryExpl.summary_pt,
    explanation_pt: primaryExpl.explanation_pt,
    learner_tip_pt: primaryExpl.learner_tip_pt,
    explanation_source: primaryExpl.source,
    feedback_source: { rule_id: primary?.rule_id || null, subtype: primary?.subtype || null, category: primary?.category || null, skill_id: skillTarget || getRuleSkill(primary?.rule_id)?.skill_id || null, selected_distractor_invalid_rule_id: question?.metadata?.distractors?.[selectedOption]?.invalid_rule_id || null },
    comparison: { user_label: 'Sua resposta', user_text: user, expected_label: 'Forma correta', expected_text: expected },
    primary_skill_label: skillLabel(primary, skillTarget),
    secondary_suggestions: groupSecondary(errors, primary).map(e => ({ title: 'Também vale observar', ...explainFeedback({ error: e, question, selectedOption, expectedAnswer: expected, skillTarget }) })),
    speech_segments: [
      { role:'explanation_pt', language:'pt-BR', text:[primaryExpl.title, primaryExpl.explanation_pt, primaryExpl.learner_tip_pt].filter(Boolean).join('. ') },
      { role:'correct_answer_en', language:'en', text:expected },
    ],
  }
}
