// V2.24 build-time authoring compiler. It enumerates deterministic candidate
// signatures for human review; runtime materialization consumes only the compact
// allow-list + filler/frame banks. This script never mutates curriculum JSON.

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import stillPack from '../src/content/pedagogy-v2/still.json' with { type: 'json' }
import unlessPack from '../src/content/pedagogy-v2/unless.json' with { type: 'json' }
import { LICENSED_REALIZATION_GENERATOR_VERSION } from '../src/lib/pedagogy-v2/licensed-realization-contracts.js'
import {
  enumerateLicensedPilotCandidates,
  materializeLicensedRealizationsForPack,
} from '../src/lib/pedagogy-v2/licensed-realizations.js'
import { validateLicensedRealizationsV2 } from '../src/lib/pedagogy-v2/licensed-realization-validator.js'

const packs = [stillPack, unlessPack]
const report = {
  generator: LICENSED_REALIZATION_GENERATOR_VERSION,
  generated_at: null, // deterministic artifact: deliberately no clock.
  pilots: [],
}

for (const pack of packs) {
  const candidates = enumerateLicensedPilotCandidates(pack)
  const provisional = materializeLicensedRealizationsForPack(pack, { allowProvisional: true })
  const validation = validateLicensedRealizationsV2(pack, provisional)
  if (!validation.valid) {
    console.error(validation.errors.join('\n'))
    process.exit(1)
  }
  const provisionalById = new Map(provisional.map((row) => [row.exemplar_id, row]))
  report.pilots.push({
    pack_id: pack.manifest.pack_id,
    candidates: candidates.map((row) => {
      const realized = provisionalById.get(row.candidate_id) || null
      return {
        ...row,
        provisional_allowlist: Boolean(realized),
        review_contract: realized ? {
          calculated_stage: realized.exposure_stage,
          composed_prerequisites: realized.prerequisites.map((p) => ({ ...p })),
        } : null,
      }
    }),
    candidate_count: candidates.length,
    provisional_allowlist_count: provisional.length,
    human_approved_count: provisional.filter((row) => row.provenance.approval_status === 'human_approved').length,
    validation,
  })
}

const json = `${JSON.stringify(report, null, 2)}\n`
if (process.argv.includes('--write')) {
  const target = resolve('test-evidence/v2-24/pilot-candidates.json')
  writeFileSync(target, json)
  console.log(`wrote ${target}`)
} else {
  process.stdout.write(json)
}
