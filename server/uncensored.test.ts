import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const dbState: { user: any; inserted: any[] } = { user: null, inserted: [] };

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (dbState.user ? [dbState.user] : []) }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async (v: any) => { dbState.inserted.push(v); } }),
  })),
}));

vi.mock("./_core/btcpay", async (orig) => {
  const actual = await orig<typeof import("./_core/btcpay")>();
  return {
    ...actual,
    isBtcpayConfigured: vi.fn(() => true),
    createUncensoredInvoice: vi.fn(async () => ({ invoiceId: "inv_123", checkoutLink: "https://btc.example/i/inv_123" })),
  };
});

import { uncensoredRouter } from "./routers/uncensored";
import { verifyBTCPayWebhook, UNCENSORED_PLAN } from "./_core/btcpay";
import { isBtcpayConfigured } from "./_core/btcpay";

const ctx = (overrides?: any) => ({ user: { id: 7, email: "u@x.com" }, session: null, ...overrides });

describe("uncensored.status", () => {
  beforeEach(() => { dbState.user = null; dbState.inserted = []; vi.clearAllMocks(); });

  it("reports inactive when no entitlement", async () => {
    dbState.user = { uncensoredUntil: null, ageConfirmedAt: null };
    const res = await uncensoredRouter.createCaller(ctx()).status();
    expect(res.active).toBe(false);
    expect(res.ageConfirmed).toBe(false);
    expect(res.plan.id).toBe(UNCENSORED_PLAN.id);
  });

  it("reports active when entitlement is in the future", async () => {
    dbState.user = { uncensoredUntil: new Date(Date.now() + 864e5), ageConfirmedAt: new Date() };
    const res = await uncensoredRouter.createCaller(ctx()).status();
    expect(res.active).toBe(true);
    expect(res.ageConfirmed).toBe(true);
  });

  it("reports inactive when entitlement has expired", async () => {
    dbState.user = { uncensoredUntil: new Date(Date.now() - 1000), ageConfirmedAt: new Date() };
    const res = await uncensoredRouter.createCaller(ctx()).status();
    expect(res.active).toBe(false);
  });
});

describe("uncensored.createCheckout", () => {
  beforeEach(() => { dbState.user = null; dbState.inserted = []; vi.clearAllMocks(); });

  it("blocks checkout until age is confirmed", async () => {
    dbState.user = { uncensoredUntil: null, ageConfirmedAt: null };
    await expect(uncensoredRouter.createCaller(ctx()).createCheckout()).rejects.toThrow(/age/i);
    expect(dbState.inserted).toHaveLength(0);
  });

  it("creates an invoice + records it once age is confirmed", async () => {
    dbState.user = { uncensoredUntil: null, ageConfirmedAt: new Date() };
    const res = await uncensoredRouter.createCaller(ctx()).createCheckout();
    expect(res.checkoutLink).toContain("inv_123");
    expect(dbState.inserted[0]).toMatchObject({ userId: 7, invoiceId: "inv_123", plan: UNCENSORED_PLAN.id, status: "new" });
  });

  it("refuses checkout when BTCPay is not configured", async () => {
    (isBtcpayConfigured as any).mockReturnValue(false);
    dbState.user = { uncensoredUntil: null, ageConfirmedAt: new Date() };
    await expect(uncensoredRouter.createCaller(ctx()).createCheckout()).rejects.toThrow(/unavailable/i);
    (isBtcpayConfigured as any).mockReturnValue(true);
  });
});

describe("verifyBTCPayWebhook", () => {
  const secret = "test-webhook-secret";
  beforeEach(() => { process.env.BTCPAY_WEBHOOK_SECRET = secret; });

  const sign = (body: string) => "sha256=" + crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(body).digest("hex");

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ type: "InvoiceSettled", invoiceId: "inv_123" });
    expect(verifyBTCPayWebhook(body, sign(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ type: "InvoiceSettled", invoiceId: "inv_123" });
    const sig = sign(body);
    expect(verifyBTCPayWebhook(JSON.stringify({ type: "InvoiceSettled", invoiceId: "inv_OTHER" }), sig)).toBe(false);
  });

  it("rejects a malformed signature header without throwing", () => {
    const body = "{}";
    expect(verifyBTCPayWebhook(body, "sha256=zzz")).toBe(false);
    expect(verifyBTCPayWebhook(body, "garbage")).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    delete process.env.BTCPAY_WEBHOOK_SECRET;
    expect(verifyBTCPayWebhook("{}", "sha256=abc")).toBe(false);
  });
});
