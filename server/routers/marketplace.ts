import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  browseListings,
  getListingDetail,
  getFeaturedListings,
  getTopSellers,
  getCategoriesWithCounts,
  createListing,
  updateListing,
  publishListing,
  getSellerListings,
  getSellerDashboard,
  getOrCreateSellerProfile,
  getSellerProfile,
  updateSellerProfile,
  recordPurchase,
  hasPurchased,
  getBuyerPurchases,
  submitReview,
  hasReviewed,
  createPayout,
  getListingById,
  PLATFORM_FEE_PERCENT,
} from "../dbMarketplace";
import Stripe from "stripe";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripe;
}

// ─── Public Routes ──────────────────────────────────────────────────────────

const browseRoute = publicProcedure
  .input(
    z.object({
      type: z.enum(["prompt", "preset", "workflow", "asset_pack", "lora"]).optional(),
      minPrice: z.number().min(0).optional(),
      maxPrice: z.number().min(0).optional(),
      tags: z.array(z.string()).optional(),
      search: z.string().max(256).optional(),
      sort: z.enum(["popular", "new", "rating", "price_low", "price_high"]).optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    })
  )
  .query(async ({ input }) => {
    return browseListings(input);
  });

const getListingDetailRoute = publicProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input }) => {
    const detail = await getListingDetail(input.id);
    if (!detail) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
    }
    return detail;
  });

const getFeaturedRoute = publicProcedure
  .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
  .query(async ({ input }) => {
    return getFeaturedListings(input?.limit ?? 12);
  });

const getTopSellersRoute = publicProcedure
  .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
  .query(async ({ input }) => {
    const sellers = await getTopSellers(input?.limit ?? 10);
    return sellers.map((s) => ({
      ...s.profile,
      userName: s.userName,
    }));
  });

const getCategoriesRoute = publicProcedure.query(async () => {
  return getCategoriesWithCounts();
});

// ─── Protected (Buyer) Routes ───────────────────────────────────────────────

const purchaseRoute = protectedProcedure
  .input(
    z.object({
      listingId: z.number(),
      paymentMethod: z.enum(["stripe", "credits"]).default("stripe"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const listing = await getListingById(input.listingId);
    if (!listing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
    }
    if (listing.listing.status !== "published") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Listing is not available for purchase" });
    }
    if (listing.listing.sellerId === ctx.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot purchase your own listing" });
    }

    // Check if already purchased
    const alreadyOwned = await hasPurchased(ctx.user.id, input.listingId);
    if (alreadyOwned) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You already own this listing" });
    }

    const price = listing.listing.price;

    // Free listings - just record the purchase
    if (price === 0) {
      const result = await recordPurchase({
        buyerId: ctx.user.id,
        listingId: input.listingId,
        price: 0,
      });
      return { success: true, purchaseId: result.id, free: true };
    }

    // For paid listings with Stripe, create a checkout session
    if (input.paymentMethod === "stripe") {
      const session = await getStripe().checkout.sessions.create({
        client_reference_id: ctx.user.id.toString(),
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: listing.listing.title,
                description: `Marketplace purchase: ${listing.listing.type}`,
              },
              unit_amount: price,
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: "marketplace_purchase",
          buyer_id: ctx.user.id.toString(),
          listing_id: input.listingId.toString(),
          price: price.toString(),
        },
        success_url: `${process.env.APP_URL || "https://dreamforge.art"}/marketplace/purchases?success=true`,
        cancel_url: `${process.env.APP_URL || "https://dreamforge.art"}/marketplace/${input.listingId}?canceled=true`,
      });

      return { success: true, checkoutUrl: session.url, free: false };
    }

    // Credits payment - deduct from credit balance and record immediately
    // Import deductCredits at the top-level would create circular deps, so use dynamic
    const { deductCredits } = await import("../stripe");
    const creditsNeeded = Math.ceil(price / 100); // 1 credit per $1
    const deductResult = await deductCredits(ctx.user.id, creditsNeeded, `Marketplace purchase: ${listing.listing.title}`);
    if (!deductResult.success) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Insufficient credits. Need ${creditsNeeded}, have ${deductResult.balance}.`,
      });
    }

    const result = await recordPurchase({
      buyerId: ctx.user.id,
      listingId: input.listingId,
      price,
    });

    return { success: true, purchaseId: result.id, free: false };
  });

const getMyPurchasesRoute = protectedProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    return getBuyerPurchases(ctx.user.id, input.limit ?? 50, input.offset ?? 0);
  });

const downloadAssetRoute = protectedProcedure
  .input(z.object({ listingId: z.number() }))
  .query(async ({ ctx, input }) => {
    // Check ownership
    const listing = await getListingById(input.listingId);
    if (!listing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
    }

    // Free listings are available to everyone; paid listings require purchase
    if (listing.listing.price > 0) {
      const owned = await hasPurchased(ctx.user.id, input.listingId);
      const isSeller = listing.listing.sellerId === ctx.user.id;
      if (!owned && !isSeller) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You must purchase this listing first" });
      }
    }

    // Return the actual prompt data / asset content
    return {
      listingId: listing.listing.id,
      title: listing.listing.title,
      type: listing.listing.type,
      promptData: listing.listing.promptData,
    };
  });

const submitReviewRoute = protectedProcedure
  .input(
    z.object({
      listingId: z.number(),
      rating: z.number().min(1).max(5),
      comment: z.string().max(2000).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Must have purchased to review
    const owned = await hasPurchased(ctx.user.id, input.listingId);
    if (!owned) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You must purchase this listing before reviewing" });
    }

    // Can only review once
    const alreadyReviewed = await hasReviewed(ctx.user.id, input.listingId);
    if (alreadyReviewed) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You have already reviewed this listing" });
    }

    const result = await submitReview({
      buyerId: ctx.user.id,
      listingId: input.listingId,
      rating: input.rating,
      comment: input.comment ?? null,
    });

    return { success: true, reviewId: result.id };
  });

// ─── Protected (Seller) Routes ──────────────────────────────────────────────

const createListingRoute = protectedProcedure
  .input(
    z.object({
      title: z.string().min(3).max(256),
      description: z.string().max(5000).optional(),
      type: z.enum(["prompt", "preset", "workflow", "asset_pack", "lora"]),
      price: z.number().min(0).max(99999), // max $999.99
      previewImages: z.array(z.string().url()).max(10).optional(),
      promptData: z.any(),
      tags: z.array(z.string()).max(20).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Ensure seller profile exists
    const userName = ctx.user.name || "Anonymous";
    await getOrCreateSellerProfile(ctx.user.id, userName);

    const result = await createListing({
      sellerId: ctx.user.id,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      price: input.price,
      previewImages: input.previewImages ?? [],
      promptData: input.promptData,
      tags: input.tags ?? [],
      status: "draft",
    });

    return { success: true, listingId: result.id };
  });

const updateListingRoute = protectedProcedure
  .input(
    z.object({
      id: z.number(),
      title: z.string().min(3).max(256).optional(),
      description: z.string().max(5000).optional(),
      type: z.enum(["prompt", "preset", "workflow", "asset_pack", "lora"]).optional(),
      price: z.number().min(0).max(99999).optional(),
      previewImages: z.array(z.string().url()).max(10).optional(),
      promptData: z.any().optional(),
      tags: z.array(z.string()).max(20).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { id, ...updates } = input;
    // Filter out undefined values
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) data[key] = value;
    }
    if (Object.keys(data).length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
    }
    return updateListing(id, ctx.user.id, data as any);
  });

const publishListingRoute = protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    return publishListing(input.id, ctx.user.id);
  });

const getMyListingsRoute = protectedProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    return getSellerListings(ctx.user.id, input.limit ?? 50, input.offset ?? 0);
  });

const getSellerDashboardRoute = protectedProcedure.query(async ({ ctx }) => {
  const dashboard = await getSellerDashboard(ctx.user.id);
  if (!dashboard) {
    return { profile: null, recentSales: [], listings: [], payouts: [] };
  }
  return dashboard;
});

const setupSellerAccountRoute = protectedProcedure
  .input(
    z.object({
      displayName: z.string().min(2).max(128),
      bio: z.string().max(1000).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getOrCreateSellerProfile(ctx.user.id, input.displayName);

    // Create Stripe Connect account if not already set up
    if (!profile.stripeConnectId) {
      try {
        const account = await getStripe().accounts.create({
          type: "express",
          metadata: {
            user_id: ctx.user.id.toString(),
            platform: "dreamforge_marketplace",
          },
        });

        await updateSellerProfile(ctx.user.id, {
          stripeConnectId: account.id,
          bio: input.bio ?? null,
        });

        // Generate onboarding link
        const accountLink = await getStripe().accountLinks.create({
          account: account.id,
          refresh_url: `${process.env.APP_URL || "https://dreamforge.art"}/marketplace/seller/setup?refresh=true`,
          return_url: `${process.env.APP_URL || "https://dreamforge.art"}/marketplace/seller/dashboard?onboarded=true`,
          type: "account_onboarding",
        });

        return { success: true, onboardingUrl: accountLink.url, profileId: profile.id };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create Stripe Connect account: ${err.message}`,
        });
      }
    }

    // If already set up, just update bio
    if (input.bio) {
      await updateSellerProfile(ctx.user.id, { bio: input.bio });
    }

    return { success: true, profileId: profile.id, alreadyConnected: true };
  });

