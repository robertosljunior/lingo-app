import yaml from 'js-yaml'
import { seededRandom } from './adaptive-planner.js'
import { getSkill } from './skill-registry.js'
import { getLessonTemplates, TEMPLATE_REGISTRY_VERSION, SUPPORTED_GENERATED_TYPES } from './lesson-template-registry.js'
import { BUILTIN_CONTENT_PACKS } from './content-pack-loader.js'
import { LEXICAL_BANK_VERSION, normalize } from './lexical-bank.js'
import { parseLesson } from './lesson-parser.js'
import { canonicalText, tokenizeBuildSentence, questionLanguageContract } from './generated-lesson-contracts.js'

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

// ---- exercise family balancing (Slice 7.4) ----
// Families group exercise types so balancing happens by family first, then by
// type. speak_sentence is grouped with listening per the slice spec.
export const EXERCISE_FAMILIES = {
  production: ['translate_natural', 'rewrite_natural', 'free_write', 'guided_write'],
  listening: ['listen_type', 'speak_sentence'],
  ordering: ['build_sentence', 'word_order'],
  recognition: ['choose_best', 'fill_blank'],
}
export const TYPE_TO_FAMILY = Object.fromEntries(Object.entries(EXERCISE_FAMILIES).flatMap(([fam, types]) => types.map((t) => [t, fam])))
const FAMILY_LABELS = { production: 'escrita', listening: 'escuta', ordering: 'construção de frases', recognition: 'reconhecimento' }

// Size-aware policy. `minDifferent` = minimum distinct exercise types;
// `typeCapFraction` = no single type above this share (unless templates run out).
function policyFor(questionCount) {
  if (questionCount >= 30) return { minDifferent: 6, typeCapFraction: 0.35, familyMin: { production: 1, listening: 1, ordering: 1, recognition: 1 } }
  if (questionCount >= 20) return { minDifferent: 5, typeCapFraction: 0.40, familyMin: { production: 1, listening: 1, ordering: 1, recognition: 1 } }
  return { minDifferent: 4, typeCapFraction: 0.40, familyMin: { production: 1, listening: 1, ordering: 1, recognition: 1 } }
}

