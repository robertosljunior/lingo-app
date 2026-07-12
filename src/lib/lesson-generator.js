import yaml from 'js-yaml'
import { seededRandom } from './adaptive-planner.js'
import { getSkill } from './skill-registry.js'
import { getLessonTemplates, TEMPLATE_REGISTRY_VERSION, SUPPORTED_GENERATED_TYPES } from './lesson-template-registry.js'
import { LEXICAL_BANK_VERSION, normalize } from './lexical-bank.js'
import { parseLesson } from './lesson-parser.js'
import { canonicalText, tokenizeBuildSentence } from './generated-lesson-contracts.js'

export const LESSON_GENERATOR_VERSION = '1'
const TYPE_TARGET_30={translate_natural:6,fill_blank:5,build_sentence:5,choose_best:4,rewrite_natural:4,listen_type:3,speak_sentence:3}
const MAINT=['present_perfect','verb_tense','word_order','vocabulary','apostrophe_usage']

export function allocateLessonSkills(context={}, questionCount=30){
  const targets=(context.target_skills||[]).filter(s=>s.skill_id&&s.skill_id!=='missing_auxiliary')
  const rein=(context.reinforcement_skills||[]).filter(s=>s.skill_id&&s.skill_id!=='missing_auxiliary')
  const desired=[]
  const targetN=Math.max(Math.ceil(questionCount*.5),Math.round(questionCount*.55))
  const reinN=Math.round(questionCount*.25)
  const max=Math.max(1,Math.floor(questionCount*.4))
  function pushMany(id,n,group){ for(let i=0;i<n;i++) desired.push({skill_id:id,group}) }
  const targetIds=targets.length?targets.map(s=>s.skill_id):['gerund_after_been','question_structure']
  targetIds.forEach((id,i)=>pushMany(id, Math.min(max, Math.floor(targetN/targetIds.length)+(i<targetN%targetIds.length?1:0)), 'target'))
  const reinIds=rein.length?rein.map(s=>s.skill_id):['workplace_preposition','collocation']
  reinIds.forEach((id,i)=>pushMany(id, Math.min(max, Math.floor(reinN/reinIds.length)+(i<reinN%reinIds.length?1:0)), 'reinforcement'))
  MAINT.forEach(id=>pushMany(id,1,'maintenance'))
  let i=0
  while(desired.length<questionCount && i<questionCount*4){
    const id=[...targetIds,...reinIds,...MAINT][i % (targetIds.length+reinIds.length+MAINT.length)]
    if(desired.filter(x=>x.skill_id===id).length<max) desired.push({skill_id:id,group:targetIds.includes(id)?'target':'review'})
    i++
  }
  return desired.slice(0,questionCount)
}

export function exerciseTypePlan(questionCount=30){
  if(questionCount===30) return Object.entries(TYPE_TARGET_30).flatMap(([t,n])=>Array(n).fill(t))
  const total=30; const counts={}; let used=0
  for(const [t,n] of Object.entries(TYPE_TARGET_30)){ counts[t]=Math.max(1,Math.floor(questionCount*n/total)); used+=counts[t] }
  const order=Object.keys(TYPE_TARGET_30); let i=0; while(used<questionCount){counts[order[i++%order.length]]++; used++} while(used>questionCount){ const t=order.slice().reverse().find(x=>counts[x]>1); counts[t]--; used-- }
  return order.flatMap(t=>Array(counts[t]).fill(t))
}

