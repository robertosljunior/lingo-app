// Diagnostic-only E2E: drives the real learner-facing "Praticar agora" flow
// for ten complete sessions and reports recipe/cognitive-demand distribution.
// It does not force plans, alter planner policy, or change product behavior.

import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, answerLearnerActivity } from './v2-helpers.js'

const OUT_DIR = join(process.cwd(), 'test-results', 'practice-ten-round-recipe-audit')
const REPORT_JSON = join(OUT_DIR, 'report.json')
const REPORT_MD = join(OUT_DIR, 'report.md')
const ROUND_COUNT = 10
const MAX_ACTIVITY_GUARD = 20

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function countBy(rows, keyFn) {
  const counts = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

function countsObject(counts) {
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))))
}

function pct(count, total) {
  return total ? count / total : 0
}

function interactionMode(recipe) {
  if (recipe === 'exposure') return 'exposure'
  if (['meaning_recognition', 'listening_recognition', 'context_recognition'].includes(recipe)) return 'option_select'
  if (recipe === 'word_order_reconstruction') return 'word_order'
  if (recipe === 'fixed_element_completion') return 'completion'
  if (['guided_production', 'free_production'].includes(recipe)) return 'production'
  if (recipe === 'pronunciation') return 'pronunciation'
  return recipe ? `other:${recipe}` : 'unknown'
}

function maxCount(counts) {
  return counts.size ? Math.max(...counts.values()) : 0
}

function summarizeRound(round) {
  const recipeCounts = countBy(round.activities, (row) => row.recipe)
  const modeCounts = countBy(round.activities, (row) => interactionMode(row.recipe))
  const capabilityCounts = countBy(round.activities, (row) => row.capability)
  const exemplarCounts = countBy(round.activities, (row) => row.exemplar_id)
  const pairCounts = countBy(round.activities, (row) => row.exemplar_id && row.recipe ? `${row.exemplar_id}::${row.recipe}` : null)
  const repeatedSamePairExcess = [...pairCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0)
  return {
    round: round.round,
    activities: round.activities.length,
    recipe_counts: countsObject(recipeCounts),
    interaction_mode_counts: countsObject(modeCounts),
    capability_counts: countsObject(capabilityCounts),
    unique_exemplars: exemplarCounts.size,
    max_same_exemplar_occurrences: maxCount(exemplarCounts),
    same_exemplar_recipe_repeat_excess: repeatedSamePairExcess,
  }
}

function analyze(rounds) {
  const all = rounds.flatMap((round) => round.activities)
  const recipeCounts = countBy(all, (row) => row.recipe)
  const modeCounts = countBy(all, (row) => interactionMode(row.recipe))
  const capabilityCounts = countBy(all, (row) => row.capability)
  const modalityCounts = countBy(all, (row) => row.modality)
  const textCounts = countBy(all, (row) => normalizeText(row.text_en))
  const exemplarCounts = countBy(all, (row) => row.exemplar_id)
  const constructionCounts = countBy(all, (row) => row.construction_id)
  const pairCounts = countBy(all, (row) => row.exemplar_id && row.recipe ? `${row.exemplar_id}::${row.recipe}` : null)
  const assessed = all.filter((row) => row.recipe !== 'exposure')
  const optionSelectAssessed = assessed.filter((row) => interactionMode(row.recipe) === 'option_select').length
  const samePairIntraSessionExcess = rounds.reduce((sum, round) => {
    const counts = countBy(round.activities, (row) => row.exemplar_id && row.recipe ? `${row.exemplar_id}::${row.recipe}` : null)
    return sum + [...counts.values()].reduce((inner, count) => inner + Math.max(0, count - 1), 0)
  }, 0)

  return {
    generated_at: new Date().toISOString(),
    scope: 'learner-facing Praticar agora; real UI/planner/engine; ten consecutive complete sessions',
    rounds_requested: ROUND_COUNT,
    rounds_completed: rounds.length,
    total_activities: all.length,
    assessed_activities: assessed.length,
    recipe_counts: countsObject(recipeCounts),
    recipe_rates: Object.fromEntries([...recipeCounts].map(([key, count]) => [key, pct(count, all.length)])),
    interaction_mode_counts: countsObject(modeCounts),
    interaction_mode_rates: Object.fromEntries([...modeCounts].map(([key, count]) => [key, pct(count, all.length)])),
    option_select_among_assessed_count: optionSelectAssessed,
    option_select_among_assessed_rate: pct(optionSelectAssessed, assessed.length),
    capability_counts: countsObject(capabilityCounts),
    modality_counts: countsObject(modalityCounts),
    unique_exact_texts: textCounts.size,
    exact_repeat_excess: all.length - textCounts.size,
    exact_repeat_excess_rate: pct(all.length - textCounts.size, all.length),
    unique_exemplars: exemplarCounts.size,
    max_same_exemplar_occurrences: maxCount(exemplarCounts),
    unique_constructions: constructionCounts.size,
    max_same_construction_occurrences: maxCount(constructionCounts),
    unique_exemplar_recipe_pairs: pairCounts.size,
    same_exemplar_recipe_intra_session_repeat_excess: samePairIntraSessionExcess,
    round_summaries: rounds.map(summarizeRound),
    rounds,
  }
}

