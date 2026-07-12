import { GENERATED_CONTENT_PACKS } from '../content/content-packs.generated.js'
export const BUILTIN_CONTENT_PACKS = GENERATED_CONTENT_PACKS.slice().sort((a,b)=>a.manifest.pack_id.localeCompare(b.manifest.pack_id))
export function getBuiltinContentPack(packId){ return BUILTIN_CONTENT_PACKS.find(p=>p.manifest.pack_id===packId) || null }
