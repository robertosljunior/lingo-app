// usage-rule-resolvers.js — safe interpreters for declarative `when` conditions.
// Packs never carry code; a `when` object is matched against structural evidence
// by these pure resolvers only. Unknown keys are ignored conservatively (a rule
// that references an unknown condition simply does not fire).

function subjectFeatures(structure) {
  const s = structure.subjects?.[0]
  return {
    present: !!s,
    third_singular: !!s?.third_singular,
    token: s?.token || null,
  }
}

const RESOLVERS = {
  sentence_type(value, structure) {
    return structure.sentence_type === value
  },
  tense(value, structure) {
    return structure.tense_candidates?.includes(value)
  },
  has_auxiliary(value, structure) {
    const present = structure.auxiliaries?.length > 0
    return value ? present : !present
  },
  subject_features(value, structure) {
    const f = subjectFeatures(structure)
    if (value?.third_singular != null && f.third_singular !== value.third_singular) return false
    if (Array.isArray(value?.persons) && f.token) {
      // Coarse person mapping.
      const person = f.token === 'i' ? 1 : ['you'].includes(f.token) ? 2 : 3
      if (!value.persons.includes(person)) return false
    }
    return true
  },
  main_verb_form(value, structure) {
    return structure.evidence?.main_verb?.form === value
  },
  intent(value, structure) {
    return structure.intent_signals?.includes(value)
  },
}

/**
 * Returns true iff every condition in `when` is satisfied by the structural
 * evidence. Empty/absent `when` never matches (a rule must be explicit).
 */
export function matchesWhen(when, structure) {
  if (!when || typeof when !== 'object' || !Object.keys(when).length) return false
  for (const [key, value] of Object.entries(when)) {
    const resolver = RESOLVERS[key]
    if (!resolver) return false // unknown condition → do not fire (conservative)
    if (!resolver(value, structure)) return false
  }
  return true
}

export function knownConditions() {
  return Object.keys(RESOLVERS)
}
