#!/usr/bin/env node
// This command runs Playwright's REAL learner path, then summarizes its evidence.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
if (!process.argv.includes('--report-only')) {
  const run=spawnSync('npx',['playwright','test','--config','playwright.combinatorial.config.js'],{stdio:'inherit',env:process.env})
  if(run.status!==0) process.exit(run.status || 1)
}
const tally=xs=>Object.entries(xs.reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{})).sort((a,b)=>b[1]-a[1])
const distinct=xs=>new Set(xs.filter(x=>x!=null)).size
const median=xs=>{const a=xs.toSorted((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2}
function summarize(run) {
  const rows=run.rows
  if(rows.length!==240) throw new Error(`INCOMPLETE_LEARNER_RUN:${rows.length}`)
  const texts=tally(rows.map(r=>r.text_en)),focuses=tally(rows.map(r=>r.planner_focus_key))
  const seen=new Set(), perSession=[],avoidable=[],consecutive=[]
  let openers=0
  for(let s=1;s<=20;s++) {
    const batch=rows.filter(r=>r.session===s)
    if(batch.length!==12)throw new Error(`INCOMPLETE_SESSION:${s}`)
    if(seen.has(batch[0].text_en))openers++
    let fresh=0
    for(const row of batch) {
      const i=rows.indexOf(row)
      if(seen.has(row.text_en) && row.supply?.unseen_supply_count>0)avoidable.push({ session:s,activity:row.activity_index,text_en:row.text_en,v3_compatible:row.supply.v3_eligible_count>0 })
      if(i && rows[i-1].text_en===row.text_en)consecutive.push({session:s,activity:row.activity_index,text_en:row.text_en})
      if(!seen.has(row.text_en))fresh++
      seen.add(row.text_en)
    }
    perSession.push({session:s,new_texts:fresh,distinct_texts:distinct(batch.map(r=>r.text_en)),max_text_count:tally(batch.map(r=>r.text_en))[0][1]})
  }
  const exhausted=rows.flatMap(r=>r.resolution_trace?.attempts || []).filter(a=>a.engine_status==='focus_exhausted')
  const perFocus=focuses.map(([focus,count])=>({focus,count,eligible_supply:Math.max(...rows.filter(r=>r.planner_focus_key===focus).map(r=>r.supply?.eligible_supply_count??0))}))
  const constructions=tally(rows.map(r=>r.construction_id))
  const metrics={
    total_activities:rows.length, distinct_exact_EN_texts:texts.length, exact_repeat_slots:rows.length-texts.length,
    exact_repeat_rate:(rows.length-texts.length)/rows.length, most_repeated_text_count:texts[0][1],
    distinct_realization_IDs:distinct(rows.map(r=>r.realization_id)),distinct_exemplar_IDs:distinct(rows.map(r=>r.exemplar_id)),
    distinct_focuses:focuses.length, distinct_constructions:distinct(rows.map(r=>r.construction_id)),
    distinct_recipes:distinct(rows.map(r=>r.recipe)),distinct_modalities:distinct(rows.map(r=>r.modality)),distinct_capabilities:distinct(rows.map(r=>r.capability)),
    max_occurrences_one_text_per_session:Math.max(...perSession.map(s=>s.max_text_count)),max_occurrences_one_text_across_20_sessions:texts[0][1],
    sessions_with_zero_new_text:perSession.filter(s=>s.new_texts===0).length,session_opener_repeat_rate:openers/20,
    consecutive_exact_repeats:consecutive.length,avoidable_exact_repeats:avoidable.length,
    v3_compatible_avoidable_exact_repeats:avoidable.filter(a=>a.v3_compatible).length,
    cooldown_bypass_count:rows.filter(r=>r.cooldown_bypass).length,focus_exhausted_count:exhausted.length,
    focus_switches_caused_by_exhaustion:rows.filter(r=>r.resolution_trace?.attempts?.some(a=>a.engine_status==='focus_exhausted')).length,
    minimum_eligible_supply_per_focus:Math.min(...perFocus.map(f=>f.eligible_supply)),median_eligible_supply_per_focus:median(perFocus.map(f=>f.eligible_supply)),
    minimum_unseen_supply_at_selection:Math.min(...rows.map(r=>r.supply?.unseen_supply_count??0)),
    repeated_texts_2x:texts.filter(([,n])=>n===2).length,repeated_texts_3x:texts.filter(([,n])=>n===3).length,repeated_texts_4x_plus:texts.filter(([,n])=>n>=4).length,
    top_focus_share:focuses[0][1]/240,top_3_focus_share:focuses.slice(0,3).reduce((n,[,v])=>n+v,0)/240,
    top_construction_share:constructions[0][1]/240,top_3_construction_share:constructions.slice(0,3).reduce((n,[,v])=>n+v,0)/240,
    activities_using_V3:rows.filter(r=>r.realization_id).length,
  }
  return {metrics,most_repeated_text:texts[0][0],top_texts:texts.slice(0,20),perSession,perFocus,recipe_distribution:tally(rows.map(r=>r.recipe)),construction_distribution:constructions,target_distribution:tally(rows.map(r=>r.target_id)),v3_focus_distribution:tally(rows.filter(r=>r.realization_id).map(r=>r.combinatorial_focus_id)),avoidable,consecutive,runtime:run.runtime}
}
const baseline=summarize(JSON.parse(readFileSync('test-evidence/v3-practice-off.json')))
const v3=summarize(JSON.parse(readFileSync('test-evidence/v3-practice-on.json')))
const report={baseline,v3, definitions:{ exact_repeat_slots:'240 minus distinct exact text_en strings; first occurrence excluded',avoidable:'Previously shown exact text with unseen eligible text in the observed same focus/recipe/capability/modality pool; not merely the score band',per_focus_supply:'Maximum observed eligible count for each planner focus, then minimum/median across focuses. Content-only eligibility is audited separately.',opener:'Already seen before the session opener / all 20 sessions',repeat_distribution:'Number of distinct texts occurring exactly 2, exactly 3, or at least 4 times'}}
writeFileSync('test-evidence/v3-combinatorial-practice-comparison.json',JSON.stringify(report,null,2))
const table='| Metric | V2 OFF | V3 ON |\n|---|---:|---:|\n'+Object.keys(baseline.metrics).map(k=>`| ${k} | ${baseline.metrics[k]} | ${v3.metrics[k]} |`).join('\n')
writeFileSync('test-evidence/v3-combinatorial-practice-metrics.md',table+'\n')
console.log(table)
