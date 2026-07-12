// knowledge-base.js — indexes loaded semantic_knowledge packs so the
// orchestrator can look up frames, rules, alternatives, exemplars, explanations
// and transformations without knowing about storage or pack file layout.

export class KnowledgeBase {
  constructor(packs = []) {
    this.packs = packs
    this.concepts = new Map()
    this.frames = new Map()
    this.usageRules = []
    this.transformations = []
    this.explanations = new Map()
    this.alternativeSets = []
    this.exemplars = []
    this.contrastSets = []
    this.naturalnessHints = []
    for (const pack of packs) this._index(pack)
  }

  _index(pack) {
    const pid = pack?.manifest?.pack_id
    for (const c of pack?.concepts || []) this.concepts.set(c.concept_id, { ...c, pack_id: pid })
    for (const f of pack?.semantic_frames || []) this.frames.set(f.frame_id, { ...f, pack_id: pid })
    for (const r of pack?.usage_rules || []) this.usageRules.push({ ...r, pack_id: pid })
    for (const t of pack?.transformations || []) this.transformations.push({ ...t, pack_id: pid })
    for (const e of pack?.explanations_pt || []) this.explanations.set(e.explanation_id, { ...e, pack_id: pid })
    for (const a of pack?.natural_alternatives || []) this.alternativeSets.push({ ...a, pack_id: pid })
    for (const ex of pack?.retrieval_exemplars || []) this.exemplars.push({ ...ex, pack_id: pid })
    for (const cs of pack?.contrast_sets || []) this.contrastSets.push({ ...cs, pack_id: pid })
    for (const h of pack?.naturalness_hints || []) this.naturalnessHints.push({ ...h, pack_id: pid })
  }

  explanation(id) { return this.explanations.get(id) || null }
  frame(id) { return this.frames.get(id) || null }

  alternativesForFrame(frameId, { level } = {}) {
    return this.alternativeSets
      .filter((s) => s.frame_id === frameId)
      .flatMap((s) => (s.alternatives || []).map((a) => ({ ...a, alternative_set_id: s.alternative_set_id })))
      .filter((a) => !level || !a.level || a.level === level || cefrLte(a.level, level))
  }

  exemplarsForRanking() {
    return this.exemplars.map((ex) => ({ text: ex.text, intent: ex.intent, frame_id: ex.frame_id, polarity: ex.polarity || 'positive', example_id: ex.example_id }))
  }
}

function cefrLte(a, b) {
  const order = ['A1', 'A2', 'B1', 'B2']
  return order.indexOf(a) <= order.indexOf(b)
}