// Build a family-balanced, adaptive distribution plan.
// availableTypes: types that actually have templates (falls back to all).
// priorityFamily: family to emphasise (e.g. 'production' when writing is weak).
export function planExerciseDistribution({ questionCount = 10, availableTypes = null, priorityFamily = null } = {}) {
  const known = Object.keys(TYPE_TO_FAMILY).filter((t) => TYPE_TARGET_30[t] != null)
  const avail = (availableTypes && availableTypes.length ? availableTypes : known).filter((t) => TYPE_TO_FAMILY[t])
  const availFamilies = [...new Set(avail.map((t) => TYPE_TO_FAMILY[t]))]
  const policy = policyFor(questionCount)
  const typeCap = Math.max(1, Math.floor(questionCount * policy.typeCapFraction))
  const priorityCap = Math.max(typeCap, questionCount <= 10 ? 4 : typeCap) // 10-q priority-type adaptive max = 4
  const constraints = []
  const counts = Object.fromEntries(avail.map((t) => [t, 0]))
  const familyCount = () => { const m = {}; for (const t of avail) m[TYPE_TO_FAMILY[t]] = (m[TYPE_TO_FAMILY[t]] || 0) + counts[t]; return m }
  const typesOf = (fam) => avail.filter((t) => TYPE_TO_FAMILY[t] === fam)
  // pick the least-used available type in a family, respecting caps
  const pickType = (fam, isPriority) => {
    const cap = isPriority ? priorityCap : typeCap
    const pool = typesOf(fam).filter((t) => counts[t] < cap)
    if (!pool.length) return typesOf(fam).sort((a, b) => counts[a] - counts[b])[0] || null
    return pool.sort((a, b) => counts[a] - counts[b] || TYPE_TARGET_30[b] - TYPE_TARGET_30[a])[0]
  }
  let placed = 0
  const add = (t) => { if (!t) return false; counts[t]++; placed++; return true }
  // 1) family minimums (only for families that exist)
  for (const [fam, min] of Object.entries(policy.familyMin)) {
    if (!availFamilies.includes(fam)) { constraints.push(`no_templates_for_family:${fam}`); continue }
    for (let i = 0; i < min && placed < questionCount; i++) add(pickType(fam, fam === priorityFamily))
  }
  // 2) ensure minimum distinct types
  while (Object.values(counts).filter((n) => n > 0).length < Math.min(policy.minDifferent, avail.length) && placed < questionCount) {
    const unused = avail.filter((t) => counts[t] === 0).sort((a, b) => TYPE_TARGET_30[b] - TYPE_TARGET_30[a])[0]
    if (!add(unused)) break
  }
  // 3) fill the rest toward a fair per-family share. The priority family gets a
  //    heavier weight (more slots) but never monopolises — other families keep
  //    their minimums and a proportional share.
  const hasPriority = priorityFamily && availFamilies.includes(priorityFamily)
  const weights = Object.fromEntries(availFamilies.map((f) => [f, f === priorityFamily ? 2.2 : 1]))
  const weightSum = availFamilies.reduce((s, f) => s + weights[f], 0)
  const famTarget = (f) => (weights[f] / weightSum) * questionCount
  let guard = questionCount * 8
  while (placed < questionCount && guard-- > 0) {
    const fc = familyCount()
    // families that still have a type under its cap
    const eligible = availFamilies.filter((f) => typesOf(f).some((t) => counts[t] < (f === priorityFamily ? priorityCap : typeCap)))
    if (!eligible.length) { constraints.push('template_capacity_reached'); break }
    // pick the eligible family furthest below its fair target
    const target = eligible.sort((a, b) => (famTarget(b) - (fc[b] || 0)) - (famTarget(a) - (fc[a] || 0)))[0]
    if (!add(pickType(target, target === priorityFamily))) break
  }
  void hasPriority
  // Last resort: too few families/types to honour caps — relax the cap so the
  // lesson still reaches its size, and record the constraint honestly.
  if (placed < questionCount && avail.length) {
    constraints.push('distribution_constraint:cap_relaxed_insufficient_templates')
    let g2 = questionCount * 4
    while (placed < questionCount && g2-- > 0) {
      const t = avail.slice().sort((a, b) => counts[a] - counts[b])[0]
      if (!add(t)) break
    }
  }
  if (placed < questionCount) constraints.push(`distribution_constraint:only_${placed}_of_${questionCount}`)
  // 4) interleave into a sequence that avoids clustering the same type
  const bag = Object.entries(counts).flatMap(([t, n]) => Array(n).fill(t))
  const sequence = interleave(bag)
  const actual_distribution = { ...counts }
  const target_distribution = Object.fromEntries(availFamilies.map((f) => [f, familyCount()[f] || 0]))
  const distinct = Object.values(counts).filter((n) => n > 0).length
  if (distinct < Math.min(policy.minDifferent, avail.length)) constraints.push('below_min_distinct_types')
  return { sequence, actual_distribution, target_distribution, constraints: [...new Set(constraints)], priorityFamily: priorityFamily || null, policy }
}

// Round-robin the most frequent types apart so no type clusters together.
function interleave(bag) {
  const groups = {}
  for (const t of bag) (groups[t] ||= []).push(t)
  const lists = Object.values(groups).sort((a, b) => b.length - a.length)
  const out = []
  let moved = true
  while (moved) {
    moved = false
    for (const list of lists) { if (list.length) { out.push(list.pop()); moved = true } }
  }
  return out
}

export function pedagogicalJustification({ priorityFamily, actual_distribution, constraints = [] } = {}) {
  const byFamily = {}
  for (const [t, n] of Object.entries(actual_distribution || {})) byFamily[TYPE_TO_FAMILY[t]] = (byFamily[TYPE_TO_FAMILY[t]] || 0) + n
  if (constraints.some((c) => String(c).startsWith('distribution_constraint') || c === 'template_capacity_reached')) {
    return 'Esta aula usa a melhor distribuição possível com o conteúdo disponível para este tema e nível.'
  }
  if (priorityFamily && FAMILY_LABELS[priorityFamily]) {
    return `Esta prática tem mais exercícios de ${FAMILY_LABELS[priorityFamily]} porque você teve mais dificuldade nessa habilidade recentemente.`
  }
  return 'Esta aula está equilibrada entre escrita, escuta e construção de frases.'
}

