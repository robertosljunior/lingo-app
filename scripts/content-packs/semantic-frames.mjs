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
  hotel: { en: 'hotel', pt: 'hotel', ptGender: 'm', semantic_class: 'accommodation', themes: ['travel'], allowed_roles: ['location', 'booking'], compatible_actions: ['book', 'stay', 'be', 'have'] },
  passport: { en: 'passport', pt: 'passaporte', ptGender: 'm', semantic_class: 'travel_document', themes: ['travel'], allowed_roles: ['document'], compatible_actions: ['lose', 'show', 'have', 'forget'] },
  flight: { en: 'flight', pt: 'voo', ptGender: 'm', semantic_class: 'transport_service', themes: ['travel'], allowed_roles: ['service'], compatible_actions: ['arrive', 'leave', 'book', 'miss', 'cancel', 'be'] },
  taxi: { en: 'taxi', pt: 'táxi', ptGender: 'm', semantic_class: 'transport_vehicle', themes: ['travel'], allowed_roles: ['vehicle'], compatible_actions: ['call', 'take', 'be'] },
  museum: { en: 'museum', pt: 'museu', ptGender: 'm', semantic_class: 'venue_location', themes: ['travel'], allowed_roles: ['location'], compatible_actions: ['visit', 'find', 'open', 'be'] },
  coast: { en: 'coast', pt: 'litoral', ptGender: 'm', semantic_class: 'venue_location', themes: ['travel'], allowed_roles: ['location'], compatible_actions: ['visit', 'be'] },
  city: { en: 'city', pt: 'cidade', ptGender: 'f', semantic_class: 'venue_location', themes: ['travel'], allowed_roles: ['location'], compatible_actions: ['visit', 'be'] },
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
  // workplace A2-B2 additions
  office: { en: 'office', pt: 'escritório', ptGender: 'm', semantic_class: 'work_location', themes: ['workplace'], allowed_roles: ['location'], compatible_actions: ['find', 'show', 'be'] },
  printer: { en: 'printer', pt: 'impressora', ptGender: 'f', semantic_class: 'work_equipment', themes: ['workplace'], allowed_roles: ['equipment'], compatible_actions: ['have', 'use', 'fix'] },
  client: { en: 'client', pt: 'cliente', ptGender: 'm', semantic_class: 'person', themes: ['workplace'], allowed_roles: ['person'], compatible_actions: ['call', 'help', 'tell', 'meet'] },
  presentation: { en: 'presentation', pt: 'apresentação', ptGender: 'f', semantic_class: 'work_document', themes: ['workplace'], allowed_roles: ['document'], compatible_actions: ['finish', 'give', 'prepare', 'be'] },
  contract: { en: 'contract', pt: 'contrato', ptGender: 'm', semantic_class: 'work_document', themes: ['workplace'], allowed_roles: ['document'], compatible_actions: ['send', 'review', 'sign'] },
  // food_and_restaurants A2-B2 additions
  waiter: { en: 'waiter', pt: 'garçom', ptGender: 'm', semantic_class: 'person', themes: ['food_and_restaurants'], allowed_roles: ['person'], compatible_actions: ['ask', 'wait', 'tell'] },
  bill: { en: 'bill', pt: 'conta', ptGender: 'f', semantic_class: 'restaurant_document', themes: ['food_and_restaurants'], allowed_roles: ['document'], compatible_actions: ['bring', 'check'] },
  dessert: { en: 'dessert', pt: 'sobremesa', ptGender: 'f', semantic_class: 'food_item', themes: ['food_and_restaurants'], allowed_roles: ['food'], compatible_actions: ['order', 'finish', 'be'] },
  salad: { en: 'salad', pt: 'salada', ptGender: 'f', semantic_class: 'food_item', themes: ['food_and_restaurants'], allowed_roles: ['food'], compatible_actions: ['have', 'order'] },
  fish: { en: 'fish', pt: 'peixe', ptGender: 'm', semantic_class: 'food_item', themes: ['food_and_restaurants'], allowed_roles: ['food'], compatible_actions: ['try', 'order'] },
  drinks: { en: 'drinks', pt: 'bebidas', ptGender: 'f', ptPlural: true, semantic_class: 'drink_item', themes: ['food_and_restaurants'], allowed_roles: ['food'], compatible_actions: ['forget', 'bring', 'order'] },
  // daily_life
  house: { en: 'house', pt: 'casa', ptGender: 'f', semantic_class: 'home_location', themes: ['daily_life'], allowed_roles: ['location'], compatible_actions: ['be', 'buy', 'clean'] },
  kitchen: { en: 'kitchen', pt: 'cozinha', ptGender: 'f', semantic_class: 'home_location', themes: ['daily_life'], allowed_roles: ['location'], compatible_actions: ['clean', 'be'] },
  keys: { en: 'keys', pt: 'chaves', ptGender: 'f', ptPlural: true, semantic_class: 'household_item', themes: ['daily_life'], allowed_roles: ['possession'], compatible_actions: ['be', 'lose', 'forget', 'find'] },
  neighbor: { en: 'neighbor', pt: 'vizinho', ptGender: 'm', semantic_class: 'person', themes: ['daily_life'], allowed_roles: ['person'], compatible_actions: ['talk', 'help', 'tell', 'ask'] },
  groceries: { en: 'groceries', pt: 'compras', ptGender: 'f', ptPlural: true, semantic_class: 'household_item', themes: ['daily_life'], allowed_roles: ['possession'], compatible_actions: ['help', 'carry', 'buy'] },
  laundry: { en: 'laundry', pt: 'roupa lavada', ptGender: 'f', semantic_class: 'household_task', themes: ['daily_life'], allowed_roles: ['task'], compatible_actions: ['do', 'help', 'finish'] },
  door: { en: 'door', pt: 'porta', ptGender: 'f', semantic_class: 'household_item', themes: ['daily_life'], allowed_roles: ['possession'], compatible_actions: ['lock', 'fix', 'open'] },
  dinner: { en: 'dinner', pt: 'jantar', ptGender: 'm', semantic_class: 'meal_item', themes: ['daily_life'], allowed_roles: ['food'], compatible_actions: ['cook', 'have'] },
  dog: { en: 'dog', pt: 'cachorro', ptGender: 'm', semantic_class: 'pet', themes: ['daily_life'], allowed_roles: ['possession'], compatible_actions: ['have', 'be'] },
  package: { en: 'package', pt: 'pacote', ptGender: 'm', semantic_class: 'household_item', themes: ['daily_life'], allowed_roles: ['possession'], compatible_actions: ['be'] },
  neighborhood: { en: 'neighborhood', pt: 'bairro', ptGender: 'm', semantic_class: 'home_location', themes: ['daily_life'], allowed_roles: ['location'], compatible_actions: ['be'] },
  // shopping_and_services
  store: { en: 'store', pt: 'loja', ptGender: 'f', semantic_class: 'retail_location', themes: ['shopping_and_services'], allowed_roles: ['location'], compatible_actions: ['be', 'close', 'find'] },
  shirt: { en: 'shirt', pt: 'camisa', ptGender: 'f', semantic_class: 'retail_product', themes: ['shopping_and_services'], allowed_roles: ['purchase'], compatible_actions: ['buy', 'exchange'] },
  price: { en: 'price', pt: 'preço', ptGender: 'm', semantic_class: 'retail_item', themes: ['shopping_and_services'], allowed_roles: ['attribute'], compatible_actions: ['be', 'check'] },
  size: { en: 'size', pt: 'tamanho', ptGender: 'm', semantic_class: 'retail_item', themes: ['shopping_and_services'], allowed_roles: ['attribute'], compatible_actions: ['help', 'be'] },
  card: { en: 'card', pt: 'cartão', ptGender: 'm', semantic_class: 'payment_item', themes: ['shopping_and_services'], allowed_roles: ['payment'], compatible_actions: ['pay'] },
  line: { en: 'line', pt: 'fila', ptGender: 'f', semantic_class: 'retail_queue', themes: ['shopping_and_services'], allowed_roles: ['location'], compatible_actions: ['wait', 'be'] },
  receipt: { en: 'receipt', pt: 'recibo', ptGender: 'm', semantic_class: 'retail_document', themes: ['shopping_and_services'], allowed_roles: ['document'], compatible_actions: ['show', 'lose', 'keep'] },
  item: { en: 'item', pt: 'item', ptGender: 'm', semantic_class: 'retail_product', themes: ['shopping_and_services'], allowed_roles: ['purchase'], compatible_actions: ['return', 'pay'] },
  discount: { en: 'discount', pt: 'desconto', ptGender: 'm', semantic_class: 'retail_item', themes: ['shopping_and_services'], allowed_roles: ['attribute'], compatible_actions: ['have', 'ask', 'forget'] },
  delivery: { en: 'delivery', pt: 'entrega', ptGender: 'f', semantic_class: 'retail_service', themes: ['shopping_and_services'], allowed_roles: ['service'], compatible_actions: ['arrive', 'pay'] },
  refund: { en: 'refund', pt: 'reembolso', ptGender: 'm', semantic_class: 'retail_service', themes: ['shopping_and_services'], allowed_roles: ['service'], compatible_actions: ['ask'] },
  cash: { en: 'cash', pt: 'dinheiro', ptGender: 'm', semantic_class: 'payment_item', themes: ['shopping_and_services'], allowed_roles: ['payment'], compatible_actions: ['pay'] },
  shoes: { en: 'shoes', pt: 'sapatos', ptGender: 'm', ptPlural: true, semantic_class: 'retail_product', themes: ['shopping_and_services'], allowed_roles: ['purchase'], compatible_actions: ['buy'] },
  // technology_and_communication
  phone: { en: 'phone', pt: 'celular', ptGender: 'm', semantic_class: 'device', themes: ['technology_and_communication'], allowed_roles: ['possession'], compatible_actions: ['be', 'charge', 'lose'] },
  app: { en: 'app', pt: 'aplicativo', ptGender: 'm', semantic_class: 'software', themes: ['technology_and_communication'], allowed_roles: ['software'], compatible_actions: ['update', 'crash'] },
  video_call: { en: 'video call', pt: 'videochamada', ptGender: 'f', semantic_class: 'communication_event', themes: ['technology_and_communication'], allowed_roles: ['event'], compatible_actions: ['start', 'finish'] },
  password: { en: 'password', pt: 'senha', ptGender: 'f', semantic_class: 'credential', themes: ['technology_and_communication'], allowed_roles: ['credential'], compatible_actions: ['help', 'forget', 'change'] },
  battery: { en: 'battery', pt: 'bateria', ptGender: 'f', semantic_class: 'device_part', themes: ['technology_and_communication'], allowed_roles: ['attribute'], compatible_actions: ['be', 'have'] },
  signal: { en: 'signal', pt: 'sinal', ptGender: 'm', semantic_class: 'connectivity_service', themes: ['technology_and_communication'], allowed_roles: ['service'], compatible_actions: ['check', 'be', 'fix'] },
  laptop: { en: 'laptop', pt: 'notebook', ptGender: 'm', semantic_class: 'device', themes: ['technology_and_communication'], allowed_roles: ['possession'], compatible_actions: ['be', 'use'] },
  files: { en: 'files', pt: 'arquivos', ptGender: 'm', ptPlural: true, semantic_class: 'digital_file', themes: ['technology_and_communication'], allowed_roles: ['possession'], compatible_actions: ['save'] },
  photos: { en: 'photos', pt: 'fotos', ptGender: 'f', ptPlural: true, semantic_class: 'digital_file', themes: ['technology_and_communication'], allowed_roles: ['possession'], compatible_actions: ['take'] },
}

