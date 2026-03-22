import { and, desc, eq, gte, lte, like, or, sql, asc, count, inArray } from "drizzle-orm";
import {
  marketplaceListings,
  marketplacePurchases,
  marketplaceReviews,
  sellerProfiles,
  sellerPayouts,
  users,
  type InsertMarketplaceListing,
  type InsertMarketplaceReview,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── Constants ──────────────────────────────────────────────────────────────
export const PLATFORM_FEE_PERCENT = 20; // 20% platform fee
const MARKETPLACE_CATEGORIES = [
  { type: "prompt", label: "Prompts", description: "Ready-to-use generation prompts" },
  { type: "preset", label: "Style Presets", description: "Curated style configurations" },
  { type: "workflow", label: "Workflows", description: "Multi-step generation pipelines" },
  { type: "asset_pack", label: "Asset Packs", description: "Bundles of AI-generated assets" },
  { type: "lora", label: "LoRA Models", description: "Fine-tuned model weights" },
] as const;

// ─── Listing Helpers ────────────────────────────────────────────────────────

export async function createListing(data: InsertMarketplaceListing) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(marketplaceListings).values(data).returning({ id: marketplaceListings.id });
  return { id: result[0].id };
}

export async function updateListing(
  id: number,
  sellerId: number,
  data: Partial<Pick<InsertMarketplaceListing, "title" | "description" | "type" | "price" | "previewImages" | "promptData" | "tags">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(marketplaceListings)
    .set(data)
    .where(and(eq(marketplaceListings.id, id), eq(marketplaceListings.sellerId, sellerId)));
  return { success: true };
}

export async function publishListing(id: number, sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(marketplaceListings)
    .set({ status: "published" })
    .where(
      and(
        eq(marketplaceListings.id, id),
        eq(marketplaceListings.sellerId, sellerId),
        eq(marketplaceListings.status, "draft")
      )
    );
  return { success: true };
}

export async function getListingById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      listing: marketplaceListings,
      sellerName: users.name,
    })
    .from(marketplaceListings)
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(eq(marketplaceListings.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getListingDetail(id: number) {
  const db = await getDb();
  if (!db) return null;

  const listingRows = await db
    .select({
      listing: marketplaceListings,
      sellerName: users.name,
    })
    .from(marketplaceListings)
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(eq(marketplaceListings.id, id))
    .limit(1);

  if (!listingRows[0]) return null;

  // Get seller profile
  const sellerProfileRows = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, listingRows[0].listing.sellerId))
    .limit(1);

  // Get reviews
  const reviews = await db
    .select({
      review: marketplaceReviews,
      buyerName: users.name,
    })
    .from(marketplaceReviews)
    .innerJoin(users, eq(marketplaceReviews.buyerId, users.id))
    .where(eq(marketplaceReviews.listingId, id))
    .orderBy(desc(marketplaceReviews.createdAt))
    .limit(20);

  return {
    ...listingRows[0].listing,
    sellerName: listingRows[0].sellerName,
    sellerProfile: sellerProfileRows[0] ?? null,
    reviews: reviews.map((r) => ({
      ...r.review,
      buyerName: r.buyerName,
    })),
  };
}

export async function browseListings(options: {
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  search?: string;
  sort?: "popular" | "new" | "rating" | "price_low" | "price_high";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const {
    type,
    minPrice,
    maxPrice,
    tags: filterTags,
    search,
    sort = "new",
    limit = 24,
    offset = 0,
  } = options;

  const conditions = [eq(marketplaceListings.status, "published")];

  if (type) {
    conditions.push(eq(marketplaceListings.type, type as any));
  }
  if (minPrice !== undefined) {
    conditions.push(gte(marketplaceListings.price, minPrice));
  }
  if (maxPrice !== undefined) {
    conditions.push(lte(marketplaceListings.price, maxPrice));
  }
  if (search) {
    conditions.push(
      or(
        like(marketplaceListings.title, `%${search}%`),
        like(marketplaceListings.description, `%${search}%`)
      )!
    );
  }
  if (filterTags && filterTags.length > 0) {
    // JSONB containment check for tags array
    for (const tag of filterTags) {
      conditions.push(sql`${marketplaceListings.tags}::jsonb @> ${JSON.stringify(tag)}::jsonb`);
    }
  }

  const where = and(...conditions);

  const orderBy =
    sort === "popular"
      ? desc(marketplaceListings.downloads)
      : sort === "rating"
      ? desc(marketplaceListings.rating)
      : sort === "price_low"
      ? asc(marketplaceListings.price)
      : sort === "price_high"
      ? desc(marketplaceListings.price)
      : desc(marketplaceListings.createdAt);

  const totalResult = await db
    .select({ total: count() })
    .from(marketplaceListings)
    .where(where);

  const items = await db
    .select({
      listing: marketplaceListings,
      sellerName: users.name,
    })
    .from(marketplaceListings)
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    items: items.map((i) => ({
      ...i.listing,
      sellerName: i.sellerName,
    })),
    total: totalResult[0]?.total ?? 0,
  };
}

