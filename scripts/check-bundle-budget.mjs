import { readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DIST = path.resolve('dist')
const ASSETS = path.join(DIST, 'assets')
const KiB = 1024

const budgets = {
  entryJavaScriptBytes: 900 * KiB,
  ordinaryChunkBytes: 650 * KiB,
  cssBytes: 120 * KiB,
}

const optionalHeavyAsset = /^(semantic-runtime|model|graph_model|harper_wasm_bg)-/i

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
const entry = js
  .filter((asset) => /^index-.*\.js$/i.test(asset.name))
  .sort((a, b) => b.bytes - a.bytes)[0] ?? null
const ordinaryChunks = js.filter((asset) => !optionalHeavyAsset.test(asset.name))
const largestOrdinary = ordinaryChunks.sort((a, b) => b.bytes - a.bytes)[0] ?? null
const largestCss = css.sort((a, b) => b.bytes - a.bytes)[0] ?? null

const failures = []
if (!entry) failures.push('No index-*.js entry chunk was emitted.')
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
  optionalHeavyAssets: assets.filter((asset) => optionalHeavyAsset.test(asset.name)),
  failures,
}

await writeFile('bundle-budget.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(`BUNDLE_BUDGET_SUMMARY ${JSON.stringify(report)}`)

if (failures.length) {
  for (const failure of failures) console.error(`BUNDLE_BUDGET_FAILURE ${failure}`)
  process.exitCode = 1
}
