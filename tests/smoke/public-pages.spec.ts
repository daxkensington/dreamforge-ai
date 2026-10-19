import { test, expect } from "./fixtures";
import { smokeTarget } from "../../shared/smoke-target.mjs";
import {
  assertHomepageCsp,
  classifyHomepageConsole,
  PREVIEW_PLATFORM_LOADER,
} from "./console-policy.mjs";

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
  {
    path: "/pricing",
    contains: ["Plans for Every Creator", "Start free with 50 credits/day"],
  },
  { path: "/tools", contains: ["Tools"] },
  { path: "/gallery", contains: ["Gallery"] },
  { path: "/marketplace", contains: ["Marketplace"] },
];

for (const page of PUBLIC_PAGES) {
  test(`${page.path} renders public content`, async ({ page: pw }) => {
    const response = await pw.goto(page.path, {
      waitUntil: "domcontentloaded",
    });
    expect(response, `no response for ${page.path}`).toBeTruthy();
    expect(response!.status(), `bad status for ${page.path}`).toBeLessThan(400);

    const main = pw.getByRole("main");
    for (const phrase of page.contains) {
      await expect
        .poll(() => main.innerText(), {
          message: `${page.path} missing rendered text: "${phrase}"`,
        })
        .toContain(phrase);
    }
    if (page.path === "/pricing") {
      await expect(
        main.getByRole("heading", {
          level: 1,
          name: "Plans for Every Creator",
          exact: true,
        })
      ).toBeVisible();
      // The section also contains an enterprise upsell heading. Count the
      // actual subscription card grid, retaining all six unique plan names.
      const plans = main.locator("#plans > .container > .grid");
      await expect(plans).toHaveCount(1);
      await expect(plans.locator(":scope > div")).toHaveCount(6);
      await expect(plans.getByRole("heading", { level: 3 })).toHaveCount(6);
      for (const name of [
        "Explorer",
        "Creator",
        "Pro",
        "Studio",
        "Business",
        "Agency",
      ]) {
        const heading = plans.getByRole("heading", {
          level: 3,
          name,
          exact: true,
        });
        await expect(heading).toHaveCount(1);
        await expect(heading).toBeVisible();
      }
      await expect(
        main.getByRole("button", { name: "Monthly", exact: true })
      ).toBeVisible();
      await expect(main.getByRole("button", { name: /Annual/ })).toBeVisible();
    }
  });
}

test("homepage What's New section is visible", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "What's new this week",
        exact: true,
      }),
    });
  const heading = section.getByRole("heading", {
    name: "What's new this week",
    exact: true,
  });
  // Preserve native driver stability checks. The scoped content-scroll budget
  // covers the observed WebKit wait; total test and auth budgets stay fixed.
  await heading.scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  await expect(heading).toHaveCSS("opacity", "1");
  await expect(
    section.getByText("Just shipped", { exact: true })
  ).toBeVisible();
  for (const [href, title] of [
    ["/tools/pet-portrait", "Pet Portrait"],
    ["/tools/tarot-card", "Tarot Card Designer"],
    ["/tools/movie-poster", "Movie Poster"],
    ["/tools/pixel-art", "Pixel Art Generator"],
    ["/tools/brand-style-guide", "Brand Style Guide"],
    ["/tools/song-creator", "Self-Hosted Audio"],
  ]) {
    const card = section.locator(`a[href="${href}"]`);
    await card.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(card).toBeVisible();
    await expect(card).toBeInViewport();
    // Compact release links render immediately; they no longer depend on a
    // scroll-triggered motion wrapper before becoming readable/actionable.
    await expect(card).toHaveCSS("opacity", "1");
    await expect(
      card.getByRole("heading", { name: title, exact: true })
    ).toBeVisible();
  }
});