// ---------------------------------------------------------------------------
// 2) Verb → compatible semantic classes (positive compatibility is the primary
//    guard). Plus explicit forbidden combinations that capture known regressions.
// ---------------------------------------------------------------------------
export const ACTION_COMPATIBILITY = {
  book: ['travel_document', 'restaurant_table', 'hotel_room', 'service_slot'],
  reserve: ['restaurant_table', 'hotel_room', 'service_slot', 'travel_document'],
  leave: ['transport_vehicle'],
  show: ['transport_location', 'work_location', 'restaurant_document', 'travel_document', 'retail_document'],
  have: ['booking', 'travel_item', 'travel_document', 'work_document', 'work_task', 'work_event', 'food_item', 'message', 'restaurant_table', 'work_equipment', 'meal_item', 'pet', 'device_part', 'retail_item'],
  go: ['transport_location', 'work_location', 'venue_location'],
  help: ['person', 'travel_item', 'work_task', 'household_item', 'household_task', 'retail_item', 'credential'],
  carry: ['travel_item'],
  confirm: ['booking'],
  finish: ['work_document', 'work_task', 'work_project', 'food_item', 'household_task', 'communication_event'],
  send: ['work_document', 'message'],
  work: ['work_project', 'work_task'],
  call: ['person'],
  bring: ['restaurant_document', 'food_item'],
  wait: ['food_item', 'transport_vehicle', 'transport_service', 'person', 'retail_queue'],
  open: ['venue_location'],
  tell: ['person'],
  order: ['food_item', 'drink_item'],
  arrive: ['transport_service', 'transport_vehicle', 'transport_location', 'venue_location', 'food_item', 'retail_service'],
  stay: ['accommodation'],
  visit: ['venue_location', 'transport_location'],
  travel: ['transport_vehicle', 'transport_service'],
  take: ['transport_vehicle', 'digital_file'],
  miss: ['transport_service', 'transport_vehicle'],
  spend: ['venue_location'],
  cancel_service: ['transport_service'],
  cancel: ['booking', 'work_event'],
  check: ['booking', 'work_document', 'restaurant_document', 'message', 'retail_item', 'connectivity_service'],
  forget: ['travel_document', 'work_document', 'food_item', 'drink_item', 'household_item', 'credential', 'retail_item'],
  lose: ['travel_document', 'travel_item', 'work_document', 'household_item', 'retail_document', 'device'],
  lead: ['work_event'],
  talk: ['person'],
  review: ['work_document'],
  read: ['message'],
  start: ['work_event', 'work_project', 'communication_event'],
  buy: ['travel_document', 'retail_product', 'food_item', 'drink_item', 'home_location'],
  find: ['transport_location', 'work_location', 'venue_location', 'household_item'],
  try: ['food_item'],
  ask: ['person', 'retail_item', 'retail_service'],
  replace: ['food_item'],
  give: ['work_document'],
  clean: ['home_location', 'household_item'],
  cook: ['meal_item'],
  do: ['household_task'],
  lock: ['household_item'],
  fix: ['household_item', 'connectivity_service'],
  close: ['retail_location', 'venue_location'],
  pay: ['payment_item', 'retail_service'],
  return: ['retail_product'],
  exchange: ['retail_product'],
  keep: ['retail_document'],
  update: ['software'],
  charge: ['device'],
  change: ['credential', 'travel_document'],
  save: ['digital_file'],
  use: ['device', 'work_equipment'],
  take: ['transport_vehicle', 'digital_file'],
  crash: ['software'],
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
  // "be" is descriptive/existential and clausal verbs (say/think) take a whole
  // clause, not the theme noun as a direct argument — always compatible.
  if (['be', 'say', 'think'].includes(verb)) return { ok: true }
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
  const m = s.match(/\b(would like|want to|can|could|would|should|must|may|might)\b/)
  if (m) modal = m[1].replace(' ', '_')
  const polarity = /\b(not|n't|never|no)\b/.test(s) ? 'neg' : 'aff'
  // Construction dimension: distinguishes structures the tense axis alone misses
  // (comparatives, existentials, reported speech, conditionals).
  let cons = 'plain'
  if (/\bthan\b/.test(s)) cons = 'comparative'
  else if (/^\s*there\s+(is|are|was|were)\b/i.test(en || '')) cons = 'existential'
  else if (/\b(said|told|asked)\s+(that|me|him|her|us|them)?\b/.test(s)) cons = 'reported'
  else if (clause === 'conditional') cons = /\bwould\b/.test(s) ? 'second_conditional' : 'first_conditional'
  return `${clause}|${tense}|${modal}|${polarity}|${cons}`
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
    en: 'I want to buy a ticket to the city.', pt: 'Quero comprar uma passagem para a cidade.', alt: ["I'd like to buy a ticket to the city.", "I would like to buy a ticket to the city."], wrong: "I want buy a ticket to the city." },
  { frame_id: 'travel_ask_time', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'leave', noun: 'bus', skill: 'question_auxiliary',
    en: 'What time does the bus leave?', pt: 'Que horas o ônibus sai?', alt: [], wrong: "What time the bus leave?" },
  { frame_id: 'travel_find_platform', intent: 'find_platform', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'show', noun: 'platform', skill: 'can_request',
    en: 'Can you show me the platform?', pt: 'Você pode me mostrar a plataforma?', alt: ['Could you show me the platform?'], wrong: "You can show me the platform?" },
  { frame_id: 'travel_talk_luggage', intent: 'describe_luggage', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'luggage', skill: 'verb_to_be',
    en: 'My luggage is very heavy.', pt: 'Minha bagagem está muito pesada.', alt: [], wrong: "My luggage very heavy." },
  { frame_id: 'travel_confirm_reservation', intent: 'confirm_reservation', grammar: 'have_possession', pattern_id: 'subject_have_object', verb: 'have', noun: 'reservation', skill: 'simple_present',
    en: 'I have a reservation for tonight.', pt: 'Tenho uma reserva para hoje à noite.', alt: ["I've got a reservation for tonight."], wrong: "I has a reservation for tonight." },
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
    en: 'The report is ready now.', pt: 'O relatório está pronto agora.', alt: ['The report is finished now.', 'The report is done now.', 'The report is ready.'], wrong: 'The report ready now.' },
  { frame_id: 'wp_send_email', intent: 'state_intention', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'send', noun: 'email', skill: 'simple_present',
    en: 'I want to send the email now.', pt: 'Quero enviar o e-mail agora.', alt: ["I'd like to send the email now."], wrong: 'I want send the email now.' },
  { frame_id: 'wp_working_now', intent: 'describe_activity', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'work', noun: 'project', skill: 'present_continuous',
    en: 'I am working on the project now.', pt: 'Estou trabalhando no projeto agora.', alt: ["I'm working on the project now."], wrong: 'I working on the project now.' },
  { frame_id: 'wp_ask_call', intent: 'ask_action', grammar: 'imperative_request', pattern_id: 'imperative_request', verb: 'call', noun: 'manager', skill: 'can_request',
    en: 'Please call the manager after the meeting.', pt: 'Por favor, ligue para o gerente depois da reunião.', alt: [], wrong: 'Please calls the manager after the meeting.' },
]

