import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  retrieve: vi.fn(),
  sessions: vi.fn(),
  deduct: vi.fn(),
  listing: vi.fn(),
  owned: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./stripe", () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: mocks.retrieve },
    checkout: { sessions: { list: mocks.sessions } },
  }),
  deductCredits: mocks.deduct,
}));
vi.mock("./dbMarketplace", async original => ({
  ...(await original<any>()),
  getListingById: mocks.listing,
  hasPurchased: mocks.owned,
}));
import { marketplaceRouter } from "./routers/marketplace";
import {
  browseListings,
  getFeaturedListings,
  getListingDetail,
  getTopSellers,
  recordPurchase,
} from "./dbMarketplace";
const dialect = new PgDialect();
const paid = {
  buyerId: 8,
  listingId: 41,
  price: 5000,
  stripePaymentId: "pi_fixture",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.owned.mockResolvedValue(false);
  mocks.listing.mockResolvedValue({
    listing: { id: 41, sellerId: 7, price: 5000, status: "published" },
  });
  mocks.retrieve.mockResolvedValue({
    id: "pi_fixture",
    status: "succeeded",
    currency: "usd",
    amount_received: 5000,
  });
  mocks.sessions.mockResolvedValue({
    data: [
      {
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        currency: "usd",
        amount_total: 5000,
        client_reference_id: "8",
        metadata: {
          type: "marketplace_purchase",
          buyer_id: "8",
          listing_id: "41",
        },
      },
    ],
  });
});

describe("marketplace funding boundary", () => {
  it("rejects paid purchases with generation/free credits before deduction or seller accrual", async () => {
    const caller = marketplaceRouter.createCaller({
      user: { id: 8, role: "user" } as any,
      session: null,
      ip: "127.0.0.1",
    });
    await expect(
      caller.purchase({ listingId: 41, paymentMethod: "credits" })
    ).rejects.toThrow(/card payment/);
    expect(mocks.deduct).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("requires settled payment evidence before touching the database", async () => {
    await expect(
      recordPurchase({ ...paid, stripePaymentId: undefined })
    ).rejects.toThrow(/settled cash/);
    mocks.retrieve.mockResolvedValueOnce({
      id: "pi_fixture",
      status: "processing",
      currency: "usd",
      amount_received: 5000,
    });
    await expect(recordPurchase(paid)).rejects.toThrow(/not settled/);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each([{ currency: "eur" }, { amount_received: 1 }, { id: "pi_other" }])(
    "refuses a settled payment with mismatched receipt %j",
    async change => {
      mocks.retrieve.mockResolvedValueOnce({
        id: "pi_fixture",
        status: "succeeded",
        currency: "usd",
        amount_received: 5000,
        ...change,
      });
      await expect(recordPurchase(paid)).rejects.toThrow(/not settled/);
      expect(mocks.getDb).not.toHaveBeenCalled();
    }
  );

  it.each([
    { payment_status: "unpaid" },
    { amount_total: 1 },
    { currency: "eur" },
    { client_reference_id: "9" },
    {
      metadata: {
        type: "marketplace_purchase",
        buyer_id: "8",
        listing_id: "42",
      },
    },
  ])(
    "binds cash settlement to the exact paid checkout, buyer and listing %j",
    async change => {
      const base = (await mocks.sessions()).data[0];
      mocks.sessions.mockResolvedValueOnce({ data: [{ ...base, ...change }] });
      await expect(recordPurchase(paid)).rejects.toThrow(/does not match/);
      expect(mocks.getDb).not.toHaveBeenCalled();
    }
  );
});

describe("public marketplace projections", () => {
  function database(rows: any[][]) {
    const selected: any[] = [],
      conditions: any[] = [];
    mocks.getDb.mockResolvedValue({
      select: (fields: any) => {
        selected.push(fields);
        const q: any = {
          from: () => q,
          innerJoin: () => q,
          where: (condition: any) => {
            conditions.push(condition);
            return q;
          },
          orderBy: () => q,
          limit: () => q,
          offset: () => q,
          then: (resolve: any, reject: any) =>
            Promise.resolve(rows.shift() ?? []).then(resolve, reject),
        };
        return q;
      },
    });
    return { selected, conditions };
  }
  const publicListing = {
    id: 41,
    sellerId: 7,
    price: 1000,
    title: "Public preview",
  };
  function expectPublic(fields: any) {
    expect(fields).toHaveProperty("title");
    expect(fields).not.toHaveProperty("promptData");
    expect(fields).not.toHaveProperty("listing");
    expect(Object.values(fields)).not.toContain(undefined);
  }

  it("anonymous browse and featured select public columns only, never whole listing rows", async () => {
    const browse = database([[{ total: 1 }], [publicListing]]);
    expect((await browseListings({})).items).toEqual([publicListing]);
    expectPublic(browse.selected[1]);
    const featured = database([[publicListing]]);
    await getFeaturedListings();
    expectPublic(featured.selected[0]);
  });

  it("detail excludes drafts at the query boundary and allowlists seller/review data", async () => {
    const db = database([[publicListing], [{ displayName: "Seller" }], []]);
    const detail = await getListingDetail(41);
    expect(detail?.title).toBe("Public preview");
    expectPublic(db.selected[0]);
    const filter = dialect.sqlToQuery(db.conditions[0]);
    expect(filter.params).toContain("published");
    expect(filter.params).toContain(41);
    expect(db.selected[1]).not.toHaveProperty("payoutBalance");
    expect(db.selected[1]).not.toHaveProperty("totalEarnings");
    expect(db.selected[1]).not.toHaveProperty("stripeConnectId");
    expect(db.selected[2]).not.toHaveProperty("review");
    database([[]]);
    const anonymous = marketplaceRouter.createCaller({
      user: null,
      session: null,
      ip: "127.0.0.1",
    });
    await expect(anonymous.getListingDetail({ id: 41 })).rejects.toThrow(
      /not found/
    );
  });

  it("public top sellers exclude financial and Stripe account fields", async () => {
    const db = database([[{ id: 5, displayName: "Seller", userName: "User" }]]);
    await getTopSellers();
    expect(db.selected[0]).not.toHaveProperty("profile");
    expect(db.selected[0]).not.toHaveProperty("payoutBalance");
    expect(db.selected[0]).not.toHaveProperty("stripeConnectId");
    expect(db.selected[0]).not.toHaveProperty("totalEarnings");
  });
});
