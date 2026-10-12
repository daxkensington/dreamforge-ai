import fs from 'node:fs/promises';
import path from 'node:path';
import { performance as nodeClock } from 'node:perf_hooks';
import { test, expect } from '../smoke/fixtures';
import type { Page, TestInfo, Response } from '@playwright/test';

const target = 'https://dreamforgex-le3wqt0zv-englandsfinest.vercel.app';
type Activation = { status: 'acknowledged' | 'rejected' | 'unknown'; nodeStart: number; nodeEnd: number; nodeElapsedMs: number; navigationHttpStatus: number; afterRealNavigationResolved: true };
const activations = new WeakMap<Page, Activation>();

async function bounded<T>(promise: Promise<T>, limit: number) {
  let timer: NodeJS.Timeout | undefined;
  const result = await Promise.race([
    promise.then(value => ({ status: 'observed' as const, value }), () => ({ status: 'rejected' as const })),
    new Promise<{ status: 'unknown' }>(resolve => { timer = setTimeout(() => resolve({ status: 'unknown' }), limit); }),
  ]);
  if (timer) clearTimeout(timer);
  return result;
}

async function activateAfterNavigation(page: Page, info: TestInfo, navigationResponse: Response | null) {
  expect(info.project.name).toBe('mobile-safari');
  expect(["homepage What's New section is visible", 'footer renders with all link sections']).toContain(info.title);
  expect(page.url()).toBe(target + '/');
  expect(navigationResponse, 'Real navigation must return a successful HTTP response before activation').toBeTruthy();
  const navigationHttpStatus = navigationResponse!.status();
  expect(navigationHttpStatus).toBeGreaterThanOrEqual(200);
  expect(navigationHttpStatus).toBeLessThan(400);
  expect(activations.has(page), 'One native activation only; unknown outcomes are not retried').toBe(false);
  const nodeStart = nodeClock.now();
  // Mark the attempt before the one native command. Even a synchronous
  // rejection or late acknowledgment cannot authorize a second activation.
  activations.set(page, { status: 'unknown', nodeStart, nodeEnd: nodeStart, nodeElapsedMs: 0, navigationHttpStatus, afterRealNavigationResolved: true });
  const observed = await bounded(Promise.resolve().then(() => page.bringToFront()), 10_000);
  const nodeEnd = nodeClock.now();
  const status = observed.status === 'observed' ? 'acknowledged' : observed.status;
  const activation: Activation = { status, nodeStart, nodeEnd, nodeElapsedMs: nodeEnd - nodeStart, navigationHttpStatus, afterRealNavigationResolved: true };
  activations.set(page, activation);
  console.log('SAFE_WEBKIT_POST_NAVIGATION_ACTIVATION ' + JSON.stringify(activation));
  expect(status, 'Native post-navigation activation must be acknowledged; unknown is not retried').toBe('acknowledged');
}

test.beforeEach(async ({ baseURL }, info) => {
  expect(baseURL).toBe(target);
  expect(info.project.name).toBe('mobile-safari');
  expect(["homepage What's New section is visible", 'footer renders with all link sections']).toContain(info.title);
});

test("homepage What's New section is visible", async ({ page }, info) => {
  const navigationResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
  await activateAfterNavigation(page, info, navigationResponse);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: "What's new this week", exact: true }) });
  const heading = section.getByRole('heading', { name: "What's new this week", exact: true });
  // Preserve native driver stability checks. The scoped content-scroll budget
  // covers the observed WebKit wait; total test and auth budgets stay fixed.
  await heading.scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  await expect(heading).toHaveCSS('opacity', '1');
  await expect(section.getByText('Just shipped', { exact: true })).toBeVisible();
  for (const [href, title] of [
    ['/tools/pet-portrait', 'Pet Portrait'], ['/tools/tarot-card', 'Tarot Card Designer'],
    ['/tools/movie-poster', 'Movie Poster'], ['/tools/pixel-art', 'Pixel Art Generator'],
    ['/tools/brand-style-guide', 'Brand Style Guide'], ['/tools/song-creator', 'Self-Hosted Audio'],
  ]) {
    const card = section.locator(`a[href="${href}"]`);
    await card.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(card).toBeVisible();
    await expect(card).toBeInViewport();
    const motionContent = card.locator(':scope > div');
    await expect(motionContent).toHaveCount(1);
    await expect(motionContent).toHaveCSS('opacity', '1');
    await expect(card.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});

