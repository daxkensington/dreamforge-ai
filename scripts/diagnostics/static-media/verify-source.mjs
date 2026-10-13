import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BASE, BASE_TREE, BRANCH, ownPath, validateAssets } from './contract.mjs';
export const MODULES = ['contract.mjs', 'build.mjs', 'server.mjs', 'reporter.mjs', 'verify-source.mjs', 'run.mjs', 'validate.mjs'].map(n => 'scripts/diagnostics/static-media/' + n);
export const CORE_PATHS = ['.github/workflows/smoke.yml', 'vercel.json', 'playwright.offline-scroll.config.ts', 'tests/diagnostics/static-media-interception.spec.ts', ...MODULES];
export function expectedPaths(root) {
  const manifestFile = 'scripts/diagnostics/static-media/assets/manifest.json';
  const manifest = validateAssets(JSON.parse(fs.readFileSync(ownPath(root, manifestFile))));
  const assets = manifest.files.filter(row => row.kind === 'snapshot').map(row => {
    assert(/^_next\/static\/(?:css\/[a-f0-9]{16}\.css|media\/[a-f0-9]{16}-s(?:\.p)?\.woff2)$/.test(row.file));
    return 'scripts/diagnostics/static-media/assets/' + row.file;
  });
  assert.equal(assets.length, 15); assert.equal(new Set(assets).size, 15);
  return [...CORE_PATHS, manifestFile, ...assets].sort();
}
export function verifySource(root, runtime = false) {
  const git = (args, encoding = 'utf8') => execFileSync('git', args, { cwd: root, encoding, stdio: ['pipe', 'pipe', 'pipe'] });
  assert.equal(git(['rev-parse', BASE + '^{tree}']).trim(), BASE_TREE);
  const head = git(['rev-parse', 'HEAD']).trim();
  assert(/^[a-f0-9]{40}$/.test(head));
  if (head !== BASE) assert.equal(git(['rev-list', '--parents', '-n', '1', head]).trim(), head + ' ' + BASE);
  if (runtime) {
    assert(head !== BASE && process.platform === 'linux');
    assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_REPOSITORY, 'daxkensington/dreamforge-ai');
    assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch'); assert.equal(process.env.GITHUB_REF, 'refs/heads/' + BRANCH);
    assert.equal(process.env.STATIC_DIAGNOSTIC_REVISION, head);
    assert(!process.env.BASE_URL && !process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
    git(['diff', '--exit-code', '--quiet', 'HEAD', '--']);
    git(['diff', '--cached', '--exit-code', '--quiet', 'HEAD', '--']);
  }
  const expected = expectedPaths(root);
  const changed = [...new Set([...git(['diff', '--name-only', BASE]).trim().split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).trim().split('\n')].filter(Boolean))].sort();
  assert.deepEqual(changed, expected);
  if (runtime) for (const file of expected) {
    const raw = fs.readFileSync(ownPath(root, file));
    let normalized = raw;
    try { const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); assert.deepEqual(Buffer.from(text), raw); if (!raw.includes(0)) normalized = Buffer.from(text.replaceAll('\r\n', '\n')); } catch {}
    const oid = crypto.createHash('sha1').update(Buffer.from('blob ' + normalized.length + '\0')).update(normalized).digest('hex');
    assert.equal(oid, git(['rev-parse', head + ':' + file]).trim(), 'Runtime diagnostic source differs from exact HEAD');
  }
  const entries = git(['ls-tree', '-r', BASE]).trim().split('\n').map(line => { const [meta, file] = line.split('\t'); const [mode, type, oid] = meta.split(' '); assert(type === 'blob' && ['100644', '100755'].includes(mode)); return { file, oid }; });
  const attrs = execFileSync('git', ['check-attr', '--all', '--stdin'], { cwd: root, encoding: 'utf8', input: entries.map(row => row.file).join('\n') + '\n', stdio: ['pipe', 'pipe', 'pipe'] });
  assert.equal(attrs, '');
  let preserved = 0;
  for (const row of entries) {
    if (['.github/workflows/smoke.yml', 'vercel.json'].includes(row.file)) continue;
    // The sole public tracked template is hashed only; real .env files stay refused.
    const raw = fs.readFileSync(ownPath(root, row.file, row.file === '.env.example'));
    let content = raw;
    try { const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); assert.deepEqual(Buffer.from(text), raw); if (!raw.includes(0)) content = Buffer.from(text.replaceAll('\r\n', '\n')); } catch {}
    const oid = crypto.createHash('sha1').update(Buffer.from('blob ' + content.length + '\0')).update(content).digest('hex');
    assert.equal(oid, row.oid, 'Protected source differs'); preserved++;
  }
  const originalVercel = JSON.parse(git(['show', BASE + ':vercel.json']));
  const currentVercel = JSON.parse(fs.readFileSync(ownPath(root, 'vercel.json')));
  assert.deepEqual(currentVercel.git, { deploymentEnabled: { [BRANCH]: false } });
  delete currentVercel.git; assert.deepEqual(currentVercel, originalVercel);
  return { head, base: BASE, tree: git(['rev-parse', 'HEAD^{tree}']).trim(), expectedPaths: expected, baselineTracked: entries.length, protectedSourceBlobsPreserved: preserved, packageLockNormal58AuthProviderSourceUnchanged: true, diagnosticBranchOnlyAutoDeploymentDisabledInSource: true, noActualDeploymentInference: true };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifySource(process.cwd())));
