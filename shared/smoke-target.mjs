/** Only known DreamForge origins may receive deployment-test credentials. */
export function smokeTarget(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Smoke target must be an HTTPS origin without credentials, path, or query');
  }
  const publicTarget = ['dreamforgex.ai', 'www.dreamforgex.ai', 'genesis-synth-lab.vercel.app'].includes(url.hostname);
  const protectedTarget = /^dreamforgex-[a-z0-9-]+-englandsfinest\.vercel\.app$/.test(url.hostname);
  if (!publicTarget && !protectedTarget) throw new Error('Unrecognized DreamForge smoke origin');
  return { origin: url.origin, protectedTarget };
}

/** @returns {Record<string, string>} */
export function bypassHeaders(target, secret) {
  if (!target.protectedTarget) return {};
  if (!secret) throw new Error('Protected DreamForge target requires the existing automation bypass secret');
  return { 'x-vercel-protection-bypass': secret };
}

export function deployedRevision(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) ? value : null;
}

export function assertDeployedHealth(status, type, body, expected) {
  if (status !== 200 || !type?.includes('application/json') || body?.ok !== true) {
    throw new Error('Smoke target is not the healthy DreamForge app (deployment protection is not app acceptance)');
  }
  if (!deployedRevision(expected) || body.revision !== expected) {
    throw new Error('Smoke target deployed revision does not match the expected source');
  }
}

export function workflowSmokeTarget(eventName, event, githubSha) {
  const deploymentEvent = eventName === 'deployment_status';
  const production = deploymentEvent && event.deployment?.environment?.toLowerCase() === 'production';
  const input = deploymentEvent
    ? (production ? 'https://dreamforgex.ai' : event.deployment_status?.target_url)
    : (eventName === 'workflow_dispatch' ? event.inputs?.base_url || 'https://dreamforgex.ai' : 'https://dreamforgex.ai');
  const expected = deploymentEvent ? event.deployment?.sha : event.inputs?.expected_sha || githubSha;
  if (!deployedRevision(expected)) throw new Error('Expected deployment source must be an exact Git commit SHA');
  return { ...smokeTarget(input), expected };
}

const gated = new Set(['/profile', '/credits', '/api-keys', '/notifications', '/admin']);
export function consumesAuthBudget(pathname) {
  return pathname.startsWith('/api/auth') || gated.has(pathname);
}

// Headroom below the unchanged server limit (20 per IP / 60 seconds).
// Persistence across Playwright worker restarts keeps retries in the budget.
export function authBudgetDelay(starts, now, reserve = 1) {
  const active = starts.filter(t => t > now - 65_000);
  return { active, delay: active.length <= 15 - reserve ? 0 : Math.max(0, active[active.length - 15 + reserve - 1] + 65_001 - now) };
}
