import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  respectGitIgnore: false,
  timeout: 60_000,
  fullyParallel: false,
  webServer: {
    command: 'node tests/e2e/static-server.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true
  },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 960 }
  }
});
