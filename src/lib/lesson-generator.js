// lesson-generator.js — deterministic, offline lesson generation. Since
// Slice 5 the generator no longer knows any theme: all linguistic content
// (templates with declarative variants, lexical items, collocations) arrives
// through an immutable contentSnapshot resolved from the content pack stores.
// JS keeps only the engine: patterns, constraints and distractor strategies.

import yaml from 'js-yaml'
import { seededRandom } from './adaptive-planner.js'
import { getSkill } from './skill-registry.js'
import { buildDistractorOptions } from './content-rule-registry.js'
import { parseLesson } from './lesson-parser.js'

export const LESSON_GENERATOR_VERSION = '1'
export const SUPPORTED_GENERATED_TYPES = ['translate_natural', 'fill_blank', 'build_sentence', 'choose_best', 'rewrite_natural', 'listen_type', 'speak_sentence']
const TYPE_TARGET_30 = { translate_natural: 6, fill_blank: 5, build_sentence: 5, choose_best: 4, rewrite_natural: 4, listen_type: 3, speak_sentence: 3 }

export function normalize(s) { return String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim() }

// Guard: an expected answer must never contain a known invalid collocation
// variant from the snapshot content.
export function buildCollocationGuard(collocations = []) {
  const rules = collocations.map((c) => ({ canonical: c.canonical, invalid_variants: (c.invalid_variants || []).map((v) => v.text || v) }))
  return {
    rules,
    validate(answer = '') {
      const normalized = normalize(answer)
      for (const rule of rules) {
        for (const bad of rule.invalid_variants) if (normalized.includes(normalize(bad))) return { valid: false, rule, invalid_variant: bad }
      }
      return { valid: true }
    },
  }
}

export function allocateLessonSkills(context = {}, questionCount = 30, snapshot = null) {
  const targets = (context.target_skills || []).filter((s) => s.skill_id && s.skill_id !== 'missing_auxiliary')
  const rein = (context.reinforcement_skills || []).filter((s) => s.skill_id && s.skill_id !== 'missing_auxiliary')
  // Skill inventory comes from the snapshot templates, never hardcoded.
  const available = [...new Set((snapshot?.template_definitions || []).map((t) => t.primary_skill_id))]
  const desired = []
  const targetN = Math.max(Math.ceil(questionCount * .5), Math.round(questionCount * .55))
  const reinN = Math.round(questionCount * .25)
  const max = Math.max(1, Math.floor(questionCount * .4))
  function pushMany(id, n, group) { for (let i = 0; i < n; i++) desired.push({ skill_id: id, group }) }
  const targetIds = targets.length ? targets.map((s) => s.skill_id) : available.slice(0, 2)
  targetIds.forEach((id, i) => pushMany(id, Math.min(max, Math.floor(targetN / targetIds.length) + (i < targetN % targetIds.length ? 1 : 0)), 'target'))
  const reinIds = rein.length ? rein.map((s) => s.skill_id) : available.slice(2, 4)
  reinIds.forEach((id, i) => pushMany(id, Math.min(max, Math.floor(reinN / reinIds.length) + (i < reinN % reinIds.length ? 1 : 0)), 'reinforcement'))
  const maint = available.filter((id) => !targetIds.includes(id) && !reinIds.includes(id)).slice(0, 5)
  maint.forEach((id) => pushMany(id, 1, 'maintenance'))
  let i = 0
  const pool = [...targetIds, ...reinIds, ...maint].filter(Boolean)
  while (desired.length < questionCount && i < questionCount * 4 && pool.length) {
    const id = pool[i % pool.length]
    if (desired.filter((x) => x.skill_id === id).length < max) desired.push({ skill_id: id, group: targetIds.includes(id) ? 'target' : 'review' })
    i++
  }
  return desired.slice(0, questionCount)
}

export function exerciseTypePlan(questionCount = 30) {
  if (questionCount === 30) return Object.entries(TYPE_TARGET_30).flatMap(([t, n]) => Array(n).fill(t))
  const total = 30; const counts = {}; let used = 0
  for (const [t, n] of Object.entries(TYPE_TARGET_30)) { counts[t] = Math.max(1, Math.floor(questionCount * n / total)); used += counts[t] }
  const order = Object.keys(TYPE_TARGET_30); let i = 0
  while (used < questionCount) { counts[order[i++ % order.length]]++; used++ }
  while (used > questionCount) { const t = order.slice().reverse().find((x) => counts[x] > 1); counts[t]--; used-- }
  return order.flatMap((t) => Array(counts[t]).fill(t))
}

