import fs from 'node:fs/promises'
import path from 'node:path'
import { framesFor, isCompatible, structuralSignature, NOUN_CLASSES } from './semantic-frames.mjs'

// Portuguese explanation per grammar focus (frame-based content).
function explainFrame(grammar){ return ({
  wh_question_be:'Pergunta com Where + verbo to be.',
  want_to_infinitive:'Estrutura want + to + verbo (querer fazer algo).',
  wh_question_do:'Pergunta no presente com o auxiliar do/does.',
  modal_request:'Pedido educado com can/could.',
  be_complement:'Verbo to be para descrever algo.',
  have_possession:'Verbo have para posse.',
  present_continuous:'Presente contínuo (am/is/are + -ing).',
  imperative_request:'Pedido no imperativo com please.',
}[grammar] || 'Estrutura comunicativa.') }

// Build-time gate: verb–argument compatibility + T20 diversity minimums. Throws
// so an artificial regression can never be compiled into a pack.
function validateFrames(frames, theme, level){
  const errs=[]
  for(const f of frames){ const c=isCompatible(f.verb, f.noun); if(!c.ok) errs.push(`${f.frame_id}: ${c.reason}`) }
  const sigs=new Set(frames.map(f=>structuralSignature(f.en)))
  const verbs=new Set(frames.map(f=>f.verb).filter(v=>v!=='be'))
  const intents=new Set(frames.map(f=>f.intent))
  if(frames.length<8) errs.push(`only ${frames.length} pairs (<8)`)
  if(sigs.size<6) errs.push(`only ${sigs.size} structures (<6)`)
  if(verbs.size<5) errs.push(`only ${verbs.size} lexical verbs (<5)`)
  if(intents.size<4) errs.push(`only ${intents.size} intents (<4)`)
  // no near-duplicate: same signature AND same verb (noun-swap)
  const seen=new Map()
  for(const f of frames){ const k=structuralSignature(f.en)+'|'+f.verb; if(seen.has(k)) errs.push(`noun-swap: ${f.frame_id} ~ ${seen.get(k)}`); else seen.set(k,f.frame_id) }
  if(errs.length) throw new Error(`FRAME VALIDATION FAILED for ${theme} ${level}:\n  `+errs.join('\n  '))
}

function frameTemplates(frames, pack_id, key, level){
  validateFrames(frames, theme_of(key), level)
  return frames.map((f,i)=>{
    const en=f.en, blank=pickBlank(en,f)
    return {template_id:`${pack_id}_${f.frame_id}`,family_id:`${pack_id}_${f.intent}`,pack_id,theme:key,level,pattern_id:f.pattern_id,primary_skill_id:f.skill,skill_ids:[f.skill,'vocabulary'],exercise_types:['translate_natural','fill_blank','build_sentence','choose_best','rewrite_natural','listen_type','speak_sentence'],slots:{},constraints:['curated_sentence'],distractor_strategies:['wrong_word_order','wrong_tense','wrong_collocation'],sentence:en,
      source_locale:'pt-BR',source_text_pt:f.pt,target_locale:'en',expected_answers_en:[en],accepted_variants_en:f.alt||[],explanation_pt:explainFrame(f.grammar),skill_targets:[f.skill],
      communicative_intent:f.intent,grammar_focus:f.grammar,pattern_signature:structuralSignature(en),lexical_verbs:[f.verb].filter(v=>v!=='be'),
      pt:f.pt,ctx:`Situação: ${f.intent.replace(/_/g,' ')}.`,blank,wrong:f.wrong}
  })
}
function theme_of(key){ return key }
function pickBlank(en,f){ const noun=NOUN_CLASSES[f.noun]; const head=(noun?.en||'').split(' ').pop(); const words=en.replace(/[?.!,]/g,'').split(' '); return words.includes(head)?head:(words[1]||'the') }
const levels=['A1','A2','B1','B2']
const themes=[['daily_life','daily-life','Vida cotidiana','Daily life'],['workplace','workplace','Trabalho','Workplace'],['travel','travel','Viagens','Travel'],['food_and_restaurants','food-and-restaurants','Comida e restaurantes','Food and restaurants'],['shopping_and_services','shopping-and-services','Compras e serviços','Shopping and services'],['technology_and_communication','technology-and-communication','Tecnologia e comunicação','Technology and communication']]
const levelPatterns={A1:['subject_be_complement','subject_simple_present_object','wh_do_subject_base_verb','subject_modal_base_verb'],A2:['subject_past_simple_object_time','subject_be_going_to_verb_time','subject_simple_present_object','wh_do_subject_base_verb'],B1:['subject_have_past_participle_yet','subject_have_been_ving_object_duration','if_present_will_future','subject_modal_base_verb'],B2:['passive_be_past_participle','reported_speech_statement','second_conditional','subject_modal_base_verb']}
const skills={A1:['verb_to_be','simple_present','there_is_are','can_ability','can_request','question_structure','vocabulary'],A2:['past_simple','present_continuous','future_going_to','comparatives','present_perfect','question_auxiliary','vocabulary'],B1:['present_perfect','present_perfect_continuous','gerund_after_been','first_conditional','question_auxiliary','collocation','preposition'],B2:['passive_voice','reported_speech','second_conditional','modal_deduction','collocation','word_order','vocabulary']}

