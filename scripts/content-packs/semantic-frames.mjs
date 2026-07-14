// Slice 7.5A-R T20 — semantic frames, noun classes and verb–argument
// compatibility. Sentences are authored as bilingual PAIRS born from a
// communicative FRAME (theme → intent → frame → compatible verb+noun → EN+PT),
// never "generic pattern + generic verb + theme noun". Compatibility is checked
// at build time so combinations like "update the train station" are rejected
// before they can become a question.
//
// This file is data + pure helpers only — no engine/worker/USE/UI.

// ---------------------------------------------------------------------------
// 1) Noun classes — every noun carries a semantic class, the themes it belongs
//    to, the argument roles it can fill, and the actions it naturally accepts.
// ---------------------------------------------------------------------------
export const NOUN_CLASSES = {
  train_station: { en: 'train station', pt: 'estação de trem', ptGender: 'f', semantic_class: 'transport_location', themes: ['travel'], allowed_roles: ['location', 'destination', 'departure_point'], compatible_actions: ['find', 'get_to', 'arrive_at', 'leave_from', 'ask_location', 'show'] },
  airport: { en: 'airport', pt: 'aeroporto', ptGender: 'm', semantic_class: 'transport_location', themes: ['travel'], allowed_roles: ['location', 'destination', 'departure_point'], compatible_actions: ['find', 'get_to', 'arrive_at', 'go_to', 'show'] },
  platform: { en: 'platform', pt: 'plataforma', ptGender: 'f', semantic_class: 'transport_location', themes: ['travel'], allowed_roles: ['location'], compatible_actions: ['find', 'show', 'ask_location'] },
  ticket: { en: 'ticket', pt: 'passagem', ptGender: 'f', semantic_class: 'travel_document', themes: ['travel'], allowed_roles: ['document', 'purchase'], compatible_actions: ['buy', 'book', 'show', 'change'] },
  bus: { en: 'bus', pt: 'ônibus', ptGender: 'm', semantic_class: 'transport_vehicle', themes: ['travel'], allowed_roles: ['vehicle'], compatible_actions: ['leave', 'arrive', 'take', 'miss', 'catch'] },
  luggage: { en: 'luggage', pt: 'bagagem', ptGender: 'f', semantic_class: 'travel_item', themes: ['travel'], allowed_roles: ['possession'], compatible_actions: ['carry', 'pack', 'be_heavy', 'check'] },
  bags: { en: 'bags', pt: 'malas', ptGender: 'f', ptPlural: true, semantic_class: 'travel_item', themes: ['travel'], allowed_roles: ['possession'], compatible_actions: ['carry', 'pack', 'help_with'] },
  reservation: { en: 'reservation', pt: 'reserva', ptGender: 'f', semantic_class: 'booking', themes: ['travel', 'food_and_restaurants'], allowed_roles: ['booking'], compatible_actions: ['have', 'confirm', 'cancel', 'change', 'make'] },
  // workplace
  meeting_room: { en: 'meeting room', pt: 'sala de reunião', ptGender: 'f', semantic_class: 'work_location', themes: ['workplace'], allowed_roles: ['location'], compatible_actions: ['find', 'show', 'be'] },
  report: { en: 'report', pt: 'relatório', ptGender: 'm', semantic_class: 'work_document', themes: ['workplace'], allowed_roles: ['document'], compatible_actions: ['have', 'finish', 'send', 'review', 'be'] },
  meeting: { en: 'meeting', pt: 'reunião', ptGender: 'f', semantic_class: 'work_event', themes: ['workplace'], allowed_roles: ['event'], compatible_actions: ['start', 'have', 'schedule'] },
  task: { en: 'task', pt: 'tarefa', ptGender: 'f', semantic_class: 'work_task', themes: ['workplace'], allowed_roles: ['task'], compatible_actions: ['help', 'finish', 'have'] },
  email: { en: 'email', pt: 'e-mail', ptGender: 'm', semantic_class: 'message', themes: ['workplace', 'technology_and_communication'], allowed_roles: ['message'], compatible_actions: ['send', 'write', 'read'] },
  project: { en: 'project', pt: 'projeto', ptGender: 'm', semantic_class: 'work_project', themes: ['workplace'], allowed_roles: ['project'], compatible_actions: ['work', 'finish', 'start'] },
  manager: { en: 'manager', pt: 'gerente', ptGender: 'm', semantic_class: 'person', themes: ['workplace'], allowed_roles: ['person'], compatible_actions: ['call', 'help', 'tell', 'ask'] },
  // food_and_restaurants
  dish: { en: 'grilled chicken', pt: 'frango grelhado', ptGender: 'm', semantic_class: 'food_item', themes: ['food_and_restaurants'], allowed_roles: ['food'], compatible_actions: ['have', 'order', 'bring'] },
  soup: { en: 'soup', pt: 'sopa', ptGender: 'f', semantic_class: 'food_item', themes: ['food_and_restaurants'], allowed_roles: ['food'], compatible_actions: ['have', 'order', 'bring'] },
  menu: { en: 'menu', pt: 'cardápio', ptGender: 'm', semantic_class: 'restaurant_document', themes: ['food_and_restaurants'], allowed_roles: ['document'], compatible_actions: ['bring', 'show', 'have'] },
  table: { en: 'table', pt: 'mesa', ptGender: 'f', semantic_class: 'restaurant_table', themes: ['food_and_restaurants'], allowed_roles: ['booking'], compatible_actions: ['book', 'reserve', 'have'] },
  restaurant: { en: 'restaurant', pt: 'restaurante', ptGender: 'm', semantic_class: 'venue_location', themes: ['food_and_restaurants'], allowed_roles: ['location'], compatible_actions: ['find', 'open', 'be'] },
  order: { en: 'order', pt: 'pedido', ptGender: 'm', semantic_class: 'food_item', themes: ['food_and_restaurants'], allowed_roles: ['food'], compatible_actions: ['wait', 'have', 'bring'] },
  peanuts: { en: 'peanuts', pt: 'amendoim', ptGender: 'm', semantic_class: 'food_item', themes: ['food_and_restaurants'], allowed_roles: ['allergen'], compatible_actions: ['be'] },
}

