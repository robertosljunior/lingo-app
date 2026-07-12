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

function L({ type, aux = false, neg = false, third = false }) {
  return { sentence_type: type === 'imperative' ? 'imperative' : type, has_auxiliary: aux, has_negation: neg, third_singular_subject: third }
}
function cap(s) { return s === 'i' ? 'I' : s[0].toUpperCase() + s.slice(1) }
function pick(arr) { return arr[cases.length % arr.length] }

export const STRUCTURAL_CORPUS = cases