// English noun phrase -> Brazilian Portuguese noun with grammatical gender/number.
// Only the first 8 of each list are used to build templates; the rest feed the
// lexical bank. Every noun that a template can use carries a real translation.
const nounsPt={
  daily_life:[['morning routine','rotina matinal','f'],['family dinner','jantar em família','m'],['bus stop','ponto de ônibus','m'],['homework','lição de casa','f'],['neighbor','vizinho','m'],['weekend plan','plano de fim de semana','m'],['appointment','compromisso','m'],['coffee break','pausa para o café','f'],['grocery list','lista de compras','f'],['phone call','ligação','f'],['clean kitchen','cozinha limpa','f'],['quiet street','rua tranquila','f'],['birthday party','festa de aniversário','f'],['daily schedule','agenda diária','f']],
  workplace:[['company','empresa','f'],['project','projeto','m'],['client','cliente','m'],['support team','equipe de suporte','f'],['deployment','implantação','f'],['report','relatório','m'],['requirements','requisitos','m','pl'],['open positions','vagas abertas','f','pl'],['salary range','faixa salarial','f'],['deadline','prazo','m'],['meeting','reunião','f'],['feedback','retorno','m'],['responsibilities','responsabilidades','f','pl'],['proposal','proposta','f']],
  travel:[['ticket','passagem','f'],['hotel','hotel','m'],['passport','passaporte','m'],['train station','estação de trem','f'],['boarding gate','portão de embarque','m'],['luggage','bagagem','f'],['reservation','reserva','f'],['city map','mapa da cidade','m'],['tour guide','guia turístico','m'],['beach trip','viagem à praia','f'],['flight delay','atraso do voo','m'],['taxi ride','corrida de táxi','f'],['museum pass','ingresso do museu','m'],['travel insurance','seguro viagem','m']],
  food_and_restaurants:[['menu','cardápio','m'],['table','mesa','f'],['starter','entrada','f'],['main course','prato principal','m'],['dessert','sobremesa','f'],['bill','conta','f'],['waiter','garçom','m'],['reservation','reserva','f'],['vegetarian dish','prato vegetariano','m'],['coffee','café','m'],['fresh salad','salada fresca','f'],['spicy soup','sopa apimentada','f'],['breakfast','café da manhã','m'],['restaurant review','avaliação do restaurante','f']],
  shopping_and_services:[['receipt','recibo','m'],['discount','desconto','m'],['cashier','caixa','m'],['return policy','política de troca','f'],['shoe size','número do sapato','m'],['delivery','entrega','f'],['pharmacy','farmácia','f'],['bank account','conta bancária','f'],['haircut','corte de cabelo','m'],['repair shop','oficina de reparos','f'],['customer service','atendimento ao cliente','m'],['appointment','agendamento','m'],['online order','pedido online','m'],['queue','fila','f']],
  technology_and_communication:[['password','senha','f'],['message','mensagem','f'],['video call','chamada de vídeo','f'],['laptop','notebook','m'],['app update','atualização do aplicativo','f'],['wifi network','rede wi-fi','f'],['email','e-mail','m'],['cloud file','arquivo na nuvem','m'],['screen','tela','f'],['notification','notificação','f'],['charger','carregador','m'],['online meeting','reunião online','f'],['privacy setting','configuração de privacidade','f'],['support chat','chat de suporte','m']],
  // Core scaffolding uses real, theme-neutral common nouns (never pronouns), so
  // the grammar patterns produce natural sentences in both languages.
  core:[['plan','plano','m'],['answer','resposta','f'],['question','pergunta','f'],['idea','ideia','f'],['problem','problema','m'],['word','palavra','f'],['name','nome','m'],['number','número','m'],['place','lugar','m'],['time','horário','m'],['reason','motivo','m'],['example','exemplo','m'],['list','lista','f'],['note','anotação','f'],['rule','regra','f'],['change','mudança','f'],['part','parte','f'],['group','grupo','m'],['point','ponto','m'],['story','história','f']],
}
const nouns=Object.fromEntries(Object.entries(nounsPt).map(([k,v])=>[k,v.map(x=>x[0])]))
function ptOf(theme,word){ const row=(nounsPt[theme]||[]).find(x=>x[0]===word); return row?{pt:row[1],g:row[2],pl:row[3]==='pl'}:{pt:word,g:'m',pl:false} }

