import { describe, expect, it } from "vitest";
import { smokeAuthContract, smokeTarget } from "../shared/smoke-target.mjs";
import { CANONICAL_AUTH_PATHS, checkCanonicalAuth, gitBlobId } from "../scripts/check-canonical-auth.mjs";

const revision = "a".repeat(40), treeSha = "b".repeat(40);
const previewOrigin = "https://dreamforgex-example-englandsfinest.vercel.app";
const target = smokeTarget(previewOrigin);
const bytes = Buffer.from("unchanged auth source\n");
const uiPath = "app/auth/signin/page.tsx";
const materialPaths = ["middleware.ts", "client/src/lib/auth.ts", "shared/returnTo.ts"];

function transport(change: (value: any, call: number) => any = value => value) {
  const calls: { url: string; options: RequestInit }[] = [], sourceReads: string[] = [];
  const fetcher = async (url: string, options: RequestInit) => {
    calls.push({ url, options });
    const value = url.includes("/git/commits/") ? { sha: revision, tree: { sha: treeSha } }
      : url.includes("/git/trees/") ? { sha: treeSha, truncated: false, tree: CANONICAL_AUTH_PATHS.map(path => ({ path, type: "blob", mode: "100644", sha: gitBlobId(bytes) })) }
      : { ref: "refs/heads/main", object: { type: "commit", sha: revision } };
    return new Response(JSON.stringify(change(value, calls.length)), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { calls, sourceReads, fetcher, readSource: async (path: string) => { sourceReads.push(path); return path === uiPath ? Buffer.from("intentional reviewed retry UI\n") : bytes; } };
}

describe("auth source claims selected from the validated expected origin", () => {
  it("retains all four source pins for the canonical production auth target", async () => {
    const canonicalTarget = smokeTarget("https://dreamforgex.ai");
    const t = transport();
    await expect(checkCanonicalAuth({ ...t, target: canonicalTarget, authOrigin: "https://dreamforgex.ai" })).rejects.toThrow(/differs/);
    expect(t.sourceReads).toContain(uiPath);
    const result = await checkCanonicalAuth({ ...transport(), target: canonicalTarget, authOrigin: "https://dreamforgex.ai", readSource: async () => bytes });
    expect(result.pins.map(row => row.path)).toEqual(["middleware.ts", "client/src/lib/auth.ts", uiPath, "shared/returnTo.ts"]);
    expect(result).toMatchObject({ authMode: "canonical", expectedAuthOrigin: "https://dreamforgex.ai", canonicalMainAuthSourceMatchesCandidate: true, signInUiSourceCompared: true, previewUiBehaviorAcceptanceRequired: false });
  });

  it("permits an intentional UI difference only when the preview exercises its own exact origin", async () => {
    const t = transport();
    const result = await checkCanonicalAuth({ ...t, target, authOrigin: previewOrigin });
    expect(t.sourceReads).toEqual(materialPaths);
    expect(result.pins.map(row => row.path)).toEqual(materialPaths);
    expect(result).toMatchObject({ authMode: "own-origin-preview", expectedAuthOrigin: previewOrigin, canonicalMainAuthSourceMatchesCandidate: null, canonicalMainMaterialAuthSourceMatchesCandidate: true, signInUiSourceCompared: false, previewUiBehaviorAcceptanceRequired: true });
    expect(t.calls).toHaveLength(4);
    for (const call of t.calls) {
      expect(new URL(call.url).origin).toBe("https://api.github.com");
      expect(call.options.method).toBe("GET");
      expect(call.options.redirect).toBe("manual");
      expect(Object.keys(call.options.headers!)).not.toContain("Authorization");
    }
  });

  it.each(materialPaths)("still rejects own-origin preview material drift in %s", async path => {
    await expect(checkCanonicalAuth({ ...transport(), target, authOrigin: previewOrigin, readSource: async p => p === path ? Buffer.from("material drift\n") : bytes })).rejects.toThrow(/differs/);
  });

  it.each(["preview", "own-origin-preview", "", null, "https://dreamforgex.ai", "https://dreamforgex-other-englandsfinest.vercel.app", previewOrigin + "/path", previewOrigin + "?mode=preview"])("rejects an unknown or mismatched expected auth origin %s before public reads", async authOrigin => {
    const t = transport();
    await expect(checkCanonicalAuth({ ...t, target, authOrigin: authOrigin as string })).rejects.toThrow();
    expect(t.calls).toHaveLength(0);
  });

  it("does not derive a UI exemption from an untrusted target or a public origin", async () => {
    for (const unsafe of [{ origin: "https://attacker.example", protectedTarget: true }, smokeTarget("https://dreamforgex.ai")]) {
      const t = transport();
      await expect(checkCanonicalAuth({ ...t, target: unsafe, authOrigin: previewOrigin })).rejects.toThrow();
      expect(t.calls).toHaveLength(0);
    }
    expect(smokeAuthContract(target.origin)).toEqual({ mode: "own-origin-preview", origin: previewOrigin });
    expect(smokeAuthContract("https://dreamforgex.ai")).toEqual({ mode: "canonical", origin: "https://dreamforgex.ai" });
    const omittedExpectedOrigin = transport();
    await expect(checkCanonicalAuth({ ...omittedExpectedOrigin, target })).rejects.toThrow(/Explicit auth expectation/);
    expect(omittedExpectedOrigin.calls).toHaveLength(0);
  });

  it("retains own-origin immutable-tree and concurrent-main guards", async () => {
    const changes = [
      (value: any, call: number) => call === 3 ? { ...value, truncated: true } : value,
      (value: any, call: number) => call === 3 ? { ...value, tree: value.tree.filter((row: any) => row.path !== materialPaths[0]) } : value,
      (value: any, call: number) => call === 3 ? { ...value, tree: value.tree.map((row: any) => ({ ...row, mode: "120000" })) } : value,
      (value: any, call: number) => call === 4 ? { ...value, object: { type: "commit", sha: "c".repeat(40) } } : value,
    ];
    for (const change of changes) await expect(checkCanonicalAuth({ ...transport(change), target, authOrigin: previewOrigin })).rejects.toThrow();
  });
});
