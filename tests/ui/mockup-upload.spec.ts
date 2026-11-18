import { test, expect } from "@playwright/test";

test("replacement upload never submits a previous image during upload or after failure", async ({ page }) => {
  let releaseUpload!: () => void;
  let markStarted!: () => void;
  const uploadStarted = new Promise<void>(resolve => { markStarted = resolve; });
  const uploadRelease = new Promise<void>(resolve => { releaseUpload = resolve; });
  let attempt = 0;
  await page.route("**/api/upload", async route => {
    attempt += 1;
    if (attempt === 1) {
      markStarted();
      await uploadRelease;
      await route.fulfill({ status: 200, json: { url: "https://example.com/new-design.png" } });
    } else if (attempt === 2) {
      await route.fulfill({ status: 500, json: { error: "Upload failed" } });
    } else {
      await route.fulfill({ status: 200, json: { url: "https://example.com/retry-design.png" } });
    }
  });
  await page.goto("/tools/mockup");
  const url = page.getByLabel("Design Image");
  const generate = page.getByRole("button", { name: "Generate Mockup" });
  const file = page.locator('input[type="file"]');
  const image = { name: "design.png", mimeType: "image/png", buffer: Buffer.from("fake image") };
  await url.fill("https://example.com/old-design.png");
  await expect(generate).toBeEnabled();
  await expect(page.getByAltText("Original", { exact: true })).toHaveAttribute("src", "https://example.com/old-design.png");

  await file.setInputFiles(image);
  await uploadStarted;
  await expect(url).toBeDisabled();
  await expect(url).toHaveValue("");
  await expect(generate).toBeDisabled();
  await expect(page.getByAltText("Original", { exact: true })).toHaveCount(0);
  releaseUpload();
  await expect(url).toHaveValue("https://example.com/new-design.png");
  await expect(page.getByAltText("Original", { exact: true })).toHaveAttribute("src", "https://example.com/new-design.png");
  await expect(generate).toBeEnabled();

  await file.setInputFiles(image);
  await expect(page.getByText("Upload failed", { exact: true })).toBeVisible();
  await expect(url).toHaveValue("");
  await expect(generate).toBeDisabled();
  await expect(page.getByAltText("Original", { exact: true })).toHaveCount(0);
  // Selecting the same file again must work after failure.
  await file.setInputFiles(image);
  await expect(url).toHaveValue("https://example.com/retry-design.png");
  await expect(generate).toBeEnabled();
});

test("pricing comparison exposes included and excluded features", async ({ page }) => {
  await page.goto("/pricing");
  const row = page.getByRole("row", { name: /Commercial rights/ });
  await expect(row.getByText("Not included", { exact: true })).toHaveCount(1);
  await expect(row.getByText("Included", { exact: true })).toHaveCount(5);
});