function id(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1) }
// definite article, "de+article" contraction, and adjective/participle agreement
function art(n){ return n.pl?(n.g==='f'?'as':'os'):(n.g==='f'?'a':'o') }
function del(n){ return n.pl?(n.g==='f'?'das':'dos'):(n.g==='f'?'da':'do') }
function agree(base,n){ return base+(n.g==='f'?'a':'o')+(n.pl?'s':'') }
const ser=(n)=>n.pl?'são':'é', foi=(n)=>n.pl?'foram':'foi', estava=(n)=>n.pl?'estavam':'estava'

function sentence(pattern, word){ return ({subject_be_complement:`The ${word} is important.`,subject_simple_present_object:`We check the ${word} every day.`,wh_do_subject_base_verb:`When do you need the ${word}?`,subject_modal_base_verb:`I can update the ${word} today.`,subject_past_simple_object_time:`We checked the ${word} yesterday.`,subject_be_going_to_verb_time:`They are going to review the ${word} tomorrow.`,subject_have_past_participle_yet:`We have checked the ${word} already.`,subject_have_been_ving_object_duration:`They have been reviewing the ${word} for two hours.`,if_present_will_future:`If we confirm the ${word}, we will start tomorrow.`,passive_be_past_participle:`The ${word} was reviewed by the team.`,reported_speech_statement:`She said that the ${word} was ready.`,second_conditional:`If I had more time, I would improve the ${word}.`})[pattern] }
// Natural Brazilian-Portuguese source that means the same as sentence().
function sentencePt(pattern, n){ const a=art(n), N=n.pt; return ({
  subject_be_complement:cap(`${a} ${N} ${ser(n)} importante${n.pl?'s':''}.`),
  subject_simple_present_object:`Nós verificamos ${a} ${N} todos os dias.`,
  wh_do_subject_base_verb:`Quando você precisa ${del(n)} ${N}?`,
  subject_modal_base_verb:`Eu posso atualizar ${a} ${N} hoje.`,
  subject_past_simple_object_time:`Nós verificamos ${a} ${N} ontem.`,
  subject_be_going_to_verb_time:`Eles vão revisar ${a} ${N} amanhã.`,
  subject_have_past_participle_yet:`Nós já verificamos ${a} ${N}.`,
  subject_have_been_ving_object_duration:`Eles estão revisando ${a} ${N} há duas horas.`,
  if_present_will_future:`Se confirmarmos ${a} ${N}, vamos começar amanhã.`,
  passive_be_past_participle:cap(`${a} ${N} ${foi(n)} ${agree('revisad',n)} pela equipe.`),
  reported_speech_statement:`Ela disse que ${a} ${N} ${estava(n)} ${agree('pront',n)}.`,
  second_conditional:`Se eu tivesse mais tempo, eu melhoraria ${a} ${N}.`,
})[pattern] }
function explainPt(pattern){ return ({
  subject_be_complement:'Use o verbo to be (is) para descrever algo.',
  subject_simple_present_object:'Presente simples para uma rotina (every day).',
  wh_do_subject_base_verb:'Pergunta no presente com o auxiliar do.',
  subject_modal_base_verb:'Modal can + verbo na forma base.',
  subject_past_simple_object_time:'Passado simples com marcador de tempo (yesterday).',
  subject_be_going_to_verb_time:'Futuro com be going to para planos.',
  subject_have_past_participle_yet:'Present perfect com already.',
  subject_have_been_ving_object_duration:'Present perfect continuous com duração (for).',
  if_present_will_future:'Primeira condicional: if + presente, will + base.',
  passive_be_past_participle:'Voz passiva: was/were + particípio passado.',
  reported_speech_statement:'Discurso indireto com said that.',
  second_conditional:'Segunda condicional: if + passado, would + base.',
})[pattern] }
function wrong(pattern, s){ return s.replace(' have been reviewing ',' have been reviewed ').replace(' was reviewed ',' reviewed ').replace(' said that ',' said ').replace(' would ',' will ').replace(' do you ',' you do ').replace(' can ',' cans ').replace(' are going to ',' go to ').replace(' checked ',' check ') }
// Accepted English variants: natural contractions of the expected answer.
function enVariants(s){ const v=new Set(); const add=x=>{ if(x&&x!==s) v.add(x) }
  add(s.replace(/\bWe have\b/,"We've")); add(s.replace(/\bThey have\b/,"They've")); add(s.replace(/\bwe will\b/,"we'll")); add(s.replace(/\bThey are going to\b/,"They're going to")); add(s.replace(/\bI would\b/,"I'd")); return [...v] }

