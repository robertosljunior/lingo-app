// Playwright E2E configuration.
//
// The required suite always runs against the production build served by
// `vite preview` (never `vite dev`). Visual evidence lives in
// playwright.visual.config.js and is not counted as skipped functional tests.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const PROD_PORT = 4174
const PROD_DIST = 'dist-production-smoke'
const VISUAL_SPEC = /screenshots\.spec\.js$/
// Multi-session learner journeys: correct but CPU-hungry, so they get their own
// serial project instead of competing with the ordinary functional specs.
const LONG_JOURNEY_SPEC = /practice-repetition-across-sessions\.spec\.js$/

// Optional local browser override: some sandboxes ship a Chromium revision that
// differs from the one @playwright/test pins. CI leaves this unset.
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined
const ci = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/use-model-setup.mjs',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: ci ? 2 : 4,
  // A retry used to turn a real first-run failure into a green PR. CI now
  // exposes every flake as a failure. One local retry remains convenient while
  // debugging, but it is never accepted as remote evidence.
  retries: ci ? 0 : 1,
  forbidOnly: ci,
  reporter: ci
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'playwright-report/results.xml' }],
      ]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions: { executablePath } },
      testIgnore: [VISUAL_SPEC, /mobile-smoke/, /real-model/, /production-cutover/, LONG_JOURNEY_SPEC],
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath } },
      testMatch: /mobile-smoke/,
    },
    {
      // Plain production build, no dogfood flag. This is the exact cutover
      // contract GitHub Pages must satisfy.
      name: 'production-build',
      testMatch: /production-cutover/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        baseURL: `http://127.0.0.1:${PROD_PORT}/`,
        launchOptions: { executablePath },
      },
    },
    {
      // Real Universal Sentence Encoder / structural-NLP specs run only after
      // the parallel functional projects so model loading cannot contend with
      // ordinary learner journeys.
      name: 'use-model',
      testMatch: /real-model/,
      fullyParallel: false,
      dependencies: ['chromium-desktop', 'chromium-mobile', 'production-build'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions: { executablePath } },
    },
    {
      // Same reasoning as `use-model`, for the same reason. The anti-repetition
      // journey drives five COMPLETE learner sessions — 60 activities through
      // the real assessment pipeline, semantic analysis included — in one test.
      // Run alongside the ordinary journeys it does not fail itself, but it
      // starves them: a run with it in the parallel pool timed out an unrelated
      // double-submit spec after 5.4m that passes in 53s on its own. Retries are
      // zero by contract, so the fix is to stop the contention, not to absorb it.
      name: 'long-journey',
      testMatch: LONG_JOURNEY_SPEC,
      fullyParallel: false,
      dependencies: ['chromium-desktop', 'chromium-mobile', 'production-build'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, launchOptions: { executablePath } },
    },
  ],
  webServer: [
    {
      command: `VITE_V2_DOGFOOD=1 npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: !ci,
      timeout: 240_000,
    },
    {
      command: `npx vite build --outDir ${PROD_DIST} --emptyOutDir && npx vite preview --outDir ${PROD_DIST} --host 127.0.0.1 --port ${PROD_PORT} --strictPort`,
      url: `http://127.0.0.1:${PROD_PORT}/`,
      reuseExistingServer: !ci,
      timeout: 240_000,
    },
  ],
})
