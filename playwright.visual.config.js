import { defineConfig, devices } from '@playwright/test'
import functionalConfig from './playwright.config.js'

const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined

// Visual evidence is intentionally opt-in. It uses the same production bundles
// and real app pipeline as the functional suite, but it is not counted as 35
// misleading skips in the required PR gate.
export default defineConfig({
  ...functionalConfig,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-visual' }]],
  projects: [
    {
      name: 'visual-chromium',
      testMatch: /screenshots\.spec\.js$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: { executablePath },
      },
    },
  ],
})
