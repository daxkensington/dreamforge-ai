import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { smokeTarget, bypassHeaders, deployedRevision, assertDeployedHealth, workflowSmokeTarget, consumesAuthBudget, authBudgetDelay } from '../shared/smoke-target.mjs';

const sha = 'a'.repeat(40);
const preview = 'https://dreamforgex-example-englandsfinest.vercel.app';
describe('deployed smoke target safety', () => {
  it.each(['http://dreamforgex.ai', 'https://attacker.example', 'https://user:password@dreamforgex.ai', 'https://dreamforgex.ai/path', 'https://dreamforgex.ai?token=x', 'https://dreamforgex.ai#fragment', 'https://dreamforgex.ai:8443'])('refuses unsafe origin %s', url => {
    expect(() => smokeTarget(url)).toThrow();
  });
  it('never sends a bypass credential to public production', () => {
    expect(bypassHeaders(smokeTarget('https://dreamforgex.ai'), 'synthetic')).toEqual({});
  });
  it('requires supported existing auth for the recognized protected origin', () => {
    const target = smokeTarget(preview);
    expect(() => bypassHeaders(target, undefined)).toThrow(/existing/);
    expect(bypassHeaders(target, 'synthetic')).toEqual({ 'x-vercel-protection-bypass': 'synthetic' });
  });
  it('rejects Vercel login, unhealthy apps, and stale source instead of false acceptance', () => {
    expect(() => assertDeployedHealth(200, 'text/html', '<h1>Login</h1>', sha)).toThrow();
    expect(() => assertDeployedHealth(503, 'application/json', {ok:false,revision:sha}, sha)).toThrow();
    expect(() => assertDeployedHealth(200, 'application/json', {ok:true,revision:'b'.repeat(40)}, sha)).toThrow(/revision/);
    expect(() => assertDeployedHealth(200, 'application/json', {ok:true,revision:sha}, sha)).not.toThrow();
  });
  it('uses exact preview URL but canonical public production and an exact source pin', () => {
    const event = { deployment: { environment:'Preview',sha }, deployment_status:{target_url:preview} };
    expect(workflowSmokeTarget('deployment_status',event,'b'.repeat(40))).toEqual({origin:preview,protectedTarget:true,expected:sha,authOrigin:preview});
    expect(workflowSmokeTarget('deployment_status',{...event,deployment:{environment:'Production',sha}},'b'.repeat(40))).toEqual({origin:'https://dreamforgex.ai',protectedTarget:false,expected:sha,authOrigin:'https://dreamforgex.ai'});
    expect(() => workflowSmokeTarget('schedule',{},'main')).toThrow(/exact/);
  });
  it('allows explicit dispatch replay source but does not interpolate URL input into shell', () => {
    expect(workflowSmokeTarget('workflow_dispatch',{inputs:{base_url:preview,expected_sha:sha}},'b'.repeat(40)).expected).toBe(sha);
    expect(workflowSmokeTarget('workflow_dispatch',{inputs:{base_url:preview,expected_sha:sha}},'b'.repeat(40)).authOrigin).toBe(preview);
    expect(() => workflowSmokeTarget('workflow_dispatch',{inputs:{base_url:'https://dreamforgex.ai/$(command)'}},sha)).toThrow();
  });
});

describe('real authentication request pacing', () => {
  it('counts both protected navigations and actual AuthJS requests, excluding static and health reads', () => {
    for(const path of ['/profile','/credits','/api-keys','/notifications','/admin','/api/auth/session','/api/auth/providers']) expect(consumesAuthBudget(path)).toBe(true);
    for(const path of ['/','/api/health','/_next/static/chunk.js','/tools/upscaler']) expect(consumesAuthBudget(path)).toBe(false);
  });
  it('retains prior-worker timestamps and waits below the unchanged 20/60 server limit', () => {
    const now=100_000;
    const starts=Array.from({length:15},(_,i)=>now-1000+i);
    expect(authBudgetDelay(starts,now).delay).toBe(64_001);
    expect(authBudgetDelay(starts,now+65_001)).toEqual({active:[],delay:0});
    expect(authBudgetDelay(starts.slice(0,14),now).delay).toBe(0);
    expect(authBudgetDelay(starts,now,6).delay).toBe(64_006);
  });
});

vi.mock('./db', () => ({ getDb: vi.fn(async () => ({ execute: vi.fn(async () => []) })) }));
describe('actual health handler revision metadata', () => {
  beforeEach(() => { vi.stubEnv('DATABASE_URL','synthetic-not-a-connection'); vi.stubEnv('JWT_SECRET','synthetic'); });
  afterEach(() => vi.unstubAllEnvs());
  it('retains real health fields and publishes only valid non-secret source metadata', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA',sha);
    const { GET }=await import('../app/api/health/route');
    const response=await GET(); const body=await response.json();
    expect(response.status).toBe(200); expect(body.ok).toBe(true); expect(body.revision).toBe(sha);
    expect(body.checks.map((c:{name:string;ok:boolean})=>[c.name,c.ok])).toEqual([['db',true],['env',true]]);
    expect(typeof body.totalMs).toBe('number'); expect(typeof body.uptimeSec).toBe('number');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('never exposes invalid metadata or changes unhealthy status semantics', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA','synthetic-secret-not-a-sha'); vi.stubEnv('JWT_SECRET','');
    const { GET }=await import('../app/api/health/route');
    const response=await GET(); const body=await response.json();
    expect(response.status).toBe(503); expect(body.ok).toBe(false); expect(body.revision).toBeNull();
    expect(JSON.stringify(body)).not.toContain('synthetic-secret');
    expect(deployedRevision(undefined)).toBeNull();
  });
});
