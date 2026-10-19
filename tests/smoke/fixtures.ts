import { test as base, expect, request as apiRequest } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { smokeTarget, bypassHeaders, consumesAuthBudget, authBudgetDelay, CANONICAL_AUTH_ORIGIN, toolbarHeadersForRequest } from '../../shared/smoke-target.mjs';

let queue: Promise<void> = Promise.resolve();

export const test = base.extend<{ smokeGuard: void }>({
  // Browser and API tests share the same origin-scoped authenticated cookies.
  request: async ({ context }, use) => { await use(context.request); },
  smokeGuard: [async ({ context, baseURL }, use, info) => {
    const target = smokeTarget(baseURL || 'https://dreamforgex.ai');
    if (target.protectedTarget) {
      // Bootstrap outside the traced browser context. Never put the secret in
      // URLs, global extraHTTPHeaders, redirected requests, logs, or artifacts.
      const bootstrap = await apiRequest.newContext();
      try {
        let result;
        try {
          result = await bootstrap.get(target.origin + '/', {
            headers: { ...bypassHeaders(target, process.env.VERCEL_AUTOMATION_BYPASS_SECRET), ...toolbarHeadersForRequest(target.origin, target.origin), 'x-vercel-set-bypass-cookie': 'true' },
            maxRedirects: 0,
          });
        } catch { throw new Error('Deployment bypass request failed (request headers withheld)'); }
        if (result.status() < 200 || result.status() >= 400) throw new Error('Existing deployment bypass bootstrap failed');
        const state = await bootstrap.storageState();
        const cookies = state.cookies.filter(c => c.domain === new URL(target.origin).hostname && c.secure && c.httpOnly);
        if (!cookies.some(c => c.name === '_vercel_jwt')) throw new Error('Deployment bypass did not set its exact-host authorization cookie');
        await context.addCookies(cookies);
      } finally { await bootstrap.dispose(); }
    }

    const budgetFile = path.join(info.project.outputDir, '.smoke-auth-budget.json');
    const readBudget = async () => {
      await fs.mkdir(path.dirname(budgetFile), { recursive: true });
      let starts: number[] = [];
      try { starts = JSON.parse(await fs.readFile(budgetFile, 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!Array.isArray(starts) || starts.some(t => !Number.isFinite(t))) throw new Error('Invalid persisted authentication request budget');
      return starts;
    };
    // Reserve headroom before navigation begins, so ordinary session/redirect
    // requests are never delayed past a navigation or console assertion.
    await queue;
    const reserved = authBudgetDelay(await readBudget(), Date.now(), 6);
    if (reserved.delay) await new Promise(resolve => setTimeout(resolve, reserved.delay));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (target.protectedTarget && url.origin === CANONICAL_AUTH_ORIGIN && url.pathname === '/api/status/providers') {
        await route.abort();
        throw new Error('Staged canonical sign-in must not invoke the old canonical provider monitoring route');
      }
      if ([target.origin, CANONICAL_AUTH_ORIGIN].includes(url.origin) && consumesAuthBudget(url.pathname)) {
        const turn = queue.then(async () => {
          const starts = await readBudget();
          let budget = authBudgetDelay(starts, Date.now());
          if (budget.delay) await new Promise(resolve => setTimeout(resolve, budget.delay));
          budget = authBudgetDelay(starts, Date.now());
          await fs.writeFile(budgetFile, JSON.stringify([...budget.active, Date.now()]));
        });
        queue = turn;
        await turn;
      }
      // https://vercel.com/docs/vercel-toolbar/managing-toolbar#disable-toolbar-for-automation
      // Suppress platform UI on exact-preview document navigations only. Fetch
      // one unmodified response without following redirects: continue() header
      // overrides would otherwise carry into a redirected request's origin.
      const toolbarHeaders = toolbarHeadersForRequest(target.origin, url.href);
      if (route.request().isNavigationRequest() && route.request().resourceType() === 'document' && Object.keys(toolbarHeaders).length) {
        try {
          const response = await route.fetch({
            headers: { ...route.request().headers(), ...toolbarHeaders },
            maxRedirects: 0,
            timeout: info.project.use.navigationTimeout ?? 110_000,
          });
          await route.fulfill({ response });
        } catch {
          // Playwright call logs can include protected request details.
          try { await route.abort(); } catch {}
          throw new Error('Preview document request failed (request headers withheld)');
        }
      } else {
        await route.continue();
      }
    });
    await use();
  }, { auto: true }],
});
export { expect };
