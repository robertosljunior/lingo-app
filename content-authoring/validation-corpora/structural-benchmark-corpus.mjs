// structural-benchmark-corpus.mjs — labeled corpus (>300) for comparing
// structural NLP engines. Each case carries the gold structural facts the
// pedagogical pipeline actually consumes: sentence_type, has_auxiliary,
// has_negation, third_singular_subject. Generated from templates across the
// required linguistic categories so the set is reproducible and large.

const SUBJECTS_3SG = ['he', 'she', 'it']
const SUBJECTS_PL = ['they', 'we', 'you', 'I']
const VERBS = ['work', 'play', 'study', 'run', 'read', 'cook', 'travel', 'call', 'help', 'walk']
const OBJ = ['here', 'every day', 'at home', 'with friends', 'in the morning', 'after lunch', 'on weekends', 'quietly']

const cases = []
const add = (text, labels, category) => cases.push({ text, category, labels })

// Correct simple-present statements (3sg vs plural agreement).
for (const s of SUBJECTS_3SG) for (const v of VERBS) add(`${cap(s)} ${v}s ${pick(OBJ)}.`, L({ type: 'statement', third: true }), 'correct')
for (const s of SUBJECTS_PL) for (const v of VERBS) add(`${cap(s)} ${v} ${pick(OBJ)}.`, L({ type: 'statement', third: false }), 'correct')

// Typical Brazilian-learner errors (missing -s).
for (const s of SUBJECTS_3SG) for (const v of VERBS) add(`${cap(s)} ${v} ${pick(OBJ)}.`, L({ type: 'statement', third: true }), 'grammar_error')

// Questions with do/does/did.
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 5)) add(`Do ${s} ${v} ${pick(OBJ)}?`, L({ type: 'question', aux: true }), 'question')
for (const s of SUBJECTS_3SG) for (const v of VERBS.slice(0, 5)) add(`Does ${s} ${v} ${pick(OBJ)}?`, L({ type: 'question', aux: true, third: true }), 'question')
for (const s of [...SUBJECTS_3SG, ...SUBJECTS_PL]) for (const v of VERBS.slice(0, 4)) add(`Did ${s} ${v}?`, L({ type: 'question', aux: true }), 'question')

// Negations + contractions.
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 4)) add(`${cap(s)} do not ${v}.`, L({ type: 'statement', aux: true, neg: true }), 'negation')
for (const s of SUBJECTS_3SG) for (const v of VERBS.slice(0, 4)) add(`${cap(s)} doesn't ${v}.`, L({ type: 'statement', aux: true, neg: true, third: true }), 'negation')
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 3)) add(`${cap(s)} can't ${v} today.`, L({ type: 'statement', aux: true, neg: true }), 'negation')
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 3)) add(`${cap(s)} never ${v} ${pick(OBJ)}.`, L({ type: 'statement', neg: true }), 'negation')

// Present perfect / continuous.
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 4)) add(`${cap(s)} have ${v}ed here before.`, L({ type: 'statement', aux: true }), 'present_perfect')
for (const s of SUBJECTS_3SG) for (const v of VERBS.slice(0, 4)) add(`${cap(s)} has ${v}ed here before.`, L({ type: 'statement', aux: true, third: true }), 'present_perfect')
for (const s of SUBJECTS_3SG) for (const v of VERBS.slice(0, 4)) add(`${cap(s)} is ${v}ing now.`, L({ type: 'statement', aux: true, third: true }), 'present_perfect_continuous')
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 4)) add(`${cap(s)} have been ${v}ing all day.`, L({ type: 'statement', aux: true }), 'present_perfect_continuous')

// Imperatives / requests.
for (const v of ['Give', 'Bring', 'Show', 'Tell', 'Pass', 'Send']) add(`${v} me the menu, please.`, L({ type: 'imperative' }), 'request')
for (const v of ['have', 'see', 'get', 'take', 'order']) add(`Could I ${v} a coffee, please?`, L({ type: 'question', aux: true }), 'polite_request')
for (const v of ['have', 'get', 'order']) add(`I'd like to ${v} a coffee, please.`, L({ type: 'statement' }), 'polite_request')

// Prepositions (context-dependent, all valid).
for (const p of ['at the station', 'in the office', 'on the bus', 'at work', 'in July', 'on Monday', 'at home', 'in Brazil', 'on the table', 'at school']) add(`I am ${p}.`, L({ type: 'statement', aux: true }), 'preposition')

// Short/fragments/ambiguous.
for (const f of ['Yes.', 'Maybe later.', 'On the table.', 'Coffee, please.', 'Not now.', 'Of course.', 'Right there.', 'By the door.']) add(f, L({ type: 'statement', neg: /not/i.test(f) }), 'fragment')
for (const a of ['Book a flight.', 'Water.', 'Time to go.', 'A big problem.', 'The red one.']) add(a, L({ type: /^book/i.test(a) ? 'imperative' : 'statement' }), 'ambiguous')

