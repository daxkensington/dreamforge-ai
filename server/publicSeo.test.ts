import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig, getRedirectUrl } from "next/experimental/testing/server";
import nextConfig from "../next.config";

async function redirect(url: string, cookie?: string) {
  const response = await unstable_getResponseFromNextConfig({
    url,
    headers: { host: new URL(url).host, ...(cookie === undefined ? {} : { cookie }) },
    // Next 15.5's helper replaces the Cookie header with its default empty
    // cookie map. Its runtime accepts null to preserve the raw HTTP fixture,
    // including whitespace and chunk names, but the experimental type omits it.
    cookies: null as unknown as Record<string, string>,
    nextConfig,
  });
  return { status: response.status, url: getRedirectUrl(response) };
}

describe("public canonical URL redirects", () => {
  it.each([
    "/", "/pricing", "/tools/photo-colorize", "/for/etsy-sellers",
    "/blog/ai-image-generation-guide", "/vs/runway", "/g/42",
    "/marketplace/123", "/video-studio/script",
  ])("redirects www%s to the same public apex path", async (path) => {
    expect(await redirect(`https://www.dreamforgex.ai${path}`)).toEqual({
      status: 308,
      url: `https://dreamforgex.ai${path}`,
    });
  });

  it.each([
    "theme=dark",
    "theme=dark; analytics=fixture",
    "authjs.csrf-token=fixture; __Secure-authjs.callback-url=fixture",
    "not-authjs.session-token=fixture",
    "authjs.session-token-old=fixture",
    "authjs.session-token.invalid=fixture",
    "unrelated=authjs.session-token=fixture; theme=dark",
  ])("still consolidates anonymous www requests with non-session cookies: %s", async (cookie) => {
    expect(await redirect("https://www.dreamforgex.ai/tools/photo-colorize?seed=42", cookie)).toEqual({
      status: 308,
      url: "https://dreamforgex.ai/tools/photo-colorize?seed=42",
    });
  });

  it.each([
    "authjs.session-token=fixture",
    "__Secure-authjs.session-token=fixture",
    "authjs.session-token.0=first; authjs.session-token.1=second",
    "__Secure-authjs.session-token.0=first; __Secure-authjs.session-token.1=second",
    "theme=dark; authjs.session-token=fixture; analytics=fixture",
    "theme=dark;__Secure-authjs.session-token.10=fixture;analytics=fixture",
    "theme=dark;\t__Secure-authjs.session-token.0=fixture",
    " authjs.session-token=fixture; theme=dark",
  ])("keeps an existing www session on its host for cookie header: %s", async (cookie) => {
    expect(await redirect("https://www.dreamforgex.ai/tools/photo-colorize?seed=42", cookie)).toEqual({
      status: 200,
      url: null,
    });
  });

  it.each([
    "/", "/workspace?welcome=true", "/batch", "/video-studio/script",
    "/gallery", "/marketplace/123?canceled=true", "/uncensored?paid=1",
  ])("preserves www session continuity on public route %s", async (path) => {
    expect(await redirect(`https://www.dreamforgex.ai${path}`, "theme=dark; __Secure-authjs.session-token.0=fixture")).toEqual({
      status: 200,
      url: null,
    });
  });

  it.each([
    "/tools/photo-colorize?prompt=red%20fox&model=flux&seed=42",
    "/pricing?success=true&session_id=cs_fixture&ref=partner",
    "/uncensored?paid=1&requestId=fixture",
    "/marketplace/123?canceled=true",
  ])("preserves content and payment queries in %s", async (path) => {
    const result = await redirect(`https://www.dreamforgex.ai${path}`);
    expect(result.status).toBe(308);
    const target = new URL(result.url!);
    expect(target.hostname).toBe("dreamforgex.ai");
    const original = new URL(`https://www.dreamforgex.ai${path}`);
    expect(target.pathname).toBe(original.pathname);
    expect([...target.searchParams]).toEqual([...original.searchParams]);
  });

  it.each([
    "https://dreamforgex.ai/pricing?success=true",
    "https://www.dreamforgex.ai/api/auth/callback/google?code=fixture&state=fixture",
    "https://www.dreamforgex.ai/api/stripe/webhook",
    "https://www.dreamforgex.ai/auth/signin?callbackUrl=%2Fworkspace",
    "https://www.dreamforgex.ai/profile",
    "https://www.dreamforgex.ai/marketplace/purchases?success=true",
    "https://www.dreamforgex.ai/marketplace/seller/setup?refresh=true",
    "https://www.dreamforgex.ai/video-studio/project/42",
    "https://www.dreamforgex.ai/video-studio/join/invite-token",
  ])("leaves existing host handling unchanged for %s", async (url) => {
    expect((await redirect(url)).url).toBeNull();
    expect((await redirect(url, "__Secure-authjs.session-token.0=fixture")).url).toBeNull();
  });

  it.each(["/refine", "/tools/refine"])("preserves the host and query of legacy %s links", async (path) => {
    for (const host of ["dreamforgex.ai", "www.dreamforgex.ai"]) {
      const result = await redirect(`https://${host}${path}?paid=1&requestId=fixture`);
      expect(result).toEqual({
        status: 308,
        url: `https://${host}/uncensored?paid=1&requestId=fixture`,
      });
      const secondHop = await redirect(result.url!);
      expect(secondHop.url).toBe(host.startsWith("www.")
        ? "https://dreamforgex.ai/uncensored?paid=1&requestId=fixture"
        : null);
    }
  });

  it.each(["/refine", "/tools/refine"])("keeps an existing www session through legacy %s links", async (path) => {
    const cookie = "theme=dark; __Secure-authjs.session-token.0=fixture; analytics=fixture";
    const result = await redirect(`https://www.dreamforgex.ai${path}?paid=1&requestId=fixture`, cookie);
    expect(result).toEqual({
      status: 308,
      url: "https://www.dreamforgex.ai/uncensored?paid=1&requestId=fixture",
    });
    expect(await redirect(result.url!, cookie)).toEqual({ status: 200, url: null });
  });
});
