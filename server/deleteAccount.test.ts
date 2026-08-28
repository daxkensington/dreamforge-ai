import { describe, it, expect, vi, beforeEach } from "vitest";

const state: { user: any; updates: any[]; deletes: string[] } = {
  user: { id: 7, email: "u@x.com", loginMethod: "google", name: "Ian" },
  updates: [],
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
    update: () => ({
      set: (v: any) => ({
        where: async () => {
          state.updates.push(v);
        },
      }),
    }),
    delete: (table: any) => ({
      where: async () => {
        state.deletes.push(String(table));
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

  it("refuses a second delete", async () => {
    state.user = { id: 7, email: null, loginMethod: "deleted" };
    await expect(deleteUserAccount(7)).rejects.toThrow(/already deleted/i);
  });
});