export async function getFeaturedListings(limit = 12) {
  const db = await getDb();
  if (!db) return [];

  const items = await db
    .select({
      listing: marketplaceListings,
      sellerName: users.name,
    })
    .from(marketplaceListings)
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(
      and(
        eq(marketplaceListings.status, "published"),
        eq(marketplaceListings.isFeatured, true)
      )
    )
    .orderBy(desc(marketplaceListings.downloads))
    .limit(limit);

  return items.map((i) => ({ ...i.listing, sellerName: i.sellerName }));
}

export async function getSellerListings(sellerId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const totalResult = await db
    .select({ total: count() })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.sellerId, sellerId));

  const items = await db
    .select()
    .from(marketplaceListings)
    .where(eq(marketplaceListings.sellerId, sellerId))
    .orderBy(desc(marketplaceListings.updatedAt))
    .limit(limit)
    .offset(offset);

  return { items, total: totalResult[0]?.total ?? 0 };
}

// ─── Purchase Helpers ───────────────────────────────────────────────────────

export function calculateFees(priceInCents: number) {
  const platformFee = Math.round(priceInCents * (PLATFORM_FEE_PERCENT / 100));
  const sellerPayout = priceInCents - platformFee;
  return { platformFee, sellerPayout };
}

export async function recordPurchase(data: {
  buyerId: number;
  listingId: number;
  price: number;
  stripePaymentId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { platformFee, sellerPayout } = calculateFees(data.price);

  // Insert purchase record
  const result = await db.insert(marketplacePurchases).values({
    buyerId: data.buyerId,
    listingId: data.listingId,
    price: data.price,
    platformFee,
    sellerPayout,
    stripePaymentId: data.stripePaymentId || null,
  }).returning({ id: marketplacePurchases.id });

  // Increment download count on the listing
  await db
    .update(marketplaceListings)
    .set({ downloads: sql`${marketplaceListings.downloads} + 1` })
    .where(eq(marketplaceListings.id, data.listingId));

  // Update seller profile stats
  const listing = await db
    .select({ sellerId: marketplaceListings.sellerId })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.id, data.listingId))
    .limit(1);

  if (listing[0]) {
    await db
      .update(sellerProfiles)
      .set({
        totalSales: sql`${sellerProfiles.totalSales} + 1`,
        totalEarnings: sql`${sellerProfiles.totalEarnings} + ${sellerPayout}`,
        payoutBalance: sql`${sellerProfiles.payoutBalance} + ${sellerPayout}`,
      })
      .where(eq(sellerProfiles.userId, listing[0].sellerId));
  }

  return { id: result[0].id, platformFee, sellerPayout };
}

