// Diagnostic-only E2E: drives the real learner-facing "Praticar agora" flow
// for four complete sessions and writes a repetition report. It does not force
// plans, alter planner policy, or change product behavior.

import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { enableTestHooks, seedFixtures, PROFILE_A } from './helpers.js'
import { setLearnerFlag, answerLearnerActivity } from './v2-helpers.js'

const OUT_DIR = join(process.cwd(), 'test-results', 'practice-four-round-repetition')
const REPORT_JSON = join(OUT_DIR, 'report.json')
const REPORT_MD = join(OUT_DIR, 'report.md')
const ROUND_COUNT = 4
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

function maxCount(counts) {
  return counts.size ? Math.max(...counts.values()) : 0
}

function summarizeRound(round) {
  const textCounts = countBy(round.activities, (row) => normalizeText(row.text_en))
  const exemplarCounts = countBy(round.activities, (row) => row.exemplar_id)
  const constructionCounts = countBy(round.activities, (row) => row.construction_id)
  return {
    round: round.round,
    activities: round.activities.length,
    unique_texts: textCounts.size,
    exact_repeat_excess: round.activities.length - textCounts.size,
    distinct_repeated_texts: [...textCounts.values()].filter((count) => count > 1).length,
    max_same_text_occurrences: maxCount(textCounts),
    unique_exemplars: exemplarCounts.size,
    max_same_exemplar_occurrences: maxCount(exemplarCounts),
    unique_constructions: constructionCounts.size,
    max_same_construction_occurrences: maxCount(constructionCounts),
  }
}

