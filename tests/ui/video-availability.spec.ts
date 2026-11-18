import { test, expect } from "@playwright/test";

for (const failedProcedure of ["generation.videoModels", "pricing.getCurrentSubscription"]) {
  test(`text video cannot generate when ${failedProcedure} fails`, async ({ page }) => {
    let attemptedGeneration = false;
    await page.route("**/api/trpc/**", async route => {
      const names = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "").split(",");
      const values: Record<string, unknown> = {
        "auth.me": { id: 123, name: "Test user", email: "test@example.test" },
        "generation.videoModels": [{ id: "cogvideo", name: "Test video", creditCost: 12, requiredTier: "free", isConfigured: true, supportedDurations: [6], outputInfo: "Test output" }],
        "generation.imageModels": [], "generation.list": [], "training.list": [], "tags.list": [],
        "pricing.getCurrentSubscription": null, "uncensored.status": { active: false },
      };
      if (names.includes("generation.create")) attemptedGeneration = true;
      const results = names.map(name => name === failedProcedure
        ? { error: { json: { message: "Simulated unavailable service", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, path: name } } } }
        : { result: { data: { json: values[name] ?? null } } });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results) });
    });
    await page.goto("/tools/text-to-video?prompt=Ocean%20waves&autogen=1");
    await expect(page.getByRole("tab", { name: "Video Clip" })).toHaveAttribute("data-state", "active");
    await expect(page.getByText(failedProcedure === "generation.videoModels"
      ? "Load the current video model catalog before generating."
      : "Your subscription is still being checked. Please try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate .*Video Clip/ })).toBeDisabled();
    await page.waitForTimeout(500);
    expect(attemptedGeneration).toBe(false);
  });
}