// New Slice 5 contract: content arrives exclusively via contentSnapshot.
export function generateLesson({ context = {}, contentSnapshot, seed = null, questionCount = 30 } = {}) {
  if (!contentSnapshot?.template_definitions?.length) {
    throw new Error('CONTENT_SNAPSHOT_REQUIRED: generateLesson precisa de um contentSnapshot com templates')
  }
  const snapshot = contentSnapshot
  const level = snapshot.level || context.level || 'B1'
  const theme = snapshot.theme || 'workplace'
  const profileId = context.profile_id || 'default'
  // Owner scope + theme + level + packs + versions + checksum + generator
  // version + target skills all participate in the generation key.
  const effectiveSeed = seed || [
    profileId, theme, level,
    snapshot.pack_ids.join(','),
    Object.entries(snapshot.pack_versions).map(([k, v]) => `${k}@${v}`).join(','),
    snapshot.checksum, LESSON_GENERATOR_VERSION,
    (context.target_skills || []).map((s) => s.skill_id).join(','),
  ].join(':')

  const rng = seededRandom(effectiveSeed)
  const templates = snapshot.template_definitions
  const guard = buildCollocationGuard(snapshot.collocations)
  const skillPlan = allocateLessonSkills(context, questionCount, snapshot)
  const typePlan = exerciseTypePlan(questionCount)
  const recent = new Set((context.recent_sentences || []).map(normalize))
  const warnings = []; const qs = []; const signatures = new Set(); const familyCounts = {}; const templateIds = []

  for (let i = 0; i < questionCount; i++) {
    const type = typePlan[i]; const skill = skillPlan[i]?.skill_id; let made = null
    const pool = shuffleStable(templates.filter((t) => t.exercise_types.includes(type) && (t.skill_ids.includes(skill) || t.primary_skill_id === skill)), rng)
      .concat(shuffleStable(templates.filter((t) => t.exercise_types.includes(type)), rng))
    for (const t of pool) {
      if ((familyCounts[t.family_id] || 0) >= 3) continue
      const variant = pickVariant(t, effectiveSeed)
      if (!variant) continue
      const q = buildQuestion(t, variant, type, qs.length + 1)
      const sig = questionSignature(q, t)
      const content = normalize(q.expected_answer)
      if (signatures.has(sig) || recent.has(content)) { warnings.push({ code: 'DUPLICATE_CONTENT_REJECTED', template_id: t.template_id }); continue }
      if (!guard.validate(q.expected_answer).valid) { warnings.push({ code: 'FORBIDDEN_ANSWER_REJECTED', template_id: t.template_id }); continue }
      q.metadata = { template_id: t.template_id, family_id: t.family_id, generator_version: LESSON_GENERATOR_VERSION, primary_skill_id: t.primary_skill_id, skill_ids: t.skill_ids, question_signature: sig, content_signature: content, resolved_slot_ids: Object.keys(t.slots || {}), pattern_id: t.pattern_id }
      made = q; signatures.add(sig); familyCounts[t.family_id] = (familyCounts[t.family_id] || 0) + 1; templateIds.push(t.template_id); break
    }
    if (made) qs.push(made); else warnings.push({ code: 'INSUFFICIENT_TEMPLATES_FOR_SKILL', skill_id: skill, type })
  }

  // The id is scoped by owner profile + full content identity, so pack
  // updates legitimately change the generated lesson while the same profile,
  // seed, packs and count stay idempotent.
  const lesson_id = `gen_${level.toLowerCase()}_${hash(`${profileId}:${effectiveSeed}:${questionCount}`).slice(0, 8)}`
  qs.forEach((q, i) => { q.id = i + 1; q.generated_question_id = `${lesson_id}:${q.id}` })
  const lesson = {
    lesson_id,
    title: titleFor(context, theme, level),
    level,
    focus: `adaptive_${theme}_english`,
    generated: true,
    owner_profile_id: context.profile_id || null,
    questions: qs,
    generation_metadata: {
      generator_version: LESSON_GENERATOR_VERSION,
      content_pack_ids: [...snapshot.pack_ids],
      content_pack_versions: { ...snapshot.pack_versions },
      content_snapshot_checksum: snapshot.checksum,
      content_schema_version: snapshot.content_schema_version || '1',
      theme, profile_id: context.profile_id || null,
      seed: effectiveSeed,
      generated_at: new Date(0).toISOString(),
      requested_questions: questionCount,
      actual_questions: qs.length,
      target_skills: (context.target_skills || []).map((s) => s.skill_id),
      template_ids: templateIds,
      template_family_counts: familyCounts,
      warnings,
    },
  }
  lesson.raw_content = buildGeneratedLessonYaml(lesson)
  const parsed = parseLesson(lesson.raw_content)
  if (parsed.questions.length !== lesson.questions.length) throw new Error('Generated lesson YAML round-trip failed')
  return lesson
}

const THEME_TITLES = {
  daily_life: 'Vida cotidiana', workplace: 'Inglês profissional', travel: 'Viagens',
  food_and_restaurants: 'Comida e restaurantes', shopping_and_services: 'Compras e serviços',
  technology_and_communication: 'Tecnologia e comunicação',
}

function titleFor(context, theme, level) {
  const labels = (context.target_skills || []).slice(0, 2).map((s) => getSkill(s.skill_id)?.label_pt).filter(Boolean)
  const base = `${THEME_TITLES[theme] || 'Revisão'} ${level}`
  return labels.length ? `${base}: ${labels.join(' e ')}` : `${base} adaptativa`
}

