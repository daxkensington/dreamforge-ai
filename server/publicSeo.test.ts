import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig, getRedirectUrl } from "next/experimental/testing/server";
import nextConfig from "../next.config";

async function redirect(url: string) {
  const response = await unstable_getResponseFromNextConfig({
    url,
    headers: { host: new URL(url).host },
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
  });

  it.each(["dreamforgex.ai", "www.dreamforgex.ai"])("consolidates old refine links on %s in one hop", async (host) => {
    expect(await redirect(`https://${host}/tools/refine?paid=1`)).toEqual({
      status: 308,
      url: "https://dreamforgex.ai/uncensored?paid=1",
    });
  });
});