const requestPayoutRoute = protectedProcedure
  .input(
    z.object({
      amount: z.number().min(500), // minimum $5.00 payout
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getSellerProfile(ctx.user.id);
    if (!profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Seller profile not found. Set up your seller account first." });
    }
    if (!profile.stripeConnectId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe Connect account not set up. Complete seller onboarding first." });
    }
    if (profile.payoutBalance < input.amount) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Insufficient balance. Available: $${(profile.payoutBalance / 100).toFixed(2)}, requested: $${(input.amount / 100).toFixed(2)}`,
      });
    }

    try {
      const transfer = await getStripe().transfers.create({
        amount: input.amount,
        currency: "usd",
        destination: profile.stripeConnectId,
        metadata: {
          seller_id: profile.id.toString(),
          user_id: ctx.user.id.toString(),
        },
      });

      const result = await createPayout(profile.id, input.amount, transfer.id);
      return { success: true, payoutId: result.id, transferId: transfer.id };
    } catch (err: any) {
      // Record failed payout attempt
      await createPayout(profile.id, input.amount);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Payout failed: ${err.message}`,
      });
    }
  });

// ─── Export Router ──────────────────────────────────────────────────────────

export const marketplaceRouter = router({
  // Public
  browse: browseRoute,
  getListingDetail: getListingDetailRoute,
  getFeatured: getFeaturedRoute,
  getTopSellers: getTopSellersRoute,
  getCategories: getCategoriesRoute,

  // Buyer (protected)
  purchase: purchaseRoute,
  getMyPurchases: getMyPurchasesRoute,
  downloadAsset: downloadAssetRoute,
  submitReview: submitReviewRoute,

  // Seller (protected)
  createListing: createListingRoute,
  updateListing: updateListingRoute,
  publishListing: publishListingRoute,
  getMyListings: getMyListingsRoute,
  getSellerDashboard: getSellerDashboardRoute,
  setupSellerAccount: setupSellerAccountRoute,
  requestPayout: requestPayoutRoute,
});