// Kept for backwards compatibility; now delegates to the family-balanced planner.
export function exerciseTypePlan(questionCount=30){
  return planExerciseDistribution({ questionCount }).sequence
}

export function generateLessonFromContext(context={}, opts={}){
  const questionCount=opts.questionCount||30, level=context.level||'B1'
  const owner=context.profile_id||opts.profileId||null
  const seed=opts.seed||`${owner||'global'}:${level}:${LESSON_GENERATOR_VERSION}:${(context.target_skills||[]).map(s=>s.skill_id).join(',')}`
  const contentSnapshot=opts.contentSnapshot || context.contentSnapshot || builtinSnapshot(context.theme || 'workplace', level)
  const rng=seededRandom(seed), templates=templatesFromSnapshot(contentSnapshot), skillPlan=allocateLessonSkills(context, questionCount)
  const availableTypes=[...new Set(templates.flatMap(t=>t.exercise_types))].filter(t=>TYPE_TO_FAMILY[t])
  const priorityFamily=context.priority_family && EXERCISE_FAMILIES[context.priority_family] ? context.priority_family : null
  const distribution=planExerciseDistribution({ questionCount, availableTypes, priorityFamily })
  const typePlan=distribution.sequence
  const plannerReason=priorityFamily==='production'?'writing_priority':priorityFamily==='listening'?'listening_priority':priorityFamily?`${priorityFamily}_priority`:'balanced'
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
  const generationKey=hash(`${owner||'global'}:${context.theme||'workplace'}:${level}:${seed}:${questionCount}:${(context.target_skills||[]).map(s=>s.skill_id).join(',')}:${LESSON_GENERATOR_VERSION}:${contentSnapshot.checksum}`).slice(0,10)
  const lesson_id=`gen_${level.toLowerCase()}_${ownerScopeHash}_${generationKey}`
  qs.forEach((q,i)=>{ q.id=i+1; q.generated_question_id=`${lesson_id}:${q.id}` })
  const lesson={ lesson_id,title:titleFor(context),level,focus:`adaptive_${context.theme||'workplace'}_english`,generated:true,owner_profile_id:owner,questions:qs,generation_metadata:{generator_version:LESSON_GENERATOR_VERSION,generation_key:generationKey,content_hash:hash(qs.map(q=>canonicalText(q.expected_answer)).join('|')),owner_scope_hash:ownerScopeHash,template_registry_version:TEMPLATE_REGISTRY_VERSION,lexical_bank_version:LEXICAL_BANK_VERSION,content_pack_ids:contentSnapshot.pack_ids,content_pack_versions:contentSnapshot.pack_versions,content_snapshot_checksum:contentSnapshot.checksum,content_schema_version:'1',theme:context.theme||'workplace',profile_id:owner,seed,generated_at:new Date(0).toISOString(),requested_questions:questionCount,actual_questions:qs.length,target_skills:(context.target_skills||[]).map(s=>s.skill_id),template_ids:templateIds,template_family_counts:familyCounts,warnings,
    planner_reason:plannerReason,target_distribution:distribution.target_distribution,actual_distribution:actualTypeCounts(qs),constraints:distribution.constraints,
    pedagogical_justification:pedagogicalJustification({priorityFamily,actual_distribution:actualTypeCounts(qs),constraints:distribution.constraints})}}
  lesson.raw_content=buildGeneratedLessonYaml(lesson)
  const parsed=parseLesson(lesson.raw_content)
  if(parsed.questions.length!==lesson.questions.length) throw new Error('Generated lesson YAML round-trip failed')
  return lesson
}

