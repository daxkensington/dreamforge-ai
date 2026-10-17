/** Account/content scrubbing commits atomically; financial receipts remain. */
import { eq, sql } from "drizzle-orm";
import { trainingDeletionQueries } from "../dbTraining";
import { getDb } from "../db";
import { users, generations, audioGenerations, creditBalances, sceneKeyframes, videoProjects } from "../../drizzle/schema";
import { cancelStripeSubscriptionsForCustomer } from "../stripe";
import { collectStorageKeys, mediaRevocationQueries, normalizeStorageKey, purgeRevokedMedia } from "./mediaLifecycle";

export async function deleteUserAccount(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");
  if (user.loginMethod === "deleted") {
    await purgeRevokedMedia(100, userId).catch(() => undefined);
    return;
  }
  const [balance] = await db.select({ stripeCustomerId: creditBalances.stripeCustomerId })
    .from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
  if (balance?.stripeCustomerId) {
    // Do not silently leave a deleted account billed. Scrubbing has not committed.
    await cancelStripeSubscriptionsForCustomer(balance.stripeCustomerId);
  }
  const [ownedGenerations, ownedAudio, ownedKeyframes] = await Promise.all([
    db.select({ imageUrl: generations.imageUrl, thumbnailUrl: generations.thumbnailUrl, fileKey: generations.fileKey })
      .from(generations).where(eq(generations.userId, userId)),
    db.select({ audioUrl: audioGenerations.audioUrl }).from(audioGenerations).where(eq(audioGenerations.userId, userId)),
    db.select({ imageUrl: sceneKeyframes.imageUrl }).from(sceneKeyframes)
      .innerJoin(videoProjects, eq(videoProjects.id, sceneKeyframes.projectId)).where(eq(videoProjects.userId, userId)),
  ]);
  const keys = collectStorageKeys([ownedGenerations, ownedAudio, ownedKeyframes]);
  for (const generation of ownedGenerations) {
    if (generation.fileKey) {
      try { keys.push(normalizeStorageKey(generation.fileKey)); } catch { /* Invalid legacy keys are not deletion targets. */ }
    }
  }
  // New objects are registered by owner. Backfill legacy generation outputs;
  // arbitrary project/reference URLs are not proof of legacy object ownership.
  const ownedProjects = sql`SELECT id FROM "videoProjects" WHERE "userId" = ${userId}`;
  const ownedGallery = sql`SELECT id FROM "galleryItems" WHERE "userId" = ${userId}`;
  const authIdentities = sql`SELECT id FROM auth_users WHERE email = ${user.email}`;
  const active = sql`EXISTS (SELECT 1 FROM users WHERE id = ${userId} AND "loginMethod" IS DISTINCT FROM 'deleted')`;
  const financialMetadata = [
    "trainingJobId", "generationRequestId", "requestId", "batchRequestId", "purchasedCreditsDebited", "purchasedCredits",
    "purchasedCreditsClawed", "purchasedCreditsRestored", "operationId", "operationKey",
    "stripeInvoiceId", "stripeSubscriptionId", "subscriptionItemId", "priceId", "periodStart", "periodEnd",
    "planId", "planName", "allowanceIndex", "allowanceStart", "paidPeriodEnd", "disputeId", "chargeId",
    "paymentIntentId", "originalPurchaseTransactionId", "restored", "refundAmount", "expectedClawedTotal",
    "disputedAmount", "btcpayInvoiceId",
  ];
  await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`),
    ...mediaRevocationQueries(db, keys, "account-deleted", userId),
    db.execute(sql`UPDATE "mediaAssets" SET "revokedAt" = COALESCE("revokedAt", now()), "deletedAt" = NULL,
      "deleteReason" = 'account-deleted' WHERE "ownerUserId" = ${userId}`),
    db.execute(sql`UPDATE "generationRequests" SET
      state = CASE WHEN state IN ('reserved', 'rendering') THEN 'reconciliation' ELSE state END,
      "errorCode" = CASE WHEN state IN ('reserved', 'rendering', 'reconciliation') THEN 'account-deleted' ELSE "errorCode" END,
      result = CASE WHEN result IS NULL THEN NULL ELSE '{"deleted":true}'::jsonb END, "updatedAt" = now()
      WHERE "userId" = ${userId} AND ${active}`),
    db.execute(sql`UPDATE "generationBatchRequests" SET
      state = CASE WHEN state IN ('reserved', 'submitting') THEN 'reconciliation' ELSE state END,
      "errorCode" = CASE WHEN state IN ('reserved', 'submitting', 'reconciliation') THEN 'account-deleted' ELSE "errorCode" END,
      result = CASE WHEN result IS NULL THEN NULL ELSE '{"deleted":true}'::jsonb END, "updatedAt" = now()
      WHERE "userId" = ${userId} AND ${active}`),
    ...trainingDeletionQueries(db, userId),
    db.execute(sql`DELETE FROM "mediaUploads" WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "galleryLikes" WHERE "userId" = ${userId} OR "galleryItemId" IN (${ownedGallery})`),
    db.execute(sql`DELETE FROM "galleryComments" WHERE "userId" = ${userId} OR "galleryItemId" IN (${ownedGallery})`),
    db.execute(sql`DELETE FROM "galleryItems" WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "moderationQueue" WHERE "userId" = ${userId}`),
    db.execute(sql`UPDATE generations SET prompt = '[deleted]', "negativePrompt" = NULL,
      "imageUrl" = NULL, "thumbnailUrl" = NULL, "fileKey" = NULL, metadata = '{"deleted":true}'::jsonb,
      "errorMessage" = NULL, status = CASE WHEN status IN ('pending', 'generating') THEN 'failed'::"generationStatus" ELSE status END,
      "updatedAt" = now() WHERE "userId" = ${userId} AND ${active}`),
    db.execute(sql`DELETE FROM "projectShareTokens" WHERE "projectId" IN (${ownedProjects}) OR "createdBy" = ${userId}`),
    db.execute(sql`DELETE FROM "projectRevisions" WHERE "projectId" IN (${ownedProjects}) OR "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "projectCollaborators" WHERE "projectId" IN (${ownedProjects}) OR "userId" = ${userId} OR "invitedBy" = ${userId}`),
    db.execute(sql`DELETE FROM "projectChatMessages" WHERE "projectId" IN (${ownedProjects}) OR "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "projectActivityLog" WHERE "projectId" IN (${ownedProjects}) OR "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "sceneKeyframes" WHERE "projectId" IN (${ownedProjects})`),
    db.execute(sql`DELETE FROM "audioGenerations" WHERE "userId" = ${userId}`),
    db.execute(sql`UPDATE "audioGenerations" SET "projectId" = NULL WHERE "projectId" IN (${ownedProjects})`),
    db.execute(sql`DELETE FROM "videoProjects" WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM characters WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "brandKits" WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "apiKeys" WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM notifications WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "notificationPreferences" WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "creditBudgets" WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM achievements WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM newsletter_signups WHERE email = ${user.email}`),
    db.execute(sql`DELETE FROM "marketplaceReviews" WHERE "buyerId" = ${userId}`),
    db.execute(sql`UPDATE "marketplaceListings" SET "listingStatus" = 'suspended', title = '[deleted]', description = NULL,
      "previewImages" = NULL, "promptData" = NULL, "listingTags" = NULL, "updatedAt" = now() WHERE "sellerId" = ${userId} AND ${active}`),
    db.execute(sql`UPDATE "sellerProfiles" SET "displayName" = 'Deleted user', bio = NULL, "avatarUrl" = NULL,
      "bannerUrl" = NULL, "isVerified" = false WHERE "userId" = ${userId} AND ${active}`),
    db.execute(sql`DELETE FROM analytics_events WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM "userFollows" WHERE "followerId" = ${userId} OR "followingId" = ${userId}`),
    db.execute(sql`UPDATE "creditBalances" SET balance = 0, "monthlyAllocation" = 0, "bonusCredits" = 0,
      "updatedAt" = now() WHERE "userId" = ${userId} AND ${active}`),
    db.execute(sql`UPDATE "creditTransactions" t SET description = 'Account deleted: retained financial receipt',
      "txMetadata" = (SELECT COALESCE(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
        FROM jsonb_each(CASE WHEN jsonb_typeof(t."txMetadata") = 'object' THEN t."txMetadata" ELSE '{}'::jsonb END) entry
        WHERE entry.key IN (${sql.join(financialMetadata.map(key => sql`${key}`), sql`, `)}))
      WHERE "userId" = ${userId}`),
    db.execute(sql`DELETE FROM verification_tokens WHERE identifier = ${user.email}`),
    db.execute(sql`DELETE FROM auth_sessions WHERE "userId" IN (${authIdentities})`),
    db.execute(sql`DELETE FROM auth_accounts WHERE "userId" IN (${authIdentities})`),
    db.execute(sql`DELETE FROM auth_users WHERE email = ${user.email}`),
    db.execute(sql`UPDATE users SET name = 'Deleted user', email = NULL, bio = NULL, institution = NULL,
      "openId" = ${`deleted:${userId}`}, "referralCode" = NULL, "loginMethod" = 'deleted',
      "uncensoredUntil" = NULL, "ageConfirmedAt" = NULL, "digestEnabled" = false,
      "emailDigestEnabled" = false, "updatedAt" = now() WHERE id = ${userId} AND "loginMethod" IS DISTINCT FROM 'deleted'`),
  ] as any);
  // Revocation already denies reads. Storage outages retry through the cron.
  await purgeRevokedMedia(100, userId).catch(() => undefined);
}
