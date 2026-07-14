// Playwright E2E configuration.
//
// The suite always runs against the production build served by `vite preview`
// (never `vite dev`): the PWA service worker only behaves like production on
// the built output. `webServer` rebuilds dist/ before serving so the tested
// bundle always matches the sources.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Optional local browser override: some sandboxes ship a Chromium revision that
// differs from the one @playwright/test pins. Set PW_CHROMIUM_EXECUTABLE to that
// binary. CI leaves it unset and uses Playwright's managed browser.
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/use-model-setup.mjs',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions: { executablePath } },
      // The real-model spec runs in its own serial project (see below); the
      // mobile smoke runs in the mobile project.
      testIgnore: [/mobile-smoke/, /real-model/],
    },
    {
      // Essential smoke on a mobile viewport; the full flows run on desktop.
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath } },
      testMatch: /mobile-smoke/,
    },
    {
      // Real Universal Sentence Encoder / structural-NLP specs. One file → one
      // worker → strictly serial (test.describe.configure serial), and it
      // `dependencies` on the parallel projects so it only starts once they are
      // done — no CPU/memory contention from concurrent 25 MB model loads. Part
      // of the normal `playwright test` command; real model, never skipped/mocked.
      name: 'use-model',
      testMatch: /real-model/,
      fullyParallel: false,
      dependencies: ['chromium-desktop', 'chromium-mobile'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
