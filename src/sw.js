// sw.js — custom service worker. Reproduces the previous generateSW behavior
// (precache of the app shell + on-demand caching of the AI runtime chunks) and
// adds one thing generateSW can't do: COOP/COEP header injection on
// navigations.
//
// The header injection gives the app cross-origin isolation on static hosts
// that can't set response headers (GitHub Pages). Isolation unlocks
// SharedArrayBuffer, which the CPU (WASM) AI backend needs to run llama.cpp
// multi-threaded — single-threaded inference is unusably slow on phones.
// 'credentialless' (not 'require-corp') keeps cross-origin fetches like the
// Hugging Face model downloads working without CORP headers on their side.

import { clientsClaim } from 'workbox-core'
import { precache, addRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precache(self.__WB_MANIFEST)

// Serve every navigation from the precached app shell, with the isolation
// headers stamped on. This route MUST be registered before addRoute() below:
// workbox matches routes in registration order, and the precache route would
// otherwise serve '/' itself (via its directoryIndex handling) with no
// headers. main.jsx reloads the page once when this worker first takes
// control, so the headers apply from the very first session.
const shellHandler = createHandlerBoundToURL('index.html')
registerRoute(new NavigationRoute(async (params) => {
  const resp = await shellHandler(params)
  const headers = new Headers(resp.headers)
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers })
}))

// Precached assets (everything that isn't a navigation).
addRoute()

// web-llm (WebGPU) and wllama (CPU/WASM) runtime chunks plus the ~7 MB
// wllama.wasm binary: too big for the first-load precache, cached here on the
// first AI activation so the tutor works offline afterwards.
registerRoute(
  ({ url }) => /\/assets\/((web-llm|webllm-worker|wllama)-[^/]+\.js|[^/]+\.wasm)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'webllm-runtime',
    plugins: [
      new ExpirationPlugin({ maxEntries: 8 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)
