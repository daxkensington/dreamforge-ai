import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { OUTPUT, ownPath, validateResult } from './contract.mjs';
import { verifySource } from './verify-source.mjs';
import { startServers } from './server.mjs';
const root = process.cwd();
const proof = verifySource(root, true);
assert.equal(process.argv.length, 2);
const directory = ownPath(root, OUTPUT);
assert(!fs.existsSync(ownPath(directory, 'RUNTIME.json')) && !fs.existsSync(ownPath(directory, 'safe')) && !fs.existsSync(ownPath(directory, 'partials')));
fs.mkdirSync(ownPath(directory, 'safe')); fs.mkdirSync(ownPath(directory, 'partials'));
let servers, child, killTimer, timer, runtimeCreated = false, code = 1;
try {
  servers = await startServers(root);
  fs.writeFileSync(ownPath(directory, 'RUNTIME.json'), JSON.stringify({ present: servers.present, absent: servers.absent }) + '\n', { flag: 'wx' });
  runtimeCreated = true;
  const require = createRequire(path.join(root, 'package.json'));
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'TZ', 'XDG_RUNTIME_DIR', 'XDG_CACHE_HOME', 'DISPLAY', 'WAYLAND_DISPLAY', 'PLAYWRIGHT_BROWSERS_PATH', 'CI', 'GITHUB_RUN_ID'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
  env.NODE_ENV = 'production';
  console.log(JSON.stringify({ kind: 'STATIC_DIAGNOSTIC_SOURCE_AND_LOCAL_TARGET_GUARD', revision: proof.head, base: proof.base, onlyLoopbackTargets: true, testCount: 8, retries: 0 }));
  child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config', 'playwright.offline-scroll.config.ts'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  // Drain output without saving/forwarding browser errors, logs or headers.
  child.stdout.resume(); child.stderr.resume();
  const stop = () => { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 5000); } };
  timer = setTimeout(stop, 20 * 60 * 1000);
  code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', value => resolve(value ?? 1)); });
  const resultFile = ownPath(directory, 'safe/RESULT.json');
  assert(fs.existsSync(resultFile) && fs.statSync(resultFile).size < 50000);
  const result = validateResult(JSON.parse(fs.readFileSync(resultFile)));
  assert.equal(result.workflowRunId, Number(process.env.GITHUB_RUN_ID));
  console.log(JSON.stringify({ diagnosticSafeResultValidated: true, cases: result.cases.length, completeObservation: result.completeEightCaseObservation, passed: result.cases.filter(row => row.status === 'passed').length, sourceReleaseAccepted: false }));
  if (!result.completeEightCaseObservation) code = 1;
} catch { console.log(JSON.stringify({ diagnosticSafeResultValidated: false, sourceReleaseAccepted: false })); code = 1; }
finally {
  clearTimeout(timer); clearTimeout(killTimer); if (servers) await servers.close();
  // Captures are normal during the cases, but only safe/RESULT may survive.
  for (const name of ['captures', 'partials']) { const target = ownPath(directory, name); if (fs.existsSync(target)) { assert(fs.realpathSync(target).startsWith(fs.realpathSync(directory) + path.sep)); fs.rmSync(target, { recursive: true }); } }
  if (runtimeCreated) fs.unlinkSync(ownPath(directory, 'RUNTIME.json'));
}
// Source must remain byte-identical throughout the job.
try { assert.equal(verifySource(root, true).head, proof.head); } catch { code = 1; }
process.exitCode = Number(code) === 0 ? 0 : 1;