// food_and_restaurants A1 — 8 intents, 8 structures, ≥5 lexical verbs.
const food_A1 = [
  { frame_id: 'food_order_dish', intent: 'order_food', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'have', noun: 'dish', skill: 'can_request',
    en: 'Can I have the grilled chicken, please?', pt: 'Posso comer o frango grelhado, por favor?', alt: ["Could I have the grilled chicken, please?"], wrong: 'I can have the grilled chicken, please?' },
  { frame_id: 'food_ask_ingredient', intent: 'ask_ingredient', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'soup', skill: 'question_auxiliary',
    en: 'Does this soup have milk?', pt: 'Esta sopa tem leite?', alt: [], wrong: 'This soup have milk?' },
  { frame_id: 'food_inform_restriction', intent: 'inform_restriction', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'peanuts', skill: 'verb_to_be',
    en: 'I am allergic to peanuts.', pt: 'Sou alérgico a amendoim.', alt: ["I'm allergic to peanuts."], wrong: 'I allergic to peanuts.' },
  { frame_id: 'food_ask_menu', intent: 'ask_menu', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'bring', noun: 'menu', skill: 'can_request',
    en: 'Could you bring the menu?', pt: 'Você poderia trazer o cardápio?', alt: ['Can you bring the menu?'], wrong: 'You could bring the menu?' },
  { frame_id: 'food_reserve_table', intent: 'reserve_table', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'book', noun: 'table', skill: 'simple_present',
    en: 'I want to book a table for two.', pt: 'Quero reservar uma mesa para dois.', alt: ["I'd like to book a table for two.", "I would like to book a table for two."], wrong: 'I want book a table for two.' },
  { frame_id: 'food_ask_location', intent: 'ask_location', grammar: 'wh_question_be', pattern_id: 'wh_be_question', verb: 'be', noun: 'restaurant', skill: 'question_structure',
    en: 'Where is the restaurant?', pt: 'Onde fica o restaurante?', alt: [], wrong: 'Where the restaurant is?' },
  { frame_id: 'food_waiting', intent: 'describe_activity', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'wait', noun: 'order', skill: 'present_continuous',
    en: 'I am waiting for my order.', pt: 'Estou esperando meu pedido.', alt: ["I'm waiting for my order."], wrong: 'I waiting for my order.' },
  { frame_id: 'food_ask_hours', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'open', noun: 'restaurant', skill: 'question_auxiliary',
    en: 'What time does the restaurant open?', pt: 'Que horas o restaurante abre?', alt: [], wrong: 'What time the restaurant open?' },
]

const travel_A2 = [
  { frame_id: 'tv2_arrive_late', intent: 'report_delay', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'arrive', noun: 'flight', skill: 'past_simple',
    en: 'Our flight arrived late yesterday.', pt: 'Nosso voo chegou atrasado ontem.', alt: [], wrong: 'Our flight arrive late yesterday.' },
  { frame_id: 'tv2_compare', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'bus', skill: 'comparatives',
    en: 'The bus is cheaper than the taxi.', pt: 'O ônibus é mais barato que o táxi.', alt: [], wrong: 'The bus is more cheap than the taxi.' },
  { frame_id: 'tv2_plan_visit', intent: 'state_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'visit', noun: 'museum', skill: 'future_going_to',
    en: 'I am going to visit the museum tomorrow.', pt: 'Vou visitar o museu amanhã.', alt: ["I'm going to visit the museum tomorrow."], wrong: 'I am going to visited the museum tomorrow.' },
  { frame_id: 'tv2_ask_breakfast', intent: 'ask_amenity', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'hotel', skill: 'question_auxiliary',
    en: 'Does the hotel have breakfast?', pt: 'O hotel tem café da manhã?', alt: [], wrong: 'The hotel have breakfast?' },
  { frame_id: 'tv2_lost_passport', intent: 'report_problem', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'lose', noun: 'passport', skill: 'past_simple',
    en: 'I lost my passport at the airport.', pt: 'Perdi meu passaporte no aeroporto.', alt: [], wrong: 'I lose my passport at the airport.' },
  { frame_id: 'tv2_request_taxi', intent: 'request_service', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'call', noun: 'taxi', skill: 'can_request',
    en: 'Could you call a taxi for me?', pt: 'Você poderia chamar um táxi para mim?', alt: ['Can you call a taxi for me?'], wrong: 'You could call a taxi for me?' },
  { frame_id: 'tv2_frequency', intent: 'talk_habit', grammar: 'frequency_adverb', pattern_id: 'subject_simple_present_object', verb: 'travel', noun: 'bus', skill: 'simple_present',
    en: 'I usually travel by bus.', pt: 'Costumo viajar de ônibus.', alt: [], wrong: 'I usually travels by bus.' },
  { frame_id: 'tv2_there_taxi', intent: 'point_out', grammar: 'existential', pattern_id: 'there_is_are', verb: 'be', noun: 'taxi', skill: 'there_is_are',
    en: 'There is a taxi outside the hotel.', pt: 'Tem um táxi na frente do hotel.', alt: ["There's a taxi outside the hotel."], wrong: 'There a taxi outside the hotel.' },
]

const travel_B1 = [
  { frame_id: 'tv3_pp_booked', intent: 'confirm_plan', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'book', noun: 'hotel', skill: 'present_perfect',
    en: 'I have already booked the hotel.', pt: 'Já reservei o hotel.', alt: ["I've already booked the hotel."], wrong: 'I have already book the hotel.' },
  { frame_id: 'tv3_first_cond', intent: 'plan_contingency', grammar: 'first_conditional', pattern_id: 'if_present_will_future', verb: 'miss', noun: 'bus', skill: 'first_conditional',
    en: 'If we miss the bus, we will take a taxi.', pt: 'Se perdermos o ônibus, vamos pegar um táxi.', alt: ["If we miss the bus, we'll take a taxi."], wrong: 'If we will miss the bus, we take a taxi.' },
  { frame_id: 'tv3_ppc_waiting', intent: 'report_problem', grammar: 'present_perfect_continuous', pattern_id: 'subject_have_been_ving_object_duration', verb: 'wait', noun: 'bus', skill: 'present_perfect_continuous',
    en: 'I have been waiting for the bus for an hour.', pt: 'Estou esperando o ônibus há uma hora.', alt: ["I've been waiting for the bus for an hour."], wrong: 'I have been wait for the bus for an hour.' },
  { frame_id: 'tv3_plan_spend', intent: 'describe_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'spend', noun: 'city', skill: 'future_going_to',
    en: 'I am going to spend three days in the city.', pt: 'Vou passar três dias na cidade.', alt: ["I'm going to spend three days in the city."], wrong: 'I am going to spent three days in the city.' },
  { frame_id: 'tv3_pp_question', intent: 'ask_experience', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'visit', noun: 'city', skill: 'present_perfect',
    en: 'Have you ever visited this city?', pt: 'Você já visitou esta cidade?', alt: [], wrong: 'Have you ever visit this city?' },
  { frame_id: 'tv3_advice', intent: 'give_advice', grammar: 'modal_advice', pattern_id: 'subject_modal_base_verb', verb: 'confirm', noun: 'reservation', skill: 'question_auxiliary',
    en: 'You should confirm your reservation online.', pt: 'Você deveria confirmar sua reserva online.', alt: [], wrong: 'You should confirms your reservation online.' },
  { frame_id: 'tv3_compare_exp', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'hotel', skill: 'comparatives',
    en: 'This hotel is better than the last one.', pt: 'Este hotel é melhor que o anterior.', alt: [], wrong: 'This hotel is more better than the last one.' },
  { frame_id: 'tv3_preference', intent: 'state_preference', grammar: 'would_preference', pattern_id: 'subject_modal_base_verb', verb: 'stay', noun: 'hotel', skill: 'first_conditional',
    en: 'I would rather stay at a small hotel.', pt: 'Eu preferiria ficar em um hotel pequeno.', alt: ["I'd rather stay at a small hotel."], wrong: 'I would rather stayed at a small hotel.' },
]

const travel_B2 = [
  { frame_id: 'tv4_passive', intent: 'report_problem', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'cancel', noun: 'flight', skill: 'passive_voice',
    en: 'The flight was cancelled because of the storm.', pt: 'O voo foi cancelado por causa da tempestade.', alt: ['The flight was canceled because of the storm.'], wrong: 'The flight was cancel because of the storm.' },
  { frame_id: 'tv4_reported', intent: 'report_information', grammar: 'reported_speech', pattern_id: 'reported_speech_statement', verb: 'say', noun: 'flight', skill: 'reported_speech',
    en: 'The agent said that the flight was delayed.', pt: 'O atendente disse que o voo estava atrasado.', alt: [], wrong: 'The agent said that the flight delayed.' },
  { frame_id: 'tv4_second_cond', intent: 'hypothesize', grammar: 'second_conditional', pattern_id: 'second_conditional', verb: 'visit', noun: 'coast', skill: 'second_conditional',
    en: 'If I had more time, I would visit the coast.', pt: 'Se eu tivesse mais tempo, visitaria o litoral.', alt: [], wrong: 'If I had more time, I will visit the coast.' },
  { frame_id: 'tv4_diplomatic', intent: 'request_politely', grammar: 'diplomatic_request', pattern_id: 'can_could_request', verb: 'check', noun: 'reservation', skill: 'modal_deduction',
    en: 'Would you mind checking the reservation again?', pt: 'Você se importaria de verificar a reserva de novo?', alt: [], wrong: 'Would you mind check the reservation again?' },
  { frame_id: 'tv4_pp_just', intent: 'report_status', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'arrive', noun: 'airport', skill: 'present_perfect',
    en: 'We have just arrived at the airport.', pt: 'Acabamos de chegar ao aeroporto.', alt: ["We've just arrived at the airport."], wrong: 'We have just arrive at the airport.' },
  { frame_id: 'tv4_passive2', intent: 'report_problem_lost', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'lose', noun: 'bags', skill: 'passive_voice',
    en: 'Our bags were lost during the transfer.', pt: 'Nossas malas foram perdidas durante o traslado.', alt: [], wrong: 'Our bags were lose during the transfer.' },
  { frame_id: 'tv4_deduction', intent: 'make_deduction', grammar: 'modal_deduction', pattern_id: 'subject_modal_base_verb', verb: 'leave', noun: 'bus', skill: 'modal_deduction',
    en: 'The bus must have left already.', pt: 'O ônibus já deve ter saído.', alt: [], wrong: 'The bus must has left already.' },
  { frame_id: 'tv4_contrast', intent: 'describe_experience', grammar: 'past_contrast', pattern_id: 'subject_be_complement', verb: 'be', noun: 'hotel', skill: 'verb_to_be',
    en: 'The hotel was comfortable, but it was quite expensive.', pt: 'O hotel era confortável, mas era bem caro.', alt: [], wrong: 'The hotel comfortable, but it was quite expensive.' },
]

