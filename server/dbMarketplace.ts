import {
  and,
  desc,
  eq,
  gte,
  lte,
  like,
  or,
  sql,
  asc,
  count,
  inArray,
} from "drizzle-orm";
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
import { getStripeClient } from "./stripe";

// ─── Constants ──────────────────────────────────────────────────────────────
export const PLATFORM_FEE_PERCENT = 20; // 20% platform fee
const MARKETPLACE_CATEGORIES = [
  {
    type: "prompt",
    label: "Prompts",
    description: "Ready-to-use generation prompts",
  },
  {
    type: "preset",
    label: "Style Presets",
    description: "Curated style configurations",
  },
  {
    type: "workflow",
    label: "Workflows",
    description: "Multi-step generation pipelines",
  },
  {
    type: "asset_pack",
    label: "Asset Packs",
    description: "Bundles of AI-generated assets",
  },
  {
    type: "lora",
    label: "LoRA Models",
    description: "Fine-tuned model weights",
  },
] as const;

// Public responses use explicit projections. Adding private schema columns
// must never silently publish paid content or a seller's financial details.
const publicListingFields = {
  id: marketplaceListings.id,
  sellerId: marketplaceListings.sellerId,
  title: marketplaceListings.title,
  description: marketplaceListings.description,
  type: marketplaceListings.type,
  price: marketplaceListings.price,
  previewImages: marketplaceListings.previewImages,
  tags: marketplaceListings.tags,
  downloads: marketplaceListings.downloads,
  rating: marketplaceListings.rating,
  ratingCount: marketplaceListings.ratingCount,
  status: marketplaceListings.status,
  isFeatured: marketplaceListings.isFeatured,
  createdAt: marketplaceListings.createdAt,
  updatedAt: marketplaceListings.updatedAt,
};
const publicSellerFields = {
  id: sellerProfiles.id,
  userId: sellerProfiles.userId,
  displayName: sellerProfiles.displayName,
  bio: sellerProfiles.bio,
  avatarUrl: sellerProfiles.avatarUrl,
  bannerUrl: sellerProfiles.bannerUrl,
  totalSales: sellerProfiles.totalSales,
  isVerified: sellerProfiles.isVerified,
  createdAt: sellerProfiles.createdAt,
};

// ─── Listing Helpers ────────────────────────────────────────────────────────

export async function createListing(data: InsertMarketplaceListing) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .insert(marketplaceListings)
    .values(data)
    .returning({ id: marketplaceListings.id });
  return { id: result[0].id };
}

export async function updateListing(
  id: number,
  sellerId: number,
  data: Partial<
    Pick<
      InsertMarketplaceListing,
      | "title"
      | "description"
      | "type"
      | "price"
      | "previewImages"
      | "promptData"
      | "tags"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(marketplaceListings)
    .set(data)
    .where(
      and(
        eq(marketplaceListings.id, id),
        eq(marketplaceListings.sellerId, sellerId)
      )
    );
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
      ...publicListingFields,
      sellerName: users.name,
    })
    .from(marketplaceListings)
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(
      and(
        eq(marketplaceListings.id, id),
        eq(marketplaceListings.status, "published")
      )
    )
    .limit(1);

  if (!listingRows[0]) return null;

  // Get seller profile
  const sellerProfileRows = await db
    .select(publicSellerFields)
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, listingRows[0].sellerId))
    .limit(1);

  // Get reviews
  const reviews = await db
    .select({
      id: marketplaceReviews.id,
      rating: marketplaceReviews.rating,
      comment: marketplaceReviews.comment,
      createdAt: marketplaceReviews.createdAt,
      buyerName: users.name,
    })
    .from(marketplaceReviews)
    .innerJoin(users, eq(marketplaceReviews.buyerId, users.id))
    .where(eq(marketplaceReviews.listingId, id))
    .orderBy(desc(marketplaceReviews.createdAt))
    .limit(20);

  return {
    ...listingRows[0],
    sellerProfile: sellerProfileRows[0] ?? null,
    reviews,
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
      conditions.push(
        sql`${marketplaceListings.tags}::jsonb @> ${JSON.stringify(tag)}::jsonb`
      );
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
      ...publicListingFields,
      sellerName: users.name,
    })
    .from(marketplaceListings)
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: totalResult[0]?.total ?? 0,
  };
}

