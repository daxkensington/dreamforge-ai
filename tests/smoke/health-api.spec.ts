import { test, expect } from "./fixtures";

/**
 * API health smoke — confirms the public health and provider-status
 * endpoints are reachable and well-formed. These back the synthetic
 * uptime monitor; if their contract drifts, the monitor goes blind.
 */

test("/api/health returns ok and database check", async ({ request }) => {
  const res = await request.get("/api/health").catch(() => { throw new Error('Health GET failed (authorization headers withheld)'); });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(Array.isArray(body.checks)).toBe(true);
  const db = body.checks.find((c: { name: string }) => c.name === "db");
  expect(db, "db check missing from /api/health").toBeTruthy();
  expect(db.ok).toBe(true);
});

test("/api/status/providers returns provider list", async ({ request }) => {
  const res = await request.get("/api/status/providers").catch(() => { throw new Error('Provider status GET failed (authorization headers withheld)'); });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.mode).toBe("read-only-metadata");
  expect(body.generationReadiness).toBe("not-probed");
  expect(body.checks.map((c: { name: string }) => c.name)).toEqual(["runpod", "runpod-balance", "replicate", "fal", "runway", "kling"]);
  for (const check of body.checks) {
    expect(typeof check.configured).toBe("boolean");
    expect(check.readiness).toBe("not-probed");
  }
  expect(body.checks.find((c: { name: string }) => c.name === "runpod").probe).toBe("control-plane-metadata");
  const balance = body.checks.find((c: { name: string }) => c.name === "runpod-balance");
  expect(balance.probe).toBe("account-metadata");
  // The dollar amount is never published; only the band relative to the floor.
  expect(JSON.stringify(balance)).not.toMatch(/\d+\.\d{2,}/);
  // "all-healthy" is the literal ohwista's synthetic check matches on; the
  // aggregate is still metadata-only (generationReadiness stays not-probed).
  expect(body.summary).toMatch(/^(all-healthy|unconfigured|degraded:[a-z-]+(,[a-z-]+)*)$/);
});
