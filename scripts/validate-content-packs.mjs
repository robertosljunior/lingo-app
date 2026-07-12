import { BUILTIN_CONTENT_PACKS } from '../src/lib/content-pack-loader.js'
import { validateContentPacks } from '../src/lib/content-pack-validator.js'
const r=validateContentPacks(BUILTIN_CONTENT_PACKS)
const table=BUILTIN_CONTENT_PACKS.map(p=>{const v=r.packs.find(x=>x.pack_id===p.manifest.pack_id);return {pack_id:p.manifest.pack_id,theme:p.manifest.theme,level:p.manifest.level,version:p.manifest.version,lexical:p.lexical_items.length,templates:p.template_definitions.length,collocations:p.collocations.length,dependencies:p.manifest.dependencies.join('|'),valid:v.valid}})
console.table(table); if(!r.valid){console.error(r.errors.join('\n')); process.exit(1)}
