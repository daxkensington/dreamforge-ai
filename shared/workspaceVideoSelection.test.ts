import { describe, expect, it } from "vitest";
import { initialWorkspaceVideoModel, workspaceVideoSelectionError } from "./workspaceVideoSelection";
const catalog = [
  { id: "studio", creditCost: 200, requiredTier: "studio", isConfigured: true, supportedDurations: [5, 8] },
  { id: "paused", creditCost: 10, requiredTier: "creator", isConfigured: false, supportedDurations: [6] },
  { id: "creator", creditCost: 20, requiredTier: "creator", isConfigured: true, supportedDurations: [6] },
];
const valid = { catalog, catalogReady: true, planReady: true, userTier: "creator", modelId: "creator", duration: 6 };
describe("Workspace video eligibility", () => {
  it("selects only a configured model allowed by the user's plan", () => {
    expect(initialWorkspaceVideoModel(catalog, "creator")?.id).toBe("creator");
    expect(initialWorkspaceVideoModel(catalog, "free")).toBeUndefined();
    expect(catalog.map(model => model.id)).toEqual(["studio", "paused", "creator"]);
  });
  it("blocks legacy image/auto IDs, unavailable choices, plan denial, stale catalogs and unsupported durations", () => {
    expect(workspaceVideoSelectionError(valid)).toBeNull();
    for (const change of [{ modelId: "built-in-v1" }, { modelId: "paused" }, { modelId: "studio" }, { userTier: "free" }, { catalogReady: false }, { planReady: false }, { duration: 4 }]) {
      expect(workspaceVideoSelectionError({ ...valid, ...change })).toBeTypeOf("string");
    }
  });
});
