const LEVELS=['A1','A2','B1','B2']
function pattern(id, required_slots, levels, transformations=[]){return {id,required_slots,levels,transformations,resolver_id:`resolver_${id}`}}
export const PATTERN_REGISTRY={
 subject_be_complement:pattern('subject_be_complement',['subject','complement'],['A1','A2','B1','B2'],['affirmative','negative']),
 subject_simple_present_object:pattern('subject_simple_present_object',['subject','verb','object'],['A1','A2','B1','B2'],['third_person_s']),
 wh_do_subject_base_verb:pattern('wh_do_subject_base_verb',['wh','auxiliary','subject','verb'],['A1','A2','B1','B2'],['question']),
 subject_past_simple_object_time:pattern('subject_past_simple_object_time',['subject','verb_past','object','time'],['A2','B1','B2']),
 subject_be_going_to_verb_time:pattern('subject_be_going_to_verb_time',['subject','be','going_to','verb','time'],['A2','B1','B2']),
 subject_have_past_participle_yet:pattern('subject_have_past_participle_yet',['subject','have','past_participle','object'],['A2','B1','B2']),
 subject_have_been_ving_object_duration:pattern('subject_have_been_ving_object_duration',['subject','have','been','verb_ing','object','duration'],['B1','B2']),
 if_present_will_future:pattern('if_present_will_future',['if_clause','will_clause'],['B1','B2']),
 subject_modal_base_verb:pattern('subject_modal_base_verb',['subject','modal','base_verb'],['A1','A2','B1','B2']),
 passive_be_past_participle:pattern('passive_be_past_participle',['subject','be','past_participle'],['B2']),
 reported_speech_statement:pattern('reported_speech_statement',['reporting_clause','that_clause'],['B2']),
 second_conditional:pattern('second_conditional',['if_past','would_clause'],['B2']),
}
export const CONSTRAINT_REGISTRY=Object.fromEntries(['subject_auxiliary_agreement','verb_requires_ving','verb_requires_base_form','verb_requires_past_participle','duration_compatible_with_present_perfect','workplace_requires_at','countable_article_required','plural_subject_requires_have','third_person_requires_has','question_requires_do','question_requires_does','level_allows_present_perfect','level_allows_present_perfect_continuous','level_allows_passive','level_allows_reported_speech','curated_sentence'].map(id=>[id,{id}]))
export const DISTRACTOR_STRATEGY_REGISTRY=Object.fromEntries(['verb_form_after_have_been','wrong_question_auxiliary','wrong_preposition','wrong_article','wrong_collocation','wrong_word_order','wrong_tense','wrong_modal_form','wrong_plural','wrong_participle'].map(id=>[id,{id}]))
export function isKnownPattern(id){return !!PATTERN_REGISTRY[id]}
export function isKnownConstraint(id){return !!CONSTRAINT_REGISTRY[id]}
export function isKnownDistractorStrategy(id){return !!DISTRACTOR_STRATEGY_REGISTRY[id]}
export function patternAllowsLevel(patternId, level){return PATTERN_REGISTRY[patternId]?.levels.includes(level)}
export { LEVELS }
