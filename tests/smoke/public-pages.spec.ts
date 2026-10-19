import { test, expect } from "./fixtures";
import { isPreviewToolbarCspCollision, smokeTarget } from "../../shared/smoke-target.mjs";

/**
 * Public-page smoke tests — verifies that the pages anyone can reach without
 * logging in actually render usable content (not just HTTP 200 with an empty
 * shell). Run on every PR preview and nightly against prod.
 */

const PUBLIC_PAGES = [
  { path: "/", contains: ["Create Stunning", "Try It Free — No Signup"] },
  { path: "/about", contains: ["About DreamForgeX", "Browse 100+ Tools"] },
  { path: "/terms", contains: ["Terms of Service", "Acceptable Use"] },
  { path: "/privacy", contains: ["Privacy Policy", "AI model training"] },
  { path: "/pricing", contains: ["Plans for Every Creator", "Start free with 50 credits/day"] },
  { path: "/tools", contains: ["Tools"] },
  { path: "/gallery", contains: ["Gallery"] },
  { path: "/marketplace", contains: ["Marketplace"] },
];

for (const page of PUBLIC_PAGES) {
  test(`${page.path} renders public content`, async ({ page: pw }) => {
    const response = await pw.goto(page.path, { waitUntil: "domcontentloaded" });
    expect(response, `no response for ${page.path}`).toBeTruthy();
    expect(response!.status(), `bad status for ${page.path}`).toBeLessThan(400);

    const main = pw.getByRole('main');
    for (const phrase of page.contains) {
      await expect.poll(() => main.innerText(), { message: `${page.path} missing rendered text: "${phrase}"` }).toContain(phrase);
    }
    if (page.path === '/pricing') {
      await expect(main.getByRole('heading', { level: 1, name: 'Plans for Every Creator', exact: true })).toBeVisible();
      // The section also contains an enterprise upsell heading. Count the
      // actual subscription card grid, retaining all six unique plan names.
      const plans = main.locator('#plans > .container > .grid');
      await expect(plans).toHaveCount(1);
      await expect(plans.locator(':scope > div')).toHaveCount(6);
      await expect(plans.getByRole('heading', { level: 3 })).toHaveCount(6);
      for (const name of ['Explorer', 'Creator', 'Pro', 'Studio', 'Business', 'Agency']) {
        const heading = plans.getByRole('heading', { level: 3, name, exact: true });
        await expect(heading).toHaveCount(1);
        await expect(heading).toBeVisible();
      }
      await expect(main.getByRole('button', { name: 'Monthly', exact: true })).toBeVisible();
      await expect(main.getByRole('button', { name: /Annual/ })).toBeVisible();
    }
  });
}

test("homepage What's New section is visible", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: "What's new this week", exact: true }) });
  const heading = section.getByRole('heading', { name: "What's new this week", exact: true });
  // Preserve native driver stability checks. The scoped content-scroll budget
  // covers the observed WebKit wait; total test and auth budgets stay fixed.
  await heading.scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  await expect(heading).toHaveCSS('opacity', '1');
  await expect(section.getByText('Just shipped', { exact: true })).toBeVisible();
  for (const [href, title] of [
    ['/tools/pet-portrait', 'Pet Portrait'], ['/tools/tarot-card', 'Tarot Card Designer'],
    ['/tools/movie-poster', 'Movie Poster'], ['/tools/pixel-art', 'Pixel Art Generator'],
    ['/tools/brand-style-guide', 'Brand Style Guide'], ['/tools/song-creator', 'Self-Hosted Audio'],
  ]) {
    const card = section.locator(`a[href="${href}"]`);
    await card.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(card).toBeVisible();
    await expect(card).toBeInViewport();
    const motionContent = card.locator(':scope > div');
    await expect(motionContent).toHaveCount(1);
    await expect(motionContent).toHaveCSS('opacity', '1');
    await expect(card.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});

test("footer renders with all link sections", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  // Every footer-linked legal page must be reachable.
  for (const path of ["/about", "/terms", "/privacy"]) {
    const link = footer.locator(`a[href="${path}"]`).first();
    await link.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(link, `footer missing link to ${path}`).toBeVisible();
    await expect(link).toBeInViewport();
  }
});

test("no broken images on homepage", async ({ page }) => {
  const broken: string[] = [];
  page.on("response", (res) => {
    if (res.request().resourceType() === "image" && res.status() >= 400) {
      broken.push(`${res.status()} ${res.url()}`);
    }
  });
  // The looping video must not block document readiness. Explicitly wait for
  // initial-viewport images to finish, keeping real network error assertions.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.locator('img').evaluateAll(images => {
    const visible = images.filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    });
    return visible.length > 0 && visible.every(img => img.complete && img.naturalWidth > 0);
  })).toBe(true);
  await page.waitForTimeout(2500);
  expect(broken, `broken images:\n${broken.join("\n")}`).toEqual([]);
});

test("no console errors on homepage", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter known third-party noise we don't control.
      if (text.includes("Sentry") && text.includes("DSN")) return;
      if (text.includes("favicon")) return;
      errors.push(text);
    }
  });
  const target = smokeTarget(baseURL || "https://dreamforgex.ai");
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const unexpectedErrors = errors.filter(error => !isPreviewToolbarCspCollision(error, target, page.url()));
  if (target.protectedTarget) {
    // Historical cause diagnostics are retained separately. Keep only finite
    // current DOM/status observations; response bodies can expire in WebKit.
    const domScriptCount = await page.locator("script[src]").evaluateAll(scripts => scripts.filter(script => {
      try {
        const url = new URL(script.getAttribute("src") || "", location.href);
        return url.origin === "https://vercel.live" && url.pathname === "/_next-live/feedback/feedback.js";
      } catch { return false; }
    }).length);
    const feedbackCspCount = errors.filter(text => text.includes("https://vercel.live/_next-live/feedback/feedback.js")
      && text.includes("Content Security Policy") && text.includes("script-src")).length;
    console.log("Preview toolbar document diagnostics", JSON.stringify({
      final_document_same_origin: new URL(page.url()).origin === target.origin
        && !!response && new URL(response.url()).origin === target.origin,
      final_document_http_status: response?.status() || 0,
      feedback_script_dom_count: domScriptCount,
      exact_feedback_csp_signature_count: feedbackCspCount,
      classified_preview_toolbar_csp_count: errors.length - unexpectedErrors.length,
      other_console_error_count: errors.length - feedbackCspCount,
    }));
  }
  expect(unexpectedErrors, `console errors:\n${unexpectedErrors.join("\n")}`).toEqual([]);
});
