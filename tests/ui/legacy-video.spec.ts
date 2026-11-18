import { test, expect } from "@playwright/test";

test("legacy text video explains the quoted workspace and cannot submit", async ({ page }) => {
  await page.goto("/tools/text-to-video");
  await expect(page.getByRole("status").filter({ hasText: "older video tool" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/workspace");
  await expect(page.getByRole("button", { name: "Generate Video" })).toBeDisabled();
});

test("music video directs users to the manual timeline workflow", async ({ page }) => {
  await page.goto("/tools/music-video");
  await expect(page.getByRole("status").filter({ hasText: "make a music video manually" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open timeline editor" })).toHaveAttribute("href", "/timeline/new");
  await expect(page.getByRole("button", { name: "Generate Music Video" })).toBeDisabled();
});
