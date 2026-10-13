import { test as base } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { actualWhatsNew } from '../../test-results/static-media-interception/generated/callback';
import { CASES, caseName, OUTPUT, ownPath, localOrigin, cssUrls, emptyCounts, EVENT_KEYS, MEDIA_KEYS, increment, validateSnapshot } from '../../scripts/diagnostics/static-media/contract.mjs';

type Cell = { caseId: string; sequence: number; repetition: number; mediaSourcePresent: boolean; routingEnabled: boolean };
const test = base.extend<{ cell: Cell; staticObserver: void }>({
  cell: [CASES[0], { option: true }],
  baseURL: async ({ cell }, use) => {
    const runtime = JSON.parse(fs.readFileSync(ownPath(process.cwd(), OUTPUT + '/RUNTIME.json'), 'utf8'));
    const present = localOrigin(runtime.present), absent = localOrigin(runtime.absent);
    if (present === absent) throw new Error('Diagnostic server origins must differ');
    await use(cell.mediaSourcePresent ? present : absent);
  },
  staticObserver: [async ({ page, context, browser, baseURL, cell }, use) => {
    const origin = localOrigin(baseURL!);
    const assets = JSON.parse(fs.readFileSync(ownPath(process.cwd(), 'scripts/diagnostics/static-media/assets/manifest.json'), 'utf8'));
    const embedded = new Set<string>(assets.files.filter((f: { kind: string; file: string }) => f.kind === 'snapshot' && f.file.endsWith('.css')).flatMap((f: { file: string }) => cssUrls(fs.readFileSync(ownPath(process.cwd(), 'scripts/diagnostics/static-media/assets/' + f.file), 'utf8')).filter((u: string) => /^data:image\/svg\+xml(?:;base64)?,/.test(u))));
    const events = emptyCounts(EVENT_KEYS), media = emptyCounts(MEDIA_KEYS);
    const inFlight = new Set<object>();
    let foreignRequests = 0, observing = true;
    const crash = () => { if (observing) increment(events, 'pageCrash'); };
    const close = () => { if (observing) increment(events, 'pageClose'); };
    const disconnect = () => { if (observing) increment(events, 'browserDisconnected'); };
    const isMedia = (request: { url(): string }) => { try { const url = new URL(request.url()); return url.origin === origin && url.pathname === '/video/hero-bg.mp4'; } catch { return false; } };
    const started = (request: import('@playwright/test').Request) => {
      if (!observing) return;
      try { if (!embedded.has(request.url()) && new URL(request.url()).origin !== origin) foreignRequests++; } catch { foreignRequests++; }
      if (isMedia(request)) { increment(media, 'requestStarted'); inFlight.add(request); if (Object.hasOwn(request.headers(), 'range')) increment(media, 'rangeHeaderPresentRequests'); }
    };
    const finished = (request: import('@playwright/test').Request) => { if (observing && isMedia(request)) { increment(media, 'requestFinished'); inFlight.delete(request); } };
    const failed = (request: import('@playwright/test').Request) => { if (observing && isMedia(request)) { increment(media, 'requestFailed'); inFlight.delete(request); } };
    const responded = (response: import('@playwright/test').Response) => { if (observing && isMedia(response.request())) { const status = response.status(); increment(media, [200, 206, 416].includes(status) ? 'status' + status : 'otherStatus'); } };
    page.on('crash', crash); page.on('close', close); browser.on('disconnected', disconnect);
    context.on('request', started); context.on('requestfinished', finished); context.on('requestfailed', failed); context.on('response', responded);
    if (cell.routingEnabled) await context.route('**/*', route => route.continue());
    try { await use(); }
    finally {
      // Snapshot before this fixture's dependencies (page/context/browser) tear down.
      observing = false; media.inFlightAtCaseEnd = inFlight.size;
      const snapshot = validateSnapshot({ sequence: cell.sequence, availability: { eventObserverAttached: true, mediaObserverAttached: true, beforeTeardownSnapshotAvailable: true, nativeTestPhaseEnded: true }, publicEventCountsBeforeTeardown: events, mediaCountersBeforeTeardown: media, foreignRequestsBeforeTeardown: foreignRequests });
      page.off('crash', crash); page.off('close', close); browser.off('disconnected', disconnect);
      context.off('request', started); context.off('requestfinished', finished); context.off('requestfailed', failed); context.off('response', responded);
      const file = ownPath(process.cwd(), OUTPUT + `/partials/case-${cell.sequence}.json`);
      fs.writeFileSync(file, JSON.stringify(snapshot) + '\n', { flag: 'wx' });
      if (foreignRequests) throw new Error('Diagnostic encountered a forbidden non-loopback request');
    }
  }, { auto: true }],
});

for (const cell of CASES) {
  test.describe(caseName(cell), () => {
    test.use({ cell });
    test('actual native heading and six cards', async ({ page }) => { await actualWhatsNew({ page }); });
  });
}