function builtinSnapshot(theme, level){
  const ids=[`core_${level.toLowerCase()}`,`${theme}_${level.toLowerCase()}`]
  const packs=BUILTIN_CONTENT_PACKS.filter(p=>ids.includes(p.manifest.pack_id))
  const template_definitions=packs.flatMap(p=>p.template_definitions)
  const lexical_items=packs.flatMap(p=>p.lexical_items)
  const collocations=packs.flatMap(p=>p.collocations)
  const pack_versions=Object.fromEntries(packs.map(p=>[p.manifest.pack_id,p.manifest.version]))
  return {pack_ids:ids,pack_versions,checksum:hash(JSON.stringify({ids,pack_versions})),template_definitions,lexical_items,collocations}
}
function templatesFromSnapshot(snapshot){
  const rows=snapshot?.template_definitions?.length ? snapshot.template_definitions : getLessonTemplates()
  return rows.map(t=>{
    const sentence=sanitizeSentence(t.sentence,t)
    const wrong=sanitizeWrong(t.wrong,sentence,t)
    const blank = (t.blank && canonicalText(sentence).includes(canonicalText(t.blank))) ? t.blank : (String(sentence||'').match(/\b\w+(?:'\w+)?\b/g)?.[1] || '')
    // Slice 7.5 bilingual contract: prefer the explicit Portuguese source of
    // truth; only fall back to guided production when a real source is absent.
    const source=t.source_text_pt||t.pt
    const ptReal=hasRealPt(source)
    return {template_id:t.template_id,family_id:t.family_id,level:t.level,primary_skill_id:t.primary_skill_id,skill_ids:t.skill_ids||[t.primary_skill_id],exercise_types:t.exercise_types||SUPPORTED_GENERATED_TYPES,domain:t.theme||t.domain,difficulty:t.difficulty||'medium',slots:t.slots||{},constraints:[...(t.constraints||[]),'curated_sentence'],sentence,pt:ptReal?source:guidedPtInstruction(t),pt_is_guided:!ptReal,accepted_variants_en:t.accepted_variants_en||[],explanation_pt:t.explanation_pt||'',ctx:objectiveContext(t.ctx,t),blank,wrong}
  }).filter(t=>t.sentence && !isBadContent(t.sentence) && !isBadContent(t.wrong))
}

function actualTypeCounts(qs){ const m={}; for(const q of qs) m[q.type]=(m[q.type]||0)+1; return m }
function titleFor(context){ const labels=(context.target_skills||[]).slice(0,2).map(s=>getSkill(s.skill_id)?.label_pt).filter(Boolean); return labels.length?`Revisão ${context.theme||'workplace'}: ${labels.join(' e ')}`:`Revisão ${context.theme||'workplace'} adaptativa` }
function buildQuestion(t,type,id){ const a=t.sentence, f=t.primary_skill_id; const base={id,type,prompt:'',prompt_pt:t.pt,context:t.ctx,expected_answer:a,accepted_answers:[],options:null,words:null,original:null,skill_target:f,lesson_focus:f,mistake_focus:f,payload:null,assessment_mode:assessmentMode(type)}
 if(type==='translate_natural') Object.assign(base,{prompt: t.pt_is_guided ? t.pt : `Traduza para o inglês:\n"${t.pt}"`, accepted_answers: [...(t.accepted_variants_en||[]), ...(a.includes("I've")?[a.replace("I've",'I have')]:[])].filter((v,i,arr)=>v&&v!==a&&arr.indexOf(v)===i)})
 if(type==='fill_blank') { const opts=distractors(t.primary_skill_id,t.blank,t.wrong); Object.assign(base,{prompt:`Complete a frase com a opção correta: ${blankOnce(a,t.blank)}`, expected_answer:t.blank, options:opts, payload_contract:{blank_skill:t.primary_skill_id,expected_slot_type:t.blank?.endsWith('ing')?'VBG':'LEXICAL',correct_option:t.blank,distractors:opts.filter(o=>canonicalText(o)!==canonicalText(t.blank)).map(text=>({text,error:'INVALID_SLOT_FORM'}))}}) }
 if(type==='build_sentence') Object.assign(base,{prompt:'Monte a frase em inglês na ordem correta.', words:tokenize(a)})
 if(type==='choose_best') { let ds=uniqueOptions([t.wrong,secondWrong(t),genericWrong(t),'Please '+a.replace(/^\w+\s*/,'').replace(/\?$/, '.')]).map(cleanOption).filter(x=>x&&!isBadContent(x)&&canonicalText(x)!==canonicalText(a)).slice(0,2); if(ds.length<2) ds=uniqueOptions([...ds,a.replace(/\.$/,'?'),'Do '+a.charAt(0).toLowerCase()+a.slice(1)]).filter(x=>canonicalText(x)!==canonicalText(a)).slice(0,2); Object.assign(base,{prompt:'Escolha a única frase correta.', options:shuffleFixed([a,...ds],t.template_id), correct_option_id:'correct', options_meta:[{id:'correct',text:a,role:'correct',invalid_rule_id:null},...ds.map((text,i)=>({id:`d${i+1}`,text,role:'distractor',invalid_rule_id:`${t.family_id}.distractor_${i+1}`}))], payload_contract:{correct:a,correct_option_id:'correct',instruction:'Escolha a única frase correta.',rule_id:`${t.family_id}.correct`,distractors:ds.map((text,i)=>({text,invalid_rule_id:`${t.family_id}.distractor_${i+1}`})),context_required:!!t.ctx}}) }
 if(type==='rewrite_natural') Object.assign(base,{prompt:'Reescreva a frase corrigindo a ordem das palavras.', original:t.wrong})
 if(type==='listen_type') Object.assign(base,{prompt:'Ouça a frase e digite exatamente o que ouvir.'})
 if(type==='speak_sentence') Object.assign(base,{prompt:'Escreva uma frase sobre algo que você fará amanhã usando “will”.', expected_answer:"I'll visit my parents tomorrow.", prompt_pt:'Produção livre guiada: plano para amanhã com will.'})
 base.language_contract=questionLanguageContract(base); base.payload=compact(base,t); return base }
function compact(q,t){ const o={id:q.id,t:q.type}; if(q.prompt_pt)o.pt=q.prompt_pt; if(q.context)o.ctx=q.context; if(q.prompt)o.p=q.prompt; if(q.original)o.original=q.original; if(q.options)o.opt=q.options; if(q.words)o.words=q.words; if(q.payload_contract)o.contract=q.payload_contract; o.a=q.expected_answer; if(q.accepted_answers?.length)o.alt=q.accepted_answers; o.f=q.skill_target; o.assessment_mode=q.assessment_mode; o.template_id=t.template_id; o.family_id=t.family_id; o.skill_ids=t.skill_ids; return o }
function distractors(skill,correct,wrong){ let opts=[correct]; if(correct.endsWith('ing')) opts.push(correct.replace(/ing$/,'ed'),correct.replace(/ing$/,'')); else if(skill.includes('preposition')||['at','on','for'].includes(correct)) opts.push(correct==='at'?'in':'at',correct==='on'?'in':'of'); else if(correct==="I've") opts.push('Ive','I have been'); else opts.push(wrong?.split(' ')[0]||'do','make') ; const seen=new Set(); return opts.filter(o=>{const n=canonicalText(o); if(!n||seen.has(n)) return false; seen.add(n); return true}).slice(0,3) }
function secondWrong(t){ if(t.primary_skill_id==='question_auxiliary') return 'They do have any open positions?'; if(t.primary_skill_id==='question_structure') return t.sentence.replace(/^(Have|Do|Could|How long have) /,''); if(t.primary_skill_id==='workplace_preposition') return t.wrong.includes(' in ')?t.wrong.replace(' in ',' at '):t.wrong.replace(' of ',' for '); if(t.primary_skill_id==='gerund_after_been'||t.primary_skill_id==='present_perfect_continuous') return t.sentence.replace(/been ([a-z]+ing)/,'been '+(t.blank||'work')); return t.wrong.replace('.', '?') }
function genericWrong(t){ return t.sentence.replace(/\?$/, '').replace(/\.$/, '') + (t.sentence.includes('?') ? '.' : '?') }
function uniqueOptions(xs){ const seen=new Set(); return xs.filter(x=>{const n=normalize(x); if(!n||seen.has(n)) return false; seen.add(n); return true}) }
function tokenize(s){ return tokenizeBuildSentence(s) }
function questionSignature(q,t){ return hash(`${q.type}|${t.family_id}|${normalize(q.prompt)}|${normalize(q.expected_answer)}`) }
function hash(s){ let h=2166136261; for(const ch of String(s)){h^=ch.charCodeAt(0); h=Math.imul(h,16777619)} return (h>>>0).toString(16).padStart(8,'0') }
function shuffleStable(arr,rng){ return arr.map(x=>[rng(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]) }
function shuffleFixed(arr,seed){ const r=seededRandom(seed); return shuffleStable(arr,r) }
function yamlQuestion(q){ const o={id:q.id,t:q.type}; if(q.prompt_pt)o.pt=q.prompt_pt; if(q.context)o.ctx=q.context; if(q.prompt)o.p=q.prompt; if(q.original)o.original=q.original; if(q.options)o.opt=q.options; if(q.words)o.words=q.words; if(q.payload_contract)o.contract=q.payload_contract; o.a=q.expected_answer; if(q.accepted_answers?.length)o.alt=q.accepted_answers; o.f=q.skill_target; o.assessment_mode=q.assessment_mode; return o }
export function buildGeneratedLessonYaml(lesson){ return yaml.dump({lesson_id:lesson.lesson_id,title:lesson.title,level:lesson.level,focus:lesson.focus,q:lesson.questions.map(yamlQuestion)}, {schema:yaml.JSON_SCHEMA,lineWidth:120,noRefs:true,sortKeys:false}) }

function assessmentMode(type){ return type==='speak_sentence' ? 'guided' : (type==='translate_natural'||type==='rewrite_natural' ? 'equivalent' : 'exact') }
function isBadContent(s){ return /incorrect:|correct:|contexto base|the (i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|our|their|tomorrow|today|this|yesterday)\b|tomorrow today|yesterday tomorrow|are \w+ have|have works|have been worked/i.test(String(s||'')) }
function cleanOption(s){ return String(s||'').replace(/^\s*(Incorrect|Correct):\s*/i,'').trim() }
function sanitizeSentence(s,t){ let x=cleanOption(s); if(!isBadContent(x)) return x; const w=String(t.slots?.object||t.template_id||'task').split('_').pop().replace(/\d+/g,'')||'task'; return ({
  question_structure:`Do they check the ${w} every day?`,
  there_is_are:`There is a ${w} near the office.`,
  can_request:`Can I update this today?`,
  simple_present:`We check this every day.`,
  present_perfect_continuous:`I've been working here for three years.`,
  gerund_after_been:`I've been working here for three years.`,
  question_auxiliary:`Do they have any open positions?`,
}[t.primary_skill_id] || `We use the ${w} every day.`) }
function sanitizeWrong(wrong,sentence,t){ let x=cleanOption(wrong); if(x && !isBadContent(x) && normalize(x)!==normalize(sentence)) return x; if(t.primary_skill_id==='question_auxiliary') return 'They have any open positions?'; if(t.primary_skill_id==='gerund_after_been'||t.primary_skill_id==='present_perfect_continuous') return "I've been work here for three years."; if(sentence.endsWith('?')) return sentence.replace(/^Can I /,'I can ').replace(/^Do they /,'They ').replace(/\?$/, '.'); return `Please ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}` }
function objectiveContext(ctx,t){ if(ctx && !/Contexto Base/i.test(ctx)) return ctx; return `Situação: você está praticando ${getSkill(t.primary_skill_id)?.label_pt || 'inglês'} em ${t.domain || 'uma conversa cotidiana'}.` }
// A real Portuguese source is one the packs actually authored — not a
// placeholder ("Frase sobre X", "Contexto Base") and not an English echo.
function hasRealPt(pt){ const s=String(pt||''); return !!s && !/Contexto Base/i.test(s) && !/^Frase sobre/i.test(s) && !/^Diga em inglês/i.test(s) }
// When there is no authored Portuguese translation, present a Portuguese guided
// production instruction that never reveals the English answer. Graded in the
// lenient 'equivalent' mode, so a natural sentence still earns credit.
function guidedPtInstruction(t){ const label=getSkill(t.primary_skill_id)?.label_pt || 'inglês do dia a dia'; return `Escreva em inglês, de forma natural, uma frase praticando ${label}.` }
function blankOnce(sentence,blank){ const tokens=String(sentence).split(/\b/); let done=false; return tokens.map(tok=>{ if(!done && canonicalText(tok)===canonicalText(blank)){ done=true; return '____' } return tok }).join('') }
