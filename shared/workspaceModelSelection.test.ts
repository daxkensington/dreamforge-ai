import { describe, expect, it } from "vitest";
import {
  getWorkspaceImageSelectionError,
  hasWorkspaceModelAccess,
  WORKSPACE_AUTO_IMAGE_MODEL,
  type WorkspaceImageModel,
} from "./workspaceModelSelection";

const catalog: WorkspaceImageModel[] = [
  { id: WORKSPACE_AUTO_IMAGE_MODEL, name: "Auto", provider: "auto", creditCost: 5, requiredTier: "free", isConfigured: true, maxResolution: { width: 1536, height: 1536 } },
  { id: "flux-pro", name: "Flux Pro", provider: "replicate", creditCost: 15, requiredTier: "pro", isConfigured: true, maxResolution: { width: 1440, height: 1440 } },
];
const request = { modelId: "flux-pro", catalog, catalogReady: true, userTier: "pro", planReady: true, width: 768, height: 768 };

describe("Workspace catalog submission checks", () => {
  it("keeps legacy Auto usable while the catalog loads or fails", () => {
    expect(getWorkspaceImageSelectionError({ ...request, modelId: WORKSPACE_AUTO_IMAGE_MODEL, catalog: undefined, catalogReady: false, planReady: false })).toBeNull();
  });

  it("fails closed for explicit choices while catalog or plan metadata is unavailable", () => {
    expect(getWorkspaceImageSelectionError({ ...request, catalogReady: false })).toMatch(/Refresh/);
    expect(getWorkspaceImageSelectionError({ ...request, planReady: false })).toMatch(/subscription/);
  });

  it("blocks removed and newly unconfigured selections after a refresh", () => {
    expect(getWorkspaceImageSelectionError({ ...request, catalog: catalog.slice(0, 1) })).toMatch(/no longer available/);
    expect(getWorkspaceImageSelectionError({ ...request, catalog: catalog.map((model) => ({ ...model, isConfigured: false })) })).toMatch(/unavailable/);
    expect(getWorkspaceImageSelectionError({ ...request, modelId: WORKSPACE_AUTO_IMAGE_MODEL, catalog: catalog.map((model) => ({ ...model, isConfigured: false })) })).toMatch(/unavailable/);
  });

  it("checks required tier and both dimensions without changing a valid request", () => {
    expect(getWorkspaceImageSelectionError(request)).toBeNull();
    expect(getWorkspaceImageSelectionError({ ...request, userTier: "creator" })).toMatch(/Pro/);
    expect(getWorkspaceImageSelectionError({ ...request, width: 1536 })).toMatch(/1440/);
    expect(getWorkspaceImageSelectionError({ ...request, height: 1536 })).toMatch(/1440/);
    expect(getWorkspaceImageSelectionError({ ...request, modelId: WORKSPACE_AUTO_IMAGE_MODEL, userTier: "free", width: 1536 })).toMatch(/supports images up to 1024/);
  });

  it("uses canonical plan ordering and rejects unknown requirements", () => {
    expect(hasWorkspaceModelAccess("enterprise", "studio")).toBe(true);
    expect(hasWorkspaceModelAccess("free", "pro")).toBe(false);
    expect(hasWorkspaceModelAccess("agency", "future-tier")).toBe(false);
  });

  it("rejects fractional and out-of-bounds dimensions even before Auto metadata loads", () => {
    for (const width of [255, 1537, 768.5]) {
      expect(getWorkspaceImageSelectionError({ ...request, modelId: WORKSPACE_AUTO_IMAGE_MODEL, catalogReady: false, width })).toMatch(/whole-pixel/);
    }
    expect(getWorkspaceImageSelectionError({ ...request, modelId: WORKSPACE_AUTO_IMAGE_MODEL, catalogReady: false, userTier: "free", width: 1536 })).toMatch(/supports images up to 1024/);
    expect(getWorkspaceImageSelectionError({ ...request, modelId: WORKSPACE_AUTO_IMAGE_MODEL, catalogReady: false, planReady: false, width: 1536 })).toMatch(/supports images up to 1024/);
  });
});
