import fs from 'node:fs/promises';
import path from 'node:path';
import { performance as nodeClock } from 'node:perf_hooks';
import { test, expect } from '../smoke/fixtures';
import type { Page } from '@playwright/test';
// Execute the unchanged actual consumer callbacks, including all native
// scroll, opacity, viewport, six card, and legal-link assertions.
import '../smoke/public-pages.spec';

const target = 'https://dreamforgex-le3wqt0zv-englandsfinest.vercel.app';
type ForegroundResult = { status: 'acknowledged' | 'rejected' | 'unknown'; nodeStart: number; nodeEnd: number; nodeElapsedMs: number };
const activations = new WeakMap<Page, ForegroundResult>();

async function bounded<T>(promise: Promise<T>, limit: number) {
  let timer: NodeJS.Timeout | undefined;
  const result = await Promise.race([
    promise.then(value => ({ status: 'observed' as const, value }), () => ({ status: 'rejected' as const })),
    new Promise<{ status: 'unknown' }>(resolve => { timer = setTimeout(() => resolve({ status: 'unknown' }), limit); }),
  ]);
  if (timer) clearTimeout(timer);
  return result;
}

test.beforeEach(async ({ page, baseURL }, info) => {
  expect(baseURL).toBe(target);
  expect(info.project.name).toBe('mobile-safari');
  expect(["homepage What's New section is visible", 'footer renders with all link sections']).toContain(info.title);
  // A single supported native browser Target.activate call. No DOM focus,
  // scroll, CSS, scheduling, storage, or route assignments are made.
  const nodeStart = nodeClock.now();
  const observed = await bounded(page.bringToFront(), 10_000);
  const nodeEnd = nodeClock.now();
  const status = observed.status === 'observed' ? 'acknowledged' : observed.status;
  const activation: ForegroundResult = { status, nodeStart, nodeEnd, nodeElapsedMs: nodeEnd - nodeStart };
  activations.set(page, activation);
  console.log(`SAFE_WEBKIT_FOREGROUND_ACTIVATION ${JSON.stringify(activation)}`);
  expect(status, 'Native foreground activation must be acknowledged; unknown is not retried').toBe('acknowledged');
});

test.afterEach(async ({ page }, info) => {
  // Sample only after the unchanged real test has finished. No concurrent
  // long-lived in-page Promise is introduced into the native stability wait.
  const start = nodeClock.now();
  const observed = await bounded(page.evaluate(() => ({
    visibility: document.visibilityState,
    readyState: document.readyState,
    hasFocus: document.hasFocus(),
    viewport: { width: innerWidth, height: innerHeight },
    devicePixelRatio,
    scrollX, scrollY,
    documentHeight: document.documentElement.scrollHeight,
  })), 3_000);
  const kind = info.title === "homepage What's New section is visible" ? 'heading' : 'footer';
  const result = { kind, browserProject: info.project.name,
    expectedAppRevision: '0962858e2ff946e62e4e3416531b01c0d940c064',
    foregroundActivation: activations.get(page) ?? null,
    actualConsumerTestStatus: info.status,
    actualConsumerTestExpectedStatus: info.expectedStatus,
    actualConsumerTestNodeDurationMs: info.duration,
    postTestObservation: { ...observed, nodeElapsedMs: nodeClock.now() - start },
    foregroundQualification: 'Native Target.activate control; document focus/visibility are emulated WebKit state, not physical foreground or causal proof.',
    noConcurrentRafOrWallTimerSampler: true,
    originalConsumerCallbackAndAssertionsUnchanged: true,
    diagnosticOnlyNotFull58OrPhysicalIPhoneAcceptance: true,
    directDomStylesScrollFocusStorageOrApplicationCallbacksMutated: false,
    nativeBrowserControlMayChangeForeground: true,
    credentialNetworkHeadersCookiesRawTextAndTracesRecorded: false,
  };
  await fs.mkdir(info.project.outputDir, { recursive: true });
  await fs.writeFile(path.join(info.project.outputDir, `foreground-${kind}.json`), JSON.stringify(result), { flag: 'wx' });
  console.log(`SAFE_WEBKIT_FOREGROUND_RESULT ${JSON.stringify(result)}`);
});
