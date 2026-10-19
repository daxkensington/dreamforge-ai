import { test, expect } from "./fixtures";
import { assertSmokeSignIn } from '../../shared/smoke-target.mjs';

/**
 * Auth-flow + tool-routing smoke tests — verifies that auth-gated routes
 * actually gate, and that a representative sampling of /tools subpages
 * load real content (not generic 404s).
 */

const AUTH_GATED = ["/profile", "/credits", "/api-keys", "/notifications", "/admin"];

for (const path of AUTH_GATED) {
  test(`${path} requires auth`, async ({ page, baseURL }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response).toBeTruthy();
    expect(response!.status()).toBeLessThan(400);
    await expect(page).toHaveURL(url => url.pathname === '/auth/signin');
    // Bind both the sign-in page and its exact original callback to this
    // validated preview origin; public production remains strictly canonical.
    assertSmokeSignIn(page.url(), path, baseURL, process.env.EXPECTED_AUTH_ORIGIN);
    await expect(page.getByRole('heading', { name: 'DreamForge', exact: true })).toBeVisible();
    await expect(page.getByText('Sign in to start creating', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
  });
}

const SAMPLE_TOOLS = [
  { path: "/tools/virtual-tryon", heading: "Virtual Try-On" },
  { path: "/tools/3d-generator", heading: "3D Model Generator" },
  { path: "/tools/comic-strip", heading: "Comic Strip Generator" },
  { path: "/tools/relight", heading: "AI Relighting" },
  { path: "/tools/tshirt-designer", heading: "T-Shirt Designer" },
  { path: "/tools/headshot", heading: "AI Headshot Generator" },
  { path: "/tools/logo-maker", heading: "AI Logo Maker" },
  { path: "/tools/song-creator", heading: "Create Original Songs" },
  { path: "/tools/upscaler", heading: "AI Image Upscaler" },
];

for (const { path, heading } of SAMPLE_TOOLS) {
  test(`${path} loads with real content`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response, `no response for ${path}`).toBeTruthy();
    expect(response!.status(), `bad status for ${path}`).toBeLessThan(400);

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    await expect(main).toContainText('Sign in free');
    // Check rendered content, not the hidden Next.js RSC not-found template.
    await expect.poll(() => main.innerText()).not.toMatch(/404|page not found|not\s+found/i);
  });
}

test("anonymous homepage CTA reaches the no-signup demo", async ({ page, baseURL }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const cta = page.getByRole("link", { name: "Try It Free — No Signup", exact: true });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', '/demo/text-to-image');
  const expectedOrigin = new URL(baseURL || 'https://dreamforgex.ai').origin;
  // Keep native-click actionability on its existing 10-second clock. Observe
  // real document navigation separately with the existing navigation budget.
  await Promise.all([
    page.waitForURL(url => url.origin === expectedOrigin && url.pathname === '/demo/text-to-image' && !url.search, { waitUntil: 'domcontentloaded' }),
    cta.click({ noWaitAfter: true }),
  ]);
  await expect(page).toHaveURL(url => url.origin === expectedOrigin && url.pathname === '/demo/text-to-image' && !url.search);
  await expect(page.getByRole('heading', { level: 1, name: 'Try AI Image Generation Free', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate (free)', exact: true })).toBeDisabled();
});
