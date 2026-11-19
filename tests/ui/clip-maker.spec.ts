import { test, expect } from "@playwright/test";
import { stat } from "node:fs/promises";

test("trims a local video into a downloadable portrait clip without a server write", async ({ page }, testInfo) => {
  const serverWrites: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/trpc/analytics.track" && request.method() === "POST") {
      const event = request.postDataJSON()?.json;
      if (event?.event === "page_view" && event.path === "/tools/clip-maker" && typeof event.anonId === "string") {
        await route.fulfill({ status: 204 });
        return;
      }
    }
    const apiWrite = request.method() !== "GET" && request.method() !== "HEAD";
    if (apiWrite && /^\/api\/(?:trpc|upload|media)(?:\/|$)/.test(path)) {
      serverWrites.push(path);
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/tools/clip-maker");
  const main = page.getByRole("main");
  const input = main.getByLabel("Choose a video", { exact: true });
  const start = main.getByLabel("Start (seconds)", { exact: true });
  const end = main.getByLabel("End (seconds)", { exact: true });
  const exportClip = main.getByRole("button", { name: "Export clip", exact: true });
  const downloadClip = main.getByRole("link", { name: "Download clip", exact: true });

  await expect(main.getByRole("region", { name: "Tool access" })).toHaveCount(0);
  await expect(exportClip).toBeDisabled();
  await input.setInputFiles("public/video/forge-preview.mp4");
  await expect(end).toBeEnabled();
  await start.fill("2");
  await end.fill("1");
  await expect(exportClip).toBeDisabled();
  await end.fill("2.5");
  await expect(exportClip).toBeDisabled();
  await end.fill("4");
  await main.getByLabel("Output format").selectOption("portrait");
  await expect(exportClip).toBeEnabled();
  await exportClip.click();
  await expect(downloadClip).toBeVisible({ timeout: 30_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadClip.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^dreamforgex-clip\.(?:mp4|webm)$/);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  expect((await stat(path)).size).toBeGreaterThan(1000);

  // Reopen the actual downloaded file to verify it is playable and trimmed.
  await input.setInputFiles(path);
  await expect(downloadClip).toHaveCount(0);
  await expect(end).toBeEnabled();
  const duration = Number(await end.inputValue());
  expect(duration).toBeGreaterThan(1.5);
  expect(duration).toBeLessThan(2.5);
  const preview = main.getByRole("region", { name: "Source video" }).locator("video");
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => [video.videoWidth, video.videoHeight]))
    .toEqual([720, 1280]);
  expect(serverWrites).toEqual([]);
});
