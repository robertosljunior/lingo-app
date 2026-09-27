import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: /practice-combinatorial-v3-across-sessions.spec.js/,
  timeout: 1200000, expect: { timeout: 20000 }, retries: 0, workers: 1,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173/',
    launchOptions: { executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
      args: process.env.PW_CHROMIUM_EXECUTABLE ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'] : [] },
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'VITE_V2_DOGFOOD=1 npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/', timeout: 240000, reuseExistingServer: !process.env.CI },
})
