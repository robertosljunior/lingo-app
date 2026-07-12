import { EXERCISE_TYPES, parseLesson } from './lesson-parser.js'
import { validateCuratedCollocationAnswer, normalize } from './lexical-bank.js'
import { buildGeneratedLessonYaml } from './lesson-generator.js'
import { canonicalBuildSentence, canonicalText, isProhibitedCorrectAnswer, uniqueNormalized } from './generated-lesson-contracts.js'

export function validateGeneratedLesson(lesson, { expectedCount = null, roundTrip = true } = {}) {
  const errors=[], warnings=[], question_results=[]
  const qs = lesson?.questions || lesson?.q || []
  if (!lesson?.lesson_id) errors.push('LESSON_ID_REQUIRED')
  if (!['A1','A2','B1','B2','C1','C2'].includes(lesson?.level)) errors.push('LEVEL_INVALID')
  if (!Array.isArray(qs) || !qs.length) errors.push('QUESTIONS_REQUIRED')
  if (expectedCount != null && qs.length !== expectedCount) errors.push('QUESTION_COUNT_MISMATCH')
  const ids=new Set(), sigs=new Set(), fam={}
  qs.forEach((q,i)=>{
    const qe=[]; if(ids.has(String(q.id))) qe.push('DUPLICATE_ID'); ids.add(String(q.id))
    const type=q.type||q.t; if(!EXERCISE_TYPES.includes(type)) qe.push('TYPE_INVALID')
    const a=q.expected_answer||q.a; if(!a) qe.push('ANSWER_REQUIRED')
    if(!(q.skill_target||q.f||q.metadata?.primary_skill_id)) qe.push('SKILL_REQUIRED')
    const sig=q.metadata?.question_signature || normalize(`${type} ${q.prompt||q.p} ${a}`); if(sigs.has(sig)) qe.push('DUPLICATE_QUESTION'); sigs.add(sig)
    const f=q.metadata?.family_id; if(f){ fam[f]=(fam[f]||0)+1; if(fam[f]>3) qe.push('FAMILY_LIMIT_EXCEEDED') }
    if(!validateCuratedCollocationAnswer(a).valid) qe.push('INVALID_COLLOCATION_AS_ANSWER')
    if(isProhibitedCorrectAnswer(a)) qe.push('PROHIBITED_CORRECT_ANSWER')
    if((q.accepted_answers||q.alt||[]).some(x=>isProhibitedCorrectAnswer(x))) qe.push('PROHIBITED_ALT_ANSWER')
    if(!uniqueNormalized([a, ...(q.accepted_answers||q.alt||[])])) qe.push('ALT_DUPLICATES_ANSWER')
    if(lesson.generated && (!q.metadata?.template_id || !q.metadata?.family_id || !q.metadata?.generator_version || !q.metadata?.question_signature)) qe.push('GENERATION_METADATA_REQUIRED')
    if(type==='fill_blank'){ const opt=q.options||q.opt; const contract=q.payload_contract||q.payload?.contract; if(!Array.isArray(opt)||opt.length<2) qe.push('FILL_OPT_REQUIRED'); else { const n=opt.map(canonicalText); if(!n.includes(canonicalText(a))) qe.push('FILL_ANSWER_NOT_IN_OPT'); if(n.filter(x=>x===canonicalText(a)).length!==1) qe.push('FILL_ANSWER_COUNT'); if(new Set(n).size!==n.length) qe.push('FILL_DUP_OPTIONS') } if((String(q.prompt||q.p).match(/____/g)||[]).length!==1) qe.push('FILL_SINGLE_BLANK_REQUIRED'); if(!contract?.blank_skill || !contract?.expected_slot_type || !contract?.correct_option || !contract?.distractors?.length) qe.push('FILL_CONTRACT_REQUIRED'); if(contract?.blank_skill && (q.skill_target||q.f) && contract.blank_skill !== (q.skill_target||q.f)) qe.push('FILL_SKILL_MISMATCH') }
    if(type==='choose_best'){ const opt=q.options||q.opt; const contract=q.payload_contract||q.payload?.contract; if(!Array.isArray(opt)||opt.length<2) qe.push('CHOOSE_OPT_REQUIRED'); else { const n=opt.map(canonicalText); if(!n.includes(canonicalText(a))) qe.push('CHOOSE_ANSWER_NOT_IN_OPT'); if(new Set(n).size!==n.length) qe.push('CHOOSE_DUP_OPTIONS'); if(n.filter(x=>x===canonicalText(a)).length!==1) qe.push('CHOOSE_CANONICAL_COUNT'); if((q.accepted_answers||q.alt||[]).some(alt=>n.includes(canonicalText(alt)))) qe.push('CHOOSE_ALT_IN_OPTIONS') } if(!contract?.rule_id || !contract?.context_required || !contract?.distractors?.every(d=>d.text&&d.invalid_rule_id)) qe.push('CHOOSE_CONTRACT_REQUIRED') }
    if(type==='build_sentence'){ const words=q.words; if(!Array.isArray(words)||!words.length) qe.push('WORDS_REQUIRED'); else if(canonicalBuildSentence(words)!==canonicalBuildSentence(a)) qe.push('WORDS_DO_NOT_REBUILD'); else if(isProhibitedCorrectAnswer(canonicalBuildSentence(words))) qe.push('PROHIBITED_BUILD_SENTENCE') }
    if(type==='rewrite_natural'){ if(!q.original) qe.push('ORIGINAL_REQUIRED'); if(normalize(q.original)===normalize(a)) qe.push('ORIGINAL_EQUALS_ANSWER') }
    if(type==='listen_type'||type==='speak_sentence'){ if(!(q.prompt_pt||q.pt)) qe.push('PT_REQUIRED'); if(!a) qe.push('SPEECH_ANSWER_REQUIRED'); if(/[\[\]{}<>]|https?:/i.test(a)) qe.push('TTS_UNSAFE_TEXT') }
    if(qe.length) errors.push(...qe.map(e=>`Q${i+1}:${e}`)); question_results.push({id:q.id,valid:!qe.length,errors:qe})
  })
  if(roundTrip && !errors.length){ try { const parsed=parseLesson(buildGeneratedLessonYaml(lesson)); if(parsed.questions.length!==qs.length) errors.push('ROUND_TRIP_COUNT_MISMATCH') } catch(e){ errors.push(`ROUND_TRIP_FAILED:${e.message}`) } }
  return { valid: errors.length===0, errors:[...new Set(errors)], warnings, question_results }
}
