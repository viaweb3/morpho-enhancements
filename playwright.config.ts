import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    headless: false,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'probe',
      testMatch: /probe\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e',
      testMatch: /e2e\/.*\.spec\.ts/,
      // e2e test manages its own launchPersistentContext because Playwright's
      // `browser` fixture can't load extensions directly.
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
