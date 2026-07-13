// Playwright global setup: ensure the real USE model assets are available on
// disk for the semantic-model E2E to serve locally (the sandbox browser has no
// route to the external origin, so the spec intercepts and fulfills from here).
//
// node's fetch honors HTTPS_PROXY, so it CAN reach the pinned Google origin even
// where the browser cannot. Files are cached under e2e/.cache/use-model
// (gitignored) so they are downloaded at most once. If both the cache and the
// network are unavailable, a marker is written and the spec skips with a clear,
// honest reason (environment-gated, not a product failure).
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const USE_CACHE_DIR = path.join(HERE, '.cache', 'use-model')
const BASE = 'https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder'
const FILES = ['model.json', 'vocab.json', 'group1-shard1of7', 'group1-shard2of7', 'group1-shard3of7', 'group1-shard4of7', 'group1-shard5of7', 'group1-shard6of7', 'group1-shard7of7']

async function present(name) {
  try { const s = await stat(path.join(USE_CACHE_DIR, name)); return s.size > 0 } catch { return false }
}

export default async function globalSetup() {
  await mkdir(USE_CACHE_DIR, { recursive: true })
  const have = await readdir(USE_CACHE_DIR).catch(() => [])
  const complete = FILES.every((f) => have.includes(f))
  if (complete) return

  for (const name of FILES) {
    if (await present(name)) continue
    try {
      const res = await fetch(`${BASE}/${name}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(path.join(USE_CACHE_DIR, name), buf)
    } catch (e) {
      await writeFile(path.join(USE_CACHE_DIR, '.unavailable'), `Could not fetch ${name}: ${e?.message || e}\n`)
      return
    }
  }
}
