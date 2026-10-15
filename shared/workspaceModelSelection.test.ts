import { describe, expect, it } from "vitest";
import {
  getWorkspaceImageSelectionError,
  hasWorkspaceModelAccess,
  WORKSPACE_AUTO_IMAGE_MODEL,
  type WorkspaceImageModel,
  fingerprintGenerationInput,
  resolveGenerationRequestIdentity,
  readGenerationRequestIdentity,
  persistGenerationRequestIdentity,
  clearGenerationRequestIdentity,
  isTerminalGenerationResult,
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

describe("Generation retry identity", () => {
  const firstUuid = "11111111-1111-4111-8111-111111111111";
  const secondUuid = "22222222-2222-4222-8222-222222222222";
  const makeStorage = () => {
    const values = new Map<string, string>();
    return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  };

  it("uses a stable SHA-256 fingerprint without including requestId", async () => {
    const first = await fingerprintGenerationInput({ prompt: "private draft", width: 768, options: { style: "ink", strength: 1 } });
    const reordered = await fingerprintGenerationInput({ options: { strength: 1, style: "ink" }, width: 768, prompt: "private draft", requestId: firstUuid });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(reordered).toBe(first);
    expect(await fingerprintGenerationInput({ prompt: "edited draft", width: 768 })).not.toBe(first);
  });

  it("reuses one identity for unchanged retries and creates a new one for edits or another user", () => {
    const previous = resolveGenerationRequestIdentity(null, 7, "a".repeat(64), () => firstUuid);
    expect(resolveGenerationRequestIdentity(previous, 7, "a".repeat(64), () => secondUuid)).toBe(previous);
    expect(resolveGenerationRequestIdentity(previous, 7, "b".repeat(64), () => secondUuid).requestId).toBe(secondUuid);
    expect(resolveGenerationRequestIdentity(previous, 8, "a".repeat(64), () => secondUuid).requestId).toBe(secondUuid);
  });

  it("persists only scoped identity fields and recovers them across a remount", () => {
    const storage = makeStorage();
    const identity = resolveGenerationRequestIdentity(null, 7, "a".repeat(64), () => firstUuid);
    persistGenerationRequestIdentity(identity, storage);
    const raw = [...storage.values.values()][0];
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["fingerprint", "requestId", "userId"]);
    expect(readGenerationRequestIdentity(7, storage)).toEqual(identity);
    expect(readGenerationRequestIdentity(8, storage)).toBeNull();
  });

  it("clears a confirmed terminal identity without deleting a newer submission", () => {
    const storage = makeStorage();
    const first = resolveGenerationRequestIdentity(null, 7, "a".repeat(64), () => firstUuid);
    const second = resolveGenerationRequestIdentity(first, 7, "b".repeat(64), () => secondUuid);
    persistGenerationRequestIdentity(second, storage);
    clearGenerationRequestIdentity(first, storage);
    expect(readGenerationRequestIdentity(7, storage)).toEqual(second);
    clearGenerationRequestIdentity(second, storage);
    expect(readGenerationRequestIdentity(7, storage)).toBeNull();
    expect(resolveGenerationRequestIdentity(null, 7, "b".repeat(64), () => firstUuid).requestId).toBe(firstUuid);
  });

  it("ignores corrupt identities and tolerates unavailable session storage", () => {
    const storage = makeStorage();
    storage.setItem("dreamforgex:generation-request:7", JSON.stringify({ userId: 7, requestId: "invalid", fingerprint: "private draft" }));
    expect(readGenerationRequestIdentity(7, storage)).toBeNull();
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    const identity = resolveGenerationRequestIdentity(null, 7, "a".repeat(64), () => firstUuid);
    expect(readGenerationRequestIdentity(7, blocked)).toBeNull();
    expect(() => persistGenerationRequestIdentity(identity, blocked)).not.toThrow();
    expect(() => clearGenerationRequestIdentity(identity, blocked)).not.toThrow();
    expect(() => resolveGenerationRequestIdentity(null, 7, "private draft", () => firstUuid)).toThrow(/identity/);
    persistGenerationRequestIdentity({ ...identity, fingerprint: "private draft" }, storage);
    expect(storage.getItem("dreamforgex:generation-request:7")).not.toContain(firstUuid);
  });

  it("treats failure without a generation ID as terminal and preserves pending/unknown responses", () => {
    expect(isTerminalGenerationResult({ status: "failed" })).toBe(true);
    expect(isTerminalGenerationResult({ status: "completed" })).toBe(true);
    expect(isTerminalGenerationResult({ status: "generating" })).toBe(false);
    expect(isTerminalGenerationResult(undefined)).toBe(false);
  });
});