test("homepage keeps pricing and tool discovery within a compact page", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pricing = page.locator("#home-pricing");
  await expect(
    pricing.getByRole("heading", {
      name: "Plans for Every Creator",
      exact: true,
    })
  ).toBeVisible();
  for (const name of ["Explorer", "Creator", "Pro", "Studio"]) {
    await expect(
      pricing.getByRole("heading", { name, exact: true })
    ).toBeVisible();
  }
  await expect(pricing.locator('a[href="/pricing"]')).toHaveCount(5);
  await expect(page.locator("#home-tools a")).toHaveCount(7);
  await expect(
    page.getByRole("link", {
      name: "View Day / Week / 30-Day Passes",
      exact: true,
    })
  ).toHaveAttribute("href", "/pricing#uncensored-passes");
  await expect(page.locator("main figure")).toHaveCount(6);
  // Evaluate the complete document after visiting its footer; include the
  // shared footer and all six releases rather than measuring just the hero.
  await page.locator("footer").scrollIntoViewIfNeeded();
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    screens: document.documentElement.scrollHeight / innerHeight,
  }));
  expect(layout.overflow).toBeLessThanOrEqual(1);
  if (layout.width <= 430) expect(layout.screens).toBeLessThanOrEqual(10);
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
  page.on("response", res => {
    if (res.request().resourceType() === "image" && res.status() >= 400) {
      broken.push(`${res.status()} ${res.url()}`);
    }
  });
  // The looping video must not block document readiness. Explicitly wait for
  // initial-viewport images to finish, keeping real network error assertions.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.locator("img").evaluateAll(images => {
        const visible = images.filter(img => {
          const rect = img.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < innerHeight &&
            rect.right > 0 &&
            rect.left < innerWidth
          );
        });
        return (
          visible.length > 0 &&
          visible.every(img => img.complete && img.naturalWidth > 0)
        );
      })
    )
    .toBe(true);
  await page.waitForTimeout(2500);
  expect(broken, `broken images:\n${broken.join("\n")}`).toEqual([]);
});

test("homepage enforces the audited Content Security Policy", async ({ page, baseURL }) => {
  const target = smokeTarget(baseURL || "https://dreamforgex.ai");
  // Only anonymous www has a source-defined public homepage redirect. Other
  // supported targets must retain their exact requested document origin.
  const expectedUrl = (target.origin === "https://www.dreamforgex.ai"
    ? "https://dreamforgex.ai" : target.origin) + "/";
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response).toBeTruthy();
  expect(response!.status()).toBe(200);
  expect(response!.url()).toBe(expectedUrl);
  expect(page.url()).toBe(expectedUrl);
  assertHomepageCsp({
    enforced: await response!.headerValues("content-security-policy"),
    reportOnly: await response!.headerValues("content-security-policy-report-only"),
  });
});

test("no application console errors on homepage", async ({ page, baseURL }, testInfo) => {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", msg => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response).toBeTruthy();
  expect(response!.status()).toBeLessThan(400);
  await page.waitForTimeout(2500);
  const result = classifyHomepageConsole(errors, {
    targetInput: baseURL || "https://dreamforgex.ai",
    responseUrl: response!.url(),
    documentUrl: page.url(),
    policy: {
      enforced: await response!.headerValues("content-security-policy"),
      reportOnly: await response!.headerValues("content-security-policy-report-only"),
    },
  });
  if (result.knownPreviewBlockages.length) {
    const description = `${result.knownPreviewBlockages.length} known preview loader CSP message(s); audited policy remains enforced. Signature classification is not proof of injection provenance.`;
    testInfo.annotations.push({ type: "known-preview-platform-csp", description });
    await testInfo.attach("known-preview-platform-csp.json", {
      body: JSON.stringify({
        description,
        loader: PREVIEW_PLATFORM_LOADER,
        messages: result.knownPreviewBlockages,
      }, null, 2),
      contentType: "application/json",
    });
    console.warn(description);
  }
  expect(result.errors, `application console errors:\n${result.errors.join("\n")}`).toEqual([]);
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
});