const workplace_A2 = [
  { frame_id: 'wp2_start_late', intent: 'report_delay', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'start', noun: 'meeting', skill: 'past_simple',
    en: 'The meeting started late yesterday.', pt: 'A reunião começou atrasada ontem.', alt: [], wrong: 'The meeting start late yesterday.' },
  { frame_id: 'wp2_compare_project', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'project', skill: 'comparatives',
    en: 'This project is more difficult than the last one.', pt: 'Este projeto é mais difícil que o anterior.', alt: [], wrong: 'This project is difficulter than the last one.' },
  { frame_id: 'wp2_plan_finish', intent: 'state_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'finish', noun: 'report', skill: 'future_going_to',
    en: 'I am going to finish the report tomorrow.', pt: 'Vou terminar o relatório amanhã.', alt: ["I'm going to finish the report tomorrow."], wrong: 'I am going to finished the report tomorrow.' },
  { frame_id: 'wp2_ask_printer', intent: 'ask_resource', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'printer', skill: 'question_auxiliary',
    en: 'Does the office have a printer?', pt: 'O escritório tem uma impressora?', alt: [], wrong: 'The office have a printer?' },
  { frame_id: 'wp2_lost_report', intent: 'report_problem', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'lose', noun: 'report', skill: 'past_simple',
    en: 'I lost the report yesterday.', pt: 'Perdi o relatório ontem.', alt: [], wrong: 'I lose the report yesterday.' },
  { frame_id: 'wp2_request_client', intent: 'request_service', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'call', noun: 'client', skill: 'can_request',
    en: 'Could you call the client for me?', pt: 'Você poderia ligar para o cliente por mim?', alt: ['Can you call the client for me?'], wrong: 'You could call the client for me?' },
  { frame_id: 'wp2_check_email', intent: 'talk_habit', grammar: 'frequency_adverb', pattern_id: 'subject_simple_present_object', verb: 'check', noun: 'email', skill: 'simple_present',
    en: 'I usually check my email in the morning.', pt: 'Costumo checar meu e-mail de manhã.', alt: [], wrong: 'I usually checks my email in the morning.' },
  { frame_id: 'wp2_there_meeting', intent: 'point_out', grammar: 'existential', pattern_id: 'there_is_are', verb: 'be', noun: 'meeting', skill: 'there_is_are',
    en: 'There is a meeting at three o’clock.', pt: 'Tem uma reunião às três horas.', alt: ["There's a meeting at three o’clock."], wrong: 'There a meeting at three o’clock.' },
]

const workplace_B1 = [
  { frame_id: 'wp3_pp_sent', intent: 'confirm_plan', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'send', noun: 'report', skill: 'present_perfect',
    en: 'I have already sent the report.', pt: 'Já enviei o relatório.', alt: ["I've already sent the report."], wrong: 'I have already send the report.' },
  { frame_id: 'wp3_first_cond', intent: 'plan_contingency', grammar: 'first_conditional', pattern_id: 'if_present_will_future', verb: 'finish', noun: 'project', skill: 'first_conditional',
    en: 'If we finish the project early, we will have more time.', pt: 'Se terminarmos o projeto cedo, teremos mais tempo.', alt: [], wrong: 'If we will finish the project early, we have more time.' },
  { frame_id: 'wp3_ppc_working', intent: 'report_status', grammar: 'present_perfect_continuous', pattern_id: 'subject_have_been_ving_object_duration', verb: 'work', noun: 'task', skill: 'present_perfect_continuous',
    en: 'I have been working on this task for two hours.', pt: 'Estou trabalhando nesta tarefa há duas horas.', alt: ["I've been working on this task for two hours."], wrong: 'I have been work on this task for two hours.' },
  { frame_id: 'wp3_plan_send', intent: 'describe_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'send', noun: 'email', skill: 'future_going_to',
    en: 'I am going to send the email tomorrow.', pt: 'Vou enviar o e-mail amanhã.', alt: ["I'm going to send the email tomorrow."], wrong: 'I am going to sent the email tomorrow.' },
  { frame_id: 'wp3_pp_led', intent: 'ask_experience', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'lead', noun: 'meeting', skill: 'present_perfect',
    en: 'Have you ever led a meeting?', pt: 'Você já liderou uma reunião?', alt: [], wrong: 'Have you ever lead a meeting?' },
  { frame_id: 'wp3_advice', intent: 'give_advice', grammar: 'modal_advice', pattern_id: 'subject_modal_base_verb', verb: 'talk', noun: 'manager', skill: 'question_auxiliary',
    en: 'You should talk to the manager about this.', pt: 'Você deveria falar com o gerente sobre isso.', alt: [], wrong: 'You should talks to the manager about this.' },
  { frame_id: 'wp3_compare_task', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'task', skill: 'comparatives',
    en: 'This task is easier than the last one.', pt: 'Esta tarefa é mais fácil que a anterior.', alt: [], wrong: 'This task is more easy than the last one.' },
  { frame_id: 'wp3_preference', intent: 'state_preference', grammar: 'would_preference', pattern_id: 'subject_modal_base_verb', verb: 'finish', noun: 'task', skill: 'first_conditional',
    en: 'I would rather finish this task today.', pt: 'Eu preferiria terminar esta tarefa hoje.', alt: ["I'd rather finish this task today."], wrong: 'I would rather finished this task today.' },
]

const workplace_B2 = [
  { frame_id: 'wp4_passive', intent: 'report_problem', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'cancel', noun: 'meeting', skill: 'passive_voice',
    en: 'The meeting was cancelled due to a conflict.', pt: 'A reunião foi cancelada por causa de um conflito.', alt: ['The meeting was canceled due to a conflict.'], wrong: 'The meeting was cancel due to a conflict.' },
  { frame_id: 'wp4_reported', intent: 'report_information', grammar: 'reported_speech', pattern_id: 'reported_speech_statement', verb: 'say', noun: 'project', skill: 'reported_speech',
    en: 'The manager said that the project was delayed.', pt: 'O gerente disse que o projeto estava atrasado.', alt: [], wrong: 'The manager said that the project delayed.' },
  { frame_id: 'wp4_second_cond', intent: 'hypothesize', grammar: 'second_conditional', pattern_id: 'second_conditional', verb: 'finish', noun: 'report', skill: 'second_conditional',
    en: 'If I had more time, I would finish the report.', pt: 'Se eu tivesse mais tempo, terminaria o relatório.', alt: [], wrong: 'If I had more time, I will finish the report.' },
  { frame_id: 'wp4_diplomatic', intent: 'request_politely', grammar: 'diplomatic_request', pattern_id: 'can_could_request', verb: 'review', noun: 'report', skill: 'modal_deduction',
    en: 'Would you mind reviewing this report again?', pt: 'Você se importaria de revisar este relatório de novo?', alt: [], wrong: 'Would you mind review this report again?' },
  { frame_id: 'wp4_pp_just', intent: 'report_status', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'finish', noun: 'presentation', skill: 'present_perfect',
    en: 'We have just finished the presentation.', pt: 'Acabamos de terminar a apresentação.', alt: ["We've just finished the presentation."], wrong: 'We have just finish the presentation.' },
  { frame_id: 'wp4_passive2', intent: 'report_problem_sent', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'send', noun: 'contract', skill: 'passive_voice',
    en: 'The contract was sent to the wrong client.', pt: 'O contrato foi enviado para o cliente errado.', alt: [], wrong: 'The contract was send to the wrong client.' },
  { frame_id: 'wp4_deduction', intent: 'make_deduction', grammar: 'modal_deduction', pattern_id: 'subject_modal_base_verb', verb: 'read', noun: 'email', skill: 'modal_deduction',
    en: 'The manager must have read the email already.', pt: 'O gerente já deve ter lido o e-mail.', alt: [], wrong: 'The manager must has read the email already.' },
  { frame_id: 'wp4_contrast', intent: 'describe_experience', grammar: 'past_contrast', pattern_id: 'subject_be_complement', verb: 'be', noun: 'presentation', skill: 'verb_to_be',
    en: 'The presentation was long, but it was very useful.', pt: 'A apresentação foi longa, mas foi muito útil.', alt: [], wrong: 'The presentation long, but it was very useful.' },
]

const food_A2 = [
  { frame_id: 'food2_arrive_late', intent: 'report_delay', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'arrive', noun: 'order', skill: 'past_simple',
    en: 'Our order arrived late tonight.', pt: 'Nosso pedido chegou atrasado esta noite.', alt: [], wrong: 'Our order arrive late tonight.' },
  { frame_id: 'food2_compare_restaurant', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'restaurant', skill: 'comparatives',
    en: 'This restaurant is more expensive than the other one.', pt: 'Este restaurante é mais caro que o outro.', alt: [], wrong: 'This restaurant is expensiver than the other one.' },
  { frame_id: 'food2_plan_order', intent: 'state_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'order', noun: 'soup', skill: 'future_going_to',
    en: 'I am going to order the soup.', pt: 'Vou pedir a sopa.', alt: ["I'm going to order the soup."], wrong: 'I am going to ordered the soup.' },
  { frame_id: 'food2_ask_table', intent: 'ask_amenity', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'table', skill: 'question_auxiliary',
    en: 'Does the restaurant have a table for four?', pt: 'O restaurante tem uma mesa para quatro?', alt: [], wrong: 'The restaurant have a table for four?' },
  { frame_id: 'food2_forgot_order', intent: 'report_problem', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'forget', noun: 'order', skill: 'past_simple',
    en: 'The waiter forgot our order.', pt: 'O garçom esqueceu nosso pedido.', alt: [], wrong: 'The waiter forget our order.' },
  { frame_id: 'food2_request_bill', intent: 'request_service', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'bring', noun: 'bill', skill: 'can_request',
    en: 'Could you bring the bill, please?', pt: 'Você poderia trazer a conta, por favor?', alt: ['Can you bring the bill, please?'], wrong: 'You could bring the bill, please?' },
  { frame_id: 'food2_habit_dish', intent: 'talk_habit', grammar: 'frequency_adverb', pattern_id: 'subject_simple_present_object', verb: 'order', noun: 'dish', skill: 'simple_present',
    en: 'I usually order the same dish.', pt: 'Costumo pedir o mesmo prato.', alt: [], wrong: 'I usually orders the same dish.' },
  { frame_id: 'food2_there_table', intent: 'point_out', grammar: 'existential', pattern_id: 'there_is_are', verb: 'be', noun: 'table', skill: 'there_is_are',
    en: 'There is a table available near the window.', pt: 'Tem uma mesa disponível perto da janela.', alt: ["There's a table available near the window."], wrong: 'There a table available near the window.' },
]