export async function getFeaturedListings(limit = 12) {
  const db = await getDb();
  if (!db) return [];

  const items = await db
    .select({
      ...publicListingFields,
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

  return items;
}

export async function getSellerListings(
  sellerId: number,
  limit = 50,
  offset = 0
) {
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
  if (!Number.isSafeInteger(data.price) || data.price < 0)
    throw new Error("Invalid marketplace price");
  if (data.price > 0) {
    if (
      !data.stripePaymentId ||
      !/^pi_[A-Za-z0-9]+$/.test(data.stripePaymentId)
    ) {
      throw new Error(
        "A settled cash payment is required for a paid marketplace purchase"
      );
    }
    const stripe = getStripeClient();
    const payment = await stripe.paymentIntents.retrieve(data.stripePaymentId);
    if (
      payment.id !== data.stripePaymentId ||
      payment.status !== "succeeded" ||
      payment.currency !== "usd" ||
      payment.amount_received !== data.price
    ) {
      throw new Error(
        "Marketplace payment is not settled for the agreed USD amount"
      );
    }
    // Checkout session metadata also binds older payments whose PI did not
    // receive payment_intent_data.metadata at checkout creation.
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: payment.id,
      limit: 2,
    });
    const matched = sessions.data.some(
      session =>
        session.mode === "payment" &&
        session.status === "complete" &&
        session.payment_status === "paid" &&
        session.currency === "usd" &&
        session.amount_total === data.price &&
        session.client_reference_id === String(data.buyerId) &&
        session.metadata?.type === "marketplace_purchase" &&
        session.metadata.buyer_id === String(data.buyerId) &&
        session.metadata.listing_id === String(data.listingId)
    );
    if (!matched)
      throw new Error(
        "Marketplace payment does not match this buyer and listing"
      );
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { platformFee, sellerPayout } = calculateFees(data.price);

  const paymentId = data.price > 0 ? data.stripePaymentId! : null;
  const result = await marketplaceTransaction(
    db,
    `purchase:${data.buyerId}:${data.listingId}`,
    sql`
    WITH existing AS (
      SELECT id, "buyerId", "listingId", "platformFee", "sellerPayout"
      FROM "marketplacePurchases"
      WHERE ("buyerId" = ${data.buyerId} AND "listingId" = ${data.listingId})
        OR (${paymentId}::text IS NOT NULL AND "stripePaymentId" = ${paymentId})
    ), inserted AS (
      INSERT INTO "marketplacePurchases" ("buyerId", "listingId", price, "platformFee", "sellerPayout", "stripePaymentId")
      SELECT ${data.buyerId}, id, ${data.price}, ${platformFee}, ${sellerPayout}, ${paymentId}
      FROM "marketplaceListings" WHERE id = ${data.listingId} AND NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id, "listingId", "platformFee", "sellerPayout"
    ), listing_updated AS (
      UPDATE "marketplaceListings" SET downloads = downloads + 1
      WHERE id IN (SELECT "listingId" FROM inserted) RETURNING "sellerId"
    ), seller_updated AS (
      UPDATE "sellerProfiles" SET "totalSales" = "totalSales" + 1,
        "totalEarnings" = "totalEarnings" + ${sellerPayout}, "payoutBalance" = "payoutBalance" + ${sellerPayout}
      WHERE "userId" IN (SELECT "sellerId" FROM listing_updated) RETURNING id
    )
    SELECT id, "platformFee", "sellerPayout" FROM inserted
    UNION ALL SELECT id, "platformFee", "sellerPayout" FROM existing
      WHERE "buyerId" = ${data.buyerId} AND "listingId" = ${data.listingId}
    LIMIT 1
  `
  );
  const row = (result.rows ?? result)[0];
  if (!row) throw new Error("Marketplace purchase could not be recorded");
  return row as { id: number; platformFee: number; sellerPayout: number };
}

async function marketplaceTransaction(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  key: string,
  statement: Parameters<typeof db.execute>[0]
): Promise<any> {
  // The lock and mutation must be separate statements. Under READ COMMITTED
  // the mutation gets a fresh snapshot after a concurrent lock holder commits.
  const [, , result] = await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`marketplace:${key}`}, 0))`
    ),
    db.execute(statement),
  ]);
  return result;
}

export async function hasPurchased(
  buyerId: number,
  listingId: number
): Promise<boolean> {
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

export async function getBuyerPurchases(
  buyerId: number,
  limit = 50,
  offset = 0
) {
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
    .innerJoin(
      marketplaceListings,
      eq(marketplacePurchases.listingId, marketplaceListings.id)
    )
    .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
    .where(eq(marketplacePurchases.buyerId, buyerId))
    .orderBy(desc(marketplacePurchases.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: items.map(i => ({
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
  const result = await db
    .insert(marketplaceReviews)
    .values(data)
    .returning({ id: marketplaceReviews.id });

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

export async function hasReviewed(
  buyerId: number,
  listingId: number
): Promise<boolean> {
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

export async function getOrCreateSellerProfile(
  userId: number,
  displayName: string
) {
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
  data: Partial<
    Pick<
      typeof sellerProfiles.$inferInsert,
      "displayName" | "bio" | "avatarUrl" | "bannerUrl" | "stripeConnectId"
    >
  >
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
      ...publicSellerFields,
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
    .innerJoin(
      marketplaceListings,
      eq(marketplacePurchases.listingId, marketplaceListings.id)
    )
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
    recentSales: recentSales.map(s => ({
      ...s.purchase,
      listingTitle: s.listingTitle,
      buyerName: s.buyerName,
    })),
    listings,
    payouts,
  };
}

// ─── Payout Helpers ─────────────────────────────────────────────────────────

/** Release exactly one pending reservation after a confirmed Stripe rejection. */
export async function releasePayout(
  sellerProfileId: number,
  amount: number,
  payoutId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await marketplaceTransaction(
    db,
    `payout:${sellerProfileId}`,
    sql`
    WITH failed AS (
      UPDATE "sellerPayouts" SET "payoutStatus" = 'failed'
      WHERE id = ${payoutId} AND "sellerId" = ${sellerProfileId}
        AND amount = ${amount} AND "payoutStatus" = 'pending' AND "stripeTransferId" IS NULL
      RETURNING amount
    )
    UPDATE "sellerProfiles" SET "payoutBalance" = "payoutBalance" + (SELECT amount FROM failed)
    WHERE id = ${sellerProfileId} AND EXISTS (SELECT 1 FROM failed)
  `
  );
}

/** Transition a payout row to its terminal state once the transfer settles. */
export async function setPayoutStatus(
  payoutId: number,
  status: "pending" | "paid" | "failed",
  stripeTransferId?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(sellerPayouts)
    .set({
      status,
      ...(stripeTransferId ? { stripeTransferId } : {}),
    })
    .where(eq(sellerPayouts.id, payoutId));
}

/** Reserve only cash-backed earnings and insert the pending payout atomically. */
export async function createPayout(sellerId: number, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 500)
    throw new Error("Invalid payout amount");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await marketplaceTransaction(
    db,
    `payout:${sellerId}`,
    sql`
    WITH cash_sales AS (
      SELECT p."stripePaymentId", MAX(p."sellerPayout") AS cents
      FROM "marketplacePurchases" p JOIN "marketplaceListings" l ON l.id = p."listingId"
      JOIN "sellerProfiles" s ON s."userId" = l."sellerId"
      WHERE s.id = ${sellerId} AND p."stripePaymentId" ~ '^pi_[A-Za-z0-9]+$'
      GROUP BY p."stripePaymentId"
    ), available AS (
      SELECT COALESCE((SELECT SUM(cents) FROM cash_sales), 0)
        - COALESCE((SELECT SUM(amount) FROM "sellerPayouts"
          WHERE "sellerId" = ${sellerId} AND "payoutStatus" IN ('pending', 'paid')), 0) AS cents
    ), reserved AS (
      UPDATE "sellerProfiles" SET "payoutBalance" = "payoutBalance" - ${amount}
      WHERE id = ${sellerId} AND "payoutBalance" >= ${amount}
        AND (SELECT cents FROM available) >= ${amount}
      RETURNING id
    )
    INSERT INTO "sellerPayouts" ("sellerId", amount, "payoutStatus")
    SELECT id, ${amount}, 'pending' FROM reserved RETURNING id
  `
  );
  const row = (result.rows ?? result)[0];
  if (!row) throw new Error("Insufficient cash-backed earnings for payout");
  return { id: Number(row.id) };
}

// ─── Category Helpers ───────────────────────────────────────────────────────

export async function getCategoriesWithCounts() {
  const db = await getDb();
  if (!db) return MARKETPLACE_CATEGORIES.map(c => ({ ...c, count: 0 }));

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

  return MARKETPLACE_CATEGORIES.map(c => ({
    ...c,
    count: countMap[c.type] ?? 0,
  }));
}
