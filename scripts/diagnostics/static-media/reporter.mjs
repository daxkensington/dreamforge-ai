import fs from 'node:fs';
import { CASES, caseName, OUTPUT, ownPath, classifyError, missingSnapshot, validateSnapshot, validateResult } from './contract.mjs';
export default class SafeReporter {
  rows = new Map(); globalErrors = 0;
  onBegin(_config, suite) { const tests = suite.allTests(); if (tests.length !== 8 || tests.some((test, index) => !test.titlePath().includes(caseName(CASES[index])) || test.expectedStatus !== 'passed')) throw new Error('Diagnostic exact8 inventory mismatch'); }
  onError() { this.globalErrors++; }
  onStdOut() {} onStdErr() {} // Raw test/browser output is never persisted or forwarded.
  onTestEnd(test, result) {
    const cell = CASES.find(c => test.titlePath().includes(caseName(c)));
    if (!cell || this.rows.has(cell.sequence) || result.retry !== 0) throw new Error('Unexpected diagnostic retry/case');
    let snapshot = missingSnapshot(cell.sequence);
    const file = ownPath(process.cwd(), OUTPUT + `/partials/case-${cell.sequence}.json`);
    if (fs.existsSync(file)) snapshot = validateSnapshot(JSON.parse(fs.readFileSync(file)));
    const proof = JSON.parse(fs.readFileSync(ownPath(process.cwd(), OUTPUT + '/BUILD-PROOF.json')));
    this.rows.set(cell.sequence, { ...cell, status: ['passed', 'failed', 'timedOut', 'interrupted'].includes(result.status) ? result.status : 'unobserved', elapsedMs: result.duration, ...classifyError(result.errors, proof.callbackCallsites), snapshot });
  }
  onEnd() {
    const cases = CASES.map(cell => this.rows.get(cell.sequence) || { ...cell, status: 'unobserved', elapsedMs: null, ...classifyError([]), snapshot: missingSnapshot(cell.sequence) });
    const result = { kind: 'STATIC_MEDIA_INTERCEPTION_DIAGNOSTIC', schemaVersion: 1, workflowRunId: Number(process.env.GITHUB_RUN_ID), full58Acceptance: false, sourceReleaseAccepted: false, rawBrowserArtifactsUploaded: false, globalErrors: this.globalErrors, completeEightCaseObservation: this.globalErrors === 0 && cases.every(r => r.status !== 'unobserved' && r.snapshot.availability.eventObserverAttached && r.snapshot.availability.mediaObserverAttached && r.snapshot.availability.beforeTeardownSnapshotAvailable && r.snapshot.availability.nativeTestPhaseEnded && r.snapshot.foreignRequestsBeforeTeardown === 0), cases };
    validateResult(result);
    fs.writeFileSync(ownPath(process.cwd(), OUTPUT + '/safe/RESULT.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
}
