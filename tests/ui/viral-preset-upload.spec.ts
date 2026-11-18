import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("viral preset retries a photo upload and submits only the current storage URL", async ({
  page,
  baseURL,
}) => {
  const inputBytes = await readFile("public/showcase/forge-preview.webp");
  expect(inputBytes.length).toBeGreaterThan(2048);
  const oldUrl = new URL("/showcase/forge-image.webp", baseURL).href;
  const newUrl = new URL("/showcase/forge-preview.webp", baseURL).href;
  const releaseOldUpload = Promise.withResolvers<void>();
  const oldUploadSettled = Promise.withResolvers<void>();
  const filenames: string[] = [];
  const mutations: unknown[] = [];
  let signedIn = false;

  await page.route("**/api/upload", async route => {
    const form = route.request().postDataBuffer()?.toString("latin1");
    const filename =
      form?.match(/filename="(old|new)\.webp"/)?.[1] ?? "missing";
    filenames.push(filename);
    if (filename === "old") {
      await releaseOldUpload.promise;
      try {
        await route.fulfill({ json: { url: oldUrl } });
      } catch {
        // Chrome can discard the old network request when it is aborted.
      } finally {
        oldUploadSettled.resolve();
      }
    } else if (filenames.length === 2) {
      await route.fulfill({
        status: 500,
        json: { error: "Upload failed — try again" },
      });
    } else {
      await route.fulfill({ json: { url: newUrl } });
    }
  });

  await page.route("**/api/trpc/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const names = decodeURIComponent(
      url.pathname.split("/").at(-1) ?? ""
    ).split(",");
    const batched = url.searchParams.get("batch") === "1";
    const inputs = request.method() === "POST" ? request.postDataJSON() : null;
    const results = names.map((name, index) => {
      if (name === "viral.transform") {
        mutations.push(batched ? inputs?.[index]?.json : inputs?.json);
        return {
          result: { data: { json: { status: "completed", url: newUrl } } },
        };
      }
      const value =
        name === "auth.me" && signedIn
          ? { id: 42, name: "Upload fixture" }
          : null;
      return { result: { data: { json: value } } };
    });
    await route.fulfill({ json: batched ? results : results[0] });
  });

  try {
    await page.goto("/tools/action-figure");
    const input = page.getByRole("main").getByRole("button", {
      name: "Upload your photo",
      exact: true,
    });
    const generate = page.getByRole("button", {
      name: "Generate",
      exact: true,
    });
    await expect(
      page.getByText("Sign in to upload", { exact: true })
    ).toBeVisible();
    await expect(input).toBeDisabled();
    expect(filenames).toEqual([]);

    signedIn = true;
    await page.reload();
    await expect(input).toBeEnabled();

    const oldFile = {
      name: "old.webp",
      mimeType: "image/webp",
      buffer: inputBytes,
    };
    const newFile = { ...oldFile, name: "new.webp" };

    await input.setInputFiles(oldFile);
    await expect.poll(() => filenames).toEqual(["old"]);
    await expect(page.getByText("Uploading photo…")).toBeVisible();
    await expect(generate).toBeDisabled();

    await input.setInputFiles(newFile);
    await expect(
      page.getByRole("alert").filter({ hasText: "Upload failed — try again" })
    ).toBeVisible();
    await expect(generate).toBeDisabled();
    await input.setInputFiles(newFile);
    await expect(
      page.getByRole("img", { name: "Source", exact: true })
    ).toHaveAttribute("src", newUrl);
    await expect(generate).toBeEnabled();

    releaseOldUpload.resolve();
    await oldUploadSettled.promise;
    await generate.click();
    await expect
      .poll(() => mutations)
      .toMatchObject([{ preset: "action-figure", imageUrl: newUrl }]);
    await expect(
      page.getByRole("img", { name: /action figure.*result/i })
    ).toBeVisible();
    expect(filenames).toEqual(["old", "new", "new"]);
  } finally {
    releaseOldUpload.resolve();
  }
});
