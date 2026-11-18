import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("Logo Animator imports the selected logo and submits only after quote review", async ({
  page,
}) => {
  const photo = await readFile("public/showcase/forge-preview.webp");
  const uploadId = "087c4075-ad76-4803-983a-fcf0a25d640f";
  const key = `uploads/42/${uploadId}.webp`;
  const imageUrl = `/api/media/${key}`;
  const videoUrl = "/video/forge-preview.mp4";
  const creditCost = 735;
  const generationId = 131;
  const mutations: Array<{ name: string; input: unknown }> = [];
  const uploadedParts: Buffer[] = [];
  const trackedMutations = new Set([
    "media.createUpload",
    "media.completeUpload",
    "animation.importSource",
    "animation.start",
    "generation.create",
    "tools.textToVideo",
  ]);

  await page.route(`**/api/media/upload/${uploadId}/0`, async route => {
    const body = route.request().postDataBuffer();
    if (body) uploadedParts.push(body);
    await route.fulfill({ json: { accepted: true } });
  });
  await page.route(`**${imageUrl}`, route =>
    route.fulfill({ contentType: "image/webp", body: photo })
  );
  await page.route("**/api/trpc/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const names = decodeURIComponent(
      url.pathname.split("/").at(-1) ?? ""
    ).split(",");
    const batched = url.searchParams.get("batch") === "1";
    const input = request.method() === "POST" ? request.postDataJSON() : null;
    const fixtures: Record<string, unknown> = {
      "auth.me": { id: 42, name: "Logo fixture" },
      "generation.list": [],
      "animation.policy": {
        creditCost,
        duration: 5,
        resolution: "480p",
        requiredTier: "creator",
        isConfigured: true,
      },
      "media.createUpload": {
        uploadId,
        key,
        chunkSize: photo.length,
        partCount: 1,
      },
      "media.completeUpload": { key, url: imageUrl },
      "animation.importSource": { generationId, imageUrl },
      "animation.start": { status: "completed", imageUrl: videoUrl },
    };
    const results = names.map((name, index) => {
      if (request.method() === "POST" && trackedMutations.has(name)) {
        mutations.push({
          name,
          input: batched ? input?.[index]?.json : input?.json,
        });
      }
      return { result: { data: { json: fixtures[name] ?? null } } };
    });
    await route.fulfill({ json: batched ? results : results[0] });
  });

  await page.goto("/tools/logo-animator");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Logo Animator", exact: true })
  ).toBeVisible();
  await main.getByLabel("Brand name (optional)").fill("Orbit Studio");
  await main.getByRole("button", { name: /^Neon Glow/ }).click();
  await main.getByLabel("Upload logo source").setInputFiles({
    name: "orbit-logo.webp",
    mimeType: "image/webp",
    buffer: photo,
  });

  const dialog = page.getByRole("dialog", { name: "Animate image to video" });
  const description = dialog.getByLabel("Motion description");
  await expect(
    dialog.getByRole("img", { name: "Selected source image" })
  ).toHaveAttribute("src", imageUrl);
  await expect(description).toHaveValue(/Orbit Studio.*Neon outlines flicker/);
  await expect(dialog.getByText(/735 credits.*5 seconds.*480p/)).toBeVisible();
  expect(uploadedParts).toHaveLength(1);
  expect(uploadedParts[0]?.equals(photo)).toBe(true);
  expect(mutations).toEqual([
    {
      name: "media.createUpload",
      input: {
        fileName: "orbit-logo.webp",
        contentType: "image/webp",
        size: photo.length,
        purpose: "animation",
      },
    },
    { name: "media.completeUpload", input: { uploadId } },
    { name: "animation.importSource", input: { key } },
  ]);

  const editedPrompt =
    "Animate the Orbit Studio logo with a short neon reveal.";
  await description.fill(editedPrompt);
  await dialog
    .getByRole("button", { name: "Generate video", exact: true })
    .click();
  await expect(dialog.locator("video")).toHaveAttribute("src", videoUrl);
  expect(mutations.slice(3)).toEqual([
    {
      name: "animation.start",
      input: {
        requestId: expect.any(String),
        generationId,
        prompt: editedPrompt,
        expectedCreditCost: creditCost,
      },
    },
  ]);
});
