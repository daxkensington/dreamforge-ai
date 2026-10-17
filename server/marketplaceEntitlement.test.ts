import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  checkout: vi.fn(),
  transfer: vi.fn(),
  account: vi.fn(),
  listing: vi.fn(),
  owned: vi.fn(),
  createListing: vi.fn(),
  updateListing: vi.fn(),
  publishListing: vi.fn(),
  seller: vi.fn(),
  profile: vi.fn(),
  payout: vi.fn(),
  settle: vi.fn(),
  history: vi.fn(),
  record: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: mocks.checkout } };
    transfers = { create: mocks.transfer };
    accounts = { create: mocks.account };
  },
}));
vi.mock("./dbMarketplace", async original => ({
  ...(await original<any>()),
  getListingById: mocks.listing,
  hasPurchased: mocks.owned,
  createListing: mocks.createListing,
  updateListing: mocks.updateListing,
  publishListing: mocks.publishListing,
  getOrCreateSellerProfile: mocks.profile,
  getSellerProfile: mocks.seller,
  createPayout: mocks.payout,
  setPayoutStatus: mocks.settle,
  getBuyerPurchases: mocks.history,
  recordPurchase: mocks.record,
}));
import {
  requireMarketplaceBuying,
  requireMarketplaceSelling,
} from "./_core/marketplaceEntitlement";
import { marketplaceRouter } from "./routers/marketplace";
const caller = marketplaceRouter.createCaller({
  user: { id: 8, role: "user", name: "Fixture" } as any,
  session: null,
  ip: "127.0.0.1",
});

function subscription(
  planName?: string,
  overrides: Record<string, unknown> = {}
) {
  const row = planName
    ? {
        planName,
        status: "active",
        currentPeriodStart: new Date(Date.now() - 60000),
        currentPeriodEnd: new Date(Date.now() + 60000),
        ...overrides,
      }
    : undefined;
  const q: any = {
    from: () => q,
    innerJoin: () => q,
    where: () => q,
    orderBy: () => q,
    limit: async () => (row ? [row] : []),
  };
  mocks.getDb.mockResolvedValue({ select: () => q });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  subscription();
  mocks.listing.mockResolvedValue({
    listing: {
      id: 41,
      sellerId: 7,
      status: "published",
      price: 5000,
      title: "Fixture",
      promptData: { prompt: "paid" },
    },
  });
  mocks.owned.mockResolvedValue(false);
  mocks.createListing.mockResolvedValue({ id: 41 });
  mocks.updateListing.mockResolvedValue({ success: true });
  mocks.publishListing.mockResolvedValue({ success: true });
  mocks.profile.mockResolvedValue({ id: 5, stripeConnectId: "acct_fixture" });
  mocks.seller.mockResolvedValue({
    id: 5,
    stripeConnectId: "acct_fixture",
    payoutBalance: 500,
  });
  mocks.payout.mockResolvedValue({ id: 51 });
  mocks.settle.mockResolvedValue(undefined);
  mocks.checkout.mockResolvedValue({
    url: "https://checkout.stripe.com/fixture",
  });
  mocks.transfer.mockResolvedValue({ id: "tr_fixture" });
  mocks.history.mockResolvedValue({ items: [], total: 0 });
  mocks.record.mockResolvedValue({ id: 1 });
});
afterAll(() => vi.unstubAllEnvs());

describe("shared marketplace tier flags", () => {
  it.each([
    ["free", false, false],
    ["creator", false, false],
    ["pro", true, false],
    ["studio", true, true],
    ["business", true, true],
    ["agency", true, true],
    ["enterprise", true, true],
  ])("applies %s buying=%s selling=%s", async (tier, buy, sell) => {
    subscription(String(tier));
    if (buy) await expect(requireMarketplaceBuying(8)).resolves.toBeUndefined();
    else
      await expect(requireMarketplaceBuying(8)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    if (sell)
      await expect(requireMarketplaceSelling(8)).resolves.toBeUndefined();
    else
      await expect(requireMarketplaceSelling(8)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
  });

  it.each([
    { status: "past_due" },
    { status: "canceled" },
    { status: "incomplete" },
    { currentPeriodStart: null },
    { currentPeriodEnd: null },
    { currentPeriodEnd: new Date(Date.now() - 1000) },
  ])("denies stale or incomplete paid entitlement %j", async override => {
    subscription("agency", override);
    await expect(requireMarketplaceBuying(8)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(requireMarketplaceSelling(8)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("honors a currently valid paid period with cancellation scheduled", async () => {
    subscription("studio", { cancelAtPeriodEnd: true });
    await expect(requireMarketplaceSelling(8)).resolves.toBeUndefined();
  });

  it("fails closed when plan verification is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(requireMarketplaceSelling(8)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});

describe("marketplace mutation entitlement boundaries", () => {
  it("a lower tier cannot create a paid Checkout session", async () => {
    subscription("creator");
    await expect(caller.purchase({ listingId: 41 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("Pro can buy a paid listing through Stripe", async () => {
    subscription("pro");
    await expect(caller.purchase({ listingId: 41 })).resolves.toMatchObject({
      checkoutUrl: "https://checkout.stripe.com/fixture",
    });
    expect(mocks.checkout).toHaveBeenCalledTimes(1);
  });
  it("Pro cannot create, edit, publish or onboard as a seller", async () => {
    subscription("pro");
    const attempts = [
      caller.createListing({
        title: "Fixture listing",
        type: "prompt",
        price: 5000,
        promptData: {},
      }),
      caller.updateListing({ id: 41, title: "Changed listing" }),
      caller.publishListing({ id: 41 }),
      caller.setupSellerAccount({ displayName: "Fixture seller" }),
    ];
    for (const attempt of attempts)
      await expect(attempt).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createListing).not.toHaveBeenCalled();
    expect(mocks.updateListing).not.toHaveBeenCalled();
    expect(mocks.publishListing).not.toHaveBeenCalled();
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
  });
  it("Studio may create, edit, publish and onboard", async () => {
    subscription("studio");
    await expect(
      caller.createListing({
        title: "Fixture listing",
        type: "prompt",
        price: 5000,
        promptData: {},
      })
    ).resolves.toMatchObject({ listingId: 41 });
    await expect(
      caller.updateListing({ id: 41, title: "Changed listing" })
    ).resolves.toMatchObject({ success: true });
    await expect(caller.publishListing({ id: 41 })).resolves.toMatchObject({
      success: true,
    });
    await expect(
      caller.setupSellerAccount({ displayName: "Fixture seller" })
    ).resolves.toMatchObject({ alreadyConnected: true });
  });
  it("free listing acquisition and already-purchased downloads/history survive downgrade", async () => {
    mocks.listing.mockResolvedValueOnce({
      listing: { id: 41, sellerId: 7, status: "published", price: 0 },
    });
    await expect(caller.purchase({ listingId: 41 })).resolves.toMatchObject({
      free: true,
    });
    mocks.owned.mockResolvedValue(true);
    await expect(
      caller.downloadAsset({ listingId: 41 })
    ).resolves.toMatchObject({ promptData: { prompt: "paid" } });
    await expect(caller.getMyPurchases({})).resolves.toMatchObject({
      total: 0,
    });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("downgraded sellers can withdraw existing cash-backed earnings without buying a new plan", async () => {
    await expect(caller.requestPayout({ amount: 500 })).resolves.toMatchObject({
      success: true,
      payoutId: 51,
    });
    expect(mocks.payout).toHaveBeenCalledWith(5, 500);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