const food_B1 = [
  { frame_id: 'food3_pp_ordered', intent: 'confirm_plan', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'order', noun: 'dessert', skill: 'present_perfect',
    en: 'I have already ordered the dessert.', pt: 'Já pedi a sobremesa.', alt: ["I've already ordered the dessert."], wrong: 'I have already order the dessert.' },
  { frame_id: 'food3_first_cond', intent: 'plan_contingency', grammar: 'first_conditional', pattern_id: 'if_present_will_future', verb: 'book', noun: 'table', skill: 'first_conditional',
    en: 'If the restaurant is full, we will book another table.', pt: 'Se o restaurante estiver lotado, vamos reservar outra mesa.', alt: [], wrong: 'If the restaurant is full, we book another table.' },
  { frame_id: 'food3_ppc_waiting', intent: 'report_problem', grammar: 'present_perfect_continuous', pattern_id: 'subject_have_been_ving_object_duration', verb: 'wait', noun: 'waiter', skill: 'present_perfect_continuous',
    en: 'We have been waiting for the waiter for ten minutes.', pt: 'Estamos esperando o garçom há dez minutos.', alt: ["We've been waiting for the waiter for ten minutes."], wrong: 'We have been wait for the waiter for ten minutes.' },
  { frame_id: 'food3_plan_try', intent: 'describe_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'try', noun: 'dish', skill: 'future_going_to',
    en: 'I am going to try the new dish tonight.', pt: 'Vou experimentar o prato novo hoje à noite.', alt: ["I'm going to try the new dish tonight."], wrong: 'I am going to tried the new dish tonight.' },
  { frame_id: 'food3_pp_question', intent: 'ask_experience', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'try', noun: 'soup', skill: 'present_perfect',
    en: 'Have you ever tried this soup?', pt: 'Você já experimentou esta sopa?', alt: [], wrong: 'Have you ever try this soup?' },
  { frame_id: 'food3_advice', intent: 'give_advice', grammar: 'modal_advice', pattern_id: 'subject_modal_base_verb', verb: 'ask', noun: 'waiter', skill: 'question_auxiliary',
    en: 'You should ask the waiter about the menu.', pt: 'Você deveria perguntar ao garçom sobre o cardápio.', alt: [], wrong: 'You should asks the waiter about the menu.' },
  { frame_id: 'food3_compare_dish', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'dish', skill: 'comparatives',
    en: 'This dish is spicier than the soup.', pt: 'Este prato é mais picante que a sopa.', alt: [], wrong: 'This dish is more spicy than the soup.' },
  { frame_id: 'food3_preference', intent: 'state_preference', grammar: 'would_preference', pattern_id: 'subject_modal_base_verb', verb: 'have', noun: 'salad', skill: 'first_conditional',
    en: 'I would rather have the salad today.', pt: 'Eu preferiria comer a salada hoje.', alt: ["I'd rather have the salad today."], wrong: 'I would rather had the salad today.' },
]

const food_B2 = [
  { frame_id: 'food4_passive', intent: 'report_problem', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'cancel', noun: 'reservation', skill: 'passive_voice',
    en: 'The reservation was cancelled by mistake.', pt: 'A reserva foi cancelada por engano.', alt: ['The reservation was canceled by mistake.'], wrong: 'The reservation was cancel by mistake.' },
  { frame_id: 'food4_reported', intent: 'report_information', grammar: 'reported_speech', pattern_id: 'reported_speech_statement', verb: 'say', noun: 'restaurant', skill: 'reported_speech',
    en: 'The waiter said that the restaurant was full.', pt: 'O garçom disse que o restaurante estava lotado.', alt: [], wrong: 'The waiter said that the restaurant full.' },
  { frame_id: 'food4_second_cond', intent: 'hypothesize', grammar: 'second_conditional', pattern_id: 'second_conditional', verb: 'try', noun: 'fish', skill: 'second_conditional',
    en: 'If I were you, I would try the fish.', pt: 'Se eu fosse você, experimentaria o peixe.', alt: [], wrong: 'If I were you, I will try the fish.' },
  { frame_id: 'food4_diplomatic', intent: 'request_politely', grammar: 'diplomatic_request', pattern_id: 'can_could_request', verb: 'check', noun: 'bill', skill: 'modal_deduction',
    en: 'Would you mind checking the bill again?', pt: 'Você se importaria de conferir a conta de novo?', alt: [], wrong: 'Would you mind check the bill again?' },
  { frame_id: 'food4_pp_just', intent: 'report_status', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'finish', noun: 'dessert', skill: 'present_perfect',
    en: 'We have just finished our dessert.', pt: 'Acabamos de terminar nossa sobremesa.', alt: ["We've just finished our dessert."], wrong: 'We have just finish our dessert.' },
  { frame_id: 'food4_passive2', intent: 'report_problem_replaced', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'replace', noun: 'dessert', skill: 'passive_voice',
    en: 'The dessert was replaced without asking.', pt: 'A sobremesa foi trocada sem avisar.', alt: [], wrong: 'The dessert was replace without asking.' },
  { frame_id: 'food4_deduction', intent: 'make_deduction', grammar: 'modal_deduction', pattern_id: 'subject_modal_base_verb', verb: 'forget', noun: 'drinks', skill: 'modal_deduction',
    en: 'The waiter must have forgotten our drinks.', pt: 'O garçom deve ter esquecido nossas bebidas.', alt: [], wrong: 'The waiter must has forgotten our drinks.' },
  { frame_id: 'food4_contrast', intent: 'describe_experience', grammar: 'past_contrast', pattern_id: 'subject_be_complement', verb: 'be', noun: 'soup', skill: 'verb_to_be',
    en: 'The soup was tasty, but it was too salty.', pt: 'A sopa estava saborosa, mas estava muito salgada.', alt: [], wrong: 'The soup tasty, but it was too salty.' },
]

const daily_life_A1 = [
  { frame_id: 'dl1_ask_keys', intent: 'ask_location', grammar: 'wh_question_be', pattern_id: 'wh_be_question', verb: 'be', noun: 'keys', skill: 'question_structure',
    en: 'Where are my keys?', pt: 'Onde estão minhas chaves?', alt: [], wrong: 'Where my keys are?' },
  { frame_id: 'dl1_clean_kitchen', intent: 'state_task', grammar: 'have_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'clean', noun: 'kitchen', skill: 'simple_present',
    en: 'I have to clean the kitchen.', pt: 'Eu tenho que limpar a cozinha.', alt: [], wrong: 'I have to cleans the kitchen.' },
  { frame_id: 'dl1_ask_breakfast_time', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'have', noun: 'dinner', skill: 'question_auxiliary',
    en: 'What time do you have dinner?', pt: 'Que horas você janta?', alt: [], wrong: 'What time you have dinner?' },
  { frame_id: 'dl1_request_groceries', intent: 'request_help', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'help', noun: 'groceries', skill: 'can_request',
    en: 'Can you help me with the groceries?', pt: 'Você pode me ajudar com as compras?', alt: ['Could you help me with the groceries?'], wrong: 'You can help me with the groceries?' },
  { frame_id: 'dl1_describe_house', intent: 'describe_state', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'house', skill: 'verb_to_be',
    en: 'The house is very clean.', pt: 'A casa está muito limpa.', alt: [], wrong: 'The house very clean.' },
  { frame_id: 'dl1_cook_dinner', intent: 'state_intention', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'cook', noun: 'dinner', skill: 'simple_present',
    en: 'I want to cook dinner tonight.', pt: 'Quero cozinhar o jantar hoje à noite.', alt: ["I'd like to cook dinner tonight."], wrong: 'I want cook dinner tonight.' },
  { frame_id: 'dl1_doing_laundry', intent: 'describe_activity', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'do', noun: 'laundry', skill: 'present_continuous',
    en: 'I am doing the laundry now.', pt: 'Estou lavando roupa agora.', alt: ["I'm doing the laundry now."], wrong: 'I doing the laundry now.' },
  { frame_id: 'dl1_lock_door', intent: 'ask_action', grammar: 'imperative_request', pattern_id: 'imperative_request', verb: 'lock', noun: 'door', skill: 'can_request',
    en: 'Please lock the door.', pt: 'Por favor, tranque a porta.', alt: [], wrong: 'Please locks the door.' },
]

const daily_life_A2 = [
  { frame_id: 'dl2_forgot_keys', intent: 'report_problem', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'forget', noun: 'keys', skill: 'past_simple',
    en: 'I forgot my keys this morning.', pt: 'Esqueci minhas chaves esta manhã.', alt: [], wrong: 'I forget my keys this morning.' },
  { frame_id: 'dl2_compare_house', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'house', skill: 'comparatives',
    en: 'My new house is bigger than the old one.', pt: 'Minha casa nova é maior que a antiga.', alt: [], wrong: 'My new house is more big than the old one.' },
  { frame_id: 'dl2_plan_clean', intent: 'state_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'clean', noun: 'kitchen', skill: 'future_going_to',
    en: 'I am going to clean the kitchen tomorrow.', pt: 'Vou limpar a cozinha amanhã.', alt: ["I'm going to clean the kitchen tomorrow."], wrong: 'I am going to cleaned the kitchen tomorrow.' },
  { frame_id: 'dl2_ask_dog', intent: 'ask_detail', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'dog', skill: 'question_auxiliary',
    en: 'Does your neighbor have a dog?', pt: 'Seu vizinho tem um cachorro?', alt: [], wrong: 'Your neighbor have a dog?' },
  { frame_id: 'dl2_lost_keys', intent: 'report_problem_lost', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'lose', noun: 'keys', skill: 'past_simple',
    en: 'I lost my keys yesterday.', pt: 'Perdi minhas chaves ontem.', alt: [], wrong: 'I lose my keys yesterday.' },
  { frame_id: 'dl2_request_laundry', intent: 'request_service', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'help', noun: 'laundry', skill: 'can_request',
    en: 'Could you help me with the laundry?', pt: 'Você poderia me ajudar com a roupa lavada?', alt: ['Can you help me with the laundry?'], wrong: 'You could help me with the laundry?' },
  { frame_id: 'dl2_habit_cook', intent: 'talk_habit', grammar: 'frequency_adverb', pattern_id: 'subject_simple_present_object', verb: 'cook', noun: 'dinner', skill: 'simple_present',
    en: 'I usually cook dinner on Sundays.', pt: 'Costumo cozinhar o jantar aos domingos.', alt: [], wrong: 'I usually cooks dinner on Sundays.' },
  { frame_id: 'dl2_there_package', intent: 'point_out', grammar: 'existential', pattern_id: 'there_is_are', verb: 'be', noun: 'package', skill: 'there_is_are',
    en: 'There is a package at the door.', pt: 'Tem um pacote na porta.', alt: ["There's a package at the door."], wrong: 'There a package at the door.' },
]

