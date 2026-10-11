import { smokeTarget, bypassHeaders, assertDeployedHealth } from '../shared/smoke-target.mjs';

const target = smokeTarget(process.env.BASE_URL || 'https://dreamforgex.ai');
const response = await fetch(target.origin + '/api/health', {
  headers: bypassHeaders(target, process.env.VERCEL_AUTOMATION_BYPASS_SECRET),
  redirect: 'manual',
  signal: AbortSignal.timeout(30_000),
});
let body;
try { body = await response.json(); } catch { body = null; }
assertDeployedHealth(response.status, response.headers.get('content-type'), body, process.env.EXPECTED_DEPLOYMENT_SHA);
console.log(`Verified healthy DreamForge source ${body.revision} at ${target.origin}`);
