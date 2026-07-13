import { BUILTIN_CONTENT_PACKS } from '../src/lib/content-pack-loader.js'
import { validateContentPacks } from '../src/lib/content-pack-validator.js'
import { validateBilingualPack } from '../src/lib/bilingual-content.js'
const r=validateContentPacks(BUILTIN_CONTENT_PACKS)
// Slice 7.5: bilingual coverage + no-placeholder + semantic-equivalence gate.
const bilingual=BUILTIN_CONTENT_PACKS.map(p=>({pack_id:p.manifest.pack_id,...validateBilingualPack(p)}))
const table=BUILTIN_CONTENT_PACKS.map(p=>{const v=r.packs.find(x=>x.pack_id===p.manifest.pack_id);const b=bilingual.find(x=>x.pack_id===p.manifest.pack_id);const rep=b.report;return {pack_id:p.manifest.pack_id,theme:p.manifest.theme,level:p.manifest.level,templates:p.template_definitions.length,translation:rep.coverage.translation,ordering:rep.coverage.ordering,listening:rep.coverage.listening,recognition:rep.coverage.recognition,placeholders:rep.placeholder_count,valid:v.valid&&b.valid}})
console.table(table)
const bilingualErrors=bilingual.filter(b=>!b.valid)
if(bilingualErrors.length){console.error('Bilingual coverage failures:'); for(const b of bilingualErrors) console.error(` ${b.pack_id}: ${b.errors.join(', ')}`)}
if(!r.valid){console.error(r.errors.join('\n'))}
if(!r.valid||bilingualErrors.length) process.exit(1)
console.log('All content packs valid with real bilingual coverage.')