// ---------------------------------------------------------------------------
// 2) Verb → compatible semantic classes (positive compatibility is the primary
//    guard). Plus explicit forbidden combinations that capture known regressions.
// ---------------------------------------------------------------------------
export const ACTION_COMPATIBILITY = {
  buy: ['travel_document', 'retail_product', 'food_item', 'drink_item'],
  book: ['travel_document', 'restaurant_table', 'hotel_room', 'service_slot'],
  reserve: ['restaurant_table', 'hotel_room', 'service_slot', 'travel_document'],
  leave: ['transport_vehicle'],
  show: ['transport_location', 'work_location', 'restaurant_document', 'travel_document'],
  have: ['booking', 'travel_item', 'travel_document', 'work_document', 'work_task', 'work_event', 'food_item', 'message', 'restaurant_table'],
  go: ['transport_location', 'work_location', 'venue_location'],
  help: ['person', 'travel_item', 'work_task'],
  carry: ['travel_item'],
  confirm: ['booking'],
  cancel: ['booking'],
  find: ['transport_location', 'work_location', 'venue_location'],
  finish: ['work_document', 'work_task', 'work_project'],
  send: ['work_document', 'message'],
  start: ['work_event', 'work_project'],
  work: ['work_project'],
  call: ['person'],
  bring: ['restaurant_document', 'food_item'],
  wait: ['food_item'],
  open: ['venue_location'],
  tell: ['person'],
  order: ['food_item', 'drink_item'],
}

export const FORBIDDEN_COMBINATIONS = [
  ['update', 'transport_location'],
  ['update', 'transport_vehicle'],
  ['download', 'food_item'],
  ['install', 'restaurant_table'],
  ['submit', 'transport_location'],
  ['review', 'food_item'],
  ['check', 'transport_location'], // "check the hotel today" style decoration
]

// verb–argument compatibility check used by the build validator
export function isCompatible(verb, nounId) {
  const noun = NOUN_CLASSES[nounId]
  if (!noun) return { ok: false, reason: `UNKNOWN_NOUN:${nounId}` }
  const cls = noun.semantic_class
  if (FORBIDDEN_COMBINATIONS.some(([v, c]) => v === verb && c === cls)) return { ok: false, reason: `FORBIDDEN:${verb}+${cls}` }
  // "be" is descriptive/existential — it combines with any entity ("the report
  // is ready", "the station is here", "I am allergic to peanuts").
  if (verb === 'be') return { ok: true }
  const positive = (ACTION_COMPATIBILITY[verb] || []).includes(cls) || (noun.compatible_actions || []).includes(verb)
  if (!positive) return { ok: false, reason: `INCOMPATIBLE:${verb}+${cls}` }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 3) Structural signature — normalizes an English target to its structure so