function makePack(theme, slug, ptTitle, en, level, core=false){ const pack_id=core?`core_${level.toLowerCase()}`:`${theme}_${level.toLowerCase()}`; const key=core?'core':theme; const words=nouns[key]; const minLex=core?20:14, minTpl=core?12:8, minCol=core?9:7
  const lex=words.slice(0,minLex).map((w,i)=>({item_id:`${pack_id}_${id(w)}`,pack_id,theme:key,level,canonical:w,translation_pt:ptOf(key,w).pt,semantic_type:i%3===0?'object':i%3===1?'time':'action',tags:[key,level.toLowerCase()]}))
  // Slice 7.5A-R T20: prefer authored semantic-frame content when available for
  // this theme×level; otherwise fall back to the deterministic generator (so all
  // 28 packs still exist while the frame rewrite rolls out theme by theme).
  const frames = core ? null : framesFor(key, level)
  if (frames) {
    const tpl = frameTemplates(frames, pack_id, key, level)
    const col=words.slice(0,minCol).map((w,i)=>({collocation_id:`${pack_id}_${id(w)}_chunk`,pack_id,theme:key,level,canonical:i%2?`check the ${w}`:`make a ${w}`,translation_pt:ptOf(key,w).pt,invalid_variants:[i%2?`do the ${w}`:`do a ${w}`],skill_id:'collocation'}))
    return {manifest:{schema_version:'1',pack_id,title:{pt:`${ptTitle} ${level}`,en:`${en} ${level}`},theme:key,level,language_pair:'pt-BR/en',version:1,source:'builtin',enabled_by_default:true,dependencies:[`core_${level.toLowerCase()}`],generator_compatibility:{min_version:'1',max_version:'1'}},lexical_items:lex,template_definitions:tpl,collocations:col}
  }
  const pats=levelPatterns[level]; const tpl=[]
  for(let i=0;i<minTpl;i++){ const p=pats[i%pats.length], w=words[i%words.length], skill=skills[level][i%skills[level].length], sent=sentence(p,w), n=ptOf(key,w), srcPt=sentencePt(p,n), variants=enVariants(sent)
    tpl.push({template_id:`${pack_id}_${p}_${String(i+1).padStart(2,'0')}`,family_id:`${pack_id}_${p}_${i%6}`,pack_id,theme:key,level,pattern_id:p,primary_skill_id:skill,skill_ids:[skill,'vocabulary'],exercise_types:['translate_natural','fill_blank','build_sentence','choose_best','rewrite_natural','listen_type','speak_sentence'],slots:{subject:'we',object:`${pack_id}_${id(w)}`},constraints:['subject_auxiliary_agreement',...(level==='B1'?['level_allows_present_perfect_continuous']:[]),...(level==='B2'?['level_allows_passive','level_allows_reported_speech']:[])],distractor_strategies:['wrong_word_order','wrong_tense','wrong_collocation'],sentence:sent,
      // Bilingual contract (Slice 7.5): the single Portuguese source of truth.
      source_locale:'pt-BR',source_text_pt:srcPt,target_locale:'en',expected_answers_en:[sent],accepted_variants_en:variants,explanation_pt:explainPt(p),skill_targets:[skill],
      // legacy fields kept for backward compatibility (now real Portuguese)
      pt:srcPt,ctx:`Contexto de ${ptTitle.toLowerCase()} (nível ${level}).`,blank:sent.split(' ')[1]||'the',wrong:wrong(p,sent)}) }
  const col=words.slice(0,minCol).map((w,i)=>({collocation_id:`${pack_id}_${id(w)}_chunk`,pack_id,theme:key,level,canonical:i%2?`check the ${w}`:`make a ${w}`,translation_pt:ptOf(key,w).pt,invalid_variants:[i%2?`do the ${w}`:`do a ${w}`],skill_id:'collocation'}))
  return {manifest:{schema_version:'1',pack_id,title:{pt:core?`Base ${level}`:`${ptTitle} ${level}`,en:core?`Core ${level}`:`${en} ${level}`},theme:key,level,language_pair:'pt-BR/en',version:1,source:'builtin',enabled_by_default:true,dependencies:core?[]:[`core_${level.toLowerCase()}`],generator_compatibility:{min_version:'1',max_version:'1'}},lexical_items:lex,template_definitions:tpl,collocations:col} }

await fs.rm('src/content/packs',{recursive:true,force:true});
const all=[]
for(const level of levels){ const pack=makePack('core','core','Base','Core',level,true); const dir='src/content/packs/core'; await fs.mkdir(dir,{recursive:true}); await fs.writeFile(path.join(dir,`core-${level.toLowerCase()}.json`),JSON.stringify(pack,null,2)+'\n'); all.push(pack) }
for(const [theme,slug,ptTitle,en] of themes) for(const level of levels){ const pack=makePack(theme,slug,ptTitle,en,level,false); const dir=`src/content/packs/${slug}`; await fs.mkdir(dir,{recursive:true}); await fs.writeFile(path.join(dir,`${slug}-${level.toLowerCase()}.json`),JSON.stringify(pack,null,2)+'\n'); all.push(pack) }
// Compile the packs into the module the app imports at runtime.
await fs.writeFile('src/content/content-packs.generated.js','// Generated by scripts/content-packs/build-content-packs.mjs\nexport const GENERATED_CONTENT_PACKS = '+JSON.stringify(all,null,2)+'\n')
console.log('content packs rebuilt with real bilingual sources:',all.length,'packs')