function markdown(report) {
  const percent = (value) => `${(value * 100).toFixed(2)}%`
  const lines = [
    '# Ten-round Praticar recipe audit',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Overall',
    '',
    `- Rounds completed: ${report.rounds_completed}/${report.rounds_requested}`,
    `- Activities observed: ${report.total_activities}`,
    `- Activities requiring an answer: ${report.assessed_activities}`,
    `- Option-select among answer-requiring activities: ${report.option_select_among_assessed_count}/${report.assessed_activities} (${percent(report.option_select_among_assessed_rate)})`,
    `- Unique exact English phrases: ${report.unique_exact_texts}`,
    `- Exact repeat excess: ${report.exact_repeat_excess} (${percent(report.exact_repeat_excess_rate)})`,
    `- Same exemplar + same recipe repeats inside a session: ${report.same_exemplar_recipe_intra_session_repeat_excess}`,
    '',
    '## Recipe distribution',
    '',
    '| Recipe | Count | Share of all activities |',
    '|---|---:|---:|',
  ]

  for (const [recipe, count] of Object.entries(report.recipe_counts)) {
    lines.push(`| ${recipe} | ${count} | ${percent(count / report.total_activities)} |`)
  }

  lines.push('', '## Interaction-mode distribution', '', '| Mode | Count | Share of all activities |', '|---|---:|---:|')
  for (const [mode, count] of Object.entries(report.interaction_mode_counts)) {
    lines.push(`| ${mode} | ${count} | ${percent(count / report.total_activities)} |`)
  }

  lines.push('', '## Capability distribution', '', '| Capability | Count | Share of all activities |', '|---|---:|---:|')
  for (const [capability, count] of Object.entries(report.capability_counts)) {
    lines.push(`| ${capability} | ${count} | ${percent(count / report.total_activities)} |`)
  }

  lines.push('', '## Per round', '')
  for (const row of report.round_summaries) {
    lines.push(`### Round ${row.round}`)
    lines.push('')
    lines.push(`- Activities: ${row.activities}`)
    lines.push(`- Recipes: ${JSON.stringify(row.recipe_counts)}`)
    lines.push(`- Interaction modes: ${JSON.stringify(row.interaction_mode_counts)}`)
    lines.push(`- Capabilities: ${JSON.stringify(row.capability_counts)}`)
    lines.push(`- Same exemplar + same recipe repeat excess: ${row.same_exemplar_recipe_repeat_excess}`)
    lines.push('')
  }

  lines.push('## Full observed sequence', '')
  for (const round of report.rounds) {
    lines.push(`### Round ${round.round}`, '', '| # | Recipe | Mode | Capability | Modality | Exemplar | Construction | English phrase |', '|---:|---|---|---|---|---|---|---|')
    for (const row of round.activities) {
      const safe = (value) => String(value ?? '').replace(/\|/g, '\\|')
      lines.push(`| ${row.position} | ${safe(row.recipe)} | ${safe(interactionMode(row.recipe))} | ${safe(row.capability)} | ${safe(row.modality)} | ${safe(row.exemplar_id)} | ${safe(row.construction_id)} | ${safe(row.text_en)} |`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

async function startPractice(page) {
  await expect(page.getByTestId('v2lx-home')).toBeVisible()
  await page.getByTestId('v2lxh-primary').click()
  await expect(page.getByTestId('v2lx-screen')).toBeVisible()
  await expect(page.getByTestId('v2lx-shell')).toBeVisible()
}

async function returnHomeFromSummary(page) {
  for (const id of ['v2lx-finish', 'v2lx-empty-home', 'v2lx-close']) {
    const button = page.getByTestId(id)
    if (await button.count()) {
      await button.click()
      await expect(page.getByTestId('v2lx-home')).toBeVisible()
      return
    }
  }
  throw new Error('Session summary has no known return-to-home control')
}

test.describe.configure({ mode: 'serial' })

test('Praticar: audit recipe distribution across ten complete rounds', async ({ page, context }) => {
  test.setTimeout(1_500_000)
  mkdirSync(OUT_DIR, { recursive: true })

  // Headless CI has no usable microphone. Keep runtime capability truthful;
  // speaking/pronunciation must not be selected unless actually executable.
  await context.addInitScript(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })

  await enableTestHooks(context)
  await seedFixtures(page, { active: PROFILE_A })
  await setLearnerFlag(page, true)
  await page.setViewportSize({ width: 420, height: 900 })

  const rounds = []
  let runError = null

  try {
    for (let roundNumber = 1; roundNumber <= ROUND_COUNT; roundNumber++) {
      await startPractice(page)
      const round = { round: roundNumber, activities: [] }

      for (let guard = 0; guard < MAX_ACTIVITY_GUARD; guard++) {
        if (await page.getByTestId('v2lx-summary').count()) break
        const activity = page.locator('[data-testid^="v2lx-activity-"]')
        await expect(activity).toBeVisible()

        const snapshot = await page.evaluate(() => {
          const plan = window.__e2e?.v2Activity || {}
          return {
            activity_id: plan.activity_id ?? null,
            exemplar_id: plan.exemplar_id ?? null,
            construction_id: plan.construction_id ?? null,
            primary_target: plan.primary_target ?? null,
            text_en: String(plan.text_en || '').trim(),
            text_pt: String(plan.text_pt || '').trim(),
            recipe: plan.recipe ?? plan.activity_kind ?? null,
            activity_kind: plan.activity_kind ?? null,
            response_type: plan.response_type ?? null,
            capability: plan.capability ?? null,
            modality: plan.modality ?? null,
            support_lane: plan.support_lane ?? plan.lane ?? null,
          }
        })

        round.activities.push({
          round: roundNumber,
          position: round.activities.length + 1,
          ...snapshot,
        })

        const answered = await answerLearnerActivity(page)
        if (!answered) throw new Error(`Unanswerable activity in round ${roundNumber}, position ${round.activities.length}`)
      }

      await expect(page.getByTestId('v2lx-summary'), `round ${roundNumber} did not reach its summary`).toBeVisible()
      expect(round.activities.length, `round ${roundNumber} produced no activities`).toBeGreaterThan(0)
      rounds.push(round)

      await page.screenshot({ path: join(OUT_DIR, `round-${roundNumber}-summary.png`), fullPage: true })
      await returnHomeFromSummary(page)
    }
  } catch (error) {
    runError = error
  } finally {
    const report = analyze(rounds)
    writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    writeFileSync(REPORT_MD, markdown(report), 'utf8')
    console.log('PRACTICE_TEN_ROUND_RECIPE_REPORT_BEGIN')
    console.log(JSON.stringify({
      rounds_completed: report.rounds_completed,
      total_activities: report.total_activities,
      assessed_activities: report.assessed_activities,
      recipe_counts: report.recipe_counts,
      recipe_rates: report.recipe_rates,
      interaction_mode_counts: report.interaction_mode_counts,
      option_select_among_assessed_count: report.option_select_among_assessed_count,
      option_select_among_assessed_rate: report.option_select_among_assessed_rate,
      capability_counts: report.capability_counts,
      modality_counts: report.modality_counts,
      unique_exact_texts: report.unique_exact_texts,
      exact_repeat_excess: report.exact_repeat_excess,
      exact_repeat_excess_rate: report.exact_repeat_excess_rate,
      same_exemplar_recipe_intra_session_repeat_excess: report.same_exemplar_recipe_intra_session_repeat_excess,
      round_summaries: report.round_summaries,
    }, null, 2))
    console.log('PRACTICE_TEN_ROUND_RECIPE_REPORT_END')
  }

  if (runError) throw runError
  expect(rounds).toHaveLength(ROUND_COUNT)
})
