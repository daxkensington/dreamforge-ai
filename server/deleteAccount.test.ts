import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { generationRequests, generations } from "../drizzle/schema";

const state: { user: any; updates: any[]; updateCalls: { table: any; values: any; where: any }[]; deletes: string[] } = {
  user: { id: 7, email: "u@x.com", loginMethod: "google", name: "Ian" },
  updates: [],
  updateCalls: [],
  deletes: [],
};

function chain(result: any = []) {
  const c: any = {
    from: () => c,
    where: () => c,
    limit: async () => result,
    set: (v: any) => {
      state.updates.push(v);
      return c;
    },
    then: undefined,
  };
  return c;
}

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => {
            const name = table?.name ?? table?.[Symbol.for("drizzle:Name")];
            if (String(name).includes("credit") || table === "creditBalances") return [{ stripeCustomerId: null }];
            return state.user ? [state.user] : [];
          },
        }),
      }),
    }),
    update: (table: any) => ({
      set: (v: any) => ({
        where: async (where: any) => {
          state.updates.push(v);
          state.updateCalls.push({ table, values: v, where });
        },
      }),
    }),
    delete: (table: any) => ({
      where: async () => {
        state.deletes.push(String(table?.[Symbol.for("drizzle:Name")] ?? table));
      },
    }),
  })),
}));

vi.mock("./stripe", () => ({
  cancelStripeSubscriptionsForCustomer: vi.fn(async () => undefined),
}));

import { deleteUserAccount } from "./_core/deleteAccount";

describe("deleteUserAccount", () => {
  beforeEach(() => {
    state.user = { id: 7, email: "u@x.com", loginMethod: "google", name: "Ian" };
    state.updates = [];
    state.updateCalls = [];
    state.deletes = [];
  });

  it("anonymises the user so they cannot sign back in", async () => {
    await deleteUserAccount(7);
    const userUpdate = state.updates.find((u) => u.loginMethod === "deleted");
    expect(userUpdate).toBeTruthy();
    expect(userUpdate.email).toBeNull();
    expect(userUpdate.name).toBe("Deleted user");
    expect(String(userUpdate.openId)).toMatch(/^deleted:7:/);
  });

  it("scrubs generation prompts", async () => {
    await deleteUserAccount(7);
    expect(state.updates.some((u) => u.prompt === "[deleted]")).toBe(true);
  });

  it("fences pending requests and scrubs replay assets before generation links while retaining the ledger", async () => {
    await deleteUserAccount(7);
    const requestUpdate = state.updateCalls.find((call) => call.table === generationRequests);
    const generationUpdate = state.updateCalls.find((call) => call.table === generations);
    expect(requestUpdate).toBeTruthy();
    expect(state.updateCalls.indexOf(requestUpdate!)).toBeLessThan(state.updateCalls.indexOf(generationUpdate!));

    const dialect = new PgDialect();
    const stateQuery = dialect.sqlToQuery(requestUpdate!.values.state);
    expect(stateQuery.sql).toBe('CASE WHEN "generationRequests"."state" IN (\'reserved\', \'rendering\') THEN \'reconciliation\' ELSE "generationRequests"."state" END');
    const errorQuery = dialect.sqlToQuery(requestUpdate!.values.errorCode);
    expect(errorQuery.sql).toBe('CASE WHEN "generationRequests"."state" IN (\'reserved\', \'rendering\', \'reconciliation\') THEN \'account-deleted\' ELSE "generationRequests"."errorCode" END');
    const resultQuery = dialect.sqlToQuery(requestUpdate!.values.result);
    expect(resultQuery.sql).toBe('CASE WHEN "generationRequests"."result" IS NULL THEN NULL ELSE $1::text::jsonb END');
    expect(resultQuery.params).toEqual([JSON.stringify({ deleted: true })]);
    expect(dialect.sqlToQuery(requestUpdate!.where).params).toEqual([7]);
    expect(requestUpdate!.values.updatedAt).toBeInstanceOf(Date);
    expect(state.deletes.some((table) => /generationRequests|creditTransactions/.test(table))).toBe(false);
  });

  it("refuses a second delete", async () => {
    state.user = { id: 7, email: null, loginMethod: "deleted" };
    await expect(deleteUserAccount(7)).rejects.toThrow(/already deleted/i);
  });
});
