import { it, expect } from 'vitest'
import { auditV3Quality } from './combinatorial-quality-audit.js'
import { materializeCombinatorialCorpusV3 } from './combinatorial-supply.js'
it('has no detected structural or semantic quality findings in the current corpus', () => {
 const findings = auditV3Quality(materializeCombinatorialCorpusV3()).findings
 expect(findings).toEqual([])
})
it('detects structural corruptions and identity collisions', () => {
 const en=['He have a idea..','They is on on {{place}}.','Did you worked yesterday','How do I get to the hotel from the hotel?','The ticket is expensive, but it is sunny.']
 const rows=en.map((text_en,i)=>({realization_id:String(i),text_en,text_pt:''}))
 rows.push({...rows[0],realization_id:'duplicate'})
 const codes=new Set(auditV3Quality(rows).findings.map(f=>f.code))
 for(const code of ['EMPTY_PT','INVALID_ARTICLE','DUPLICATE_PUNCTUATION','SUBJECT_VERB_AGREEMENT','UNRESOLVED_PLACEHOLDER','BROKEN_QUESTION','INVALID_VERB_FORM','IDENTICAL_SURFACE_DIFFERENT_IDS','SAME_ORIGIN_DESTINATION','SEMANTICALLY_IMPLAUSIBLE_COMBINATION']) expect(codes.has(code),code).toBe(true)
})
