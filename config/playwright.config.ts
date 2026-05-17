import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '../tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    // Dedicated port so local port 3000 (often another app) is not reused by mistake.
    baseURL: 'http://127.0.0.1:3333',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Separate distDir (see next.config.ts) so this can run while another `next dev` holds `.next/dev/lock`.
    command: 'PLAYWRIGHT_E2E=1 npm run dev -- -p 3333',
    url: 'http://127.0.0.1:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
