export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

import { buildSignInUrl } from "@shared/returnTo";

/**
 * Sign-in URL, carrying where the user was headed so auth returns them there.
 *
 * Called with no argument it defaults to the page the user is standing on —
 * so every existing call site (navbar, tool pages, /uncensored) starts
 * preserving intent instead of dumping everyone in the generic studio.
 */
export const getLoginUrl = (returnTo?: string) => {
  if (returnTo !== undefined) return buildSignInUrl(returnTo);
  if (typeof window === "undefined") return buildSignInUrl(null);
  return buildSignInUrl(window.location.pathname + window.location.search);
};
