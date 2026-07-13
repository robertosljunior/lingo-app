// semantic-calibration-corpus.mjs — labeled pairs to calibrate the semantic
// encoder. Each pair is either an intent/meaning MATCH (should rank high) or a
// MISMATCH (should rank lower), including hard negatives that share a topic word
// but differ in intent/meaning.
//
// The set combines hand-authored anchors (SEMANTIC_PAIRS) with a systematically
// GENERATED corpus (GENERATED_PAIRS) covering the spec's eight calibration
// categories at scale. Generated pairs are labeled by construction — swapping an
// entity produces an entity_mismatch, adding negation produces opposite_polarity,
// changing tense produces a tense_mismatch — so the labels are exact, not guessed.
//
// IMPORTANT: similarity is advisory only. In free mode it never reprova; in
// equivalent mode it is combined with negation/entities/tense/intent/grammar.

export const SEMANTIC_PAIRS = [
  // intent match — polite requests
  { a: 'Please give me a dessert.', b: 'Could I have something sweet, please?', label: 'match', kind: 'intent_match', category: 'valid_paraphrase' },
  { a: 'Could I have a coffee, please?', b: "I'd like a coffee, please.", label: 'match', kind: 'intent_match', category: 'valid_paraphrase' },
  { a: 'Can I see the menu?', b: 'Could I look at the menu, please?', label: 'match', kind: 'intent_match', category: 'valid_paraphrase' },
  // topic overlap but DIFFERENT intent/meaning (hard negatives)
  { a: 'Please give me a dessert.', b: 'The dessert is important.', label: 'mismatch', kind: 'close_but_different', category: 'same_topic_different_intent' },
  { a: 'Could I have a coffee?', b: 'Coffee is bad for your health.', label: 'mismatch', kind: 'close_but_different', category: 'same_topic_different_intent' },
  { a: 'I want to book a flight.', b: 'The flight was three hours late.', label: 'mismatch', kind: 'close_but_different', category: 'same_topic_different_intent' },
  // negation flips meaning
  { a: 'I like coffee.', b: "I don't like coffee.", label: 'mismatch', kind: 'negation', category: 'opposite_polarity' },
  { a: 'She is happy.', b: 'She is not happy at all.', label: 'mismatch', kind: 'negation', category: 'opposite_polarity' },
  // entity mismatch
  { a: 'I have a car.', b: 'I have a bike.', label: 'mismatch', kind: 'entity_mismatch', category: 'entity_mismatch' },
  { a: 'She lives in London.', b: 'She lives in Paris.', label: 'mismatch', kind: 'entity_mismatch', category: 'entity_mismatch' },
  // tense mismatch
  { a: 'I work here.', b: 'I worked here.', label: 'mismatch', kind: 'tense_mismatch', category: 'tense_mismatch' },
  // clear semantic match
  { a: 'The meeting starts at nine.', b: 'The meeting begins at 9.', label: 'match', kind: 'semantic_match', category: 'equivalent' },
  { a: 'He is a doctor.', b: 'He works as a physician.', label: 'match', kind: 'semantic_match', category: 'equivalent' },
  // clear mismatch
  { a: 'The weather is nice today.', b: 'I need to fix my computer.', label: 'mismatch', kind: 'semantic_mismatch', category: 'related_not_equivalent' },
]

