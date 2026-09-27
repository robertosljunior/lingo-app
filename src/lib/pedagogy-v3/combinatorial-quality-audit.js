// Conservative lint, not an editorial approval or a proof of naturalness.
export function auditV3Quality(rows) {
  const findings = []
  const texts = new Map()
  const flag = (row, code, severity = 'error') => findings.push({ realization_id: row.realization_id, focus_id: row.focus_id, text_en: row.text_en, code, severity })
  for (const row of rows) {
    const en = row.text_en || ''
    const key = en.trim().toLowerCase().replace(/\s+/g, ' ')
    if (texts.has(key)) flag(row, texts.get(key) === row.realization_id ? 'DUPLICATE_EN' : 'IDENTICAL_SURFACE_DIFFERENT_IDS')
    texts.set(key, row.realization_id)
    if (!row.text_pt?.trim()) flag(row, 'EMPTY_PT')
    if (/\{\{|\}\}|\$\{/.test(en + row.text_pt)) flag(row, 'UNRESOLVED_PLACEHOLDER')
    if (/[.!?,]{2,}/.test(en)) flag(row, 'DUPLICATE_PUNCTUATION')
    if (/\bnext to to\b|\bin in\b|\bon on\b/.test(en)) flag(row, 'INVALID_PREPOSITION')
    if (/\b(?:I is|He are|She are|They is|We is|You is|He have|She have|They has)\b/.test(en)) flag(row, 'SUBJECT_VERB_AGREEMENT')
    if (/\ba (?:idea|apple|orange|empty|airport)\b|\ban (?:car|book|table|question)\b/i.test(en)) flag(row, 'INVALID_ARTICLE')
    if (/^(?:Did|Do|Does|Are|Have|Could|Would|How)\b/.test(en) && !en.includes('?')) flag(row, 'BROKEN_QUESTION')
    if (/\b(?:did|does) (?:you|he|she|they|we) (?:went|works|worked|bought)\b/i.test(en)) flag(row, 'INVALID_VERB_FORM')
    if (/\bnext to to\b/.test(en)) flag(row, 'GRAMMATICALLY_INVALID_COMBINATION')
    const trip = en.match(/^How do I get to (.+) from (.+)\?$/)
    if (trip && trip[1] === trip[2]) flag(row, 'SAME_ORIGIN_DESTINATION', 'editorial_review')
    if (/^(?:The room|This room|This hotel) is faster\b/.test(en)
      || /^The ticket is expensive, but it is sunny/.test(en)
      || /^There is a bus (?:upstairs|at the end of the hall)/.test(en)
      || /meet today today/.test(en)) flag(row, 'SEMANTICALLY_IMPLAUSIBLE_COMBINATION', 'editorial_review')
    if (row.focus_id === 'v3.but.simple_contrast' && /^(?:I am tired|I am busy), but it (?:is comfortable|works well)/.test(en)) flag(row, 'UNRESOLVED_SEMANTIC_REFERENT', 'editorial_review')
  }
  return { method: 'bounded mechanical rules and explicit semantic counterexamples; absence of a finding is NOT approval', coverage: ['duplicate English','empty Portuguese','verb form','subject/verb','article','preposition','semantic plausibility','punctuation','question structure','placeholders','surface identity'], findings }
}
