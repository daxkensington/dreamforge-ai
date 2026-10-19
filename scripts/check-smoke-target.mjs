import { smokeTarget, bypassHeaders, assertDeployedHealth, smokeAuthContract } from '../shared/smoke-target.mjs';
import { checkCanonicalAuth } from './check-canonical-auth.mjs';

const target = smokeTarget(process.env.BASE_URL || 'https://dreamforgex.ai');
const contract = smokeAuthContract(target.origin, process.env.EXPECTED_AUTH_ORIGIN);
const response = await fetch(target.origin + '/api/health', {
  headers: bypassHeaders(target, process.env.VERCEL_AUTOMATION_BYPASS_SECRET),
  redirect: 'manual',
  signal: AbortSignal.timeout(30_000),
});
let body;
try { body = await response.json(); } catch { body = null; }
assertDeployedHealth(response.status, response.headers.get('content-type'), body, process.env.EXPECTED_DEPLOYMENT_SHA);
if (target.protectedTarget) console.log(JSON.stringify(await checkCanonicalAuth({ target, authOrigin: contract.origin })));
console.log(`Verified healthy DreamForge source ${body.revision} at ${target.origin}`);
