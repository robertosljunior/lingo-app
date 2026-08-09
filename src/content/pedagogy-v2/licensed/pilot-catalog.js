// V2.24 pilot authoring data. This is intentionally compact: runtime materializes
// only signatures present in the allow-list. The current approvals are an
// LLM-assisted editorial pass and remain explicitly provisional until a human
// reviewer records approval/timing evidence in test-evidence/v2-24/.

export const STILL_LEXICAL_PILOT = Object.freeze({
  strategy: 'lexical_slots',
  pack_id: 'pedagogy_v2_still',
  parent_exemplar_id: 'exemplar:still.002',
  construction_stage: 'A1',
  template: {
    en: '{{subject}} still {{predicate}}.',
    pt: '{{subject}} ainda {{predicate}}.',
  },
  subjects: Object.freeze([
    { filler_id: 'still.subject.they', en: 'They', pt: 'Eles', introduced_stage: 'A1', prerequisites: [], context_items: [] },
    { filler_id: 'still.subject.my_parents', en: 'My parents', pt: 'Meus pais', introduced_stage: 'A1-A2', prerequisites: [], context_items: ['parents'] },
    { filler_id: 'still.subject.my_friends', en: 'My friends', pt: 'Meus amigos', introduced_stage: 'A1-A2', prerequisites: [], context_items: ['friends'] },
    { filler_id: 'still.subject.our_neighbors', en: 'Our neighbors', pt: 'Nossos vizinhos', introduced_stage: 'A2', prerequisites: [], context_items: ['neighbors'] },
  ]),
  predicates: Object.freeze([
    { filler_id: 'still.predicate.live_nearby', en: 'live nearby', pt: 'moram perto', introduced_stage: 'A1-A2', prerequisites: [], context_items: ['live', 'nearby'] },
    { filler_id: 'still.predicate.work_here', en: 'work here', pt: 'trabalham aqui', introduced_stage: 'A1', prerequisites: [], context_items: ['work', 'here'] },
    { filler_id: 'still.predicate.use_this_app', en: 'use this app', pt: 'usam este aplicativo', introduced_stage: 'A2', prerequisites: [], context_items: ['use', 'app'] },
    { filler_id: 'still.predicate.need_more_time', en: 'need more time', pt: 'precisam de mais tempo', introduced_stage: 'A2', prerequisites: [], context_items: ['need', 'time'] },
  ]),
})

export const UNLESS_CLAUSE_PILOT = Object.freeze({
  strategy: 'clause_frame',
  pack_id: 'pedagogy_v2_unless',
  construction_stage: 'A2-B1',
  template: {
    en: 'Unless {{condition}}, {{result}}.',
    pt: 'A menos que {{condition}}, {{result}}.',
  },
  frames: Object.freeze([
    {
      frame_id: 'unless.frame.weather_plan',
      parent_exemplar_id: 'exemplar:unless.001',
      introduced_stage: 'A2-B1',
      prerequisites: [],
      conditions: [
        { filler_id: 'unless.weather.rains', en: 'it rains', pt: 'chova', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['rains'] },
        { filler_id: 'unless.weather.worse', en: 'the weather gets worse', pt: 'o tempo piore', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['weather', 'worse'] },
      ],
      results: [
        { filler_id: 'unless.weather.eat_outside', en: "we'll eat outside", pt: 'vamos comer do lado de fora', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['eat', 'outside'] },
        { filler_id: 'unless.weather.walk', en: "we'll go for a walk", pt: 'vamos sair para caminhar', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['walk'] },
      ],
    },
    {
      frame_id: 'unless.frame.deadline_work',
      parent_exemplar_id: 'exemplar:unless.002',
      introduced_stage: 'A2-B1',
      prerequisites: [],
      conditions: [
        { filler_id: 'unless.work.deadline_changes', en: 'the client changes the deadline', pt: 'o cliente mude o prazo', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['client', 'deadline'] },
        { filler_id: 'unless.work.urgent', en: 'something urgent comes up', pt: 'apareça algo urgente', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['urgent'] },
      ],
      results: [
        { filler_id: 'unless.work.send_update', en: "we'll send the update this afternoon", pt: 'vamos enviar a atualização esta tarde', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['update', 'afternoon'] },
        { filler_id: 'unless.work.close_task', en: "I'll finish the task before dinner", pt: 'vou terminar a tarefa antes do jantar', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['task', 'dinner'] },
      ],
    },
    {
      frame_id: 'unless.frame.transport_plan',
      parent_exemplar_id: 'exemplar:unless.003',
      introduced_stage: 'A2-B1',
      prerequisites: [],
      conditions: [
        { filler_id: 'unless.transport.train_delayed', en: 'the train is delayed', pt: 'o trem atrase', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['train', 'delayed'] },
        { filler_id: 'unless.transport.traffic_worse', en: 'traffic gets much worse', pt: 'o trânsito piore muito', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['traffic', 'worse'] },
      ],
      results: [
        { filler_id: 'unless.transport.on_time', en: "I'll be there on time", pt: 'vou chegar no horário', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['time'] },
        { filler_id: 'unless.transport.morning_meeting', en: "we'll make the morning meeting", pt: 'vamos chegar a tempo para a reunião da manhã', introduced_stage: 'A2-B1', prerequisites: [], context_items: ['morning', 'meeting'] },
      ],
    },
  ]),
})

