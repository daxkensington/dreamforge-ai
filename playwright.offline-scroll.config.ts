import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/diagnostics', testMatch: 'static-media-interception.spec.ts',
  fullyParallel: false, forbidOnly: true, workers: 1, retries: 0,
  timeout: 120_000, expect: { timeout: 10_000 },
  outputDir: './test-results/static-media-interception/captures',
  reporter: [['./scripts/diagnostics/static-media/reporter.mjs']],
  use: { trace: 'off', screenshot: 'only-on-failure', video: 'retain-on-failure', actionTimeout: 10_000, navigationTimeout: 110_000 },
  projects: [{ name: 'mobile-safari', use: { ...devices['iPhone 14'] } }],
});