export function generateLessonFromContext(context={}, opts={}){
  const questionCount=opts.questionCount||30, level=context.level||'B1'
  const owner=context.profile_id||opts.profileId||null
  const seed=opts.seed||`${owner||'global'}:${level}:${LESSON_GENERATOR_VERSION}:${(context.target_skills||[]).map(s=>s.skill_id).join(',')}`
  const rng=seededRandom(seed), templates=getLessonTemplates(), skillPlan=allocateLessonSkills(context, questionCount), typePlan=exerciseTypePlan(questionCount)
  const recent=new Set((context.recent_sentences||[]).map(normalize)), warnings=[], qs=[], signatures=new Set(), familyCounts={}, templateIds=[]
  for(let i=0;i<questionCount;i++){
    const type=typePlan[i], skill=skillPlan[i]?.skill_id; let made=null
    const pool=shuffleStable(templates.filter(t=>t.exercise_types.includes(type) && (t.skill_ids.includes(skill)||t.primary_skill_id===skill)),rng)
      .concat(shuffleStable(templates.filter(t=>t.exercise_types.includes(type)),rng))
    for(const t of pool){
      if((familyCounts[t.family_id]||0)>=3) continue
      const q=buildQuestion(t,type,qs.length+1,seed)
      const sig=questionSignature(q,t)
      const content=normalize(q.expected_answer)
      if(signatures.has(sig)||recent.has(content)) { warnings.push({code:'DUPLICATE_CONTENT_REJECTED',template_id:t.template_id}); continue }
      q.metadata={ template_id:t.template_id,family_id:t.family_id,generator_version:LESSON_GENERATOR_VERSION,primary_skill_id:t.primary_skill_id,skill_ids:t.skill_ids,question_signature:sig,content_signature:content,resolved_slot_ids:Object.keys(t.slots||{}) }
      made=q; signatures.add(sig); familyCounts[t.family_id]=(familyCounts[t.family_id]||0)+1; templateIds.push(t.template_id); break
    }
    if(made) qs.push(made); else warnings.push({code:'INSUFFICIENT_TEMPLATES_FOR_SKILL',skill_id:skill,type})
  }
  const ownerScopeHash=hash(owner||'global').slice(0,8)
  const generationKey=hash(`${seed}:${questionCount}:${(context.target_skills||[]).map(s=>s.skill_id).join(',')}:${LESSON_GENERATOR_VERSION}:${TEMPLATE_REGISTRY_VERSION}`).slice(0,10)
  const lesson_id=`gen_${level.toLowerCase()}_${ownerScopeHash}_${generationKey}`
  qs.forEach((q,i)=>{ q.id=i+1; q.generated_question_id=`${lesson_id}:${q.id}` })
  const lesson={ lesson_id,title:titleFor(context),level,focus:'adaptive_workplace_english',generated:true,owner_profile_id:owner,questions:qs,generation_metadata:{generator_version:LESSON_GENERATOR_VERSION,generation_key:generationKey,content_hash:hash(qs.map(q=>canonicalText(q.expected_answer)).join('|')),owner_scope_hash:ownerScopeHash,template_registry_version:TEMPLATE_REGISTRY_VERSION,lexical_bank_version:LEXICAL_BANK_VERSION,profile_id:owner,seed,generated_at:new Date(0).toISOString(),requested_questions:questionCount,actual_questions:qs.length,target_skills:(context.target_skills||[]).map(s=>s.skill_id),template_ids:templateIds,template_family_counts:familyCounts,warnings}}
  lesson.raw_content=buildGeneratedLessonYaml(lesson)
  const parsed=parseLesson(lesson.raw_content)
  if(parsed.questions.length!==lesson.questions.length) throw new Error('Generated lesson YAML round-trip failed')
  return lesson
}
function titleFor(context){ const labels=(context.target_skills||[]).slice(0,2).map(s=>getSkill(s.skill_id)?.label_pt).filter(Boolean); return labels.length?`Revisão profissional: ${labels.join(' e ')}`:'Revisão profissional adaptativa' }
function buildQuestion(t,type,id){ const a=t.sentence, f=t.primary_skill_id; const base={id,type,prompt:'',prompt_pt:t.pt,context:t.ctx,expected_answer:a,accepted_answers:[],options:null,words:null,original:null,skill_target:f,lesson_focus:f,mistake_focus:f,payload:null}
 if(type==='translate_natural') Object.assign(base,{prompt:'Traduza naturalmente.', accepted_answers: a.includes("I've")?[a.replace("I've",'I have')]:[]})
 if(type==='fill_blank') { const opts=distractors(t.primary_skill_id,t.blank,t.wrong); Object.assign(base,{prompt:a.replace(t.blank,'____'), expected_answer:t.blank, options:opts, payload_contract:{blank_skill:t.primary_skill_id,expected_slot_type:t.blank?.endsWith('ing')?'VBG':'LEXICAL',correct_option:t.blank,distractors:opts.filter(o=>canonicalText(o)!==canonicalText(t.blank)).map(text=>({text,error:'INVALID_SLOT_FORM'}))}}) }
 if(type==='build_sentence') Object.assign(base,{prompt:'Monte a frase em inglês.', words:tokenize(a)})
 if(type==='choose_best') { const ds=uniqueOptions([t.wrong,secondWrong(t),genericWrong(t)]).filter(x=>canonicalText(x)!==canonicalText(a)).slice(0,2); Object.assign(base,{prompt:t.ctx || 'Escolha a frase mais natural.', options:shuffleFixed([a,...ds],t.template_id), payload_contract:{correct:a,rule_id:`${t.family_id}.correct`,distractors:ds.map((text,i)=>({text,invalid_rule_id:`${t.family_id}.distractor_${i+1}`})),context_required:!!t.ctx}}) }
 if(type==='rewrite_natural') Object.assign(base,{prompt:'Reescreva a frase de forma natural e correta.', original:t.wrong})
 if(type==='listen_type') Object.assign(base,{prompt:'Ouça a frase e digite exatamente o que ouvir.'})
 if(type==='speak_sentence') Object.assign(base,{prompt:'Fale a frase em inglês.'})
 base.payload=compact(base,t); return base }