const daily_life_B1 = [
  { frame_id: 'dl3_pp_cleaned', intent: 'confirm_plan', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'clean', noun: 'kitchen', skill: 'present_perfect',
    en: 'I have already cleaned the kitchen.', pt: 'Já limpei a cozinha.', alt: ["I've already cleaned the kitchen."], wrong: 'I have already clean the kitchen.' },
  { frame_id: 'dl3_first_cond', intent: 'plan_contingency', grammar: 'first_conditional', pattern_id: 'if_present_will_future', verb: 'finish', noun: 'laundry', skill: 'first_conditional',
    en: 'If I finish the laundry early, I will go for a walk.', pt: 'Se eu terminar a roupa lavada cedo, vou dar uma caminhada.', alt: [], wrong: 'If I will finish the laundry early, I go for a walk.' },
  { frame_id: 'dl3_ppc_cooking', intent: 'report_status', grammar: 'present_perfect_continuous', pattern_id: 'subject_have_been_ving_object_duration', verb: 'cook', noun: 'dinner', skill: 'present_perfect_continuous',
    en: 'I have been cooking dinner for an hour.', pt: 'Estou cozinhando o jantar há uma hora.', alt: ["I've been cooking dinner for an hour."], wrong: 'I have been cook dinner for an hour.' },
  { frame_id: 'dl3_plan_fix', intent: 'describe_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'fix', noun: 'door', skill: 'future_going_to',
    en: 'I am going to fix the door tomorrow.', pt: 'Vou consertar a porta amanhã.', alt: ["I'm going to fix the door tomorrow."], wrong: 'I am going to fixed the door tomorrow.' },
  { frame_id: 'dl3_pp_question', intent: 'ask_experience', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'lose', noun: 'keys', skill: 'present_perfect',
    en: 'Have you ever lost your keys?', pt: 'Você já perdeu suas chaves?', alt: [], wrong: 'Have you ever lose your keys?' },
  { frame_id: 'dl3_advice', intent: 'give_advice', grammar: 'modal_advice', pattern_id: 'subject_modal_base_verb', verb: 'talk', noun: 'neighbor', skill: 'question_auxiliary',
    en: 'You should talk to your neighbor about the noise.', pt: 'Você deveria falar com seu vizinho sobre o barulho.', alt: [], wrong: 'You should talks to your neighbor about the noise.' },
  { frame_id: 'dl3_compare_neighborhood', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'neighborhood', skill: 'comparatives',
    en: 'This neighborhood is quieter than the last one.', pt: 'Este bairro é mais tranquilo que o anterior.', alt: [], wrong: 'This neighborhood is more quiet than the last one.' },
  { frame_id: 'dl3_preference', intent: 'state_preference', grammar: 'would_preference', pattern_id: 'subject_modal_base_verb', verb: 'clean', noun: 'house', skill: 'first_conditional',
    en: 'I would rather clean the house today.', pt: 'Eu preferiria limpar a casa hoje.', alt: ["I'd rather clean the house today."], wrong: 'I would rather cleaned the house today.' },
]

const daily_life_B2 = [
  { frame_id: 'dl4_passive', intent: 'report_status', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'clean', noun: 'kitchen', skill: 'passive_voice',
    en: 'The kitchen was cleaned this morning.', pt: 'A cozinha foi limpa esta manhã.', alt: [], wrong: 'The kitchen was clean this morning.' },
  { frame_id: 'dl4_reported', intent: 'report_information', grammar: 'reported_speech', pattern_id: 'reported_speech_statement', verb: 'say', noun: 'keys', skill: 'reported_speech',
    en: 'My neighbor said that he found his keys.', pt: 'Meu vizinho disse que encontrou suas chaves.', alt: [], wrong: 'My neighbor said that he find his keys.' },
  { frame_id: 'dl4_second_cond', intent: 'hypothesize', grammar: 'second_conditional', pattern_id: 'second_conditional', verb: 'buy', noun: 'house', skill: 'second_conditional',
    en: 'If I had more space, I would buy a bigger house.', pt: 'Se eu tivesse mais espaço, compraria uma casa maior.', alt: [], wrong: 'If I had more space, I will buy a bigger house.' },
  { frame_id: 'dl4_diplomatic', intent: 'request_politely', grammar: 'diplomatic_request', pattern_id: 'can_could_request', verb: 'fix', noun: 'door', skill: 'modal_deduction',
    en: 'Would you mind fixing the door again?', pt: 'Você se importaria de consertar a porta de novo?', alt: [], wrong: 'Would you mind fix the door again?' },
  { frame_id: 'dl4_pp_just', intent: 'report_status_finished', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'finish', noun: 'laundry', skill: 'present_perfect',
    en: 'We have just finished the laundry.', pt: 'Acabamos de terminar a roupa lavada.', alt: ["We've just finished the laundry."], wrong: 'We have just finish the laundry.' },
  { frame_id: 'dl4_passive2', intent: 'report_found', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'find', noun: 'keys', skill: 'passive_voice',
    en: 'The keys were found under the sofa.', pt: 'As chaves foram encontradas embaixo do sofá.', alt: [], wrong: 'The keys were find under the sofa.' },
  { frame_id: 'dl4_deduction', intent: 'make_deduction', grammar: 'modal_deduction', pattern_id: 'subject_modal_base_verb', verb: 'forget', noun: 'keys', skill: 'modal_deduction',
    en: 'My neighbor must have forgotten the keys.', pt: 'Meu vizinho deve ter esquecido as chaves.', alt: [], wrong: 'My neighbor must has forgotten the keys.' },
  { frame_id: 'dl4_contrast', intent: 'describe_experience', grammar: 'past_contrast', pattern_id: 'subject_be_complement', verb: 'be', noun: 'house', skill: 'verb_to_be',
    en: 'The house was small, but it was very cozy.', pt: 'A casa era pequena, mas era muito aconchegante.', alt: [], wrong: 'The house small, but it was very cozy.' },
]

const shopping_A1 = [
  { frame_id: 'sh1_ask_store', intent: 'ask_location', grammar: 'wh_question_be', pattern_id: 'wh_be_question', verb: 'be', noun: 'store', skill: 'question_structure',
    en: 'Where is the nearest store?', pt: 'Onde fica a loja mais próxima?', alt: [], wrong: 'Where the nearest store is?' },
  { frame_id: 'sh1_buy_shirt', intent: 'state_intention', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'buy', noun: 'shirt', skill: 'simple_present',
    en: 'I want to buy a new shirt.', pt: 'Quero comprar uma camisa nova.', alt: ["I'd like to buy a new shirt."], wrong: 'I want buy a new shirt.' },
  { frame_id: 'sh1_ask_close_time', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'close', noun: 'store', skill: 'question_auxiliary',
    en: 'What time does the store close?', pt: 'Que horas a loja fecha?', alt: [], wrong: 'What time the store close?' },
  { frame_id: 'sh1_request_size', intent: 'request_help', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'help', noun: 'size', skill: 'can_request',
    en: 'Can you help me find my size?', pt: 'Você pode me ajudar a achar meu tamanho?', alt: ['Could you help me find my size?'], wrong: 'You can help me find my size?' },
  { frame_id: 'sh1_describe_price', intent: 'describe_state', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'price', skill: 'verb_to_be',
    en: 'This price is very high.', pt: 'Este preço está muito alto.', alt: [], wrong: 'This price very high.' },
  { frame_id: 'sh1_pay_card', intent: 'state_payment', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'pay', noun: 'card', skill: 'simple_present',
    en: 'I want to pay with my card.', pt: 'Quero pagar com meu cartão.', alt: ["I'd like to pay with my card."], wrong: 'I want pay with my card.' },
  { frame_id: 'sh1_waiting_line', intent: 'describe_activity', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'wait', noun: 'line', skill: 'present_continuous',
    en: 'I am waiting in line now.', pt: 'Estou esperando na fila agora.', alt: ["I'm waiting in line now."], wrong: 'I waiting in line now.' },
  { frame_id: 'sh1_show_receipt', intent: 'ask_action', grammar: 'imperative_request', pattern_id: 'imperative_request', verb: 'show', noun: 'receipt', skill: 'can_request',
    en: 'Please show me the receipt.', pt: 'Por favor, me mostre o recibo.', alt: [], wrong: 'Please shows me the receipt.' },
]

