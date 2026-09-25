import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8099', trace: 'retain-on-failure' },
  webServer: {
    command: 'node --import tsx server/index.ts --demo',
    url: 'http://127.0.0.1:8099/healthz',
    env: { PORT: '8099', DATABASE: ':memory:' },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
