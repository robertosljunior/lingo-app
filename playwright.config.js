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
      testIgnore: /mobile-smoke/,
    },
    {
      // Essential smoke on a mobile viewport; the full flows run on desktop.
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile-smoke/,
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