//    noun-swaps collapse together. Considers clause type, tense/aspect,
//    modality and polarity (T20 "Similaridade estrutural").
// ---------------------------------------------------------------------------
export function structuralSignature(en) {
  const s = ` ${String(en || '').toLowerCase().trim()} `
  const q = /\?\s*$/.test(en || '')
  let clause = 'statement'
  if (/^\s*(please\b|help\b|show\b|take\b|carry\b|call\b|bring\b)/i.test(en || '') && !q) clause = 'imperative'
  if (q && /^\s*(what|where|when|which|who|how|why)\b/i.test(en || '')) clause = 'wh_question'
  else if (q) clause = 'yesno_question'
  if (/\bif\b/.test(s)) clause = 'conditional'
  let tense = 'present_simple'
  if (/\bis\b|\bare\b|\bam\b/.test(s) && !/\bing\b/.test(s)) tense = 'be'
  if (/\b(am|is|are)\s+\w+ing\b/.test(s)) tense = 'present_continuous'
  if (/\bwas\b|\bwere\b|\b\w+ed\b/.test(s) && !/\bhave\b|\bhas\b/.test(s) && clause !== 'conditional') tense = 'past_simple'
  if (/\b(have|has)\s+been\s+\w+ing\b/.test(s)) tense = 'present_perfect_continuous'
  else if (/\b(have|has)\s+\w+(ed|en|t)\b/.test(s)) tense = 'present_perfect'
  if (/\bgoing to\b/.test(s)) tense = 'going_to'
  if (/\bwill\b/.test(s)) tense = 'will_future'
  if (/\bwas\s+\w+ed\s+by\b|\bis\s+\w+ed\s+by\b|\bwere\s+\w+ed\s+by\b/.test(s)) tense = 'passive'
  let modal = 'none'
  const m = s.match(/\b(can|could|would|should|must|may|might|want to|would like)\b/)
  if (m) modal = m[1].replace(' ', '_')
  const polarity = /\b(not|n't|never|no)\b/.test(s) ? 'neg' : 'aff'
  return `${clause}|${tense}|${modal}|${polarity}`
}

// ---------------------------------------------------------------------------
// 4) Frames — communicative situations. Each pilot frame is a fully realized
//    bilingual pair (slot pre-filled with ONE compatible noun) plus the
//    metadata the build validator checks.
// ---------------------------------------------------------------------------
// travel A1 — 8 intents, 8 structures, 6 lexical verbs.
const travel_A1 = [
  { frame_id: 'travel_ask_location', intent: 'ask_location', grammar: 'wh_question_be', pattern_id: 'wh_be_question', verb: 'be', noun: 'train_station', skill: 'question_structure',
    en: 'Where is the train station?', pt: 'Onde fica a estação de trem?', alt: ['Where is the train station, please?'], wrong: "Where the train station is?" },
  { frame_id: 'travel_buy_ticket', intent: 'buy_ticket', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'buy', noun: 'ticket', skill: 'simple_present',
    en: 'I want to buy a ticket to the city.', pt: 'Quero comprar uma passagem para a cidade.', alt: [], wrong: "I want buy a ticket to the city." },
  { frame_id: 'travel_ask_time', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'leave', noun: 'bus', skill: 'question_auxiliary',
    en: 'What time does the bus leave?', pt: 'Que horas o ônibus sai?', alt: [], wrong: "What time the bus leave?" },
  { frame_id: 'travel_find_platform', intent: 'find_platform', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'show', noun: 'platform', skill: 'can_request',
    en: 'Can you show me the platform?', pt: 'Você pode me mostrar a plataforma?', alt: ['Could you show me the platform?'], wrong: "You can show me the platform?" },
  { frame_id: 'travel_talk_luggage', intent: 'describe_luggage', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'luggage', skill: 'verb_to_be',
    en: 'My luggage is very heavy.', pt: 'Minha bagagem está muito pesada.', alt: [], wrong: "My luggage very heavy." },
  { frame_id: 'travel_confirm_reservation', intent: 'confirm_reservation', grammar: 'have_possession', pattern_id: 'subject_have_object', verb: 'have', noun: 'reservation', skill: 'simple_present',
    en: 'I have a reservation for tonight.', pt: 'Tenho uma reserva para hoje à noite.', alt: [], wrong: "I has a reservation for tonight." },
  { frame_id: 'travel_state_destination', intent: 'state_destination', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'go', noun: 'airport', skill: 'present_continuous',
    en: 'I am going to the airport now.', pt: 'Estou indo para o aeroporto agora.', alt: ["I'm going to the airport now."], wrong: "I going to the airport now." },
  { frame_id: 'travel_ask_help', intent: 'ask_help', grammar: 'imperative_request', pattern_id: 'imperative_request', verb: 'help', noun: 'bags', skill: 'can_request',
    en: 'Please help me with my bags.', pt: 'Por favor, me ajude com as malas.', alt: ['Can you help me with my bags?'], wrong: "Please helps me with my bags." },
]

// workplace A1 — 8 intents, 8 structures, ≥5 lexical verbs.
const workplace_A1 = [
  { frame_id: 'wp_ask_room', intent: 'ask_location', grammar: 'wh_question_be', pattern_id: 'wh_be_question', verb: 'be', noun: 'meeting_room', skill: 'question_structure',
    en: 'Where is the meeting room?', pt: 'Onde fica a sala de reunião?', alt: [], wrong: 'Where the meeting room is?' },
  { frame_id: 'wp_state_task', intent: 'state_task', grammar: 'have_possession', pattern_id: 'subject_have_object', verb: 'have', noun: 'report', skill: 'simple_present',
    en: 'I have a report to finish today.', pt: 'Tenho um relatório para terminar hoje.', alt: [], wrong: 'I has a report to finish today.' },
  { frame_id: 'wp_ask_meeting_time', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'start', noun: 'meeting', skill: 'question_auxiliary',
    en: 'What time does the meeting start?', pt: 'Que horas começa a reunião?', alt: [], wrong: 'What time the meeting start?' },
  { frame_id: 'wp_request_help', intent: 'request_help', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'help', noun: 'task', skill: 'can_request',
    en: 'Can you help me with this task?', pt: 'Você pode me ajudar com esta tarefa?', alt: ['Could you help me with this task?'], wrong: 'You can help me with this task?' },
  { frame_id: 'wp_describe_doc', intent: 'describe_status', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'report', skill: 'verb_to_be',
    en: 'The report is ready now.', pt: 'O relatório está pronto agora.', alt: [], wrong: 'The report ready now.' },
  { frame_id: 'wp_send_email', intent: 'state_intention', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'send', noun: 'email', skill: 'simple_present',
    en: 'I want to send the email now.', pt: 'Quero enviar o e-mail agora.', alt: [], wrong: 'I want send the email now.' },
  { frame_id: 'wp_working_now', intent: 'describe_activity', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'work', noun: 'project', skill: 'present_continuous',
    en: 'I am working on the project now.', pt: 'Estou trabalhando no projeto agora.', alt: ["I'm working on the project now."], wrong: 'I working on the project now.' },
  { frame_id: 'wp_ask_call', intent: 'ask_action', grammar: 'imperative_request', pattern_id: 'imperative_request', verb: 'call', noun: 'manager', skill: 'can_request',
    en: 'Please call the manager after the meeting.', pt: 'Por favor, ligue para o gerente depois da reunião.', alt: [], wrong: 'Please calls the manager after the meeting.' },
]

// food_and_restaurants A1 — 8 intents, 8 structures, ≥5 lexical verbs.
const food_A1 = [
  { frame_id: 'food_order_dish', intent: 'order_food', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'have', noun: 'dish', skill: 'can_request',
    en: 'Can I have the grilled chicken, please?', pt: 'Posso comer o frango grelhado, por favor?', alt: [], wrong: 'I can have the grilled chicken, please?' },
  { frame_id: 'food_ask_ingredient', intent: 'ask_ingredient', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'soup', skill: 'question_auxiliary',
    en: 'Does this soup have milk?', pt: 'Esta sopa tem leite?', alt: [], wrong: 'This soup have milk?' },
  { frame_id: 'food_inform_restriction', intent: 'inform_restriction', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'peanuts', skill: 'verb_to_be',
    en: 'I am allergic to peanuts.', pt: 'Sou alérgico a amendoim.', alt: ["I'm allergic to peanuts."], wrong: 'I allergic to peanuts.' },
  { frame_id: 'food_ask_menu', intent: 'ask_menu', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'bring', noun: 'menu', skill: 'can_request',
    en: 'Could you bring the menu?', pt: 'Você poderia trazer o cardápio?', alt: ['Can you bring the menu?'], wrong: 'You could bring the menu?' },
  { frame_id: 'food_reserve_table', intent: 'reserve_table', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'book', noun: 'table', skill: 'simple_present',
    en: 'I want to book a table for two.', pt: 'Quero reservar uma mesa para dois.', alt: [], wrong: 'I want book a table for two.' },
  { frame_id: 'food_ask_location', intent: 'ask_location', grammar: 'wh_question_be', pattern_id: 'wh_be_question', verb: 'be', noun: 'restaurant', skill: 'question_structure',
    en: 'Where is the restaurant?', pt: 'Onde fica o restaurante?', alt: [], wrong: 'Where the restaurant is?' },
  { frame_id: 'food_waiting', intent: 'describe_activity', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'wait', noun: 'order', skill: 'present_continuous',
    en: 'I am waiting for my order.', pt: 'Estou esperando meu pedido.', alt: ["I'm waiting for my order."], wrong: 'I waiting for my order.' },
  { frame_id: 'food_ask_hours', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'open', noun: 'restaurant', skill: 'question_auxiliary',
    en: 'What time does the restaurant open?', pt: 'Que horas o restaurante abre?', alt: [], wrong: 'What time the restaurant open?' },
]

export const FRAMES = {
  travel: { A1: travel_A1 },
  workplace: { A1: workplace_A1 },
  food_and_restaurants: { A1: food_A1 },
}

// Does a frame set exist for this theme×level?
export function framesFor(theme, level) {
  return FRAMES[theme]?.[level] || null
}
