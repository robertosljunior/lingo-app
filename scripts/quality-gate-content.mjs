// quality-gate-content.mjs — PARTE 27: 6 temas × 4 níveis × 10 seeds × 30
// perguntas = 7.200 perguntas geradas e validadas a partir dos content packs.
//   node scripts/quality-gate-content.mjs
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)))
const packsDir = path.join(root, 'src/content/packs')

function loadPacks() {
  const out = []
  for (const dir of fs.readdirSync(packsDir)) {
    for (const f of fs.readdirSync(path.join(packsDir, dir))) {
      out.push(JSON.parse(fs.readFileSync(path.join(packsDir, dir, f), 'utf8')))
    }
  }
  return out
}

const { setBundledPacksForNode, composeBundledSnapshot } = await import('../src/lib/content-pack-loader.js')
const { validateContentPack } = await import('../src/lib/content-pack-validator.js')
const { generateLesson } = await import('../src/lib/lesson-generator.js')
const { validateGeneratedLesson } = await import('../src/lib/generated-lesson-validator.js')
const { getPattern, isKnownConstraint, isKnownStrategy } = await import('../src/lib/content-rule-registry.js')

const packs = loadPacks()
setBundledPacksForNode(packs)

const THEMES = ['daily_life', 'workplace', 'travel', 'food_and_restaurants', 'shopping_and_services', 'technology_and_communication']
const LEVELS = ['A1', 'A2', 'B1', 'B2']
const SEEDS = 10
const QUESTIONS = 30

const t0 = performance.now()
const report = {
  packs: packs.length,
  theme_level_combinations: 0,
  lessons_generated: 0,
  questions_generated: 0,
  invalid_packs: 0,
  invalid_lessons: 0,
  invalid_questions: 0,
  duplicate_ids: 0,
  duplicate_signatures_within_lesson: 0,
  unresolved_references: 0,
  unknown_patterns: 0,
  unknown_constraints: 0,
  unknown_strategies: 0,
  forbidden_correct_answers: 0,
  level_distribution: {},
  theme_distribution: {},
  exercise_type_distribution: {},
  skill_distribution: {},
  duration_ms: 0,
}

// Pack-level checks.
const knownPacks = packs.map((p) => p.manifest.pack_id)
const allIds = new Set()
for (const pack of packs) {
  const v = validateContentPack(pack, { knownPacks })
  if (!v.valid) { report.invalid_packs++; console.error(pack.manifest?.pack_id, v.errors) }
  for (const t of pack.template_definitions) {
    if (!getPattern(t.pattern_id)) report.unknown_patterns++
    for (const c of t.constraints || []) if (!isKnownConstraint(c)) report.unknown_constraints++
    for (const s of t.distractor_strategy_ids || []) if (!isKnownStrategy(s)) report.unknown_strategies++
  }
  for (const id of [pack.manifest.pack_id, ...pack.lexical_items.map((x) => x.item_id), ...pack.template_definitions.map((x) => x.template_id), ...pack.collocations.map((x) => x.collocation_id)]) {
    if (allIds.has(id)) report.duplicate_ids++
    allIds.add(id)
  }
  for (const dep of pack.manifest.dependencies || []) if (!knownPacks.includes(dep)) report.unresolved_references++
}

for (const theme of THEMES) {
  for (const level of LEVELS) {
    report.theme_level_combinations++
    const snapshot = composeBundledSnapshot(theme, level)
    for (let s = 0; s < SEEDS; s++) {
      let lesson
      try {
        lesson = generateLesson({ context: { profile_id: `qg-${s}` }, contentSnapshot: snapshot, seed: `qg-${theme}-${level}-${s}`, questionCount: QUESTIONS })
      } catch (e) {
        report.invalid_lessons++
        console.error(`GENERATION FAILED ${theme}/${level}/${s}: ${e.message}`)
        continue
      }
      report.lessons_generated++
      report.questions_generated += lesson.questions.length
      const v = validateGeneratedLesson(lesson, { expectedCount: QUESTIONS, collocations: snapshot.collocations })
      if (!v.valid) { report.invalid_lessons++; console.error(`${theme}/${level}/${s}`, v.errors.slice(0, 5)) }
      report.invalid_questions += v.question_results.filter((q) => !q.valid).length
      const sigs = lesson.questions.map((q) => q.metadata.question_signature)
      report.duplicate_signatures_within_lesson += sigs.length - new Set(sigs).size
      report.forbidden_correct_answers += v.errors.filter((e) => e.includes('INVALID_COLLOCATION_AS_ANSWER')).length
      report.level_distribution[level] = (report.level_distribution[level] || 0) + lesson.questions.length
      report.theme_distribution[theme] = (report.theme_distribution[theme] || 0) + lesson.questions.length
      for (const q of lesson.questions) {
        report.exercise_type_distribution[q.type] = (report.exercise_type_distribution[q.type] || 0) + 1
        report.skill_distribution[q.metadata.primary_skill_id] = (report.skill_distribution[q.metadata.primary_skill_id] || 0) + 1
      }
    }
  }
}

report.duration_ms = Math.round(performance.now() - t0)
console.log(JSON.stringify(report, null, 2))
const pass = report.invalid_packs === 0 && report.invalid_lessons === 0 && report.invalid_questions === 0
  && report.duplicate_ids === 0 && report.duplicate_signatures_within_lesson === 0
  && report.unknown_patterns === 0 && report.unknown_constraints === 0 && report.unknown_strategies === 0
  && report.unresolved_references === 0 && report.forbidden_correct_answers === 0
  && report.questions_generated === THEMES.length * LEVELS.length * SEEDS * QUESTIONS
console.log(pass ? 'QUALITY_GATE_PASS' : 'QUALITY_GATE_FAIL')
process.exit(pass ? 0 : 1)
