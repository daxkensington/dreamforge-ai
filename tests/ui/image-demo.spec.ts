import { expect, test, type Page } from "@playwright/test";

const demoPath = "/demo/text-to-image";
const fixtureImage = "/showcase/forge-preview.webp";
const promptHandoffKey = "dreamforgex-demo-image-prompt";

async function mockDemo(page: Page, result: Record<string, string>) {
  const submittedPrompts: string[] = [];
  let signedIn = false;
  let workspaceGenerations = 0;
  await page.route("**/api/trpc/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const procedures = decodeURIComponent(
      url.pathname.split("/").at(-1) ?? ""
    ).split(",");
    const batched = url.searchParams.get("batch") === "1";
    const input = request.method() === "POST" ? request.postDataJSON() : null;

    const results = procedures.map((procedure, index) => {
      if (procedure === "auth.me" && signedIn) {
        return {
          result: { data: { json: { id: 123, name: "Demo visitor" } } },
        };
      }
      if (procedure === "generation.create") workspaceGenerations += 1;
      if (procedure !== "demo.generate") {
        return { result: { data: { json: null } } };
      }

      const payload = batched ? input?.[index]?.json : input?.json;
      submittedPrompts.push(payload.prompt);
      return { result: { data: { json: result } } };
    });
    await route.fulfill({ json: batched ? results : results[0] });
  });
  return {
    submittedPrompts,
    signIn: () => {
      signedIn = true;
    },
    workspaceGenerations: () => workspaceGenerations,
  };
}

test("an editable example produces an image and carries its prompt into Workspace", async ({
  page,
}) => {
  const { submittedPrompts, signIn, workspaceGenerations } = await mockDemo(
    page,
    {
      status: "completed",
      url: fixtureImage,
    }
  );
  await page.goto(demoPath);

  const promptField = page.getByRole("textbox", { name: "Describe an image" });
  const generate = page.getByRole("button", {
    name: "Generate (free)",
    exact: true,
  });
  await expect(generate).toBeDisabled();
  await page.getByRole("button", { name: "Neon street", exact: true }).click();
  await expect(promptField).not.toHaveValue("");
  await expect(generate).toBeEnabled();
  expect(submittedPrompts).toEqual([]);

  const submittedPrompt = "A neon street reflected in a rain puddle";
  await promptField.fill(` ${submittedPrompt} `);
  await generate.click();

  const resultImage = page.getByRole("img", {
    name: new RegExp(submittedPrompt),
  });
  await expect(resultImage).toBeVisible();
  await expect(resultImage).toHaveAttribute("src", fixtureImage);
  expect(submittedPrompts).toEqual([submittedPrompt]);
  await expect(
    page.getByRole("link", { name: "Download image" })
  ).toHaveAttribute("href", fixtureImage);

  const workspaceLink = page.getByRole("link", {
    name: "Continue in Workspace",
  });
  const signInPath = `/auth/signin?next=${encodeURIComponent("/workspace?from=demo")}`;
  await expect(workspaceLink).toHaveAttribute("href", signInPath);
  expect(
    await page.evaluate(key => sessionStorage.getItem(key), promptHandoffKey)
  ).toBeNull();

  await workspaceLink.click();
  await expect(page).toHaveURL(new URL(signInPath, page.url()).toString());
  await expect(
    page.getByRole("heading", { name: "DreamForge", exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(key => sessionStorage.getItem(key), promptHandoffKey)
  ).toBe(submittedPrompt);

  signIn();
  await page.goto("/workspace?from=demo");
  await expect(
    page.getByPlaceholder(/^Describe a fictional scene/)
  ).toHaveValue(submittedPrompt);
  await expect(page).toHaveURL(/\/workspace$/);
  expect(
    await page.evaluate(key => sessionStorage.getItem(key), promptHandoffKey)
  ).toBeNull();
  expect(workspaceGenerations()).toBe(0);
});

test("an incoming prompt auto-submits once and shows a failed generation inline", async ({
  page,
}) => {
  const failure = "The demo could not generate this image. Please try again.";
  const { submittedPrompts } = await mockDemo(page, {
    status: "failed",
    error: failure,
  });
  const prompt = "Moonlight across a quiet lake";
  await page.goto(`${demoPath}?${new URLSearchParams({ prompt })}`);

  const main = page.getByRole("main");
  await expect(
    main.getByRole("textbox", { name: "Describe an image" })
  ).toHaveValue(prompt);
  await expect(main.getByRole("alert")).toContainText(failure);
  await expect(
    main.getByRole("button", { name: "Generate (free)", exact: true })
  ).toBeEnabled();
  expect(submittedPrompts).toEqual([prompt]);
  await expect(main.getByRole("link", { name: "Download image" })).toHaveCount(
    0
  );
});
