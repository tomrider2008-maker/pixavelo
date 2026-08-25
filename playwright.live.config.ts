import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PIXAVELO_BASE_URL ?? 'https://pixavelo.pages.dev';

if (!baseURL.startsWith('https://')) {
  throw new Error('Production smoke tests require an HTTPS PIXAVELO_BASE_URL.');
}

export default defineConfig({
  testDir: './live-e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-live-report' }],
    [
      'json',
      {
        outputFile:
          process.env.PIXAVELO_BROWSER_REPORT ?? '.artifacts/operations/live-browser-report.json'
      }
    ]
  ],
  outputDir: 'test-results-live',
  use: {
    baseURL,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } }
  ]
});
