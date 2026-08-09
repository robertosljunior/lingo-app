import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the built app runs from any path and offline (file:// or a
// static host in a subfolder). The service worker precaches the core build
// assets needed by the default V2 experience. Optional runtimes and legacy V1
// font binaries are cached only on first use.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // onnxruntime-web (pulled in by piper-tts-web) emits its 26 MB wasm as a
    // build asset, but at runtime Piper always loads the ONNX/phonemizer
    // runtimes from CDN (cached by the service worker) — the local copy is
    // never requested. Drop it so the versioned dist/ stays small.
    {
      name: 'drop-unused-ort-wasm',
      generateBundle(_, bundle) {
        for (const key of Object.keys(bundle)) {
          // Drop only the onnxruntime/Piper wasm (loaded from CDN at runtime).
          // Keep Harper's wasm — the local grammar engine needs it to run.
          if (key.endsWith('.wasm') && !/harper/i.test(key)) delete bundle[key]
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        // Optional resources must not bloat every V2 installation. Semantic
        // runtime chunks and legacy Bob typography are runtime-cached on first
        // use instead of living in the base precache.
        globIgnores: [
          '**/semantic-runtime-*.js',
          '**/model-*.js',
          '**/graph_model-*.js',
          '**/*nunito*.woff2',
          '**/*baloo*.woff2',
          '**/*geist-mono*.woff2',
        ],
        // The NLP worker + Compromise bundle can exceed the default 2 MiB cap.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Piper (neural TTS) runtimes come from CDNs; cache them so the
        // engine keeps working offline after the first use. The voice models
        // themselves live in OPFS (handled by piper-tts-web).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'piper-runtime-v1',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // The opt-in semantic runtime (TensorFlow.js + USE) chunk: cache on
            // first use so USE keeps working offline afterwards. Excluded from the
            // precache above so users who never download the model never pay for it.
            urlPattern: ({ url }) => url.origin === self.location.origin && /(semantic-runtime|model|graph_model)-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'semantic-runtime-v1',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // RX-8E / REC-245: Nunito, Baloo 2 and Geist Mono belong to the
            // explicit legacy experience. Their binaries stay out of the base
            // V2 precache, then become offline-capable after the first V1 use.
            urlPattern: ({ url }) => url.origin === self.location.origin && /(nunito|baloo|geist-mono).*\.woff2$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'legacy-fonts-v1',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Harper's WASM (~18 MB, local same-origin asset) is too large to
            // precache; cache it on first use so grammar analysis works offline
            // afterwards. Before first (online) use, the app falls back to the
            // internal grammar checker — GRAMMAR_ENGINE_UNAVAILABLE, no crash.
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'harper-wasm-v1',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'App Idiomas — Treino de Inglês',
        short_name: 'Idiomas',
        description: 'Importe aulas, responda exercícios, revise erros e exporte para o seu tutor. Funciona offline.',
        theme_color: '#4F46E5',
        background_color: '#FBF9F4',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'pt-BR',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the whole optional semantic runtime in ONE predictable chunk so
        // the service worker can exclude it from the precache and runtime-cache
        // it on demand (see VitePWA workbox config above).
        manualChunks(id) {
          if (id.includes('@tensorflow') || id.includes('universal-sentence-encoder')) return 'semantic-runtime'
        },
      },
    },
  },
  // Vitest: unit tests only — Playwright owns e2e/*.spec.js.
  test: {
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
})