const provisional = (pilot_id, slots, frame_id = null) => Object.freeze({
  pilot_id,
  slots: Object.freeze({ ...slots }),
  ...(frame_id ? { frame_id } : {}),
  approval: Object.freeze({
    status: 'provisional_nonhuman',
    approved_by: 'assistant:v2.24-pilot-editorial-pass',
    approved_at: '2026-08-09T00:00:00.000Z',
  }),
})

// 12 deliberately selected lexical-slot signatures. The wider filler bank can
// enumerate more candidates, but runtime never uses a Cartesian product.
export const STILL_PILOT_ALLOWLIST = Object.freeze([
  provisional('still-01', { subject: 'still.subject.they', predicate: 'still.predicate.live_nearby' }),
  provisional('still-02', { subject: 'still.subject.they', predicate: 'still.predicate.work_here' }),
  provisional('still-03', { subject: 'still.subject.they', predicate: 'still.predicate.use_this_app' }),
  provisional('still-04', { subject: 'still.subject.my_parents', predicate: 'still.predicate.live_nearby' }),
  provisional('still-05', { subject: 'still.subject.my_parents', predicate: 'still.predicate.use_this_app' }),
  provisional('still-06', { subject: 'still.subject.my_parents', predicate: 'still.predicate.need_more_time' }),
  provisional('still-07', { subject: 'still.subject.my_friends', predicate: 'still.predicate.live_nearby' }),
  provisional('still-08', { subject: 'still.subject.my_friends', predicate: 'still.predicate.work_here' }),
  provisional('still-09', { subject: 'still.subject.my_friends', predicate: 'still.predicate.use_this_app' }),
  provisional('still-10', { subject: 'still.subject.our_neighbors', predicate: 'still.predicate.live_nearby' }),
  provisional('still-11', { subject: 'still.subject.our_neighbors', predicate: 'still.predicate.work_here' }),
  provisional('still-12', { subject: 'still.subject.our_neighbors', predicate: 'still.predicate.need_more_time' }),
])

// Clause-frame signatures are licensed only inside their authored pragmatic
// frame. 2 conditions × 2 results × 3 frames = 12 candidates, never cross-frame.
export const UNLESS_PILOT_ALLOWLIST = Object.freeze([
  ...UNLESS_CLAUSE_PILOT.frames.flatMap((frame) => frame.conditions.flatMap((condition) => frame.results.map((result) =>
    provisional(`${frame.frame_id}:${condition.filler_id}:${result.filler_id}`, {
      condition: condition.filler_id,
      result: result.filler_id,
    }, frame.frame_id)))),
])
