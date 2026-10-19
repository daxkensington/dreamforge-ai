import { describe, expect, it } from 'vitest';
import { assertCanonicalSignIn, assertSmokeSignIn } from '../shared/smoke-target.mjs';

const origin = 'https://dreamforgex-example-englandsfinest.vercel.app';
const signin = (base: string, callback = base + '/profile') => base + '/auth/signin?callbackUrl=' + encodeURIComponent(callback);

describe('explicit exact-origin preview sign-in contract', () => {
  it('reproduces the old canonical-only failure for an otherwise valid preview callback', () => {
    expect(() => assertCanonicalSignIn(signin(origin), '/profile')).toThrow();
    expect(() => assertSmokeSignIn(signin(origin), '/profile', origin, origin)).not.toThrow();
  });
  it.each(['/profile', '/credits', '/api-keys', '/notifications', '/admin'])('retains the exact preview callback for %s', path => {
    expect(() => assertSmokeSignIn(signin(origin, origin + path), path, origin, origin)).not.toThrow();
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
    expect(() => assertSmokeSignIn(url, '/profile', origin, origin)).toThrow();
  });
  it('derives the exact target contract and rejects any explicit expectation drift', () => {
    expect(() => assertSmokeSignIn(signin(origin), '/profile', origin)).not.toThrow();
    expect(() => assertSmokeSignIn(signin(origin), '/profile', origin, 'https://dreamforgex.ai')).toThrow();
    expect(() => assertSmokeSignIn(signin(origin), '/profile', origin, 'https://dreamforgex-other-englandsfinest.vercel.app')).toThrow();
    expect(() => assertSmokeSignIn(signin(origin), '/profile', 'https://dreamforgex.ai', origin)).toThrow();
    expect(() => assertSmokeSignIn(signin(origin, origin + '/other'), '/other', origin, origin)).toThrow();
    expect(() => assertSmokeSignIn(signin('https://dreamforgex.ai'), '/profile', 'https://dreamforgex.ai', 'https://dreamforgex.ai')).not.toThrow();
  });
});
