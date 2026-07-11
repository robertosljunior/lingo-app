import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the built app runs from any path and offline (file:// or a
// static host in a subfolder). The service worker precaches every build asset —
// including the bundled Compromise worker and self-hosted fonts — so the app is
// fully usable with no network after the first load.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
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
})
