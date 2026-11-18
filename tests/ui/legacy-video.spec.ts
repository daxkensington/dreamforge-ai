import { test, expect } from "@playwright/test";

test("text video opens the quoted video workspace without automatic generation", async ({ page }) => {
  const calls: { path: string; body: string | null }[] = [];
  await page.route("**/api/trpc/**", async route => {
    const request = route.request();
    const names = decodeURIComponent(new URL(request.url()).pathname.split("/").pop() || "").split(",");
    calls.push({ path: names.join(","), body: request.postData() });
    const values: Record<string, unknown> = {
      "auth.me": { id: 123, name: "Test user", email: "test@example.test" },
      "generation.videoModels": [{ id: "cogvideo", name: "Test video", creditCost: 12, requiredTier: "free", isConfigured: true, supportedDurations: [6], outputInfo: "Test output" }],
      "generation.imageModels": [], "generation.list": [], "training.list": [], "tags.list": [],
      "pricing.getCurrentSubscription": null, "uncensored.status": { active: false },
    };
    const results = names.map(name => ({ result: { data: { json: name === "generation.create" ? { status: "generating", mediaType: "video" } : values[name] ?? null } } }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results) });
  });
  await page.goto("/tools/text-to-video?prompt=Ocean%20waves&autogen=1");
  await expect(page.getByRole("tab", { name: "Video Clip" })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("12 credits per render.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Video duration")).toContainText("6 seconds");
  await expect(page.getByRole("button", { name: /Generate/i }).first()).toBeEnabled();
  await page.waitForTimeout(500);
  expect(calls.some(call => call.path.includes("generation.create"))).toBe(false);
  await page.getByRole("button", { name: "Generate 6s Video Clip" }).click();
  await expect.poll(() => calls.filter(call => call.path.includes("generation.create")).length).toBe(1);
  const sent = JSON.parse(calls.find(call => call.path.includes("generation.create"))!.body!);
  const payload = sent["0"].json;
  expect(payload).toMatchObject({ prompt: "Ocean waves", mediaType: "video", modelVersion: "cogvideo", duration: 6, expectedCreditCost: 12 });
  expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
});

test("text video does not select or submit a model outside the user's plan", async ({ page }) => {
  let attemptedGeneration = false;
  await page.route("**/api/trpc/**", async route => {
    const names = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "").split(",");
    const values: Record<string, unknown> = {
      "auth.me": { id: 123, name: "Test user", email: "test@example.test" },
      "generation.videoModels": [{ id: "runway-gen4.5", name: "Premium video", creditCost: 200, requiredTier: "studio", isConfigured: true, supportedDurations: [5], outputInfo: "Test output" }],
      "generation.imageModels": [], "generation.list": [], "training.list": [], "tags.list": [],
      "pricing.getCurrentSubscription": null, "uncensored.status": { active: false },
    };
    if (names.includes("generation.create")) attemptedGeneration = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(names.map(name => ({ result: { data: { json: values[name] ?? null } } }))) });
  });
  await page.goto("/tools/text-to-video?prompt=Ocean%20waves");
  await expect(page.getByRole("tab", { name: "Video Clip" })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("Choose a video model from the current catalog.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate .*Video Clip/ })).toBeDisabled();
  expect(attemptedGeneration).toBe(false);
});

test("music video explains looped audio composition without claiming beat sync", async ({ page }) => {
  await page.goto("/tools/music-video");
  await expect(page.getByText("The visual repeats; it does not sync to the beat.", { exact: false })).toBeVisible();
  await expect(page.getByText("AI creates a music video starring you")).toHaveCount(0);
});

test("untrusted song query parameters cannot load remote media", async ({ page }) => {
  const unexpected: string[] = [];
  page.on("request", request => { if (request.url().startsWith("https://example.com/")) unexpected.push(request.url()); });
  await page.goto("/tools/music-video?song=https%3A%2F%2Fexample.com%2Fsong.mp3&title=My%20Song");
  await expect(page.getByRole("region", { name: "Your song" })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
