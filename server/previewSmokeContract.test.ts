import { describe, expect, it } from 'vitest';
import { assertCanonicalSignIn, assertSmokeSignIn, previewToolbarHeaders, smokeTarget } from '../shared/smoke-target.mjs';

const origin = 'https://dreamforgex-example-englandsfinest.vercel.app';
const target = smokeTarget(origin);
const signin = (base: string, callback = base + '/profile') => base + '/auth/signin?callbackUrl=' + encodeURIComponent(callback);

describe('explicit exact-origin preview sign-in contract', () => {
  it('reproduces the old canonical-only failure for an otherwise valid preview callback', () => {
    expect(() => assertCanonicalSignIn(signin(origin), '/profile')).toThrow();
    expect(() => assertSmokeSignIn(signin(origin), '/profile', target, origin)).not.toThrow();
  });
  it.each(['/profile', '/credits', '/api-keys', '/notifications', '/admin'])('retains the exact preview callback for %s', path => {
    expect(() => assertSmokeSignIn(signin(origin, origin + path), path, target, origin)).not.toThrow();
  });
  it.each([
    signin('https://dreamforgex-other-englandsfinest.vercel.app'),
    signin('https://dreamforgex-example-englandsfinest.vercel.app.attacker.example'),
    signin('https://user:pass@dreamforgex-example-englandsfinest.vercel.app'),
    signin(origin + ':8443'),
    signin(origin, 'https://dreamforgex.ai/profile'),
    signin(origin, origin + '/admin'),
    signin(origin, origin + '/profile?input=synthetic'),
    signin(origin, origin + '/profile#fragment'),
    signin(origin) + '&callbackUrl=' + encodeURIComponent(origin + '/profile'),
    signin(origin) + '&token=synthetic',
    signin(origin) + '#fragment',
    signin(origin).replace('/auth/signin?', '/not-signin?'),
    origin + '/auth/signin',
  ])('rejects preview recipient, path or callback drift %s', url => {
    expect(() => assertSmokeSignIn(url, '/profile', target, origin)).toThrow();
  });
  it('requires an explicitly matched preview contract and defaults to canonical staging', () => {
    expect(() => assertSmokeSignIn(signin(origin), '/profile', target)).toThrow();
    expect(() => assertSmokeSignIn(signin(origin), '/profile', target, 'https://dreamforgex-other-englandsfinest.vercel.app')).toThrow();
    expect(() => assertSmokeSignIn(signin(origin), '/profile', smokeTarget('https://dreamforgex.ai'), origin)).toThrow();
    expect(() => assertSmokeSignIn(signin(origin, origin + '/other'), '/other', target, origin)).toThrow();
    expect(() => assertSmokeSignIn(signin('https://dreamforgex.ai'), '/profile', target)).not.toThrow();
  });
});

describe('documented Vercel toolbar E2E header scope', () => {
  it('attaches only the non-secret skip-toolbar header to exact preview-origin requests', () => {
    expect(previewToolbarHeaders(target, origin + '/')).toEqual({ 'x-vercel-skip-toolbar': '1' });
    expect(previewToolbarHeaders(target, origin + '/_next/static/chunk.js')).toEqual({ 'x-vercel-skip-toolbar': '1' });
  });
  it.each([
    'https://dreamforgex.ai/',
    'https://dreamforgex-other-englandsfinest.vercel.app/',
    'https://dreamforgex-example-englandsfinest.vercel.app.attacker.example/',
    'https://vercel.live/_next-live/feedback/feedback.js',
    'https://accounts.google.com/',
  ])('never attaches the header to another origin %s', url => {
    expect(previewToolbarHeaders(target, url)).toEqual({});
  });
  it('does not change public production requests', () => {
    expect(previewToolbarHeaders(smokeTarget('https://dreamforgex.ai'), 'https://dreamforgex.ai/')).toEqual({});
  });
});
