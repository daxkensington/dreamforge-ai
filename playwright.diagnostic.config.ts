import { defineConfig } from '@playwright/test';
import smoke from './playwright.config';

export default defineConfig({
  ...smoke,
  testDir: './tests/diagnostics',
  outputDir: './diagnostic-results',
  retries: 0,
  workers: 1,
  reporter: [['github'], ['list']],
  use: { ...smoke.use, trace: 'off', screenshot: 'off', video: 'off' },
  projects: smoke.projects?.filter(project => project.name === 'mobile-safari'),
});
