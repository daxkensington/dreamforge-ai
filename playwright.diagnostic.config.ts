import { defineConfig } from '@playwright/test';
import smoke from './playwright.config';

export default defineConfig({
  ...smoke,
  testDir: './tests/diagnostics',
  grep: /(?:^|\s)(homepage What's New section is visible|footer renders with all link sections)$/,
  outputDir: './diagnostic-results',
  retries: 0,
  workers: 1,
  reporter: [['github'], ['list']],
  use: { ...smoke.use, trace: 'off', screenshot: 'off', video: 'off' },
  projects: smoke.projects?.filter(project => project.name === 'mobile-safari'),
});
