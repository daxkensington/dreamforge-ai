import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import { getDb } from "../db";
import { allocatePaidSubscriptionInvoice } from "./subscriptionBilling";

vi.mock("../db", () => ({ getDb: vi.fn() }));

const mapping = {
  invoiceId: "in_adapter", subscriptionId: "sub_adapter",
  subscriptionItemId: "si_adapter", priceId: "price_adapter",
  periodStart: new Date("2026-10-01T00:00:00Z"), periodEnd: new Date("2026-11-01T00:00:00Z"),
};

type Query = { text: string; params: unknown[]; options: unknown; then: (resolve: (value: unknown) => unknown, reject: (error: Error) => unknown) => unknown };

/** Real installed Drizzle adapter; only the Neon transport is an inert test double. */
function adapter(receipts: unknown[][] = [[]]) {
  const standalone: string[] = [];
  let receiptIndex = 0;
  const client: any = vi.fn((text: string, params: unknown[], options: unknown): Query => ({
    text, params, options,
    then(resolve, reject) {
      standalone.push(text);
      if (!text.includes('SELECT w.id FROM "webhookEvents"')) return reject(new Error("Batch query was executed independently."));
      return resolve({ rows: receipts[Math.min(receiptIndex++, receipts.length - 1)] });
    },
  }));
  client.transaction = vi.fn(async (_queries: Query[], _options: unknown) => [
    { rows: [] }, { rows: [{ id: 1 }] }, { rows: [{ id: 2 }] },
  ]);
  vi.mocked(getDb).mockResolvedValue(drizzle(client));
  return { client, standalone };
}

describe("subscription invoice installed Neon HTTP adapter contract", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("sends isolation, wallet lock and allocation as one lazy static transaction", async () => {
    const { client, standalone } = adapter();
    await expect(allocatePaidSubscriptionInvoice(mapping)).resolves.toBe("allocated");

    expect(client.transaction).toHaveBeenCalledTimes(1);
    const [queries, options] = client.transaction.mock.calls[0] as [Query[], unknown];
    expect(queries).toHaveLength(3);
    expect(queries[0].text).toBe("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    expect(queries[1].text).toContain("FOR UPDATE OF cb");
    expect(queries[1].params).toEqual([mapping.subscriptionId]);
    expect(queries[2].text).toContain('us."subStatus" IN (\'active\', \'trialing\')');
    expect(queries[2].text).toContain('SELECT "userSubscriptions".id');
    expect(queries[2].text).toContain("statement_timestamp() AT TIME ZONE 'UTC'");
    expect(queries[2].text).toContain("internal.subscription.period_allocation");
    expect(queries[2].text).toContain("internal.subscription.invoice_allocation");
    expect(queries.every(query => client.mock.results.some((result: any) => result.value === query))).toBe(true);
    expect(queries.map(query => query.options)).toEqual(Array(3).fill({ fullResults: true, arrayMode: false }));
    expect(options).toEqual({ fullResults: true, arrayMode: true });
    expect(standalone).toHaveLength(1);
    expect(standalone[0]).toContain('SELECT w.id FROM "webhookEvents"');
  });

  it("returns an exact prior invoice receipt without starting a new transaction", async () => {
    const { client } = adapter([[{ id: 2 }]]);
    await expect(allocatePaidSubscriptionInvoice(mapping)).resolves.toBe("duplicate");
    expect(client.transaction).not.toHaveBeenCalled();
  });

  it("holds a rejected current-subscription admission without a weaker fallback", async () => {
    const { client, standalone } = adapter();
    client.transaction.mockResolvedValueOnce([{ rows: [] }, { rows: [{ id: 1 }] }, { rows: [] }]);
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow("reconcile before retrying");
    expect(client.transaction).toHaveBeenCalledTimes(1);
    expect(standalone).toHaveLength(1);
  });

  it("propagates an atomic batch failure without individually retrying its mutations", async () => {
    const { client, standalone } = adapter();
    client.transaction.mockRejectedValueOnce(new Error("atomic transport unavailable"));
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow("atomic transport unavailable");
    expect(client.transaction).toHaveBeenCalledTimes(1);
    expect(standalone).toHaveLength(1);
  });

  it("fresh-reads the exact receipt after a concurrent invoice uniqueness collision", async () => {
    const { client, standalone } = adapter([[], [{ id: 2 }]]);
    client.transaction.mockRejectedValueOnce(Object.assign(new Error("duplicate receipt"), { code: "23505" }));
    await expect(allocatePaidSubscriptionInvoice(mapping)).resolves.toBe("duplicate");
    expect(client.transaction).toHaveBeenCalledTimes(1);
    expect(standalone).toHaveLength(2);
  });
});
