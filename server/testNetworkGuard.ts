import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
if (process.env.TEST_LIVE_DB !== "true") {
  const local = (input: any) => {
    try {
      const host = typeof input === "string" || input instanceof URL ? new URL(input).hostname
        : input?.url ? new URL(input.url).hostname : String(input?.hostname ?? input?.host ?? "").replace(/:\d+$/, "");
      return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
    } catch { return false; }
  };
  const deny = () => { throw new Error("External HTTP requests are prohibited in unit tests."); };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, options: any) => local(input) ? originalFetch(input, options) : deny()) as typeof fetch;
  for (const module of [http, https]) {
    const request = module.request;
    const get = module.get;
    module.request = ((...args: any[]) => local(args[0]) ? (request as any)(...args) : deny()) as never;
    module.get = ((...args: any[]) => local(args[0]) ? (get as any)(...args) : deny()) as never;
  }
  syncBuiltinESMExports();
}
