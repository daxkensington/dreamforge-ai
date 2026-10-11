import { test, expect } from "./fixtures";

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
  { path: "/pricing", contains: ["Pricing", "Creator"] },
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
  });
}

test("homepage What's New section is visible", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: "What's new this week", exact: true }) });
  await section.getByRole('heading').scrollIntoViewIfNeeded();
  await expect(section.getByText('Just shipped', { exact: true })).toBeVisible();
  for (const [href, title] of [
    ['/tools/pet-portrait', 'Pet Portrait'], ['/tools/tarot-card', 'Tarot Card Designer'],
    ['/tools/movie-poster', 'Movie Poster'], ['/tools/pixel-art', 'Pixel Art Generator'],
    ['/tools/brand-style-guide', 'Brand Style Guide'], ['/tools/song-creator', 'Self-Hosted Audio'],
  ]) {
    const card = section.locator(`a[href="${href}"]`);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeInViewport();
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
    await link.scrollIntoViewIfNeeded();
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

test("no console errors on homepage", async ({ page }) => {
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
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});
