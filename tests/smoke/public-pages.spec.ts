import { test, expect } from "@playwright/test";

/**
 * Public-page smoke tests — verifies that the pages anyone can reach without
 * logging in actually render usable content (not just HTTP 200 with an empty
 * shell). Run on every PR preview and nightly against prod.
 */

const PUBLIC_PAGES = [
  { path: "/", contains: ["Create Stunning", "Start Creating"] },
  { path: "/about", contains: ["About DreamForgeX", "Browse 75+ Tools"] },
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

    const body = await pw.locator("body").textContent();
    for (const phrase of page.contains) {
      expect(body, `${page.path} missing expected text: "${phrase}"`).toContain(phrase);
    }
  });
}

test("homepage What's New section is visible", async ({ page }) => {
  await page.goto("/");
  // Section header — proves the new homepage content shipped.
  await expect(page.getByText(/Just shipped/i)).toBeVisible();
  await expect(page.getByText(/Virtual Try-On/i)).toBeVisible();
  await expect(page.getByText(/3D Model Generator/i)).toBeVisible();
});

test("footer renders with all link sections", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").scrollIntoViewIfNeeded();
  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  // Every footer-linked legal page must be reachable.
  for (const path of ["/about", "/terms", "/privacy"]) {
    const link = footer.locator(`a[href="${path}"]`).first();
    await expect(link, `footer missing link to ${path}`).toBeVisible();
  }
});

test("no broken images on homepage", async ({ page }) => {
  const broken: string[] = [];
  page.on("response", (res) => {
    if (res.request().resourceType() === "image" && res.status() >= 400) {
      broken.push(`${res.status()} ${res.url()}`);
    }
  });
  // Don't wait for networkidle — the homepage has a looping bg video that
  // never lets the network go idle. Load + a short settle is enough to
  // catch any image that 404s on initial render.
  await page.goto("/", { waitUntil: "load" });
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
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});
