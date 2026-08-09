// audit-authored-confusability-v2.mjs — V2.23 authored-corpus ambiguity audit.
//
// This is an OFFLINE candidate detector, not a runtime judge. It combines
// deterministic pt-BR surface overlap with the existing hashing semantic encoder
// over the authored English sentences. The result is a static, reviewable pair
// list for V2.26; it never changes lesson runtime behavior by itself.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import stillPack from '../src/content/pedagogy-v2/still.json' with { type: 'json' }
import butPack from '../src/content/pedagogy-v2/but.json' with { type: 'json' }
import yetPack from '../src/content/pedagogy-v2/yet.json' with { type: 'json' }
import { HashingSemanticEncoder } from '../src/lib/language-analysis/semantic-encoder-adapter.js'

export const CONFUSABILITY_AUDIT_VERSION = 1
export const CONFUSABILITY_THRESHOLDS = Object.freeze({
  pt_surface_high: 0.72,
  pt_surface_support: 0.25,
  english_semantic_same_sense: 0.58,
  english_semantic_high: 0.78,
  english_semantic_surface_support: 0.4,
})

export function normalizePt(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?…"'()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(text) {
  return new Set(normalizePt(text).split(' ').filter(Boolean))
}

export function jaccardPt(a, b) {
  const aa = tokens(a); const bb = tokens(b)
  if (!aa.size && !bb.size) return 1
  let intersection = 0
  for (const x of aa) if (bb.has(x)) intersection += 1
  const union = new Set([...aa, ...bb]).size
  return union ? intersection / union : 0
}

function overlaps(a = [], b = []) {
  const bs = new Set(b)
  return a.some((x) => bs.has(x))
}

function packRows(pack) {
  const packId = pack.manifest?.pack_id || pack.pack_id || '(unknown)'
  return (pack.exemplars || []).map((e) => ({ ...e, _pack_id: packId }))
}

async function defaultSemanticScoreFactory() {
  const encoder = new HashingSemanticEncoder()
  return async (a, b) => {
    const ranked = await encoder.rank(a, [b])
    return ranked[0]?.score ?? 0
  }
}

export async function buildConfusabilityReport(packs, { semanticScore = null } = {}) {
  const score = semanticScore || await defaultSemanticScoreFactory()
  const rows = packs.flatMap(packRows).sort((a, b) => a.exemplar_id.localeCompare(b.exemplar_id))
  const candidates = []

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]; const b = rows[j]
      const ptA = normalizePt(a.text_pt); const ptB = normalizePt(b.text_pt)
      const ptJaccard = jaccardPt(ptA, ptB)
      const exactPt = ptA && ptA === ptB
      const sameSense = overlaps(a.sense_ids, b.sense_ids)
      const sameConstruction = a.construction_id === b.construction_id
      const enSemantic = await score(String(a.text_en || ''), String(b.text_en || ''))
      const reasons = []

      if (exactPt) reasons.push('normalized_pt_equal')
      if (ptJaccard >= CONFUSABILITY_THRESHOLDS.pt_surface_high) reasons.push('high_pt_surface_overlap')
      if (sameSense
        && enSemantic >= CONFUSABILITY_THRESHOLDS.english_semantic_same_sense
        && ptJaccard >= CONFUSABILITY_THRESHOLDS.pt_surface_support) reasons.push('same_sense_semantic_near')
      if (enSemantic >= CONFUSABILITY_THRESHOLDS.english_semantic_high
        && ptJaccard >= CONFUSABILITY_THRESHOLDS.english_semantic_surface_support) reasons.push('cross_sense_semantic_near')
      if (!reasons.length) continue

      candidates.push({
        pair_id: `${a.exemplar_id}::${b.exemplar_id}`,
        a: { pack_id: a._pack_id, exemplar_id: a.exemplar_id, text_en: a.text_en, text_pt: a.text_pt },
        b: { pack_id: b._pack_id, exemplar_id: b.exemplar_id, text_en: b.text_en, text_pt: b.text_pt },
        relation: { same_sense: sameSense, same_construction: sameConstruction },
        scores: {
          pt_jaccard: +ptJaccard.toFixed(4),
          english_hashing_semantic: +Number(enSemantic).toFixed(4),
        },
        reasons: reasons.sort(),
        disposition: 'needs_human_review',
      })
    }
  }

  candidates.sort((a, b) => a.pair_id.localeCompare(b.pair_id))
  return {
    audit_version: CONFUSABILITY_AUDIT_VERSION,
    corpus: packs.map((p) => p.manifest?.pack_id || p.pack_id).sort(),
    exemplar_count: rows.length,
    pair_count: rows.length * (rows.length - 1) / 2,
    thresholds: CONFUSABILITY_THRESHOLDS,
    candidate_count: candidates.length,
    candidates,
    caveat: 'Candidate detector only. A pair must be human-reviewed before V2.26 treats it as an ambiguity exclusion.',
  }
}

export async function writeConfusabilityReport(outPath = null) {
  const report = await buildConfusabilityReport([stillPack, butPack, yetPack])
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const target = outPath || path.join(root, 'test-evidence', 'v2-23', 'authored-confusability.generated.json')
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return { target, report }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const shouldWrite = process.argv.includes('--write')
  if (shouldWrite) {
    const { target, report } = await writeConfusabilityReport()
    console.log(`# V2.23 authored confusability audit\nwritten=${target}\ncandidates=${report.candidate_count}/${report.pair_count}`)
  } else {
    const report = await buildConfusabilityReport([stillPack, butPack, yetPack])
    console.log(JSON.stringify(report, null, 2))
  }
}
