import { test, expect } from "@playwright/test";

/**
 * Auth-flow + tool-routing smoke tests — verifies that auth-gated routes
 * actually gate, and that a representative sampling of /tools subpages
 * load real content (not generic 404s).
 */

const AUTH_GATED = ["/profile", "/credits", "/api-keys", "/notifications", "/admin"];

for (const path of AUTH_GATED) {
  test(`${path} requires auth`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response).toBeTruthy();
    // After redirects, we should land on a login page (or be on the gated
    // page rendered as a "please log in" shell — both are valid).
    const url = page.url();
    const body = (await page.locator("body").textContent()) || "";
    const looksLikeAuth =
      /\/auth|\/login|\/signin/i.test(url) ||
      /sign in|log in|signin|login/i.test(body);
    expect(
      looksLikeAuth,
      `${path} did not gate auth — landed on ${url}`,
    ).toBe(true);
  });
}

const SAMPLE_TOOLS = [
  "/tools/virtual-tryon",
  "/tools/3d-generator",
  "/tools/comic-strip",
  "/tools/relight",
  "/tools/tshirt-designer",
  "/tools/headshot",
  "/tools/logo-maker",
  "/tools/song-creator",
  "/tools/upscaler",
];

for (const path of SAMPLE_TOOLS) {
  test(`${path} loads with real content`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response, `no response for ${path}`).toBeTruthy();
    expect(response!.status(), `bad status for ${path}`).toBeLessThan(400);

    // Real pages have a heading. The 404 page does not have an H1 with tool-relevant text.
    const heading = await page.locator("h1, h2").first().textContent();
    expect(heading, `${path} missing heading`).toBeTruthy();
    expect(heading!.length, `${path} heading too short`).toBeGreaterThan(2);

    // Hard fail if the page is the not-found shell.
    const body = (await page.locator("body").textContent()) || "";
    expect(
      /404|page not found|not\s+found/i.test(body) && !/404 errors handled/i.test(body),
      `${path} rendered 404 page`,
    ).toBe(false);
  });
}

test("homepage has a visible primary CTA", async ({ page }) => {
  await page.goto("/");
  // Hero CTA copy has changed over time ("Start Creating" -> "Try It Free"),
  // so accept any of the primary call-to-action phrasings.
  const cta = page
    .getByRole("button", { name: /try it free|start creating|get started|start free/i })
    .or(page.getByRole("link", { name: /try it free|start creating|get started|start free/i }))
    .first();
  await expect(cta).toBeVisible();
});
