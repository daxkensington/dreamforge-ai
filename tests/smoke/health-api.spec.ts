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
  // Either a providers array or a structured response — minimum: it parses.
  expect(body).toBeTruthy();
});
