import fs from 'node:fs/promises';
import path from 'node:path';
import { performance as nodeClock } from 'node:perf_hooks';
import { test, expect } from '../smoke/fixtures';
import type { Page } from '@playwright/test';

const target = 'https://dreamforgex-le3wqt0zv-englandsfinest.vercel.app';

/** Read-only sampling: no styles, scroll positions, storage or application
 * callbacks are modified. Timers/RAF belong only to this bounded sampler. */
async function sampleFrames(page: Page) {
  return page.evaluate(() => new Promise(resolve => {
    const start = performance.now();
    const frames: unknown[] = [];
    const wallclockSamples: unknown[] = [];
    let deliveredRafCallbacks = 0, lastStoredFrame = -Infinity;
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      return {
        tag: element.tagName, isConnected: element.isConnected,
        box: { x: box.x, y: box.y, top: box.top, left: box.left,
          right: box.right, bottom: box.bottom, width: box.width, height: box.height },
        css: { opacity: css.opacity, transform: css.transform, display: css.display,
          position: css.position, overflowX: css.overflowX, overflowY: css.overflowY,
          fontSize: css.fontSize, lineHeight: css.lineHeight, contentVisibility: css.contentVisibility },
      };
    };
    const heading = [...document.querySelectorAll('h2')].find(element =>
      element.textContent?.replace(/\s+/g, ' ').trim() === "What's new this week") ?? null;
    const footerLink = document.querySelector('footer a[href="/about"]');
    const consecutiveRafGeometry = [heading, footerLink].map(() => ({
      prior: null as number[] | null, observations: 0, identicalAdjacentPairs: 0,
      changedAdjacentPairs: 0, missingOrDisconnectedFrames: 0,
    }));
    const ancestors = (element: Element | null) => {
      const rows = [];
      for (let count = 0; element && count < 6; count++, element = element.parentElement) rows.push(rect(element));
      return rows;
    };
    const snapshot = () => ({
      at: performance.now(), visibility: document.visibilityState, readyState: document.readyState,
      hasFocus: document.hasFocus(), fontsStatus: document.fonts.status,
      fontsPending: [...document.fonts].filter(font => font.status === 'loading' || font.status === 'unloaded').length,
      scrollX, scrollY, viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      visualViewport: window.visualViewport ? { width: visualViewport!.width,
        height: visualViewport!.height, offsetTop: visualViewport!.offsetTop,
        offsetLeft: visualViewport!.offsetLeft, scale: visualViewport!.scale } : null,
      documentHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      documentScrollTop: document.documentElement.scrollTop,
      bodyScrollTop: document.body.scrollTop,
      scrollingElement: document.scrollingElement?.tagName ?? null,
      scrollingElementScrollTop: document.scrollingElement?.scrollTop ?? null,
      html: rect(document.documentElement), body: rect(document.body),
      hero: rect(document.querySelector('h1')),
      heading: rect(heading), footer: rect(document.querySelector('footer')),
      footerLink: rect(footerLink), headingAncestors: ancestors(heading), footerAncestors: ancestors(footerLink),
    });
    const initial = snapshot();
    let raf = 0, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      clearInterval(interval);
      resolve({ reason: 'wallclock-limit', deliveredRafCallbacks, storedRafSnapshots: frames.length, elapsedMs: performance.now() - start,
        initial, final: snapshot(), frames, consecutiveRafGeometry,
        wallclockSampleCount: wallclockSamples.length, wallclockSamples });
    };
    const timer = setTimeout(finish, 32_000);
    const interval = setInterval(() => { if (wallclockSamples.length < 128) wallclockSamples.push(snapshot()); }, 250);
    const tick = (timestamp: number) => {
      if (finished) return;
      deliveredRafCallbacks++;
      [heading, footerLink].forEach((element, index) => {
        const state = consecutiveRafGeometry[index];
        if (!element?.isConnected) { state.missingOrDisconnectedFrames++; state.prior = null; return; }
        const box = element.getBoundingClientRect(), tuple = [box.top, box.left, box.width, box.height];
        state.observations++;
        if (state.prior) {
          if (tuple.every((value, field) => value === state.prior![field])) state.identicalAdjacentPairs++;
          else state.changedAdjacentPairs++;
        }
        state.prior = tuple;
      });
      if (frames.length < 180 && timestamp - lastStoredFrame >= 180) {
        frames.push({ rafTimestamp: timestamp, ...snapshot() });
        lastStoredFrame = timestamp;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }));
}

