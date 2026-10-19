import { smokeTarget } from '../../shared/smoke-target.mjs';

// Independently pin the deployed policy audited at cffeb875. Importing the
// runtime configuration would let a policy change silently update this check.
export const EXPECTED_HOMEPAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https: blob:",
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://www.facebook.com https://graph.facebook.com",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const PREVIEW_PLATFORM_LOADER = 'https://vercel.live/_next-live/feedback/feedback.js';

// Full observed browser messages, deliberately fail-closed if wording or URL
// changes. A match identifies this known blocked-loader signature, not proof
// of which actor inserted a script. No other vercel.live errors are classified.
const knownPreviewMessages = new Set([
  `Loading the script '${PREVIEW_PLATFORM_LOADER}' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' https://connect.facebook.net". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.`,
  `Refused to load ${PREVIEW_PLATFORM_LOADER} because it does not appear in the script-src directive of the Content Security Policy.`,
]);

/** @typedef {{ enforced: string[], reportOnly: string[] }} HomepageCsp */

/** @param {HomepageCsp} policy */
export function assertHomepageCsp(policy) {
  if (policy.enforced.length !== 1 || policy.enforced[0] !== EXPECTED_HOMEPAGE_CSP) {
    throw new Error('Homepage must retain exactly the audited enforcing Content-Security-Policy header');
  }
}

/**
 * @param {string[]} messages
 * @param {{ targetInput: string, responseUrl: string, documentUrl: string, policy: HomepageCsp }} context
 */
export function classifyHomepageConsole(messages, context) {
  assertHomepageCsp(context.policy);
  const target = smokeTarget(context.targetInput);
  const exactPreview = target.protectedTarget
    && context.responseUrl === target.origin + '/'
    && context.documentUrl === target.origin + '/';
  return {
    knownPreviewBlockages: messages.filter(message => exactPreview && knownPreviewMessages.has(message)),
    errors: messages.filter(message => !exactPreview || !knownPreviewMessages.has(message)),
  };
}
