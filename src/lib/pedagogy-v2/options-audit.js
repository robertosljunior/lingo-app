// options-audit.js — structural audit of authored recognition alternatives
// (Slice V2.5). With multiple packs, authored translations may collide or be
// near-identical; this audit detects STRUCTURAL hazards only — it never tries
// to decide deep synonymy by regex (that is authoring responsibility).
//
// Findings (deterministic order, machine-readable codes):
//   DUPLICATE_TRANSLATION            — two exemplars share the exact text_pt
//   NORMALIZED_DUPLICATE_TRANSLATION — same text_pt after case/punct/accent
//                                      normalization (would be ambiguous options)
//   SELF_DISTRACTOR                  — a built option set contains the target's
//                                      own translation as a distractor
//   INSUFFICIENT_OPTIONS             — an exemplar cannot form the minimum safe
//                                      option set from authored translations
//   FOREIGN_OPTION_SOURCE            — a built option sources an exemplar that
//                                      does not belong to the audited pack
//
// The audit is read-only and pure. When an exemplar has no safe alternatives
// the runtime behavior is unchanged: the engine excludes the recipe
// (`no_safe_options`), tries other exemplars/recipes and ultimately reports
// `no_eligible_activity` — options are never fabricated.

import { DEFAULT_LESSON_ENGINE_POLICY_V2, buildRecognitionOptionsV2, normalizeTranslationPt } from './lesson-engine.js'

export function auditRecognitionOptionsV2(pack, {
  minOptions = DEFAULT_LESSON_ENGINE_POLICY_V2.min_recognition_options,
} = {}) {
  const findings = []
  const exemplars = pack?.exemplars || []
  const packExemplarIds = new Set(exemplars.map((e) => e.exemplar_id))

  // 1) authored duplicates (exact and normalized).
  const byExact = new Map()
  const byNormalized = new Map()
  for (const e of exemplars) {
    if (!e.text_pt) continue
    const exact = byExact.get(e.text_pt)
    if (exact) findings.push({ code: 'DUPLICATE_TRANSLATION', exemplar_id: e.exemplar_id, other_exemplar_id: exact, text_pt: e.text_pt })
    else byExact.set(e.text_pt, e.exemplar_id)
    const norm = normalizeTranslationPt(e.text_pt)
    const seen = byNormalized.get(norm)
    if (seen && byExact.get(e.text_pt) === e.exemplar_id) {
      // Only report the normalized collision when it is not already an exact one.
      findings.push({ code: 'NORMALIZED_DUPLICATE_TRANSLATION', exemplar_id: e.exemplar_id, other_exemplar_id: seen, text_pt: e.text_pt })
    }
    if (!seen) byNormalized.set(norm, e.exemplar_id)
  }

  // 2) per-exemplar option sets exactly as the engine would build them.
  for (const e of exemplars) {
    const options = buildRecognitionOptionsV2(pack, e, minOptions)
    if (!options) {
      findings.push({ code: 'INSUFFICIENT_OPTIONS', exemplar_id: e.exemplar_id, min_options: minOptions })
      continue
    }
    const targetNorm = normalizeTranslationPt(e.text_pt)
    for (const o of options) {
      if (!o.is_target && normalizeTranslationPt(o.text_pt) === targetNorm) {
        findings.push({ code: 'SELF_DISTRACTOR', exemplar_id: e.exemplar_id, option_id: o.option_id, text_pt: o.text_pt })
      }
      if (!packExemplarIds.has(o.source_exemplar_id)) {
        findings.push({ code: 'FOREIGN_OPTION_SOURCE', exemplar_id: e.exemplar_id, option_id: o.option_id, source_exemplar_id: o.source_exemplar_id })
      }
      const dup = options.filter((x) => x !== o && normalizeTranslationPt(x.text_pt) === normalizeTranslationPt(o.text_pt))
      if (dup.length && o.is_target) {
        findings.push({ code: 'NORMALIZED_DUPLICATE_TRANSLATION', exemplar_id: e.exemplar_id, option_id: o.option_id, text_pt: o.text_pt })
      }
    }
  }

  findings.sort((a, b) => (a.exemplar_id < b.exemplar_id ? -1 : a.exemplar_id > b.exemplar_id ? 1 : 0)
    || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  return { clean: findings.length === 0, findings }
}