function analyze(rounds) {
  const all = rounds.flatMap((round) => round.activities)
  const textCounts = countBy(all, (row) => normalizeText(row.text_en))
  const exemplarCounts = countBy(all, (row) => row.exemplar_id)
  const constructionCounts = countBy(all, (row) => row.construction_id)
  const roundsByText = new Map()

  for (const row of all) {
    const text = normalizeText(row.text_en)
    if (!text) continue
    if (!roundsByText.has(text)) roundsByText.set(text, new Set())
    roundsByText.get(text).add(row.round)
  }

  const repeatedTexts = [...textCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([text_en, count]) => ({
      text_en,
      count,
      rounds: [...(roundsByText.get(text_en) || [])].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count || a.text_en.localeCompare(b.text_en))

  const repeatedAcrossRounds = repeatedTexts.filter((row) => row.rounds.length > 1)
  const exactRepeatExcess = all.length - textCounts.size

  return {
    generated_at: new Date().toISOString(),
    scope: 'learner-facing Praticar agora; real UI/planner/engine; four complete sessions',
    rounds_requested: ROUND_COUNT,
    rounds_completed: rounds.length,
    total_activities: all.length,
    unique_exact_texts: textCounts.size,
    exact_repeat_excess: exactRepeatExcess,
    exact_repeat_excess_rate: all.length ? exactRepeatExcess / all.length : 0,
    distinct_repeated_exact_texts: repeatedTexts.length,
    repeated_exact_texts_across_rounds: repeatedAcrossRounds.length,
    max_same_exact_text_occurrences: maxCount(textCounts),
    unique_exemplars: exemplarCounts.size,
    max_same_exemplar_occurrences: maxCount(exemplarCounts),
    unique_constructions: constructionCounts.size,
    max_same_construction_occurrences: maxCount(constructionCounts),
    round_summaries: rounds.map(summarizeRound),
    repeated_texts: repeatedTexts,
    repeated_across_rounds: repeatedAcrossRounds,
    rounds,
  }
}

function markdown(report) {
  const pct = (value) => `${(value * 100).toFixed(1)}%`
  const lines = [
    '# Four-round Praticar repetition audit',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Overall',
    '',
    `- Rounds completed: ${report.rounds_completed}/${report.rounds_requested}`,
    `- Activities observed: ${report.total_activities}`,
    `- Unique exact English phrases: ${report.unique_exact_texts}`,
    `- Repeated activity slots beyond first occurrence: ${report.exact_repeat_excess} (${pct(report.exact_repeat_excess_rate)})`,
    `- Distinct exact phrases that repeated: ${report.distinct_repeated_exact_texts}`,
    `- Exact phrases repeated across different rounds: ${report.repeated_exact_texts_across_rounds}`,
    `- Maximum occurrences of one exact phrase: ${report.max_same_exact_text_occurrences}`,
    `- Unique exemplar IDs: ${report.unique_exemplars}`,
    `- Maximum occurrences of one exemplar ID: ${report.max_same_exemplar_occurrences}`,
    `- Unique construction IDs: ${report.unique_constructions}`,
    `- Maximum occurrences of one construction: ${report.max_same_construction_occurrences}`,
    '',
    '## Per round',
    '',
    '| Round | Activities | Unique text | Repeat excess | Distinct repeated text | Max same text | Unique exemplars | Max same exemplar | Unique constructions | Max same construction |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...report.round_summaries.map((row) => `| ${row.round} | ${row.activities} | ${row.unique_texts} | ${row.exact_repeat_excess} | ${row.distinct_repeated_texts} | ${row.max_same_text_occurrences} | ${row.unique_exemplars} | ${row.max_same_exemplar_occurrences} | ${row.unique_constructions} | ${row.max_same_construction_occurrences} |`),
    '',
    '## Repeated exact phrases',
    '',
  ]

  if (!report.repeated_texts.length) lines.push('No exact English phrase repeated.')
  else {
    lines.push('| Count | Rounds | English phrase |', '|---:|---|---|')
    for (const row of report.repeated_texts) {
      lines.push(`| ${row.count} | ${row.rounds.join(', ')} | ${row.text_en.replace(/\|/g, '\\|')} |`)
    }
  }

  lines.push('', '## Full observed sequence', '')
  for (const round of report.rounds) {
    lines.push(`### Round ${round.round}`, '', '| # | Recipe | Exemplar | Construction | English phrase |', '|---:|---|---|---|---|')
    for (const row of round.activities) {
      const safe = (value) => String(value ?? '').replace(/\|/g, '\\|')
      lines.push(`| ${row.position} | ${safe(row.recipe)} | ${safe(row.exemplar_id)} | ${safe(row.construction_id)} | ${safe(row.text_en)} |`)
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

test('Praticar: capture exact repetition across four complete rounds', async ({ page, context }) => {
  test.setTimeout(900_000)
  mkdirSync(OUT_DIR, { recursive: true })

  // Make headless runtime truthful: no usable microphone means the planner must
  // not choose a speaking activity this browser cannot answer.
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
            text_en: String(plan.text_en || '').trim(),
            text_pt: String(plan.text_pt || '').trim(),
            recipe: plan.recipe ?? plan.activity_kind ?? null,
            capability: plan.capability ?? null,
            modality: plan.modality ?? null,
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
    console.log('PRACTICE_FOUR_ROUND_REPORT_BEGIN')
    console.log(JSON.stringify({
      rounds_completed: report.rounds_completed,
      total_activities: report.total_activities,
      unique_exact_texts: report.unique_exact_texts,
      exact_repeat_excess: report.exact_repeat_excess,
      exact_repeat_excess_rate: report.exact_repeat_excess_rate,
      distinct_repeated_exact_texts: report.distinct_repeated_exact_texts,
      repeated_exact_texts_across_rounds: report.repeated_exact_texts_across_rounds,
      max_same_exact_text_occurrences: report.max_same_exact_text_occurrences,
      unique_exemplars: report.unique_exemplars,
      max_same_exemplar_occurrences: report.max_same_exemplar_occurrences,
      unique_constructions: report.unique_constructions,
      max_same_construction_occurrences: report.max_same_construction_occurrences,
      round_summaries: report.round_summaries,
      top_repeated_texts: report.repeated_texts.slice(0, 20),
    }, null, 2))
    console.log('PRACTICE_FOUR_ROUND_REPORT_END')
  }

  if (runError) throw runError
  expect(rounds).toHaveLength(ROUND_COUNT)
})
