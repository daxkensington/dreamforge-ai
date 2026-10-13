import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import { BASE, OUTPUT, CASES, ORDER, caseName, sha, ownPath, localOrigin, cssUrls, singleRange, validateAssets, validateSnapshot, validateResult, classifyError, missingSnapshot, emptyCounts, EVENT_KEYS, MEDIA_KEYS } from './contract.mjs';
import { loadResources, resourceResponse } from './server.mjs';
import { verifySource } from './verify-source.mjs';
import SafeReporter from './reporter.mjs';
const root = process.cwd();
if (process.argv[2] === '--result') {
  const file = ownPath(root, OUTPUT + '/safe/RESULT.json'); assert(fs.statSync(file).size < 50000); validateResult(JSON.parse(fs.readFileSync(file))); console.log(JSON.stringify({ safeResultSchemaPass: true }));
} else if (process.argv.length === 2) {
  const groups = [];
  const check = (name, fn) => { fn(); groups.push(name); };
  const proof = JSON.parse(fs.readFileSync(ownPath(root, OUTPUT + '/BUILD-PROOF.json')));
  const assets = validateAssets(JSON.parse(fs.readFileSync(ownPath(root, 'scripts/diagnostics/static-media/assets/manifest.json'))));
  const resources = loadResources(root);
  const jsonClone = value => JSON.parse(JSON.stringify(value));
  check('actual-source/versions/whole-native-callback', () => {
    assert.equal(proof.base, BASE); assert.equal(proof.versions['@playwright/test'], '1.63.0');
    const original = fs.readFileSync(ownPath(root, 'tests/smoke/public-pages.spec.ts'), 'utf8');
    const sf = ts.createSourceFile('original.ts', original, ts.ScriptTarget.Latest, true); let callback;
    const visit = n => { if (ts.isCallExpression(n) && n.expression.getText(sf) === 'test' && n.arguments[0]?.text === "homepage What's New section is visible") callback = n.arguments[1]; ts.forEachChild(n, visit); }; visit(sf);
    assert.equal(sha(Buffer.from(callback.body.getText(sf))), proof.callbackBodySha256);
    const generated = fs.readFileSync(ownPath(root, OUTPUT + '/generated/callback.ts'), 'utf8');
    assert(generated.includes(callback.getText(sf))); assert.deepEqual(Object.keys(proof.callbackCallsites).sort(), ['card', 'heading']);
    assert(proof.callbackCallsites.heading !== proof.callbackCallsites.card);
    assert.equal((generated.match(/scrollIntoViewIfNeeded\(\{ timeout: 30_000 \}\)/g) || []).length, 2);
    assert(!/waitForTimeout|\.evaluate|force:|\.skip\(/.test(generated));
  });
  check('literal-SSR-only-source-difference/real-cards', () => {
    const present = resources.get('/present.html').buffer.toString(), absent = resources.get('/absent.html').buffer.toString();
    assert.equal(present.replace(/<source[^>]*\/>/, ''), absent); assert(!/data-media-source|\/api\/|https?:\/\//.test(present.replace(/<svg[\s\S]*?<\/svg>/g, '')));
    for (const title of ['Pet Portrait', 'Tarot Card Designer', 'Movie Poster', 'Pixel Art Generator', 'Brand Style Guide', 'Self-Hosted Audio']) assert(present.includes(title));
    const renderedText = present.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
    assert(renderedText.includes("What's new this week") && renderedText.includes('Just shipped'));
  });
  check('asset-graph/duplicates/aliases/byte-closure', () => {
    for (const mutate of [m => m.files[1].url = m.files[0].url, m => m.files[0].url = '/wrong.css', m => m.files[0].file = '../private', m => m.files[0].sha256 = '0'.repeat(64)]) { const changed = jsonClone(assets); mutate(changed); assert.throws(() => validateAssets(changed)); }
    for (const row of assets.files) assert.equal(sha(resources.get(row.url).buffer), row.sha256);
    assert.deepEqual(cssUrls(`url("data:image/svg+xml,<svg style='filter:url(#n)'></svg>") url(/local.woff2)`), ["data:image/svg+xml,<svg style='filter:url(#n)'></svg>", '/local.woff2']);
    assert.throws(() => cssUrls('url("unterminated)'));
  });
  check('real-MP4-ranges/reassembly/HEAD/invalid', () => {
    const media = resources.get('/video/hero-bg.mp4').buffer; const chunks = [];
    for (let start = 0; start < media.length; start += 500000) { const end = Math.min(start + 499999, media.length - 1); const result = resourceResponse('GET', '/video/hero-bg.mp4', `bytes=${start}-${end}`, true, resources); assert.equal(result.status, 206); assert.equal(result.headers['Content-Range'], `bytes ${start}-${end}/${media.length}`); assert.equal(Number(result.headers['Content-Length']), end - start + 1); chunks.push(result.body); }
    assert.deepEqual(Buffer.concat(chunks), media);
    for (const header of ['bytes=-10', 'bytes=0-', 'bytes=0-999999999']) assert.equal(singleRange(header, media.length).status, 206);
    for (const header of ['bytes=-0', 'bytes=5-4', 'bytes=999999999-', 'bytes=0-2,4-5', 'bytes=90071992547409930-', 'items=0-2']) assert.equal(singleRange(header, media.length).status, 416);
    const head = resourceResponse('HEAD', '/video/hero-bg.mp4', 'bytes=0-1', true, resources); assert.equal(head.body.length, 0); assert.equal(head.headers['Content-Length'], '2');
    assert.equal(resourceResponse('GET', '/video/hero-bg.mp4', undefined, true, resources).status, 200);
  });
  check('handler-method/traversal/API/variant-fences', () => {
    for (const request of ['../x', '//external/x', '/%2e%2e/private', '/%5cprivate', '/bad%zz', '/x?remote=1']) assert.equal(resourceResponse('GET', request, undefined, true, resources).status, 400);
    for (const request of ['/api/status/providers', '/api/health', '/present.html', '/absent.html', '/unknown']) assert.equal(resourceResponse('GET', request, undefined, true, resources).status, 404);
    assert.equal(resourceResponse('POST', '/', undefined, true, resources).status, 405);
    assert.deepEqual(resourceResponse('GET', '/', undefined, false, resources).body, resources.get('/absent.html').buffer);
    for (const url of ['https://127.0.0.1:5', 'http://localhost:5', 'http://user@127.0.0.1:5', 'http://127.0.0.1:5/api', 'http://127.0.0.1:5/?x=1']) assert.throws(() => localOrigin(url));
    assert.equal(localOrigin('http://127.0.0.1:55123'), 'http://127.0.0.1:55123');
  });
  check('exact-balanced8/standard-lifecycle/recording', () => {
    assert.deepEqual(ORDER, ['A', 'B', 'C', 'D', 'D', 'C', 'B', 'A']);
    for (const id of ['A', 'B', 'C', 'D']) assert.equal(CASES.filter(c => c.caseId === id).length, 2);
    const config = fs.readFileSync(ownPath(root, 'playwright.offline-scroll.config.ts'), 'utf8');
    for (const literal of ["workers: 1", "retries: 0", "timeout: 120_000", "timeout: 10_000", "actionTimeout: 10_000", "navigationTimeout: 110_000", "trace: 'off'", "screenshot: 'only-on-failure'", "video: 'retain-on-failure'", "devices['iPhone 14']"]) assert(config.includes(literal));
    const fixture = fs.readFileSync(ownPath(root, 'tests/diagnostics/static-media-interception.spec.ts'), 'utf8');
    assert.equal((fixture.match(/context\.route\(/g) || []).length, 1); assert(fixture.includes('if (cell.routingEnabled)'));
    assert(!/bringToFront|\.evaluate|requestAnimationFrame|newContext|\.launch\(|setTimeout/.test(fixture));
  });
  check('runtime-refuses-local/uncommitted-source', () => { assert.throws(() => verifySource(root, true)); });
  const snapshot = sequence => ({ sequence, availability: { eventObserverAttached: true, mediaObserverAttached: true, beforeTeardownSnapshotAvailable: true, nativeTestPhaseEnded: true }, publicEventCountsBeforeTeardown: emptyCounts(EVENT_KEYS), mediaCountersBeforeTeardown: emptyCounts(MEDIA_KEYS), foreignRequestsBeforeTeardown: 0 });
  check('unavailable/teardown/counter-conservation', () => {
    validateSnapshot(missingSnapshot(0)); validateSnapshot(snapshot(0));
    const wrong = missingSnapshot(0); wrong.publicEventCountsBeforeTeardown = emptyCounts(EVENT_KEYS); assert.throws(() => validateSnapshot(wrong));
    for (const mutate of [s => s.mediaCountersBeforeTeardown.requestStarted = 1, s => s.mediaCountersBeforeTeardown.rangeHeaderPresentRequests = 1, s => s.mediaCountersBeforeTeardown.status206 = 1, s => s.publicEventCountsBeforeTeardown.pageClose = Infinity]) { const row = snapshot(0); mutate(row); assert.throws(() => validateSnapshot(row)); }
  });
  check('actual-callsite/ancestor-card/ambiguous-refusal', () => {
    const stack = name => `at actualWhatsNew (/job/generated/callback.ts:${proof.callbackCallsites[name]}:17)`;
    assert.equal(classifyError([{ message: "waiting for element to be stable What's new this week", stack: stack('heading') }], proof.callbackCallsites).failingScrollTarget, 'heading');
    assert.equal(classifyError([{ message: 'waiting for element to be stable What\'s new this week a[href="/tools/pet-portrait"] incidental /tools/song-creator', stack: stack('card') }], proof.callbackCallsites).failingScrollTarget, 'card1');
    assert.equal(classifyError([{ message: 'waiting for element to be stable a[href="/tools/pet-portrait"] a[href="/tools/song-creator"]', stack: stack('card') }], proof.callbackCallsites).failingScrollTarget, 'unobserved');
    assert.equal(classifyError([{ message: "waiting for element to be stable What's new this week", stack: 'at anotherFile.ts:1:1' }], proof.callbackCallsites).failingScrollTarget, 'unobserved');
  });
  check('actual-reporter-producer/schema/adversarial', () => {
    const temporary = fs.mkdtempSync(ownPath(root, OUTPUT + '/validation-'));
    const originalRun = process.env.GITHUB_RUN_ID;
    try {
      process.chdir(temporary); process.env.GITHUB_RUN_ID = '1';
      for (const dir of ['partials', 'safe']) fs.mkdirSync(ownPath(temporary, OUTPUT + '/' + dir), { recursive: true });
      fs.writeFileSync(ownPath(temporary, OUTPUT + '/BUILD-PROOF.json'), JSON.stringify(proof));
      const reporter = new SafeReporter(); const tests = CASES.map(c => ({ titlePath: () => [caseName(c), 'actual native heading and six cards'], expectedStatus: 'passed' }));
      reporter.onBegin({}, { allTests: () => tests });
      for (const [i, test] of tests.entries()) { fs.writeFileSync(ownPath(temporary, OUTPUT + `/partials/case-${i}.json`), JSON.stringify(snapshot(i))); reporter.onTestEnd(test, { status: 'passed', duration: 100, retry: 0, errors: [] }); }
      reporter.onEnd(); const result = validateResult(JSON.parse(fs.readFileSync(ownPath(temporary, OUTPUT + '/safe/RESULT.json'))));
      for (const mutate of [r => r.cases[0].failureClass = 'timeout', r => r.cases[0].stableWait = true, r => r.cases[0].elapsedMs = Infinity, r => r.cases[0].status = 'unobserved', r => r.cases[0].snapshot.mediaCountersBeforeTeardown.extra = 'secret', r => r.cases[3].snapshot.mediaCountersBeforeTeardown.requestStarted = 1, r => r.cases[0].unexpected = 'http://private', r => r.completeEightCaseObservation = false]) { const row = jsonClone(result); mutate(row); assert.throws(() => validateResult(row)); }
      assert.throws(() => reporter.onTestEnd(tests[0], { status: 'passed', duration: 10, retry: 1, errors: [] }));
      const missing = jsonClone(result); missing.cases[0] = { ...missing.cases[0], status: 'unobserved', elapsedMs: null, snapshot: missingSnapshot(0) }; missing.completeEightCaseObservation = false; validateResult(missing);
      assert.throws(() => { missing.cases[0].elapsedMs = 0; validateResult(missing); });
    } finally { process.chdir(root); if (originalRun === undefined) delete process.env.GITHUB_RUN_ID; else process.env.GITHUB_RUN_ID = originalRun; }
  });
  const source = verifySource(root);
  const workflow = fs.readFileSync(ownPath(root, '.github/workflows/smoke.yml'), 'utf8');
  const guardStart = workflow.indexOf('            const branch =');
  const guardEnd = workflow.indexOf('      - uses: actions/checkout@v4', guardStart);
  assert(guardStart > 0 && guardEnd > guardStart);
  const guard = workflow.slice(guardStart, guardEnd).split('\n').map(line => line.slice(12)).join('\n');
  const frozenHead = 'a'.repeat(40), branch = 'codex/dreamforge-offline-scroll-20261013';
  const contextBase = { eventName: 'workflow_dispatch', ref: 'refs/heads/' + branch, sha: frozenHead, repo: { owner: 'daxkensington', repo: 'dreamforge-ai' }, payload: { inputs: { diagnostic_mode: 'static-media-interception', expected_sha: frozenHead, base_url: 'https://dreamforgex.ai' }, repository: { id: 1188896913 } } };
  const repliesBase = { selected: { data: { commit: { sha: frozenHead } } }, commit: { data: { parents: [{ sha: BASE }] } }, associated: { data: [] }, comparison: { data: { total_commits: 1, files: source.expectedPaths.map(filename => ({ filename, status: ['.github/workflows/smoke.yml', 'vercel.json'].includes(filename) ? 'modified' : 'added' })) } } };
  const evaluate = async (context, replies) => {
    const github = { rest: { repos: { getBranch: async () => replies.selected, getCommit: async () => replies.commit, listPullRequestsAssociatedWithCommit: async () => replies.associated, compareCommitsWithBasehead: async () => replies.comparison } } };
    await vm.runInNewContext('(async()=>{' + guard + '})()', { context, github }, { timeout: 1000 });
  };
  await evaluate(jsonClone(contextBase), jsonClone(repliesBase));
  const guards = [
    c => c.eventName = 'deployment_status', c => c.ref = 'refs/heads/main', c => c.payload.repository.id = 1,
    c => c.payload.inputs.expected_sha = 'b'.repeat(40), c => c.payload.inputs.base_url = 'https://external.example', c => c.payload.inputs.diagnostic_mode = 'normal',
  ];
  for (const mutate of guards) { const context = jsonClone(contextBase); mutate(context); await assert.rejects(() => evaluate(context, jsonClone(repliesBase))); }
  for (const mutate of [r => r.selected.data.commit.sha = 'b'.repeat(40), r => r.commit.data.parents.push({ sha: BASE }), r => r.associated.data.push({ head: { repo: { full_name: 'fork/repo' } } }), r => r.comparison.data.files[0].filename = 'app/page.tsx', r => r.comparison.data.files[0].status = 'removed', r => r.comparison.data.files.pop(), r => r.comparison.data.files[1].filename = r.comparison.data.files[0].filename]) { const replies = jsonClone(repliesBase); mutate(replies); await assert.rejects(() => evaluate(jsonClone(contextBase), replies)); }
  groups.push('actual-GitHub-inline-guard/one-happy13-refusals');
  check('workflow-static-secret/normal58/capture-isolation', () => {
    const offline = workflow.slice(workflow.indexOf('  offline_static:'));
    assert(!/secrets\.|BASE_URL:|VERCEL_AUTOMATION_BYPASS_SECRET|check-smoke-target|test:smoke|playwright-report\//.test(offline));
    assert(offline.includes('test-results/static-media-interception/safe/RESULT.json'));
    assert(workflow.includes("github.ref != 'refs/heads/codex/dreamforge-offline-scroll-20261013'"));
    assert(workflow.includes("branches.data.some(b => b.name === 'codex/dreamforge-offline-scroll-20261013')"));
    assert(offline.includes('persist-credentials: false') && offline.includes('timeout-minutes: 25'));
  });
  console.log(JSON.stringify({ offlineGroupsPassed: groups.length, groups, protectedSourceBlobsPreserved: source.protectedSourceBlobsPreserved, noBrowserOrServerOrNetwork: true, sourceReleaseAccepted: false }));
} else throw new Error('Invalid offline validation mode');