const shopping_A2 = [
  { frame_id: 'sh2_delivery_late', intent: 'report_delay', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'arrive', noun: 'delivery', skill: 'past_simple',
    en: 'The delivery arrived late yesterday.', pt: 'A entrega chegou atrasada ontem.', alt: [], wrong: 'The delivery arrive late yesterday.' },
  { frame_id: 'sh2_compare_store', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'store', skill: 'comparatives',
    en: 'This store is cheaper than the other one.', pt: 'Esta loja é mais barata que a outra.', alt: [], wrong: 'This store is more cheap than the other one.' },
  { frame_id: 'sh2_plan_return', intent: 'state_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'return', noun: 'item', skill: 'future_going_to',
    en: 'I am going to return this item tomorrow.', pt: 'Vou devolver este item amanhã.', alt: ["I'm going to return this item tomorrow."], wrong: 'I am going to returned this item tomorrow.' },
  { frame_id: 'sh2_ask_discount', intent: 'ask_detail', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'discount', skill: 'question_auxiliary',
    en: 'Does this store have a discount today?', pt: 'Esta loja tem desconto hoje?', alt: [], wrong: 'This store have a discount today?' },
  { frame_id: 'sh2_lost_receipt', intent: 'report_problem', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'lose', noun: 'receipt', skill: 'past_simple',
    en: 'I lost my receipt yesterday.', pt: 'Perdi meu recibo ontem.', alt: [], wrong: 'I lose my receipt yesterday.' },
  { frame_id: 'sh2_request_price', intent: 'request_service', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'check', noun: 'price', skill: 'can_request',
    en: 'Could you check the price for me?', pt: 'Você poderia checar o preço para mim?', alt: ['Can you check the price for me?'], wrong: 'You could check the price for me?' },
  { frame_id: 'sh2_habit_pay', intent: 'talk_habit', grammar: 'frequency_adverb', pattern_id: 'subject_simple_present_object', verb: 'pay', noun: 'card', skill: 'simple_present',
    en: 'I usually pay with a card.', pt: 'Costumo pagar com cartão.', alt: [], wrong: 'I usually pays with a card.' },
  { frame_id: 'sh2_there_line', intent: 'point_out', grammar: 'existential', pattern_id: 'there_is_are', verb: 'be', noun: 'line', skill: 'there_is_are',
    en: 'There is a long line at the store.', pt: 'Tem uma fila longa na loja.', alt: ["There's a long line at the store."], wrong: 'There a long line at the store.' },
]

const shopping_B1 = [
  { frame_id: 'sh3_pp_paid', intent: 'confirm_plan', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'pay', noun: 'item', skill: 'present_perfect',
    en: 'I have already paid for the item.', pt: 'Já paguei pelo item.', alt: ["I've already paid for the item."], wrong: 'I have already pay for the item.' },
  { frame_id: 'sh3_first_cond', intent: 'plan_contingency', grammar: 'first_conditional', pattern_id: 'if_present_will_future', verb: 'ask', noun: 'discount', skill: 'first_conditional',
    en: 'If the price is too high, I will ask for a discount.', pt: 'Se o preço estiver muito alto, vou pedir um desconto.', alt: [], wrong: 'If the price is too high, I ask for a discount.' },
  { frame_id: 'sh3_ppc_waiting', intent: 'report_status', grammar: 'present_perfect_continuous', pattern_id: 'subject_have_been_ving_object_duration', verb: 'wait', noun: 'line', skill: 'present_perfect_continuous',
    en: 'I have been waiting in line for twenty minutes.', pt: 'Estou esperando na fila há vinte minutos.', alt: ["I've been waiting in line for twenty minutes."], wrong: 'I have been wait in line for twenty minutes.' },
  { frame_id: 'sh3_plan_exchange', intent: 'describe_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'exchange', noun: 'shirt', skill: 'future_going_to',
    en: 'I am going to exchange this shirt tomorrow.', pt: 'Vou trocar esta camisa amanhã.', alt: ["I'm going to exchange this shirt tomorrow."], wrong: 'I am going to exchanged this shirt tomorrow.' },
  { frame_id: 'sh3_pp_question', intent: 'ask_experience', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'ask', noun: 'refund', skill: 'present_perfect',
    en: 'Have you ever asked for a refund?', pt: 'Você já pediu um reembolso?', alt: [], wrong: 'Have you ever ask for a refund?' },
  { frame_id: 'sh3_advice', intent: 'give_advice', grammar: 'modal_advice', pattern_id: 'subject_modal_base_verb', verb: 'keep', noun: 'receipt', skill: 'question_auxiliary',
    en: 'You should keep the receipt.', pt: 'Você deveria guardar o recibo.', alt: [], wrong: 'You should keeps the receipt.' },
  { frame_id: 'sh3_compare_size', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'size', skill: 'comparatives',
    en: 'This size is better than the other one.', pt: 'Este tamanho é melhor que o outro.', alt: [], wrong: 'This size is more good than the other one.' },
  { frame_id: 'sh3_preference', intent: 'state_preference', grammar: 'would_preference', pattern_id: 'subject_modal_base_verb', verb: 'pay', noun: 'cash', skill: 'first_conditional',
    en: 'I would rather pay with cash.', pt: 'Eu preferiria pagar em dinheiro.', alt: ["I'd rather pay with cash."], wrong: 'I would rather paid with cash.' },
]

const shopping_B2 = [
  { frame_id: 'sh4_passive', intent: 'report_status', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'return', noun: 'item', skill: 'passive_voice',
    en: 'The item was returned yesterday.', pt: 'O item foi devolvido ontem.', alt: [], wrong: 'The item was return yesterday.' },
  { frame_id: 'sh4_reported', intent: 'report_information', grammar: 'reported_speech', pattern_id: 'reported_speech_statement', verb: 'say', noun: 'discount', skill: 'reported_speech',
    en: 'The cashier said that the discount had ended.', pt: 'O caixa disse que o desconto tinha acabado.', alt: [], wrong: 'The cashier said that the discount ended.' },
  { frame_id: 'sh4_second_cond', intent: 'hypothesize', grammar: 'second_conditional', pattern_id: 'second_conditional', verb: 'buy', noun: 'shoes', skill: 'second_conditional',
    en: 'If the store had my size, I would buy the shoes.', pt: 'Se a loja tivesse meu tamanho, eu compraria os sapatos.', alt: [], wrong: 'If the store had my size, I will buy the shoes.' },
  { frame_id: 'sh4_diplomatic', intent: 'request_politely', grammar: 'diplomatic_request', pattern_id: 'can_could_request', verb: 'check', noun: 'price', skill: 'modal_deduction',
    en: 'Would you mind checking the price again?', pt: 'Você se importaria de checar o preço de novo?', alt: [], wrong: 'Would you mind check the price again?' },
  { frame_id: 'sh4_pp_just', intent: 'report_status_paid', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'pay', noun: 'delivery', skill: 'present_perfect',
    en: 'We have just paid for the delivery.', pt: 'Acabamos de pagar pela entrega.', alt: ["We've just paid for the delivery."], wrong: 'We have just pay for the delivery.' },
  { frame_id: 'sh4_passive2', intent: 'report_lost', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'lose', noun: 'receipt', skill: 'passive_voice',
    en: 'The receipt was lost during the delivery.', pt: 'O recibo foi perdido durante a entrega.', alt: [], wrong: 'The receipt was lose during the delivery.' },
  { frame_id: 'sh4_deduction', intent: 'make_deduction', grammar: 'modal_deduction', pattern_id: 'subject_modal_base_verb', verb: 'forget', noun: 'discount', skill: 'modal_deduction',
    en: 'The cashier must have forgotten the discount.', pt: 'O caixa deve ter esquecido o desconto.', alt: [], wrong: 'The cashier must has forgotten the discount.' },
  { frame_id: 'sh4_contrast', intent: 'describe_experience', grammar: 'past_contrast', pattern_id: 'subject_be_complement', verb: 'be', noun: 'store', skill: 'verb_to_be',
    en: 'The store was crowded, but the service was fast.', pt: 'A loja estava lotada, mas o atendimento foi rápido.', alt: [], wrong: 'The store crowded, but the service was fast.' },
]

const tech_A1 = [
  { frame_id: 'tc1_ask_phone', intent: 'ask_location', grammar: 'wh_question_be', pattern_id: 'wh_be_question', verb: 'be', noun: 'phone', skill: 'question_structure',
    en: 'Where is my phone?', pt: 'Onde está meu celular?', alt: [], wrong: 'Where my phone is?' },
  { frame_id: 'tc1_update_app', intent: 'state_intention', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'update', noun: 'app', skill: 'simple_present',
    en: 'I want to update the app.', pt: 'Quero atualizar o aplicativo.', alt: ["I'd like to update the app."], wrong: 'I want update the app.' },
  { frame_id: 'tc1_ask_call_time', intent: 'ask_time', grammar: 'wh_question_do', pattern_id: 'wh_do_subject_base_verb', verb: 'start', noun: 'video_call', skill: 'question_auxiliary',
    en: 'What time does the video call start?', pt: 'Que horas a videochamada começa?', alt: [], wrong: 'What time the video call start?' },
  { frame_id: 'tc1_request_password', intent: 'request_help', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'help', noun: 'password', skill: 'can_request',
    en: 'Can you help me with the password?', pt: 'Você pode me ajudar com a senha?', alt: ['Could you help me with the password?'], wrong: 'You can help me with the password?' },
  { frame_id: 'tc1_describe_battery', intent: 'describe_state', grammar: 'be_complement', pattern_id: 'subject_be_complement', verb: 'be', noun: 'battery', skill: 'verb_to_be',
    en: 'My phone battery is very low.', pt: 'A bateria do meu celular está muito baixa.', alt: [], wrong: 'My phone battery very low.' },
  { frame_id: 'tc1_send_message', intent: 'state_intention_message', grammar: 'want_to_infinitive', pattern_id: 'subject_want_to_verb', verb: 'send', noun: 'email', skill: 'simple_present',
    en: 'I want to send an email now.', pt: 'Quero enviar um e-mail agora.', alt: ["I'd like to send an email now."], wrong: 'I want send an email now.' },
  { frame_id: 'tc1_charging', intent: 'describe_activity', grammar: 'present_continuous', pattern_id: 'subject_present_continuous', verb: 'charge', noun: 'phone', skill: 'present_continuous',
    en: 'I am charging my phone now.', pt: 'Estou carregando meu celular agora.', alt: ["I'm charging my phone now."], wrong: 'I charging my phone now.' },
  { frame_id: 'tc1_check_signal', intent: 'ask_action', grammar: 'imperative_request', pattern_id: 'imperative_request', verb: 'check', noun: 'signal', skill: 'can_request',
    en: 'Please check the wifi signal.', pt: 'Por favor, verifique o sinal do wifi.', alt: [], wrong: 'Please checks the wifi signal.' },
]

