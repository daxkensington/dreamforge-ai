import { test, expect } from "@playwright/test";

test("unsupported music recording is stopped before any paid animation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "MediaRecorder", { value: undefined, configurable: true }));
  let paidCalls = 0;
  await page.route("**/api/trpc/**", async route => {
    const names = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "").split(",");
    const values: Record<string, unknown> = {
      "auth.me": { id: 123, name: "Test user", email: "test@example.test" },
      "generation.list": [],
      "animation.policy": { creditCost: 100, duration: 5, resolution: "480p", requiredTier: "creator", isConfigured: true },
    };
    if (names.includes("animation.start")) paidCalls++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(names.map(name => ({ result: { data: { json: values[name] ?? null } } }))) });
  });
  await page.goto("/tools/music-video");
  await page.getByRole("button", { name: "Upload an image" }).click();
  await expect(page.getByText(/no credits were charged/i)).toBeVisible();
  expect(paidCalls).toBe(0);
});