function compact(q,t){ const o={id:q.id,t:q.type}; if(q.prompt_pt)o.pt=q.prompt_pt; if(q.context)o.ctx=q.context; if(q.prompt)o.p=q.prompt; if(q.original)o.original=q.original; if(q.options)o.opt=q.options; if(q.words)o.words=q.words; if(q.payload_contract)o.contract=q.payload_contract; o.a=q.expected_answer; if(q.accepted_answers?.length)o.alt=q.accepted_answers; o.f=q.skill_target; o.template_id=t.template_id; o.family_id=t.family_id; o.skill_ids=t.skill_ids; return o }
function distractors(skill,correct,wrong){ let opts=[correct]; if(skill==='gerund_after_been'||correct.endsWith('ing')) opts.push(correct.replace(/ing$/,'ed'),correct.replace(/ing$/,'')); else if(skill.includes('preposition')||['at','on','for'].includes(correct)) opts.push(correct==='at'?'in':'at',correct==='on'?'in':'of'); else if(correct==="I've") opts.push('Ive','I have been'); else opts.push(wrong?.split(' ')[0]||'do','make') ; return [...new Set(opts)].slice(0,3) }
function secondWrong(t){ if(t.primary_skill_id==='question_auxiliary') return 'They do have any open positions?'; if(t.primary_skill_id==='question_structure') return t.sentence.replace(/^(Have|Do|Could|How long have) /,''); if(t.primary_skill_id==='workplace_preposition') return t.wrong.includes(' in ')?t.wrong.replace(' in ',' at '):t.wrong.replace(' of ',' for '); if(t.primary_skill_id==='gerund_after_been'||t.primary_skill_id==='present_perfect_continuous') return t.sentence.replace(/been ([a-z]+ing)/,'been '+(t.blank||'work')); return t.wrong.replace('.', '?') }
function genericWrong(t){ return t.sentence.replace(/\?$/, '').replace(/\.$/, '') + ' please?' }
function uniqueOptions(xs){ const seen=new Set(); return xs.filter(x=>{const n=normalize(x); if(!n||seen.has(n)) return false; seen.add(n); return true}) }
function tokenize(s){ return tokenizeBuildSentence(s) }
function questionSignature(q,t){ return hash(`${q.type}|${t.family_id}|${normalize(q.prompt)}|${normalize(q.expected_answer)}`) }
function hash(s){ let h=2166136261; for(const ch of String(s)){h^=ch.charCodeAt(0); h=Math.imul(h,16777619)} return (h>>>0).toString(16).padStart(8,'0') }
function shuffleStable(arr,rng){ return arr.map(x=>[rng(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]) }
function shuffleFixed(arr,seed){ const r=seededRandom(seed); return shuffleStable(arr,r) }
function yamlQuestion(q){ const o={id:q.id,t:q.type}; if(q.prompt_pt)o.pt=q.prompt_pt; if(q.context)o.ctx=q.context; if(q.prompt)o.p=q.prompt; if(q.original)o.original=q.original; if(q.options)o.opt=q.options; if(q.words)o.words=q.words; if(q.payload_contract)o.contract=q.payload_contract; o.a=q.expected_answer; if(q.accepted_answers?.length)o.alt=q.accepted_answers; o.f=q.skill_target; return o }
export function buildGeneratedLessonYaml(lesson){ return yaml.dump({lesson_id:lesson.lesson_id,title:lesson.title,level:lesson.level,focus:lesson.focus,q:lesson.questions.map(yamlQuestion)}, {schema:yaml.JSON_SCHEMA,lineWidth:120,noRefs:true,sortKeys:false}) }
