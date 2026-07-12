// semantic-calibration-corpus.mjs — labeled pairs to calibrate the semantic
// encoder. Each pair is either an intent/meaning MATCH (should rank high) or a
// MISMATCH (should rank lower), including hard negatives that share a topic word
// but differ in intent/meaning.

export const SEMANTIC_PAIRS = [
  // intent match — polite requests
  { a: 'Please give me a dessert.', b: 'Could I have something sweet, please?', label: 'match', kind: 'intent_match' },
  { a: 'Could I have a coffee, please?', b: "I'd like a coffee, please.", label: 'match', kind: 'intent_match' },
  { a: 'Can I see the menu?', b: 'Could I look at the menu, please?', label: 'match', kind: 'intent_match' },
  // topic overlap but DIFFERENT intent/meaning (hard negatives)
  { a: 'Please give me a dessert.', b: 'The dessert is important.', label: 'mismatch', kind: 'close_but_different' },
  { a: 'Could I have a coffee?', b: 'Coffee is bad for your health.', label: 'mismatch', kind: 'close_but_different' },
  { a: 'I want to book a flight.', b: 'The flight was three hours late.', label: 'mismatch', kind: 'close_but_different' },
  // negation flips meaning
  { a: 'I like coffee.', b: "I don't like coffee.", label: 'mismatch', kind: 'negation' },
  { a: 'She is happy.', b: 'She is not happy at all.', label: 'mismatch', kind: 'negation' },
  // entity mismatch
  { a: 'I have a car.', b: 'I have a bike.', label: 'mismatch', kind: 'entity_mismatch' },
  { a: 'She lives in London.', b: 'She lives in Paris.', label: 'mismatch', kind: 'entity_mismatch' },
  // tense mismatch
  { a: 'I work here.', b: 'I worked here.', label: 'mismatch', kind: 'tense_mismatch' },
  // clear semantic match
  { a: 'The meeting starts at nine.', b: 'The meeting begins at 9.', label: 'match', kind: 'semantic_match' },
  { a: 'He is a doctor.', b: 'He works as a physician.', label: 'match', kind: 'semantic_match' },
  // clear mismatch
  { a: 'The weather is nice today.', b: 'I need to fix my computer.', label: 'mismatch', kind: 'semantic_mismatch' },
]
