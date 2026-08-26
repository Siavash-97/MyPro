import { defineConfig, devices } from '@playwright/test';

// Der Port kommt aus scripts/run-playwright.mjs, das ihn vom Betriebssystem
// geben laesst. Der Rueckfallwert gilt nur, wenn jemand `playwright test`
// von Hand gegen einen selbst gestarteten Server laufen laesst.
// Begruendung fuer den beweglichen Port: siehe run-playwright.mjs.
const PORT = Number(process.env.PLANER_E2E_PORT) || 4174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