export async function hasPurchased(buyerId: number, listingId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: marketplacePurchases.id })
    .from(marketplacePurchases)
    .where(
      and(
        eq(marketplacePurchases.buyerId, buyerId),
        eq(marketplacePurchases.listingId, listingId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function getBuyerPurchases(buyerId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const totalResult = await db
    .select({ total: count() })
    .from(marketplacePurchases)
    .where(eq(marketplacePurchases.buyerId, buyerId));

  const items = await db
    .select({
      purchase: marketplacePurchases,
      listingTitle: marketplaceListings.title,
      listingType: marketplaceListings.type,
      sellerName: users.name,
    })
    .from(marketplacePurchases)
    .innerJoin(marketplaceListings, eq(marketplacePurchases.listingId, marketplaceListings.id))
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(eq(marketplacePurchases.buyerId, buyerId))
    .orderBy(desc(marketplacePurchases.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: items.map((i) => ({
      ...i.purchase,
      listingTitle: i.listingTitle,
      listingType: i.listingType,
      sellerName: i.sellerName,
    })),
    total: totalResult[0]?.total ?? 0,
  };
}

// ─── Review Helpers ─────────────────────────────────────────────────────────

export async function submitReview(data: InsertMarketplaceReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert the review
  const result = await db.insert(marketplaceReviews).values(data).returning({ id: marketplaceReviews.id });

  // Recalculate average rating for the listing
  const ratingResult = await db
    .select({
      avgRating: sql<number>`ROUND(AVG(${marketplaceReviews.rating}) * 100)`,
      totalCount: count(),
    })
    .from(marketplaceReviews)
    .where(eq(marketplaceReviews.listingId, data.listingId));

  if (ratingResult[0]) {
    await db
      .update(marketplaceListings)
      .set({
        rating: ratingResult[0].avgRating ?? 0,
        ratingCount: ratingResult[0].totalCount,
      })
      .where(eq(marketplaceListings.id, data.listingId));
  }

  return { id: result[0].id };
}

export async function hasReviewed(buyerId: number, listingId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: marketplaceReviews.id })
    .from(marketplaceReviews)
    .where(
      and(
        eq(marketplaceReviews.buyerId, buyerId),
        eq(marketplaceReviews.listingId, listingId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

// ─── Seller Profile Helpers ─────────────────────────────────────────────────

export async function getOrCreateSellerProfile(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  await db.insert(sellerProfiles).values({ userId, displayName });
  const created = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);
  return created[0];
}

export async function getSellerProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSellerProfile(
  userId: number,
  data: Partial<Pick<typeof sellerProfiles.$inferInsert, "displayName" | "bio" | "avatarUrl" | "bannerUrl" | "stripeConnectId">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(sellerProfiles)
    .set(data)
    .where(eq(sellerProfiles.userId, userId));
  return { success: true };
}

export async function getTopSellers(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      profile: sellerProfiles,
      userName: users.name,
    })
    .from(sellerProfiles)
    .innerJoin(users, eq(sellerProfiles.userId, users.id))
    .where(gte(sellerProfiles.totalSales, 1))
    .orderBy(desc(sellerProfiles.totalEarnings))
    .limit(limit);
}

export async function getSellerDashboard(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const profile = await getSellerProfile(userId);
  if (!profile) return null;

  // Recent sales
  const recentSales = await db
    .select({
      purchase: marketplacePurchases,
      listingTitle: marketplaceListings.title,
      buyerName: users.name,
    })
    .from(marketplacePurchases)
    .innerJoin(marketplaceListings, eq(marketplacePurchases.listingId, marketplaceListings.id))
    .innerJoin(users, eq(marketplacePurchases.buyerId, users.id))
    .where(eq(marketplaceListings.sellerId, userId))
    .orderBy(desc(marketplacePurchases.createdAt))
    .limit(20);

  // Listing stats
  const listings = await db
    .select()
    .from(marketplaceListings)
    .where(eq(marketplaceListings.sellerId, userId))
    .orderBy(desc(marketplaceListings.downloads));

  // Payout history
  const payouts = await db
    .select()
    .from(sellerPayouts)
    .where(eq(sellerPayouts.sellerId, profile.id))
    .orderBy(desc(sellerPayouts.createdAt))
    .limit(10);

  return {
    profile,
    recentSales: recentSales.map((s) => ({
      ...s.purchase,
      listingTitle: s.listingTitle,
      buyerName: s.buyerName,
    })),
    listings,
    payouts,
  };
}

// ─── Payout Helpers ─────────────────────────────────────────────────────────

export async function createPayout(sellerId: number, amount: number, stripeTransferId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(sellerPayouts).values({
    sellerId,
    amount,
    stripeTransferId: stripeTransferId || null,
    status: stripeTransferId ? "paid" : "pending",
  }).returning({ id: sellerPayouts.id });

  // Deduct from payout balance
  await db
    .update(sellerProfiles)
    .set({
      payoutBalance: sql`${sellerProfiles.payoutBalance} - ${amount}`,
    })
    .where(eq(sellerProfiles.id, sellerId));

  return { id: result[0].id };
}

// ─── Category Helpers ───────────────────────────────────────────────────────

export async function getCategoriesWithCounts() {
  const db = await getDb();
  if (!db) return MARKETPLACE_CATEGORIES.map((c) => ({ ...c, count: 0 }));

  const counts = await db
    .select({
      type: marketplaceListings.type,
      count: count(),
    })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.status, "published"))
    .groupBy(marketplaceListings.type);

  const countMap: Record<string, number> = {};
  for (const row of counts) {
    countMap[row.type] = row.count;
  }

  return MARKETPLACE_CATEGORIES.map((c) => ({
    ...c,
    count: countMap[c.type] ?? 0,
  }));
}