const tech_A2 = [
  { frame_id: 'tc2_call_late', intent: 'report_delay', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'start', noun: 'video_call', skill: 'past_simple',
    en: 'The video call started late today.', pt: 'A videochamada começou atrasada hoje.', alt: [], wrong: 'The video call start late today.' },
  { frame_id: 'tc2_compare_phone', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'phone', skill: 'comparatives',
    en: 'This phone is faster than my old one.', pt: 'Este celular é mais rápido que o antigo.', alt: [], wrong: 'This phone is more fast than my old one.' },
  { frame_id: 'tc2_plan_update', intent: 'state_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'update', noun: 'app', skill: 'future_going_to',
    en: 'I am going to update the app tomorrow.', pt: 'Vou atualizar o aplicativo amanhã.', alt: ["I'm going to update the app tomorrow."], wrong: 'I am going to updated the app tomorrow.' },
  { frame_id: 'tc2_ask_battery', intent: 'ask_detail', grammar: 'yes_no_question', pattern_id: 'yes_no_do_question', verb: 'have', noun: 'battery', skill: 'question_auxiliary',
    en: 'Does this laptop have a good battery?', pt: 'Este notebook tem uma boa bateria?', alt: [], wrong: 'This laptop have a good battery?' },
  { frame_id: 'tc2_forgot_password', intent: 'report_problem', grammar: 'past_simple', pattern_id: 'subject_past_simple_object_time', verb: 'forget', noun: 'password', skill: 'past_simple',
    en: 'I forgot my password yesterday.', pt: 'Esqueci minha senha ontem.', alt: [], wrong: 'I forget my password yesterday.' },
  { frame_id: 'tc2_request_signal', intent: 'request_service', grammar: 'modal_request', pattern_id: 'can_could_request', verb: 'check', noun: 'signal', skill: 'can_request',
    en: 'Could you check the signal for me?', pt: 'Você poderia verificar o sinal para mim?', alt: ['Can you check the signal for me?'], wrong: 'You could check the signal for me?' },
  { frame_id: 'tc2_habit_charge', intent: 'talk_habit', grammar: 'frequency_adverb', pattern_id: 'subject_simple_present_object', verb: 'charge', noun: 'phone', skill: 'simple_present',
    en: 'I usually charge my phone at night.', pt: 'Costumo carregar meu celular à noite.', alt: [], wrong: 'I usually charges my phone at night.' },
  { frame_id: 'tc2_there_signal', intent: 'point_out', grammar: 'existential', pattern_id: 'there_is_are', verb: 'be', noun: 'signal', skill: 'there_is_are',
    en: 'There is a signal problem today.', pt: 'Tem um problema de sinal hoje.', alt: ["There's a signal problem today."], wrong: 'There a signal problem today.' },
]

const tech_B1 = [
  { frame_id: 'tc3_pp_updated', intent: 'confirm_plan', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'update', noun: 'app', skill: 'present_perfect',
    en: 'I have already updated the app.', pt: 'Já atualizei o aplicativo.', alt: ["I've already updated the app."], wrong: 'I have already update the app.' },
  { frame_id: 'tc3_first_cond', intent: 'plan_contingency', grammar: 'first_conditional', pattern_id: 'if_present_will_future', verb: 'charge', noun: 'phone', skill: 'first_conditional',
    en: 'If the battery dies, I will charge my phone.', pt: 'Se a bateria acabar, vou carregar meu celular.', alt: [], wrong: 'If the battery dies, I charge my phone.' },
  { frame_id: 'tc3_ppc_fixing', intent: 'report_status', grammar: 'present_perfect_continuous', pattern_id: 'subject_have_been_ving_object_duration', verb: 'fix', noun: 'signal', skill: 'present_perfect_continuous',
    en: 'I have been trying to fix the signal for an hour.', pt: 'Estou tentando consertar o sinal há uma hora.', alt: ["I've been trying to fix the signal for an hour."], wrong: 'I have been try to fix the signal for an hour.' },
  { frame_id: 'tc3_plan_change', intent: 'describe_plan', grammar: 'going_to', pattern_id: 'subject_be_going_to_verb_time', verb: 'change', noun: 'password', skill: 'future_going_to',
    en: 'I am going to change my password tomorrow.', pt: 'Vou mudar minha senha amanhã.', alt: ["I'm going to change my password tomorrow."], wrong: 'I am going to changed my password tomorrow.' },
  { frame_id: 'tc3_pp_question', intent: 'ask_experience', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'lose', noun: 'phone', skill: 'present_perfect',
    en: 'Have you ever lost your phone?', pt: 'Você já perdeu seu celular?', alt: [], wrong: 'Have you ever lose your phone?' },
  { frame_id: 'tc3_advice', intent: 'give_advice', grammar: 'modal_advice', pattern_id: 'subject_modal_base_verb', verb: 'save', noun: 'files', skill: 'question_auxiliary',
    en: 'You should save your files.', pt: 'Você deveria salvar seus arquivos.', alt: [], wrong: 'You should saves your files.' },
  { frame_id: 'tc3_compare_laptop', intent: 'compare_options', grammar: 'comparative', pattern_id: 'comparative_than', verb: 'be', noun: 'laptop', skill: 'comparatives',
    en: 'This laptop is lighter than my old one.', pt: 'Este notebook é mais leve que o antigo.', alt: [], wrong: 'This laptop is more light than my old one.' },
  { frame_id: 'tc3_preference', intent: 'state_preference', grammar: 'would_preference', pattern_id: 'subject_modal_base_verb', verb: 'use', noun: 'laptop', skill: 'first_conditional',
    en: 'I would rather use the laptop today.', pt: 'Eu preferiria usar o notebook hoje.', alt: ["I'd rather use the laptop today."], wrong: 'I would rather used the laptop today.' },
]

const tech_B2 = [
  { frame_id: 'tc4_passive', intent: 'report_status', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'update', noun: 'app', skill: 'passive_voice',
    en: 'The app was updated last night.', pt: 'O aplicativo foi atualizado ontem à noite.', alt: [], wrong: 'The app was update last night.' },
  { frame_id: 'tc4_reported', intent: 'report_information', grammar: 'reported_speech', pattern_id: 'reported_speech_statement', verb: 'say', noun: 'battery', skill: 'reported_speech',
    en: 'The technician said that the battery was damaged.', pt: 'O técnico disse que a bateria estava danificada.', alt: [], wrong: 'The technician said that the battery damaged.' },
  { frame_id: 'tc4_second_cond', intent: 'hypothesize', grammar: 'second_conditional', pattern_id: 'second_conditional', verb: 'take', noun: 'photos', skill: 'second_conditional',
    en: 'If I had a new phone, I would take better photos.', pt: 'Se eu tivesse um celular novo, tiraria fotos melhores.', alt: [], wrong: 'If I had a new phone, I will take better photos.' },
  { frame_id: 'tc4_diplomatic', intent: 'request_politely', grammar: 'diplomatic_request', pattern_id: 'can_could_request', verb: 'check', noun: 'signal', skill: 'modal_deduction',
    en: 'Would you mind checking the signal again?', pt: 'Você se importaria de verificar o sinal de novo?', alt: [], wrong: 'Would you mind check the signal again?' },
  { frame_id: 'tc4_pp_just', intent: 'report_status_finished', grammar: 'present_perfect', pattern_id: 'subject_have_past_participle_yet', verb: 'finish', noun: 'video_call', skill: 'present_perfect',
    en: 'We have just finished the video call.', pt: 'Acabamos de terminar a videochamada.', alt: ["We've just finished the video call."], wrong: 'We have just finish the video call.' },
  { frame_id: 'tc4_passive2', intent: 'report_changed', grammar: 'passive', pattern_id: 'passive_be_past_participle', verb: 'change', noun: 'password', skill: 'passive_voice',
    en: 'The password was changed yesterday.', pt: 'A senha foi mudada ontem.', alt: [], wrong: 'The password was change yesterday.' },
  { frame_id: 'tc4_deduction', intent: 'make_deduction', grammar: 'modal_deduction', pattern_id: 'subject_modal_base_verb', verb: 'crash', noun: 'app', skill: 'modal_deduction',
    en: 'The app must have crashed during the update.', pt: 'O aplicativo deve ter travado durante a atualização.', alt: [], wrong: 'The app must has crashed during the update.' },
  { frame_id: 'tc4_contrast', intent: 'describe_experience', grammar: 'past_contrast', pattern_id: 'subject_be_complement', verb: 'be', noun: 'laptop', skill: 'verb_to_be',
    en: 'The laptop was expensive, but it was very reliable.', pt: 'O notebook era caro, mas era muito confiável.', alt: [], wrong: 'The laptop expensive, but it was very reliable.' },
]

export const FRAMES = {
  travel: { A1: travel_A1, A2: travel_A2, B1: travel_B1, B2: travel_B2 },
  workplace: { A1: workplace_A1, A2: workplace_A2, B1: workplace_B1, B2: workplace_B2 },
  food_and_restaurants: { A1: food_A1, A2: food_A2, B1: food_B1, B2: food_B2 },
  daily_life: { A1: daily_life_A1, A2: daily_life_A2, B1: daily_life_B1, B2: daily_life_B2 },
  shopping_and_services: { A1: shopping_A1, A2: shopping_A2, B1: shopping_B1, B2: shopping_B2 },
  technology_and_communication: { A1: tech_A1, A2: tech_A2, B1: tech_B1, B2: tech_B2 },
}

// Does a frame set exist for this theme×level?
export function framesFor(theme, level) {
  return FRAMES[theme]?.[level] || null
}