async function bounded<T>(promise: Promise<T>, timeout: number) {
  const start = nodeClock.now();
  let timer: NodeJS.Timeout | undefined;
  const result = await Promise.race([
    promise.then(value => ({ status: 'observed' as const, value }), () => ({ status: 'evaluation-rejected' as const })),
    new Promise<{ status: 'node-watchdog' }>(resolve => { timer = setTimeout(() => resolve({ status: 'node-watchdog' }), timeout); }),
  ]);
  if (timer) clearTimeout(timer);
  return { ...result, nodeStart: start, nodeEnd: nodeClock.now(), nodeElapsedMs: nodeClock.now() - start };
}

function afterSnapshot(element: Element) {
  const box = element.getBoundingClientRect(), css = getComputedStyle(element);
  return { at: performance.now(), isConnected: element.isConnected,
    visibility: document.visibilityState, readyState: document.readyState,
    hasFocus: document.hasFocus(), activeElement: document.activeElement?.tagName ?? null,
    activeContentEditable: document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable,
    scrollX, scrollY, documentHeight: document.documentElement.scrollHeight,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    opacity: css.opacity, transform: css.transform };
}

for (const kind of ['heading', 'footer'] as const) {
  test(`diagnose ${kind} native mobile WebKit stability`, async ({ page, baseURL }, info) => {
    expect(baseURL).toBe(target);
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    const locator = kind === 'heading'
      ? page.getByRole('heading', { name: "What's new this week", exact: true })
      : page.locator('footer a[href="/about"]').first();
    await expect(locator).toHaveCount(1);
    // Start measurement concurrently; preserve the original early native
    // action condition rather than inserting a pre-action settling delay.
    const duringPromise = bounded(sampleFrames(page), 38_000);
    const nativeStarted = nodeClock.now();
    let success = false;
    let safeError: { stableWait: boolean; notStable: boolean; timeoutMs: number | null } | null = null;
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 30_000 });
      success = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      safeError = { stableWait: message.includes('waiting for element to be stable'),
        notStable: message.includes('element is not stable'),
        timeoutMs: Number(message.match(/Timeout ([\d.]+)ms exceeded/)?.[1]) || null };
    }
    const nativeEnded = nodeClock.now();
    const during = await duringPromise;
    const after = await bounded(locator.evaluate(afterSnapshot), 5_000);
    const keyboardControl: unknown[] = [];
    if (!success) {
      const keys = kind === 'heading' ? ['PageDown', 'PageDown', 'PageDown', 'PageDown'] : ['End'];
      for (const key of keys) {
        const beforeKey = await bounded(locator.evaluate(afterSnapshot), 3_000);
        if (beforeKey.status !== 'observed' || beforeKey.value.activeContentEditable ||
          !['BODY', 'HTML'].includes(beforeKey.value.activeElement ?? '')) {
          keyboardControl.push({ keyNotSent: true, reason: 'ACTIVE_BODY_HTML_NOT_PROVEN', beforeKey });
          break;
        }
        const event = await bounded(page.keyboard.press(key), 5_000);
        if (event.status !== 'observed') { keyboardControl.push({ key, beforeKey, event, acknowledgmentUnknownNoRetry: true }); break; }
        await new Promise(resolve => setTimeout(resolve, 150));
        const afterKey = await bounded(locator.evaluate(afterSnapshot), 3_000);
        keyboardControl.push({ key, beforeKey, event, afterKey });
      }
    }
    const result = { kind, browserProject: info.project.name, expectedAppRevision: '0962858e2ff946e62e4e3416531b01c0d940c064',
      nativeScrollSucceeded: success, safeError, during, after,
      nativeActionNodeClock: { start: nativeStarted, end: nativeEnded, elapsedMs: nativeEnded - nativeStarted },
      keyboardControl,
      keyboardControlQualification: 'Automated keyboard in mobile emulation; not physical touch/iPhone proof, not native-scroll or full58 acceptance.',
      samplingQualification: 'Observational RAF/style/geometry reads may affect scheduling; sampled success cannot certify the uninstrumented58 or exact root cause.',
      adjacentGeometryQualification: 'Exact tuples are compared on every delivered main-world RAF; they do not prove delivery or stability of the driver utility-world RAF.',
      sampleRealm: 'Main-world RAF/interval; native driver independently uses its utility-world RAF.',
      directDomStyleScrollStorageOrCallbacksMutated: false,
      nativeActionsMayChangeScroll: true,
      networkHeadersCookiesRawTextAndTracesRecorded: false };
    await fs.mkdir(info.project.outputDir, { recursive: true });
    await fs.writeFile(path.join(info.project.outputDir, `geometry-${kind}.json`), JSON.stringify(result), { flag: 'wx' });
    console.log(`SAFE_WEBKIT_DIAGNOSTIC ${JSON.stringify(result)}`);
    expect(success, `${kind} native scroll still requires a real stability fix`).toBe(true);
    await expect(locator).toBeVisible();
    await expect(locator).toBeInViewport();
  });
}