test("footer renders with all link sections", async ({ page }, info) => {
  const navigationResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
  await activateAfterNavigation(page, info, navigationResponse);
  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  // Every footer-linked legal page must be reachable.
  for (const path of ["/about", "/terms", "/privacy"]) {
    const link = footer.locator(`a[href="${path}"]`).first();
    await link.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(link, `footer missing link to ${path}`).toBeVisible();
    await expect(link).toBeInViewport();
  }
});

test.afterEach(async ({ page }, info) => {
  const start = nodeClock.now();
  const observed = await bounded(page.evaluate(() => ({
    visibility: document.visibilityState, readyState: document.readyState,
    hasFocus: document.hasFocus(), viewport: { width: innerWidth, height: innerHeight },
    devicePixelRatio, scrollX, scrollY, documentHeight: document.documentElement.scrollHeight,
  })), 3_000);
  // Error text stays in memory. Only exact technical flags are persisted.
  const messages = info.errors.slice(0, 4).map(error => (error.message ?? '').slice(0, 100_000)).join('\n');
  const failure = { errorCount: info.errors.length,
    nativeScrollNamed: messages.includes('scrollIntoViewIfNeeded'),
    waitingForElementStable: messages.includes('waiting for element to be stable'),
    elementReportedNotStable: /element is not stable|element was not stable/.test(messages),
    native30000MsTimeoutNamed: /(?:Timeout|timeout)[^\n]{0,80}30000ms|30000ms[^\n]{0,80}(?:Timeout|timeout)/.test(messages),
    actualSelectedDiagnosticLocationPresent: messages.includes('home-scroll.spec.ts'),
  };
  const kind = info.title === "homepage What's New section is visible" ? 'heading' : 'footer';
  const result = { kind, browserProject: info.project.name,
    workerIndex: info.workerIndex, parallelIndex: info.parallelIndex, workerProcessId: process.pid,
    expectedAppRevision: '0962858e2ff946e62e4e3416531b01c0d940c064',
    foregroundActivation: activations.get(page) ?? null,
    actualConsumerTestStatus: info.status, actualConsumerTestExpectedStatus: info.expectedStatus,
    actualConsumerTestNodeDurationMs: info.duration, failure,
    postTestObservation: { ...observed, nodeElapsedMs: nodeClock.now() - start },
    foregroundQualification: 'One native Target.activate after real successful navigation; emulated focus and acknowledgment do not prove physical foreground, renderer readiness, or exclusive cause.',
    noConcurrentRafOrWallTimerSampler: true,
    originalConsumerCallbackBytesUnchanged: false,
    originalConsumerAssertionsAndOrderPreservedWithSolePostGotoActivationInsertion: true,
    navigationResponseAssignmentAndSuccessGuardAdded: true,
    diagnosticOnlyNotFull58OrPhysicalIPhoneAcceptance: true,
    directDomStylesScrollFocusStorageOrApplicationCallbacksMutated: false,
    nativeBrowserControlMayChangeForeground: true,
    credentialNetworkHeadersCookiesRawTextAndTracesRecorded: false,
  };
  await fs.mkdir(info.project.outputDir, { recursive: true });
  await fs.writeFile(path.join(info.project.outputDir, 'navigation-' + kind + '.json'), JSON.stringify(result), { flag: 'wx' });
  console.log('SAFE_WEBKIT_POST_NAVIGATION_RESULT ' + JSON.stringify(result));
});
