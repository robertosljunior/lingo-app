import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DIST = path.resolve('dist')
const ASSETS = path.join(DIST, 'assets')
const KiB = 1024

const budgets = {
  // RX-8B baseline after route splitting. The previous eager entry was about
  // 1.46 MB; this gate caps the new production entry at 1 MiB.
  entryJavaScriptBytes: 1024 * KiB,
  ordinaryChunkBytes: 650 * KiB,
  cssBytes: 120 * KiB,
}

const optionalHeavyAsset = /^(semantic-runtime|model|graph_model|harper_wasm_bg)-/i
const generatedIndexChunk = /^index-.*\.js$/i

async function filesIn(dir) {
  const names = await readdir(dir)
  return Promise.all(names.map(async (name) => {
    const file = path.join(dir, name)
    const info = await stat(file)
    return { name, bytes: info.size }
  }))
}

const assets = await filesIn(ASSETS)
const js = assets.filter((asset) => asset.name.endsWith('.js'))
const css = assets.filter((asset) => asset.name.endsWith('.css'))
const html = await readFile(path.join(DIST, 'index.html'), 'utf8')
const entryMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["'][^"']*\/assets\/([^"']+\.js)["']/i)
  ?? html.match(/<script[^>]+src=["'][^"']*\/assets\/([^"']+\.js)["'][^>]+type=["']module["']/i)
const entryName = entryMatch?.[1] ?? null
const entry = entryName ? js.find((asset) => asset.name === entryName) ?? null : null

// Rollup can emit generic index-* chunks for workers and deferred dependency
// graphs. They are not the HTML entry and must not be mistaken for startup JS.
// Keep them visible in the report while budgeting named application/vendor
// chunks separately.
const ordinaryChunks = js.filter((asset) => (
  asset.name !== entryName
  && !generatedIndexChunk.test(asset.name)
  && !optionalHeavyAsset.test(asset.name)
))
const deferredIndexChunks = js
  .filter((asset) => asset.name !== entryName && generatedIndexChunk.test(asset.name))
  .sort((a, b) => b.bytes - a.bytes)
const largestOrdinary = ordinaryChunks.sort((a, b) => b.bytes - a.bytes)[0] ?? null
const largestCss = css.sort((a, b) => b.bytes - a.bytes)[0] ?? null

const failures = []
if (!entry) failures.push('The module entry referenced by dist/index.html could not be resolved.')
else if (entry.bytes > budgets.entryJavaScriptBytes) {
  failures.push(`Entry JavaScript ${entry.name} is ${(entry.bytes / KiB).toFixed(1)} KiB; budget is ${budgets.entryJavaScriptBytes / KiB} KiB.`)
}
if (largestOrdinary && largestOrdinary.bytes > budgets.ordinaryChunkBytes) {
  failures.push(`Ordinary chunk ${largestOrdinary.name} is ${(largestOrdinary.bytes / KiB).toFixed(1)} KiB; budget is ${budgets.ordinaryChunkBytes / KiB} KiB.`)
}
if (largestCss && largestCss.bytes > budgets.cssBytes) {
  failures.push(`CSS ${largestCss.name} is ${(largestCss.bytes / KiB).toFixed(1)} KiB; budget is ${budgets.cssBytes / KiB} KiB.`)
}

const report = {
  budgets,
  entry,
  largestOrdinary,
  largestCss,
  deferredIndexChunks,
  optionalHeavyAssets: assets.filter((asset) => optionalHeavyAsset.test(asset.name)),
  failures,
}

await writeFile('bundle-budget.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(`BUNDLE_BUDGET_SUMMARY ${JSON.stringify(report)}`)

if (failures.length) {
  for (const failure of failures) console.error(`BUNDLE_BUDGET_FAILURE ${failure}`)
  process.exitCode = 1
}