function pickVariant(t, seed) {
  const variants = t.variants || []
  if (!variants.length) return null
  if (variants.length === 1) return variants[0]
  const r = seededRandom(`${seed}:${t.template_id}`)
  return variants[Math.floor(r() * variants.length) % variants.length]
}

function buildQuestion(t, v, type, id) {
  const a = v.en; const f = t.primary_skill_id
  const prompts = t.prompt_templates || {}
  const base = { id, type, prompt: '', prompt_pt: v.pt, context: v.ctx, expected_answer: a, accepted_answers: [], options: null, words: null, original: null, skill_target: f, lesson_focus: f, mistake_focus: f, payload: null }
  if (type === 'translate_natural') Object.assign(base, { prompt: prompts.translate_natural || 'Traduza naturalmente.', accepted_answers: contractionAlternates(a) })
  if (type === 'fill_blank') Object.assign(base, { prompt: a.replace(v.blank, '____'), expected_answer: v.blank, options: buildDistractorOptions(v.blank, { ...t, invalid_blanks: v.invalid_blanks }) })
  if (type === 'build_sentence') Object.assign(base, { prompt: 'Monte a frase em inglês.', words: tokenize(a) })
  if (type === 'choose_best') Object.assign(base, { prompt: v.ctx || 'Escolha a frase mais natural.', options: shuffleFixed(uniqueOptions([a, v.wrong, sentenceCorruption(a, v)]).slice(0, 3), t.template_id) })
  if (type === 'rewrite_natural') Object.assign(base, { prompt: prompts.rewrite_natural || 'Reescreva a frase de forma natural e correta.', original: v.wrong })
  if (type === 'listen_type') Object.assign(base, { prompt: 'Ouça a frase e digite exatamente o que ouvir.' })
  if (type === 'speak_sentence') Object.assign(base, { prompt: 'Fale a frase em inglês.' })
  base.payload = compact(base, t)
  return base
}

function contractionAlternates(a) {
  const map = [["I've", 'I have'], ["She's been", 'She has been'], ["He's been", 'He has been'], ["We've", 'We have'], ["They've", 'They have'], ["I'll", 'I will'], ["Let's", 'Let us']]
  for (const [c, full] of map) if (a.includes(c)) return [a.replace(c, full)]
  return []
}

// A third choose_best distractor built by the engine (never by pack data):
// swap two mid-sentence words, or fall back to a trailing corruption.
function sentenceCorruption(a, v) {
  const words = a.replace(/[.?!]$/, '').split(' ')
  if (words.length >= 4) {
    const i = Math.max(1, Math.floor(words.length / 2) - 1)
    const swapped = [...words]
    ;[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]]
    const candidate = swapped.join(' ') + (a.match(/[.?!]$/)?.[0] || '')
    if (normalize(candidate) !== normalize(a) && normalize(candidate) !== normalize(v.wrong)) return candidate
  }
  return a.replace(/[.?!]?$/, '') + ' please?'
}

function compact(q, t) {
  const o = { id: q.id, t: q.type }
  if (q.prompt_pt) o.pt = q.prompt_pt
  if (q.context) o.ctx = q.context
  if (q.prompt) o.p = q.prompt
  if (q.original) o.original = q.original
  if (q.options) o.opt = q.options
  if (q.words) o.words = q.words
  o.a = q.expected_answer
  if (q.accepted_answers?.length) o.alt = q.accepted_answers
  o.f = q.skill_target
  o.template_id = t.template_id
  o.family_id = t.family_id
  o.skill_ids = t.skill_ids
  return o
}

function uniqueOptions(xs) { const seen = new Set(); return xs.filter((x) => { const n = normalize(x); if (!n || seen.has(n)) return false; seen.add(n); return true }) }
function tokenize(s) { return String(s).match(/[A-Za-z]+(?:[-'][A-Za-z]+)*|[.,!?;]/g) || [] }
function questionSignature(q, t) { return hash(`${q.type}|${t.family_id}|${normalize(q.prompt)}|${normalize(q.expected_answer)}`) }
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return (h >>> 0).toString(16).padStart(8, '0') }
function shuffleStable(arr, rng) { return arr.map((x) => [rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]) }
function shuffleFixed(arr, seed) { const r = seededRandom(seed); return shuffleStable(arr, r) }
function yamlQuestion(q) {
  const o = { id: q.id, t: q.type }
  if (q.prompt_pt) o.pt = q.prompt_pt
  if (q.context) o.ctx = q.context
  if (q.prompt) o.p = q.prompt
  if (q.original) o.original = q.original
  if (q.options) o.opt = q.options
  if (q.words) o.words = q.words
  o.a = q.expected_answer
  if (q.accepted_answers?.length) o.alt = q.accepted_answers
  o.f = q.skill_target
  return o
}
export function buildGeneratedLessonYaml(lesson) { return yaml.dump({ lesson_id: lesson.lesson_id, title: lesson.title, level: lesson.level, focus: lesson.focus, q: lesson.questions.map(yamlQuestion) }, { schema: yaml.JSON_SCHEMA, lineWidth: 120, noRefs: true, sortKeys: false }) }