// ---- generated corpus ------------------------------------------------------
const ITEMS = ['a car', 'a bike', 'a dog', 'a cat', 'a phone', 'a laptop', 'a book', 'a house', 'a ticket', 'a coffee', 'a bag', 'a watch', 'a camera', 'a guitar', 'a plant', 'an umbrella']
const CITIES = ['London', 'Paris', 'Tokyo', 'Berlin', 'Madrid', 'Rome', 'Lisbon', 'Cairo', 'Oslo', 'Athens']
const FOODS = ['a dessert', 'a salad', 'some soup', 'a sandwich', 'some water', 'a pizza', 'a burger', 'some juice']
const SUBJECTS = ['I', 'We', 'They', 'She', 'He']
const s3 = (subj) => subj === 'She' || subj === 'He'
const VERBS = [
  { base: 'work', past: 'worked', s: 'works' },
  { base: 'live', past: 'lived', s: 'lives' },
  { base: 'play', past: 'played', s: 'plays' },
  { base: 'study', past: 'studied', s: 'studies' },
  { base: 'travel', past: 'traveled', s: 'travels' },
  { base: 'cook', past: 'cooked', s: 'cooks' },
  { base: 'paint', past: 'painted', s: 'paints' },
  { base: 'walk', past: 'walked', s: 'walks' },
  { base: 'call', past: 'called', s: 'calls' },
  { base: 'read', past: 'read', s: 'reads' },
]
const ENTITY_CARRIERS = [(x) => `I have ${x}.`, (x) => `I want ${x}.`, (x) => `Do you have ${x}?`, (x) => `I bought ${x}.`]
const pres = (subj, v) => `${subj} ${s3(subj) ? v.s : v.base} every day.`
const past = (subj, v) => `${subj} ${v.past} yesterday.`
const future = (subj, v) => `${subj} will ${v.base} tomorrow.`

