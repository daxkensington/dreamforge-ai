-- Hot-path indexes still missing after 0010/0011. Each maps to a real query:
--   * userSubscriptions(userId): getUserTier inner-joins on it for EVERY
--     generation and getUserSubscription queries it per request. No query
--     filters by status, so plain userId (not composite).
--   * generations(userId, createdAt): the "my generations" workspace feed
--     filters by userId and sorts by createdAt DESC. 0010's separate
--     userId-only and createdAt-only indexes can't drive the filter+sort.
--   * marketplacePurchases(buyerId) + (listingId): purchase history
--     (getBuyerPurchases) filters by buyerId; hasPurchased filters by
--     buyerId AND listingId.
--   * referrals(referrerId): per-user referral stats filter by it.
--   * creditTransactions(stripePaymentIntentId): the refund/dispute clawback
--     path looks up the original purchase by payment intent
--     (findPurchaseByPaymentIntent in the Stripe webhook handler).
-- Idempotent: safe to re-apply.

CREATE INDEX IF NOT EXISTS "userSubscriptions_userId_idx" ON "userSubscriptions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_user_createdAt_idx" ON "generations" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplacePurchases_buyerId_idx" ON "marketplacePurchases" USING btree ("buyerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplacePurchases_listingId_idx" ON "marketplacePurchases" USING btree ("listingId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_referrerId_idx" ON "referrals" USING btree ("referrerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creditTransactions_stripePaymentIntentId_idx" ON "creditTransactions" USING btree ("stripePaymentIntentId");
