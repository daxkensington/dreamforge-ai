import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
describe("private bucket public-access verification", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key,value] of Object.entries({ R2_ACCOUNT_ID: "a".repeat(32), R2_BUCKET_NAME: "public-fixture", R2_ACCESS_KEY_ID: "fixture-public-key", R2_SECRET_ACCESS_KEY: "fixture-public-secret", R2_PRIVATE_BUCKET_NAME: "private-fixture", R2_PRIVATE_ACCESS_KEY_ID: "fixture-private-key", R2_PRIVATE_SECRET_ACCESS_KEY: "fixture-private-secret", R2_PRIVATE_READ_TOKEN: "fixture-read-only-management-token" })) vi.stubEnv(key,value);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const ok = (result: unknown) => Response.json({ success: true, result });
  const safeFetch = () => vi.fn(async (url: string) => ok(url.endsWith("/managed") ? { enabled: false } : { domains: [] }));
  it("requires an explicit distinct bucket and separate private credentials before any network request", async () => {
    const fetch = safeFetch(); vi.stubGlobal("fetch",fetch); const helper=await import("./privateStorage");
    expect(helper.privateStorageConfigured()).toBe(true);
    for (const [key,value] of [["R2_PRIVATE_BUCKET_NAME",""],["R2_PRIVATE_BUCKET_NAME","public-fixture"],["R2_PRIVATE_ACCESS_KEY_ID","fixture-public-key"],["R2_PRIVATE_SECRET_ACCESS_KEY","fixture-public-secret"],["R2_PRIVATE_READ_TOKEN",""]] as const) {
      const prior=process.env[key]!; vi.stubEnv(key,value); expect(helper.privateStorageConfigured()).toBe(false); await expect(helper.assertPrivateStorage()).rejects.toThrow("Private media is temporarily unavailable"); vi.stubEnv(key,prior);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks both independent Cloudflare public-access methods on the fixed management origin", async () => {
    const fetch=safeFetch();vi.stubGlobal("fetch",fetch); const helper=await import("./privateStorage");
    expect(await helper.assertPrivateStorage()).toMatchObject({bucket:"private-fixture"}); expect(fetch).toHaveBeenCalledTimes(2);
    for (const [url,options] of fetch.mock.calls as unknown as [string,RequestInit][]) {
      expect(new URL(url).origin).toBe("https://api.cloudflare.com"); expect(url).toMatch(/\/domains\/(managed|custom)$/);
      expect(options).toMatchObject({method:"GET",redirect:"error",cache:"no-store",headers:{Authorization:"Bearer fixture-read-only-management-token"}});
    }
  });
  it.each([{enabled:true},{}, {enabled:null}])("fails closed for enabled or unknown r2.dev settings: %j", async managed => {
    vi.stubGlobal("fetch",vi.fn(async (url:string)=>ok(url.endsWith("/managed")?managed:{domains:[]})));
    expect(await (await import("./privateStorage")).privateStorageAvailable()).toBe(false);
  });
  it.each([{domains:[{enabled:true}]},{domains:[{}]},{domains:null},{}])("fails closed for enabled or unknown custom domains: %j",async custom=>{
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>ok(url.endsWith("/managed")?{enabled:false}:custom)));
    expect(await(await import("./privateStorage")).privateStorageAvailable()).toBe(false);
  });
  it("deduplicates concurrent checks and expires the brief success cache",async()=>{
    vi.useFakeTimers(); const fetch=safeFetch();vi.stubGlobal("fetch",fetch); const helper=await import("./privateStorage");
    await Promise.all(Array.from({length:20},()=>helper.assertPrivateStorage()));expect(fetch).toHaveBeenCalledTimes(2);
    await helper.assertPrivateStorage();expect(fetch).toHaveBeenCalledTimes(2);vi.setSystemTime(Date.now()+30001);await helper.assertPrivateStorage();expect(fetch).toHaveBeenCalledTimes(4);
    vi.stubEnv("R2_PRIVATE_BUCKET_NAME","another-private-fixture"); await helper.assertPrivateStorage();expect(fetch).toHaveBeenCalledTimes(6);
  });
  it("briefly caches failures to prevent public policy polling from hammering Cloudflare",async()=>{
    vi.useFakeTimers(); const fetch=vi.fn(async()=>ok({enabled:true}));vi.stubGlobal("fetch",fetch);const helper=await import("./privateStorage");
    expect(await helper.privateStorageAvailable()).toBe(false); expect(await helper.privateStorageAvailable()).toBe(false);expect(fetch).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now()+5001);fetch.mockImplementation(safeFetch());expect(await helper.privateStorageAvailable()).toBe(true);expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("fails closed on HTTP, transport, malformed or oversized responses without returning provider body details",async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response("fixture-sensitive-response-body",{status:403}));vi.stubGlobal("fetch",fetch);let helper=await import("./privateStorage");
    await expect(helper.assertPrivateStorage()).rejects.toThrow(/^Private media is temporarily unavailable\./);
    vi.resetModules();fetch.mockRejectedValue(new Error("fixture-sensitive-token-error"));helper=await import("./privateStorage");await expect(helper.assertPrivateStorage()).rejects.not.toThrow("fixture-sensitive-token-error");
    vi.resetModules();fetch.mockImplementation(async()=>new Response("x".repeat(65537)));helper=await import("./privateStorage");await expect(helper.assertPrivateStorage()).rejects.toThrow("Private media is temporarily unavailable");
    vi.resetModules();fetch.mockImplementation(async()=>new Response("not JSON"));helper=await import("./privateStorage");expect(await helper.privateStorageAvailable()).toBe(false);
  });
});
