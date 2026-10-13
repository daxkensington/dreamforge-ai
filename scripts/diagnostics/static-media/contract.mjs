import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const BASE = '632ca11de3c9944f337e1a305c24234a9e8d1b2a';
export const BASE_TREE = 'b484afe1075dd68a0f02260e516fe787b99328ba';
export const BRANCH = 'codex/dreamforge-offline-scroll-20261013';
export const ORDER = ['A', 'B', 'C', 'D', 'D', 'C', 'B', 'A'];
export const CELLS = { A: { mediaSourcePresent: true, routingEnabled: true }, B: { mediaSourcePresent: true, routingEnabled: false }, C: { mediaSourcePresent: false, routingEnabled: true }, D: { mediaSourcePresent: false, routingEnabled: false } };
export const CASES = ORDER.map((caseId, sequence) => ({ caseId, sequence, repetition: sequence < 4 ? 1 : 2, ...CELLS[caseId] }));
export const OUTPUT = 'test-results/static-media-interception';
export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function cssUrls(value) {
  const urls = [];
  for (let index = 0; (index = value.indexOf('url(', index)) >= 0;) {
    let cursor = index + 4;
    while (/\s/.test(value[cursor] || '')) cursor++;
    const quote = ['"', "'"].includes(value[cursor]) ? value[cursor++] : null;
    const start = cursor;
    if (quote) { while (cursor < value.length && value[cursor] !== quote) { if (value[cursor] === '\\') cursor++; cursor++; } assert(cursor < value.length); urls.push(value.slice(start, cursor)); cursor++; while (/\s/.test(value[cursor] || '')) cursor++; assert.equal(value[cursor], ')'); }
    else { while (cursor < value.length && value[cursor] !== ')') cursor++; assert(cursor < value.length); urls.push(value.slice(start, cursor).trim()); }
    index = cursor + 1;
  }
  return urls;
}
export function validateAssets(manifest) {
  assert(manifest && Object.keys(manifest).sort().join(',') === 'css,files');
  assert.deepEqual(manifest.css, ['/_next/static/css/28a17861791f36cb.css', '/_next/static/css/a3c12419cd3201d5.css']);
  assert(Array.isArray(manifest.files) && manifest.files.length === 23);
  assert.equal(new Set(manifest.files.map(r => r.url)).size, 23);
  assert.equal(new Set(manifest.files.map(r => r.kind + ':' + r.file)).size, 23);
  for (const row of manifest.files) {
    assert(Object.keys(row).sort().join(',') === 'bytes,file,kind,sha256,url');
    assert(['snapshot', 'repo'].includes(row.kind));
    assert(Number.isSafeInteger(row.bytes) && row.bytes > 0 && /^[a-f0-9]{64}$/.test(row.sha256));
    if (row.kind === 'snapshot') { assert(/^_next\/static\/(?:css\/[a-f0-9]{16}\.css|media\/[a-f0-9]{16}-s(?:\.p)?\.woff2)$/.test(row.file)); assert.equal(row.url, '/' + row.file); }
    else { assert(/^public\/(?:showcase\/(?:hero-forge|tool-(?:pet-portrait|tarot-card|movie-poster|pixel-art|brand-style-guide|audio-self))\.jpg|video\/hero-bg\.mp4)$/.test(row.file)); assert.equal(row.url, '/' + row.file.slice('public/'.length)); }
  }
  assert.equal(manifest.files.filter(r => r.kind === 'repo').length, 8);
  for (const [i, url] of manifest.css.entries()) assert.equal(manifest.files.find(r => r.url === url)?.sha256, ['cb23eed16d321a7a92b6aba41749cc957353a15170365a2f368392fca63bb257', '971672db78803a3f0d6f028c077edbd070cb2ca0a8711ff21a8aee4655e37a07'][i]);
  const media = manifest.files.find(r => r.url === '/video/hero-bg.mp4');
  assert.equal(media?.bytes, 2197955); assert.equal(media?.sha256, '90110f827f9ef7018949e5021c98fe989a2f2496c64509a12a74d69a676bec7e');
  return manifest;
}
export const caseName = c => `static-${c.sequence}-${c.caseId}-${c.repetition}`;
export const ownPath = (root, relative, trackedPublicExample = false) => {
  assert(typeof relative === 'string' && relative.length && !/[\\:\0]/.test(relative) && !path.isAbsolute(relative));
  assert(relative.split('/').every(s => s && s !== '.' && s !== '..' && (!s.startsWith('.env') || (trackedPublicExample && relative === '.env.example'))));
  let cursor = path.resolve(root);
  for (const part of relative.split('/')) { cursor = path.join(cursor, part); if (fs.existsSync(cursor)) assert(!fs.lstatSync(cursor).isSymbolicLink()); }
  const difference = path.relative(path.resolve(root), cursor);
  assert(difference && !difference.startsWith('..') && !path.isAbsolute(difference));
  return cursor;
};
export function localOrigin(value) {
  const url = new URL(value);
  assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash);
  assert(/^\d+$/.test(url.port) && Number(url.port) > 0 && Number(url.port) <= 65535);
  return url.origin;
}
export function singleRange(header, bytes) {
  assert(Number.isSafeInteger(bytes) && bytes > 0);
  if (header === undefined) return { status: 200, start: 0, end: bytes - 1, length: bytes };
  if (typeof header !== 'string' || !/^bytes=(\d*)-(\d*)$/.test(header)) return { status: 416, length: 0 };
  const [, first, last] = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!first && !last) return { status: 416, length: 0 };
  let start, end;
  if (!first) { const suffix = Number(last); if (!Number.isSafeInteger(suffix) || suffix <= 0) return { status: 416, length: 0 }; start = Math.max(0, bytes - suffix); end = bytes - 1; }
  else { start = Number(first); end = last ? Number(last) : bytes - 1; if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= bytes || end < start) return { status: 416, length: 0 }; end = Math.min(end, bytes - 1); }
  return { status: 206, start, end, length: end - start + 1 };
}
export const EVENT_KEYS = ['pageCrash', 'pageClose', 'browserDisconnected'];
export const MEDIA_KEYS = ['requestStarted', 'requestFinished', 'requestFailed', 'rangeHeaderPresentRequests', 'status200', 'status206', 'status416', 'otherStatus', 'inFlightAtCaseEnd'];
export const emptyCounts = keys => Object.fromEntries(keys.map(k => [k, 0]));
export function increment(counts, key) { assert(Object.hasOwn(counts, key)); counts[key]++; assert(Number.isSafeInteger(counts[key])); }
const exactKeys = (object, keys) => { assert(object && typeof object === 'object' && !Array.isArray(object)); assert.deepEqual(Object.keys(object).sort(), [...keys].sort()); };
const int = n => assert(Number.isSafeInteger(n) && n >= 0);
export function validateSnapshot(row) {
  exactKeys(row, ['sequence', 'availability', 'publicEventCountsBeforeTeardown', 'mediaCountersBeforeTeardown', 'foreignRequestsBeforeTeardown']);
  int(row.sequence); assert(row.sequence < 8);
  exactKeys(row.availability, ['eventObserverAttached', 'mediaObserverAttached', 'beforeTeardownSnapshotAvailable', 'nativeTestPhaseEnded']);
  for (const value of Object.values(row.availability)) assert(typeof value === 'boolean');
  const available = row.availability.beforeTeardownSnapshotAvailable && row.availability.nativeTestPhaseEnded;
  for (const [field, keys, attached] of [['publicEventCountsBeforeTeardown', EVENT_KEYS, row.availability.eventObserverAttached], ['mediaCountersBeforeTeardown', MEDIA_KEYS, row.availability.mediaObserverAttached]]) {
    if (!available || !attached) assert.equal(row[field], null);
    else { exactKeys(row[field], keys); Object.values(row[field]).forEach(int); }
  }
  if (row.mediaCountersBeforeTeardown !== null) { const m = row.mediaCountersBeforeTeardown; assert.equal(m.requestStarted, m.requestFinished + m.requestFailed + m.inFlightAtCaseEnd); assert(m.rangeHeaderPresentRequests <= m.requestStarted); assert(m.status200 + m.status206 + m.status416 + m.otherStatus <= m.requestStarted); }
  if (!available || !row.availability.mediaObserverAttached) assert.equal(row.foreignRequestsBeforeTeardown, null); else int(row.foreignRequestsBeforeTeardown);
  return row;
}
export function missingSnapshot(sequence) { return { sequence, availability: { eventObserverAttached: false, mediaObserverAttached: false, beforeTeardownSnapshotAvailable: false, nativeTestPhaseEnded: false }, publicEventCountsBeforeTeardown: null, mediaCountersBeforeTeardown: null, foreignRequestsBeforeTeardown: null }; }
export function classifyError(errors, callsites = {}) {
  const text = (errors || []).map(e => String(e.message || '') + '\n' + String(e.stack || '')).join('\n');
  const stableWait = /waiting for element to be stable/.test(text);
  const reportedInstability = /element is not stable/.test(text);
  const failureClass = /crash|Target closed|browser.*closed|page.*closed/i.test(text) ? 'closed-or-crashed' : /not attached|detached/i.test(text) ? 'detached' : reportedInstability ? 'reported-instability' : stableWait ? 'stable-wait' : /Timeout|timed out/i.test(text) ? 'timeout' : text ? 'assertion-or-other' : 'none';
  // Only allowlisted locator names are retained, never the error string.
  let failingScrollTarget = 'unobserved';
  if (stableWait || reportedInstability) {
    const stack = (errors || []).map(e => String(e.stack || '')).join('\n');
    const located = name => Number.isSafeInteger(callsites[name]) && new RegExp('generated[\\\\/]callback\\.ts:' + callsites[name] + ':\\d+').test(stack);
    if (located('heading') && !located('card')) failingScrollTarget = 'heading';
    else if (located('card') && !located('heading')) {
      const selectors = [...new Set([...text.matchAll(/a\[href=["']\/tools\/(pet-portrait|tarot-card|movie-poster|pixel-art|brand-style-guide|song-creator)["']\]/g)].map(match => match[1]))];
      if (selectors.length === 1) failingScrollTarget = 'card' + (['pet-portrait', 'tarot-card', 'movie-poster', 'pixel-art', 'brand-style-guide', 'song-creator'].indexOf(selectors[0]) + 1);
    }
  }
  return { failureClass, stableWait, reportedInstability, failingScrollTarget };
}
export function validateResult(result) {
  exactKeys(result, ['kind', 'schemaVersion', 'workflowRunId', 'full58Acceptance', 'sourceReleaseAccepted', 'rawBrowserArtifactsUploaded', 'globalErrors', 'completeEightCaseObservation', 'cases']);
  assert.equal(result.kind, 'STATIC_MEDIA_INTERCEPTION_DIAGNOSTIC'); assert.equal(result.schemaVersion, 1);
  int(result.workflowRunId); assert(result.workflowRunId > 0); int(result.globalErrors);
  assert.equal(result.full58Acceptance, false); assert.equal(result.sourceReleaseAccepted, false); assert.equal(result.rawBrowserArtifactsUploaded, false);
  assert(typeof result.completeEightCaseObservation === 'boolean' && Array.isArray(result.cases) && result.cases.length === 8);
  for (const [i, row] of result.cases.entries()) {
    exactKeys(row, ['caseId', 'sequence', 'repetition', 'mediaSourcePresent', 'routingEnabled', 'status', 'elapsedMs', 'failureClass', 'stableWait', 'reportedInstability', 'failingScrollTarget', 'snapshot']);
    for (const [key, value] of Object.entries(CASES[i])) assert.equal(row[key], value);
    assert(['passed', 'failed', 'timedOut', 'interrupted', 'unobserved'].includes(row.status));
    if (row.status === 'unobserved') assert.equal(row.elapsedMs, null); else assert(Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0);
    assert(['none', 'closed-or-crashed', 'detached', 'reported-instability', 'stable-wait', 'timeout', 'assertion-or-other'].includes(row.failureClass));
    assert(typeof row.stableWait === 'boolean' && typeof row.reportedInstability === 'boolean');
    assert(['heading', 'card1', 'card2', 'card3', 'card4', 'card5', 'card6', 'unobserved'].includes(row.failingScrollTarget));
    if (row.status === 'passed') { assert.equal(row.failureClass, 'none'); assert.equal(row.stableWait, false); assert.equal(row.reportedInstability, false); assert.equal(row.failingScrollTarget, 'unobserved'); }
    assert.equal(row.snapshot.sequence, i); validateSnapshot(row.snapshot);
    if (!row.mediaSourcePresent && row.snapshot.mediaCountersBeforeTeardown !== null) Object.values(row.snapshot.mediaCountersBeforeTeardown).forEach(n => assert.equal(n, 0));
    if (row.status === 'unobserved') assert.equal(row.snapshot.availability.beforeTeardownSnapshotAvailable, false);
  }
  const complete = result.globalErrors === 0 && result.cases.every(r => r.status !== 'unobserved' && r.snapshot.availability.eventObserverAttached && r.snapshot.availability.mediaObserverAttached && r.snapshot.availability.beforeTeardownSnapshotAvailable && r.snapshot.availability.nativeTestPhaseEnded && r.snapshot.foreignRequestsBeforeTeardown === 0);
  assert.equal(result.completeEightCaseObservation, complete);
  return result;
}
