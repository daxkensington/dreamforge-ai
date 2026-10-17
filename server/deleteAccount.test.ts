import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  cancel: vi.fn(),
  purge: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./stripe", () => ({
  cancelStripeSubscriptionsForCustomer: mocks.cancel,
}));
vi.mock("./_core/mediaLifecycle", async original => ({
  ...(await original<any>()),
  purgeRevokedMedia: mocks.purge,
  mediaRevocationQueries: mocks.revoke,
}));
import { deleteUserAccount } from "./_core/deleteAccount";
const dialect = new PgDialect();
let user: any, batch: any;

beforeEach(() => {
  vi.clearAllMocks();
  user = {
    id: 7,
    email: "fixture@example.test",
    loginMethod: "google",
    name: "Fixture",
  };
  mocks.cancel.mockResolvedValue(undefined);
  mocks.purge.mockResolvedValue({ deleted: 0, failed: 0 });
  mocks.revoke.mockReturnValue([sql`SELECT 'media-revocation-fixture'`]);
  batch = vi.fn(async () => []);
  mocks.getDb.mockResolvedValue({
    select: () => {
      let table: string;
      const q: any = {
        from: (t: any) => {
          table = t[Symbol.for("drizzle:Name")];
          return q;
        },
        where: () => q,
        innerJoin: () => q,
        limit: () => q,
        then: (resolve: any, reject: any) => {
          const rows =
            table === "users"
              ? [user]
              : table === "creditBalances"
                ? [{ stripeCustomerId: "cus_fixture" }]
                : table === "generations"
                  ? [
                      {
                        imageUrl:
                          "https://dreamforgex.ai/img/private/fixture.png",
                        fileKey: "private/fixture.png",
                      },
                    ]
                  : [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return q;
    },
    execute: (query: any) => query,
    batch,
  });
});

describe("deleteUserAccount transaction", () => {
  it("locks the owner and atomically scrubs content, shares, sessions and identity while retaining financial records", async () => {
    await deleteUserAccount(7);
    expect(batch).toHaveBeenCalledTimes(1);
    const statements = batch.mock.calls[0][0].map((query: any) =>
      dialect.sqlToQuery(query)
    );
    const text = statements.map((q: any) => q.sql).join("\n");
    expect(statements[0].sql).toContain("READ COMMITTED");
    expect(statements[1].sql).toContain("FOR UPDATE");
    for (const name of [
      "videoProjects",
      "projectShareTokens",
      "projectRevisions",
      "projectCollaborators",
      "projectChatMessages",
      "projectActivityLog",
      "audioGenerations",
      "galleryLikes",
      "galleryComments",
      "apiKeys",
      "auth_sessions",
      "auth_accounts",
      "auth_users",
    ])
      expect(text).toContain(name);
    expect(text).toContain("UPDATE generations SET prompt = '[deleted]'");
    expect(text).toContain("'account-deleted'");
    expect(text).toContain("UPDATE users SET name = 'Deleted user'");
    expect(text).not.toMatch(
      /DELETE FROM "(?:creditTransactions|generationRequests|generationBatchRequests)"/
    );
    expect(mocks.revoke.mock.calls[0][1]).toContain("private/fixture.png");
    expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      batch.mock.invocationCallOrder[0]
    );
    expect(mocks.purge.mock.invocationCallOrder[0]).toBeGreaterThan(
      batch.mock.invocationCallOrder[0]
    );
  });

  it("does not commit scrubbing when subscription cancellation fails", async () => {
    mocks.cancel.mockRejectedValueOnce(new Error("cancel unavailable"));
    await expect(deleteUserAccount(7)).rejects.toThrow("cancel unavailable");
    expect(batch).not.toHaveBeenCalled();
    expect(mocks.purge).not.toHaveBeenCalled();
  });

  it("propagates an atomic batch failure without scheduling a success purge", async () => {
    batch.mockRejectedValueOnce(new Error("transaction failed"));
    await expect(deleteUserAccount(7)).rejects.toThrow("transaction failed");
    expect(mocks.purge).not.toHaveBeenCalled();
  });

  it("retries cleanup idempotently for an already-deleted account", async () => {
    user = { id: 7, email: null, loginMethod: "deleted" };
    await deleteUserAccount(7);
    expect(batch).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.purge).toHaveBeenCalledWith(100, 7);
  });
});
