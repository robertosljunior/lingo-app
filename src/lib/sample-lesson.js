// sample-lesson.js — the example lesson shipped with the app (offline seed).

export const SAMPLE_YAML = `lesson_id: eng_007
level: B1
focus: jobs_companies
q:
  - id: 1
    t: translate_natural
    pt: Eles têm vagas abertas?
    ctx: Você está conversando com um recrutador sobre uma vaga.
    p: Diga isso naturalmente em inglês.
    a: Do they have any open positions?
    alt: [Are they hiring?, Do they have any openings?]
    f: question_structure
  - id: 2
    t: build_sentence
    pt: Eu trabalharia lá com certeza.
    p: Monte uma frase natural.
    words: [I, would, work, there, for sure]
    a: I would work there for sure.
    f: word_order
  - id: 3
    t: rewrite_natural
    p: Reescreva de forma natural.
    original: I am working in this company since two years.
    a: I've been working at this company for two years.
    alt: [I have been working at this company for two years.]
    f: unnatural_translation
  - id: 4
    t: fill_blank
    p: This seems ___ a great company.
    opt: [like, as, with]
    a: like
    f: collocation
  - id: 5
    t: choose_best
    p: Choose the most natural way to ask about the salary.
    opt: [What is the salary?, Could you tell me the salary range?, How much money?]
    a: Could you tell me the salary range?
    f: question_structure`
