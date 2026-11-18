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
  await expect(page.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/workspace");
  await expect(page.getByRole("link", { name: "Open timeline editor" })).toHaveAttribute("href", "/timeline/new");
  await expect(page.getByRole("button", { name: "Generate Music Video" })).toHaveCount(0);
  await expect(page.getByText("AI creates a music video starring you")).toHaveCount(0);
});

test("a song from Song Creator can be previewed and saved for the timeline", async ({ page }) => {
  await page.goto("/tools/music-video?song=https%3A%2F%2Fexample.com%2Fsong.mp3&title=My%20Song");
  const song = page.getByRole("region", { name: "Your song" });
  await expect(song.getByRole("heading", { name: "My Song" })).toBeVisible();
  await expect(song.getByRole("link", { name: "Open or download song" })).toHaveAttribute("href", "https://example.com/song.mp3");
});
