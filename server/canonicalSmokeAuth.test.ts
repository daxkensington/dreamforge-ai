import { describe, expect, it } from 'vitest';
import { assertCanonicalSignIn, assertSmokeSignIn } from '../shared/smoke-target.mjs';
import { CANONICAL_AUTH_PATHS, checkCanonicalAuth, gitBlobId } from '../scripts/check-canonical-auth.mjs';

const revision = 'a'.repeat(40), treeSha = 'b'.repeat(40);
const bytes = Buffer.from('unchanged auth source\n');
function transport(change: (value: any, call: number) => any = value => value) {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  const fetcher = async (url: string, options: RequestInit) => {
    calls.push({ url, options });
    const value = url.includes('/git/commits/') ? { sha: revision, tree: { sha: treeSha } }
      : url.includes('/git/trees/') ? { sha: treeSha, truncated: false, tree: CANONICAL_AUTH_PATHS.map(path => ({ path, type: 'blob', mode: '100644', sha: gitBlobId(bytes) })) }
      : { ref: 'refs/heads/main', object: { type: 'commit', sha: revision } };
    return new Response(JSON.stringify(change(value, calls.length)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetcher, readSource: async () => bytes };
}

describe('actual canonical sign-in URL contract', () => {
  it.each(['/profile', '/credits', '/api-keys', '/notifications', '/admin'])('requires the exact original canonical callback for %s', path => {
    const url = 'https://dreamforgex.ai/auth/signin?callbackUrl=' + encodeURIComponent('https://dreamforgex.ai' + path);
    expect(() => assertCanonicalSignIn(url, path)).not.toThrow();
  });
  it.each([
    ['https://attacker.example/auth/signin?callbackUrl=https://dreamforgex.ai/profile', '/profile'],
    ['https://dreamforgex.ai.attacker.example/auth/signin?callbackUrl=https://dreamforgex.ai/profile', '/profile'],
    ['https://user:pass@dreamforgex.ai/auth/signin?callbackUrl=https://dreamforgex.ai/profile', '/profile'],
    ['https://dreamforgex.ai:8443/auth/signin?callbackUrl=https://dreamforgex.ai/profile', '/profile'],
    ['https://dreamforgex.ai/auth/signin?callbackUrl=https://attacker.example/profile', '/profile'],
    ['https://dreamforgex.ai/auth/signin?callbackUrl=https://dreamforgex.ai/admin', '/profile'],
    ['https://dreamforgex.ai/auth/signin?callbackUrl=https://dreamforgex.ai/profile%3Finput%3Dsynthetic', '/profile'],
    ['https://dreamforgex.ai/auth/signin?callbackUrl=https://dreamforgex.ai/profile&callbackUrl=https://dreamforgex.ai/profile', '/profile'],
    ['https://dreamforgex.ai/auth/signin?callbackUrl=https://dreamforgex.ai/profile&token=synthetic', '/profile'],
    ['https://dreamforgex.ai/auth/signin?callbackUrl=https://dreamforgex.ai/profile#fragment', '/profile'],
    ['https://dreamforgex.ai/not-signin?callbackUrl=https://dreamforgex.ai/profile', '/profile'],
    ['https://dreamforgex.ai/auth/signin', '/profile'],
    ['https://dreamforgex.ai/auth/signin?callbackUrl=https://dreamforgex.ai/other', '/other'],
  ])('refuses recipient, callback, or path drift %s', (url, path) => {
    expect(() => assertCanonicalSignIn(url, path)).toThrow();
  });
});

describe('exact deployed sign-in URL contract', () => {
  const preview = 'https://dreamforgex-example-englandsfinest.vercel.app';
  const otherPreview = 'https://dreamforgex-other-englandsfinest.vercel.app';
  const signIn = (origin: string, callback: string) => origin + '/auth/signin?callbackUrl=' + encodeURIComponent(callback);

  it.each(['/profile', '/credits', '/api-keys', '/notifications', '/admin'])('binds preview sign-in and callback to the exact target for %s', path => {
    expect(() => assertSmokeSignIn(signIn(preview, preview + path), path, preview)).not.toThrow();
  });
  it('retains strict canonical production checks, including public aliases', () => {
    for (const target of ['https://dreamforgex.ai', 'https://www.dreamforgex.ai', 'https://genesis-synth-lab.vercel.app']) {
      expect(() => assertSmokeSignIn(signIn('https://dreamforgex.ai', 'https://dreamforgex.ai/profile'), '/profile', target)).not.toThrow();
      expect(() => assertSmokeSignIn(signIn(preview, preview + '/profile'), '/profile', target)).toThrow();
    }
    expect(() => assertCanonicalSignIn(signIn(preview, preview + '/profile'), '/profile')).toThrow();
  });
  it.each([
    [otherPreview, preview + '/profile'],
    [preview, otherPreview + '/profile'],
    ['https://dreamforgex.ai', 'https://dreamforgex.ai/profile'],
    ['https://attacker.example', preview + '/profile'],
    [preview, 'https://attacker.example/profile'],
    [preview.replace('https://', 'https://user:pass@'), preview + '/profile'],
    [preview, preview.replace('https://', 'https://user:pass@') + '/profile'],
    [preview, preview + '/admin'],
    [preview, preview + '/profile?input=synthetic'],
    [preview, preview + '/profile#fragment'],
  ])('rejects foreign origins, userinfo and callback drift %s %s', (origin, callback) => {
    expect(() => assertSmokeSignIn(signIn(origin, callback), '/profile', preview)).toThrow();
  });
  it.each(['#fragment', '&extra=synthetic', '&callbackUrl=duplicate'])('rejects sign-in fragment or extra queries %s', suffix => {
    expect(() => assertSmokeSignIn(signIn(preview, preview + '/profile') + suffix, '/profile', preview)).toThrow();
  });
  it('rejects unapproved targets and non-gated paths', () => {
    expect(() => assertSmokeSignIn(signIn(preview, preview + '/profile'), '/profile', 'https://attacker.example')).toThrow();
    expect(() => assertSmokeSignIn(signIn(preview, preview + '/other'), '/other', preview)).toThrow();
  });
});

describe('actual public canonical auth source preflight', () => {
  it('pins immutable main/tree and all four auth files using only fixed-origin unauthenticated GETs', async () => {
    const t = transport();
    const result = await checkCanonicalAuth(t);
    expect(result.canonicalMainRevision).toBe(revision);
    expect(result.pins.map(row => row.path)).toEqual(CANONICAL_AUTH_PATHS);
    expect(t.calls).toHaveLength(4);
    for (const call of t.calls) {
      expect(new URL(call.url).origin).toBe('https://api.github.com');
      expect(new URL(call.url).pathname).toMatch(/^\/repos\/daxkensington\/dreamforge-ai\/git\//);
      expect(call.options.method).toBe('GET'); expect(call.options.redirect).toBe('manual');
      expect(call.options.body).toBeUndefined(); expect(Object.keys(call.options.headers!)).not.toContain('Authorization');
    }
  });
  it('accepts only Git-equivalent Windows newline normalization', async () => {
    expect((await checkCanonicalAuth({ ...transport(), readSource: async () => Buffer.from('unchanged auth source\r\n') })).canonicalMainAuthSourceMatchesCandidate).toBe(true);
    await expect(checkCanonicalAuth({ ...transport(), readSource: async () => Buffer.from('changed auth source\n') })).rejects.toThrow(/differs/);
  });
  it('rejects missing, duplicate, truncated, symlink, foreign or malformed immutable metadata', async () => {
    const modifications = [
      (value: any) => ({ ...value, truncated: true }),
      (value: any) => ({ ...value, tree: value.tree.slice(1) }),
      (value: any) => ({ ...value, tree: [...value.tree, value.tree[0]] }),
      (value: any) => ({ ...value, tree: value.tree.map((row: any) => ({ ...row, mode: '120000' })) }),
      (value: any) => ({ ...value, sha: 'c'.repeat(40) }),
    ];
    for (const change of modifications) await expect(checkCanonicalAuth(transport((value, call) => call === 3 ? change(value) : value))).rejects.toThrow();
    await expect(checkCanonicalAuth(transport((value, call) => call === 1 ? { ...value, object: { type: 'tag', sha: revision } } : value))).rejects.toThrow();
  });
  it('refuses concurrent main drift, redirects, non-JSON and failed public reads', async () => {
    await expect(checkCanonicalAuth(transport((value, call) => call === 4 ? { ...value, object: { type: 'commit', sha: 'c'.repeat(40) } } : value))).rejects.toThrow(/changed/);
    for (const response of [new Response('', {status:302}), new Response('{}',{status:403}), new Response('<html>',{status:200,headers:{'content-type':'text/html'}}), new Response('{',{status:200,headers:{'content-type':'application/json'}})]) {
      await expect(checkCanonicalAuth({ ...transport(), fetcher: async () => response })).rejects.toThrow();
    }
  });
});
