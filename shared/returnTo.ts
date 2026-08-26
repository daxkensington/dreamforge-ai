/**
 * Post-sign-in return paths ("where was the user headed before we asked them
 * to log in?").
 *
 * Every sign-in entry point used to hard-code `/workspace?welcome=true`, so a
 * visitor who landed on an intent page — /uncensored above all — authenticated
 * and got dropped into the generic studio with their intent discarded. They had
 * to rediscover the page they started on; most didn't.
 *
 * The `next` param carries that intent through the OAuth round-trip. It comes
 * off a URL the user controls, so it is sanitised on BOTH ends: only a
 * same-origin absolute path is ever handed to NextAuth's callbackUrl.
 */

/** Where a signed-in user lands when we have no better idea. */
export const DEFAULT_POST_LOGIN = "/workspace?welcome=true";

/** Query param carrying the intended destination into /auth/signin. */
export const RETURN_TO_PARAM = "next";

/**
 * Reduce an untrusted `next` value to a safe same-origin path, or null.
 *
 * Rejects anything that could leave the origin — absolute URLs, scheme-relative
 * `//evil.com`, backslash variants that some browsers normalise to `/`, and
 * control characters that can smuggle a scheme past a naive prefix test.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value) return null;

  // Must be a rooted path. Nothing else can be trusted.
  if (!value.startsWith("/")) return null;

  // `//host` and `/\host` are scheme-relative — they leave the origin.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  // Control chars (incl. the tab/newline browsers strip before parsing) can be
  // used to hide a scheme; a real path never contains them.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }

  // Defence in depth: if it still parses as an absolute URL, it isn't a path.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  return value;
}

/**
 * Build the sign-in URL, carrying `returnTo` when it is a safe same-origin path.
 */
export function buildSignInUrl(returnTo?: string | null): string {
  const safe = sanitizeReturnTo(returnTo);
  return safe ? `/auth/signin?${RETURN_TO_PARAM}=${encodeURIComponent(safe)}` : "/auth/signin";
}

/** Resolve the callbackUrl to hand NextAuth, falling back to the studio. */
export function resolvePostLogin(raw: string | null | undefined): string {
  return sanitizeReturnTo(raw) ?? DEFAULT_POST_LOGIN;
}
