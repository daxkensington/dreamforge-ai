/**
 * Routing adult requests into the metered uncensored funnel.
 *
 * The standard generation chain can reach a self-hosted model with no safety
 * checker, so explicit prompts typed into the ordinary Workspace were quietly
 * generating on the free path: of 43 adult generations by 21 users, 29 ran
 * outside the metered funnel and only one of those users ever bought a pass.
 * The paid tier was competing with itself being given away.
 *
 * Rather than refuse them (which throws away demand that demonstrably
 * converts), those prompts are steered to /uncensored — three free previews,
 * then the pass. The user keeps a taste; the tier keeps a reason to exist.
 *
 * The message is a shared constant so the client can recognise it and redirect,
 * while still being something a human can read if any caller shows it raw.
 */

/** Thrown by the server and matched by the client to trigger the redirect. */
export const ADULT_REDIRECT_MESSAGE =
  "Adult content runs on our uncensored models — continue on the Uncensored page to generate it.";

/**
 * Where to send someone whose prompt needs the uncensored funnel.
 *
 * Carries the prompt so they don't retype it, and `start=1` so the page opens
 * on the free-preview card (see shared/returnTo.ts) rather than the marketing
 * copy at the top.
 */
export function buildAdultRedirectUrl(prompt?: string | null): string {
  const params = new URLSearchParams({ start: "1" });
  const trimmed = (prompt ?? "").trim();
  if (trimmed) params.set("prompt", trimmed.slice(0, 1000));
  return `/uncensored?${params.toString()}`;
}

/** Does this error mean "send them to the uncensored funnel"? */
export function isAdultRedirect(message: string | null | undefined): boolean {
  return typeof message === "string" && message === ADULT_REDIRECT_MESSAGE;
}
