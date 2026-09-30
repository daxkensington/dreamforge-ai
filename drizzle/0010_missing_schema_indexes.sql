-- Indexes declared in drizzle/schema.ts that never landed in a migration.
-- The committed 0003 snapshot referenced 12 of them, but no migration SQL ever
-- created them — only environments updated ad hoc (or via push) had them; any
-- database built from migrations (prod, fresh deploys) was missing all 17.
--   * 12 plain indexes for the hot query paths (per-user listings, status
--     filters, join lookups)
--   * 5 unique indexes enforcing data integrity — each is preceded by a DO
--     block that deletes duplicate rows (keeping the lowest id) so the unique
--     index cannot fail on pre-existing data
-- Idempotent: safe to re-apply.

CREATE INDEX IF NOT EXISTS "creditTransactions_userId_idx" ON "creditTransactions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "galleryItems_generationId_idx" ON "galleryItems" USING btree ("generationId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "galleryItems_userId_idx" ON "galleryItems" USING btree ("userId");--> statement-breakpoint
DO $$
BEGIN
  DELETE FROM "galleryItems" gi
  WHERE gi."id" > (
    SELECT MIN(gi2."id") FROM "galleryItems" gi2
    WHERE gi2."generationId" = gi."generationId"
  );
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "galleryItems_generationId_unique" ON "galleryItems" USING btree ("generationId");--> statement-breakpoint
DO $$
BEGIN
  DELETE FROM "galleryLikes" gl
  WHERE gl."id" > (
    SELECT MIN(gl2."id") FROM "galleryLikes" gl2
    WHERE gl2."userId" = gl."userId" AND gl2."galleryItemId" = gl."galleryItemId"
  );
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "galleryLikes_userId_galleryItemId_unique" ON "galleryLikes" USING btree ("userId","galleryItemId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generationTags_generationId_idx" ON "generationTags" USING btree ("generationId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generationTags_tagId_idx" ON "generationTags" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_userId_idx" ON "generations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_status_idx" ON "generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_createdAt_idx" ON "generations" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplaceListings_sellerId_idx" ON "marketplaceListings" USING btree ("sellerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplaceListings_status_idx" ON "marketplaceListings" USING btree ("listingStatus");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moderationQueue_status_idx" ON "moderationQueue" USING btree ("moderationStatus");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications" USING btree ("userId");--> statement-breakpoint
DO $$
BEGIN
  DELETE FROM "userFollows" uf
  WHERE uf."id" > (
    SELECT MIN(uf2."id") FROM "userFollows" uf2
    WHERE uf2."followerId" = uf."followerId" AND uf2."followingId" = uf."followingId"
  );
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "userFollows_followerId_followingId_unique" ON "userFollows" USING btree ("followerId","followingId");--> statement-breakpoint
DO $$
BEGIN
  DELETE FROM "userSubscriptions" us
  WHERE us."stripeSubscriptionId" IS NOT NULL
    AND us."id" > (
      SELECT MIN(us2."id") FROM "userSubscriptions" us2
      WHERE us2."stripeSubscriptionId" = us."stripeSubscriptionId"
    );
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "userSubscriptions_stripeSubscriptionId_unique" ON "userSubscriptions" USING btree ("stripeSubscriptionId");--> statement-breakpoint
DO $$
BEGIN
  DELETE FROM "users" u
  WHERE u."email" IS NOT NULL
    AND u."id" > (
      SELECT MIN(u2."id") FROM "users" u2
      WHERE u2."email" = u."email"
    );
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");
