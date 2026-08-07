import { chromium } from '@playwright/test'

const [rawPageUrl, expectedCommit] = process.argv.slice(2)
if (!rawPageUrl || !expectedCommit) {
  console.error('Usage: node scripts/smoke-pages-deploy.mjs <page_url> <expected_commit>')
  process.exit(2)
}

const pageUrl = rawPageUrl.endsWith('/') ? rawPageUrl : `${rawPageUrl}/`
const metaUrl = new URL('build-meta.json', pageUrl).href
const metaResponse = await fetch(metaUrl, { cache: 'no-store' })
if (!metaResponse.ok) throw new Error(`Pages metadata unavailable: ${metaResponse.status} ${metaUrl}`)
const meta = await metaResponse.json()
if (meta.commit !== expectedCommit) {
  throw new Error(`Pages commit mismatch: expected ${expectedCommit}, got ${meta.commit || '<missing>'}`)
}

const browser = await chromium.launch()
try {
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const page = await context.newPage()
  const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  if (!response?.ok()) throw new Error(`Pages root failed online: ${response?.status()}`)

  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false
    await navigator.serviceWorker.ready
    return true
  }, null, { timeout: 30_000 })

  // A fresh first load is intentionally not force-reloaded when the first SW
  // claims it. Reload once so the following offline proof starts controlled.
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 })

  const onlineRoot = await page.locator('#root').evaluate((el) => el.textContent?.trim() || '')
  if (!onlineRoot) throw new Error('Pages app rendered an empty #root online')

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForFunction(() => Boolean(document.querySelector('#root')?.textContent?.trim()), null, { timeout: 15_000 })

  const offlineState = await page.evaluate(() => ({
    controlled: Boolean(navigator.serviceWorker?.controller),
    rootText: document.querySelector('#root')?.textContent?.trim() || '',
    title: document.title,
  }))
  if (!offlineState.controlled || !offlineState.rootText) {
    throw new Error(`Offline boot failed: ${JSON.stringify(offlineState)}`)
  }

  console.log(JSON.stringify({
    pages_url: pageUrl,
    commit: meta.commit,
    service_worker_controlled: offlineState.controlled,
    offline_root_rendered: true,
  }))
} finally {
  await browser.close()
}