// Modals.
for (const s of [...SUBJECTS_3SG, ...SUBJECTS_PL]) for (const m of ['can', 'should', 'must', 'might']) add(`${cap(s)} ${m} ${pick(VERBS)} ${pick(OBJ)}.`, L({ type: 'statement', aux: true, third: /^(he|she|it)$/i.test(s) }), 'modal')
for (const s of SUBJECTS_PL) add(`Can ${s} ${pick(VERBS)} here?`, L({ type: 'question', aux: true }), 'modal')

// Passive voice.
for (const subj of ['The report', 'The house', 'The email', 'The project']) for (const v of ['approved', 'finished', 'sent', 'built']) add(`${subj} was ${v} yesterday.`, L({ type: 'statement', aux: true, third: true }), 'passive')
for (const subj of ['The reports', 'The houses', 'The emails']) for (const v of ['approved', 'finished', 'sent']) add(`${subj} were ${v} last week.`, L({ type: 'statement', aux: true }), 'passive')

// Phrasal verbs.
for (const s of SUBJECTS_PL) for (const pv of ['pick up the kids', 'turn off the lights', 'look after the dog', 'give up smoking']) add(`${cap(s)} ${pv} ${pick(OBJ)}.`, L({ type: 'statement' }), 'phrasal_verb')
for (const s of SUBJECTS_3SG) for (const pv of ['picks up the kids', 'turns off the lights', 'looks after the dog']) add(`${cap(s)} ${pv}.`, L({ type: 'statement', third: true }), 'phrasal_verb')

// Non-native learner errors (extra category, still structurally labeled).
for (const s of SUBJECTS_3SG) add(`${cap(s)} don't ${pick(VERBS)}.`, L({ type: 'statement', aux: true, neg: true, third: true }), 'non_native_error')
for (const s of SUBJECTS_PL) add(`${cap(s)} is ${pick(VERBS)} every day.`, L({ type: 'statement', aux: true }), 'non_native_error')
for (const s of SUBJECTS_3SG) add(`Does ${s} ${pick(VERBS)}s here?`, L({ type: 'question', aux: true, third: true }), 'non_native_error')

// Wh-questions.
for (const wh of ['What', 'Where', 'When', 'Why', 'How']) for (const s of SUBJECTS_PL.slice(0, 3)) add(`${wh} do ${s} ${pick(VERBS)}?`, L({ type: 'question', aux: true }), 'question')
for (const wh of ['What', 'Where', 'When']) for (const s of SUBJECTS_3SG) add(`${wh} does ${s} ${pick(VERBS)}?`, L({ type: 'question', aux: true, third: true }), 'question')

// Polite requests / offers (A2–B1).
for (const item of ['a coffee', 'the menu', 'some water', 'the bill', 'a table']) add(`Could I have ${item}, please?`, L({ type: 'question', aux: true }), 'request')
for (const item of ['a coffee', 'the menu', 'some water']) add(`Would you like ${item}?`, L({ type: 'question', aux: true }), 'request')

// Present continuous statements + questions (A1–A2).
for (const s of SUBJECTS_3SG) for (const v of VERBS.slice(0, 5)) add(`${cap(s)} is ${v}ing right now.`, L({ type: 'statement', aux: true, third: true }), 'present_continuous')
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 5)) add(`${cap(s)} are ${v}ing right now.`, L({ type: 'statement', aux: true }), 'present_continuous')
for (const s of SUBJECTS_PL) for (const v of VERBS.slice(0, 4)) add(`Are ${s} ${v}ing today?`, L({ type: 'question', aux: true }), 'present_continuous')

// Leveled everyday sentences (A1–B2), all valid declaratives.
for (const t of [
  'I like pizza.', 'She has two cats.', 'We live in a small town.', 'They study English on Mondays.',
  'He is a teacher.', 'The coffee is hot.', 'My brother works at a bank.', 'I usually wake up early.',
  'She has been working here for years.', 'We had already finished when they arrived.',
  'If it rains, we will stay home.', 'The book was written by a famous author.',
  'I would rather travel by train.', 'He suggested that we leave early.',
  'The children are playing outside.', 'This restaurant serves great food.',
  'I have never been to Japan.', 'She could speak three languages.',
]) add(t, L({ type: 'statement', aux: /\b(is|are|was|were|has|have|had|will|would|could|been)\b/i.test(t), third: /^(he|she|it|the|my|she|his|this)\b/i.test(t) && !/^(we|they|i)\b/i.test(t) }), 'leveled')

function L({ type, aux = false, neg = false, third = false }) {
  return { sentence_type: type === 'imperative' ? 'imperative' : type, has_auxiliary: aux, has_negation: neg, third_singular_subject: third }
}
function cap(s) { return s === 'i' ? 'I' : s[0].toUpperCase() + s.slice(1) }
function pick(arr) { return arr[cases.length % arr.length] }

export const STRUCTURAL_CORPUS = cases
