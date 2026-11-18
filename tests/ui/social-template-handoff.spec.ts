import { expect, test } from "@playwright/test";

const portraitTemplate = /Dance Trend/;
const details = "Add warm amber lights and leave the top clear for a title.";
const expectedPrompt = `Person dancing to a trending beat, dynamic camera angles, colorful lighting, high energy, viral dance trend style. Additional details: ${details}`;

for (const compatible of [
  {
    id: "runway-gen4.5",
    name: "Portrait video",
    durations: [5, 8],
    selected: 8,
  },
  {
    id: "fal-wan-video",
    name: "Short portrait video",
    durations: [5],
    selected: 5,
  },
]) {
  test(`social template keeps portrait framing and reviews the ${compatible.selected}s quote before generation`, async ({
    page,
  }) => {
    const submissions: unknown[] = [];
    const legacySubmissions: string[] = [];
    await page.route("**/api/trpc/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const names = decodeURIComponent(
        url.pathname.split("/").pop() ?? ""
      ).split(",");
      const batch = url.searchParams.get("batch") === "1";
      const input = request.method() === "POST" ? request.postDataJSON() : null;
      const values: Record<string, unknown> = {
        "auth.me": { id: 123, name: "Test user", email: "test@example.test" },
        "generation.videoModels": [
          {
            id: "cogvideo",
            name: "Fixed landscape",
            creditCost: 12,
            requiredTier: "free",
            isConfigured: true,
            supportedDurations: [6],
            supportedAspectRatios: [],
            outputInfo: "Fixed landscape output",
          },
          {
            id: compatible.id,
            name: compatible.name,
            creditCost: 40,
            requiredTier: "free",
            isConfigured: true,
            supportedDurations: compatible.durations,
            supportedAspectRatios: ["9:16"],
            outputInfo: "Portrait output",
          },
        ],
        "generation.imageModels": [],
        "generation.list": [],
        "training.list": [],
        "tags.list": [],
        "pricing.getCurrentSubscription": null,
        "uncensored.status": { active: false },
      };
      const results = names.map((name, index) => {
        if (name === "tools.textToVideo") legacySubmissions.push(name);
        const payload = batch ? input?.[index]?.json : input?.json;
        if (name === "generation.create") {
          submissions.push(payload);
          return {
            result: {
              data: {
                json: {
                  status: "generating",
                  mediaType: "video",
                  requestId: payload.requestId,
                },
              },
            },
          };
        }
        return { result: { data: { json: values[name] ?? null } } };
      });
      await route.fulfill({ json: batch ? results : results[0] });
    });

    await page.goto("/tools/social-templates");
    await page
      .getByRole("main")
      .getByRole("button", { name: portraitTemplate })
      .click();
    await page.getByLabel("Customize (optional)").fill(details);
    await page.getByRole("button", { name: "Open in Video Workspace" }).click();
    await expect(page).toHaveURL(/\/tools\/text-to-video$/);

    const main = page.getByRole("main");
    await expect(main.getByRole("tab", { name: "Video Clip" })).toHaveAttribute(
      "data-state",
      "active"
    );
    const prompt = main.getByPlaceholder(/^Describe a motion scene/);
    await expect(prompt).toHaveValue(expectedPrompt);
    await expect(main.getByRole("button", { name: /9:16/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(main.getByLabel("Video duration")).toContainText(
      `${compatible.selected} seconds`
    );
    await expect(
      main.getByText("40 credits per render.", { exact: false })
    ).toBeVisible();
    expect(submissions).toHaveLength(0);
    expect(legacySubmissions).toHaveLength(0);

    await main
      .getByRole("button", {
        name: `Generate ${compatible.selected}s Video Clip`,
      })
      .click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]).toMatchObject({
      prompt: expectedPrompt,
      mediaType: "video",
      modelVersion: compatible.id,
      width: 576,
      height: 1024,
      duration: compatible.selected,
      expectedCreditCost: 40,
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
    expect(legacySubmissions).toHaveLength(0);
  });
}