function pairsEntityMismatch() {
  const out = []
  for (const carrier of ENTITY_CARRIERS) {
    for (let i = 0; i < ITEMS.length; i++) for (let j = i + 1; j < ITEMS.length; j++) {
      out.push({ a: carrier(ITEMS[i]), b: carrier(ITEMS[j]), label: 'mismatch', kind: 'entity_mismatch', category: 'entity_mismatch' })
    }
  }
  for (let i = 0; i < CITIES.length; i++) for (let j = i + 1; j < CITIES.length; j++) {
    out.push({ a: `She lives in ${CITIES[i]}.`, b: `She lives in ${CITIES[j]}.`, label: 'mismatch', kind: 'entity_mismatch', category: 'entity_mismatch' })
    out.push({ a: `I traveled to ${CITIES[i]}.`, b: `I traveled to ${CITIES[j]}.`, label: 'mismatch', kind: 'entity_mismatch', category: 'entity_mismatch' })
  }
  for (let i = 0; i < FOODS.length; i++) for (let j = i + 1; j < FOODS.length; j++) {
    out.push({ a: `Could I have ${FOODS[i]}, please?`, b: `Could I have ${FOODS[j]}, please?`, label: 'mismatch', kind: 'entity_mismatch', category: 'entity_mismatch' })
  }
  return out
}
function pairsTenseMismatch() {
  const out = []
  for (const subj of SUBJECTS) for (const v of VERBS) {
    out.push({ a: pres(subj, v), b: past(subj, v), label: 'mismatch', kind: 'tense_mismatch', category: 'tense_mismatch' })
    out.push({ a: pres(subj, v), b: future(subj, v), label: 'mismatch', kind: 'tense_mismatch', category: 'tense_mismatch' })
    out.push({ a: past(subj, v), b: future(subj, v), label: 'mismatch', kind: 'tense_mismatch', category: 'tense_mismatch' })
  }
  return out
}
function pairsPolarity() {
  const out = []
  const likes = ['coffee', 'tea', 'the plan', 'this city', 'the food', 'my job', 'the weather', 'football', 'the movie', 'this book', 'the idea', 'the music']
  for (const subj of ['I', 'We', 'They', 'You']) for (const x of likes) {
    out.push({ a: `${subj} like ${x}.`, b: `${subj} don't like ${x}.`, label: 'mismatch', kind: 'negation', category: 'opposite_polarity' })
  }
  for (const x of likes) {
    out.push({ a: `She likes ${x}.`, b: `She doesn't like ${x}.`, label: 'mismatch', kind: 'negation', category: 'opposite_polarity' })
  }
  return out
}
function pairsSameTopicDifferentIntent() {
  const out = []
  for (const f of FOODS) {
    const noun = f.replace(/^(a|some)\s/, '')
    out.push({ a: `Could I have ${f}, please?`, b: `The ${noun} is important.`, label: 'mismatch', kind: 'close_but_different', category: 'same_topic_different_intent' })
    out.push({ a: `Could I have ${f}, please?`, b: `I made ${f} yesterday.`, label: 'mismatch', kind: 'close_but_different', category: 'same_topic_different_intent' })
  }
  for (const c of CITIES) {
    out.push({ a: `Do you live in ${c}?`, b: `${c} is a big city.`, label: 'mismatch', kind: 'close_but_different', category: 'same_topic_different_intent' })
  }
  return out
}
function pairsValidParaphrase() {
  const req = [
    ['Could I have a coffee, please?', "I'd like a coffee, please."],
    ['Can I see the menu?', 'Could I look at the menu, please?'],
    ['Please open the window.', 'Would you open the window, please?'],
    ['Give me a hand, please.', 'Could you help me, please?'],
    ['I want to book a room.', "I'd like to reserve a room."],
    ['The meeting starts at nine.', 'The meeting begins at 9.'],
    ['He is a doctor.', 'He works as a physician.'],
    ['She is very tired.', 'She is exhausted.'],
    ['This is cheap.', 'This is inexpensive.'],
    ['I will call you tomorrow.', "I'm going to call you tomorrow."],
  ]
  return req.map(([a, b]) => ({ a, b, label: 'match', kind: 'intent_match', category: 'valid_paraphrase' }))
}
function pairsEquivalentScaled() {
  const out = []
  const advPairs = [['every day.', 'daily.'], ['often.', 'frequently.'], ['every week.', 'weekly.']]
  for (const subj of SUBJECTS) for (const v of VERBS) {
    const base = s3(subj) ? v.s : v.base
    for (const [x, y] of advPairs) {
      out.push({ a: `${subj} ${base} ${x}`, b: `${subj} ${base} ${y}`, label: 'match', kind: 'semantic_match', category: 'equivalent' })
    }
  }
  return out
}
function pairsRelatedNotEquivalent() {
  const out = []
  const domain = [
    ['The weather is nice today.', 'I need to fix my computer.'],
    ['Coffee is popular worldwide.', 'The train leaves at noon.'],
    ['She plays the piano.', 'The bank closes at five.'],
    ['I enjoy reading books.', 'He repaired the roof.'],
  ]
  for (const [a, b] of domain) out.push({ a, b, label: 'mismatch', kind: 'semantic_mismatch', category: 'related_not_equivalent' })
  for (let i = 0; i < FOODS.length; i++) {
    const other = FOODS[(i + 3) % FOODS.length]
    out.push({ a: `I love ${FOODS[i]}.`, b: `The price of ${other} went up.`, label: 'mismatch', kind: 'semantic_mismatch', category: 'related_not_equivalent' })
  }
  return out
}
function pairsAmbiguous() {
  // Near-duplicate surface, subtly different intent — labeled ambiguous; the
  // engine should NOT assert a confident match/mismatch here.
  const amb = [
    ['Can you swim?', 'Can I swim here?'],
    ['Do you have the time?', 'Do you have time?'],
    ['He left the room.', 'He left the room clean.'],
    ['Book the table.', 'Read the table.'],
  ]
  return amb.map(([a, b]) => ({ a, b, label: 'ambiguous', kind: 'ambiguous', category: 'ambiguous' }))
}

export const GENERATED_PAIRS = [
  ...pairsEntityMismatch(),
  ...pairsTenseMismatch(),
  ...pairsPolarity(),
  ...pairsSameTopicDifferentIntent(),
  ...pairsValidParaphrase(),
  ...pairsEquivalentScaled(),
  ...pairsRelatedNotEquivalent(),
  ...pairsAmbiguous(),
]

// Full labeled set (anchors + generated). `ambiguous` pairs are excluded from the
// binary match/mismatch metrics by the benchmark but reported separately.
export const ALL_PAIRS = [...SEMANTIC_PAIRS, ...GENERATED_PAIRS]

export const CATEGORY_COUNTS = ALL_PAIRS.reduce((m, p) => { m[p.category] = (m[p.category] || 0) + 1; return m }, {})
