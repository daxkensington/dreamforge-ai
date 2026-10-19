import { describe, expect, it } from 'vitest';
import { assertHomepageCsp, classifyHomepageConsole, EXPECTED_HOMEPAGE_CSP } from '../tests/smoke/console-policy.mjs';

const preview = 'https://dreamforgex-example-englandsfinest.vercel.app';
const chromiumBlock = `Loading the script 'https://vercel.live/_next-live/feedback/feedback.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' https://connect.facebook.net". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.`;
const webkitBlock = 'Refused to load https://vercel.live/_next-live/feedback/feedback.js because it does not appear in the script-src directive of the Content Security Policy.';
const context = () => ({
  targetInput: preview,
  responseUrl: preview + '/',
  documentUrl: preview + '/',
  policy: { enforced: [EXPECTED_HOMEPAGE_CSP], reportOnly: [] as string[] },
});

describe('deployed homepage enforcing CSP invariant', () => {
  it('requires the complete audited enforcing policy independently of console output', () => {
    expect(() => assertHomepageCsp(context().policy)).not.toThrow();
    expect(classifyHomepageConsole([], context())).toEqual({ knownPreviewBlockages: [], errors: [] });
  });
  it.each([
    { enforced: [], reportOnly: [] },
    { enforced: [], reportOnly: [EXPECTED_HOMEPAGE_CSP] },
    { enforced: [EXPECTED_HOMEPAGE_CSP, EXPECTED_HOMEPAGE_CSP], reportOnly: [] },
    { enforced: [EXPECTED_HOMEPAGE_CSP + '; script-src-elem https://vercel.live'], reportOnly: [] },
    { enforced: [EXPECTED_HOMEPAGE_CSP.replace("script-src 'self'", "script-src https: 'self'")], reportOnly: [] },
    { enforced: [EXPECTED_HOMEPAGE_CSP.replace("frame-ancestors 'none'; ", '')], reportOnly: [] },
    { enforced: [EXPECTED_HOMEPAGE_CSP.replace("default-src 'self'", 'default-src *')], reportOnly: [] },
  ])('rejects absent, report-only, duplicate or changed enforcement %#', policy => {
    expect(() => assertHomepageCsp(policy)).toThrow(/enforcing/);
    expect(() => classifyHomepageConsole([chromiumBlock], { ...context(), policy })).toThrow(/enforcing/);
  });
});

describe('transparent known protected-preview CSP message classification', () => {
  it.each([chromiumBlock, webkitBlock])('classifies only the exact observed blocked-loader signature %#', message => {
    expect(classifyHomepageConsole([message], context())).toEqual({ knownPreviewBlockages: [message], errors: [] });
  });
  it('retains mixed application errors and every copy of the known message for reporting', () => {
    const applicationError = 'Hydration failed because the initial UI does not match what was rendered on the server';
    const result = classifyHomepageConsole([chromiumBlock, applicationError, webkitBlock, chromiumBlock], context());
    expect(result.knownPreviewBlockages).toEqual([chromiumBlock, webkitBlock, chromiumBlock]);
    expect(result.errors).toEqual([applicationError]);
  });
  it.each(['https://dreamforgex.ai', 'https://www.dreamforgex.ai', 'https://genesis-synth-lab.vercel.app'])('keeps public production strict on %s', targetInput => {
    const result = classifyHomepageConsole([chromiumBlock, webkitBlock], {
      ...context(), targetInput, responseUrl: targetInput + '/', documentUrl: targetInput + '/',
    });
    expect(result).toEqual({ knownPreviewBlockages: [], errors: [chromiumBlock, webkitBlock] });
  });
  it.each([
    'https://dreamforgex-other-englandsfinest.vercel.app/',
    'https://dreamforgex.ai/',
    'https://attacker.example/',
    preview + '/about',
    preview + '/?input=synthetic',
    preview + '/#fragment',
    preview + ':8443/',
    preview.replace('https://', 'http://') + '/',
    preview.replace('https://', 'https://user:pass@') + '/',
    'not-a-url',
  ])('does not classify after any response or document URL drift %s', url => {
    for (const key of ['responseUrl', 'documentUrl'] as const) {
      const result = classifyHomepageConsole([chromiumBlock], { ...context(), [key]: url });
      expect(result).toEqual({ knownPreviewBlockages: [], errors: [chromiumBlock] });
    }
  });
  it.each([
    'https://attacker.example', 'http://dreamforgex.ai',
    preview + '/path', preview + '?input=synthetic', preview + '#fragment',
    preview.replace('https://', 'https://user:pass@'),
  ])('rejects an unapproved or malformed target %s', targetInput => {
    expect(() => classifyHomepageConsole([chromiumBlock], { ...context(), targetInput })).toThrow();
  });
  it.each([
    chromiumBlock.replace('https://vercel.live/', 'https://attacker.example/'),
    chromiumBlock.replace('feedback.js', 'other.js'),
    chromiumBlock.replace('feedback.js', 'feedback.js?input=synthetic'),
    chromiumBlock.replace('feedback.js', 'feedback.js/'),
    chromiumBlock.replace('feedback.js', 'feedback.js#fragment'),
    chromiumBlock.replace('https://vercel.live/', 'https://vercel.live:8443/'),
    chromiumBlock.replace('https://vercel.live/', 'http://vercel.live/'),
    chromiumBlock.replace('https://vercel.live/', 'https://user:pass@vercel.live/'),
    chromiumBlock.replace('https://vercel.live/', 'https://vercel.live.attacker.example/'),
    chromiumBlock.replace("script-src 'self'", "script-src https: 'self'"),
    chromiumBlock.replace('has been blocked', 'has been allowed'),
    'Application console error: ' + chromiumBlock,
    webkitBlock + ' Additional application error.',
    webkitBlock + ' ',
    webkitBlock.replace('script-src directive', 'connect-src directive'),
    chromiumBlock + '\nTypeError: application handler failed',
    'Failed to load resource: https://vercel.live/_next-live/feedback/feedback.js',
    'TypeError: application exception',
    'Application favicon loader failed',
    'Application Sentry DSN configuration failed',
  ])('keeps near matches and application failures as errors %#', message => {
    expect(classifyHomepageConsole([message], context())).toEqual({ knownPreviewBlockages: [], errors: [message] });
  });
});
