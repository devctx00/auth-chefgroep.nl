import { defineConfig, devices } from '@playwright/test';

const authE2ePort = process.env.AUTH_E2E_PORT ?? '4274';
const authE2eBaseUrl = `http://127.0.0.1:${authE2ePort}`;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: authE2eBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${authE2ePort} --strictPort`,
    cwd: '..',
    url: authE2eBaseUrl,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
