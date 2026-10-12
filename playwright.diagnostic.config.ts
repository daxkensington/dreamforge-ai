import { defineConfig } from '@playwright/test';
import smoke from './playwright.config';

const mobile = smoke.projects?.find(project => project.name === 'mobile-safari');
if (!mobile) throw new Error('Original mobile Safari project profile is required');

export default defineConfig({
  ...smoke,
  testDir: './tests/diagnostics',
  // Both projects intentionally inherit this one explicit output directory,
  // preserving the on-disk authentication budget across sequential workers.
  outputDir: './diagnostic-results',
  retries: 0,
  workers: 1,
  reporter: [['github'], ['list']],
  use: { ...smoke.use, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    { ...mobile, name: 'mobile-safari-isolated-heading',
      grep: /(?:^|\s)homepage What's New section is visible$/ },
    { ...mobile, name: 'mobile-safari-isolated-footer',
      grep: /(?:^|\s)footer renders with all link sections$/ },
  ],
});
